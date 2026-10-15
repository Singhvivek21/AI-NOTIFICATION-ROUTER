from schemas import CalibratedDecision
import asyncio
import logging
import sys
from pathlib import Path
from typing import List, Tuple

import pandas as pd
from tqdm import tqdm

from confidence_calibrator import ConfidenceCalibrator
from constants import MediaType
from context_builder import ContextBuilder
from csv_loader import csv_loader
from gemini_client import GeminiClient, CircuitBreakerTrippedError
from history_retriever import HistoryRetriever
from media_processor import MediaProcessor
from output_generator import OutputGenerator
from prompt_builder import PromptBuilder
from reflection_agent import ReflectionAgent
from router_agent import RouterAgent

# Configure application-level logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("pipeline.log", mode="a")
    ]
)
logger = logging.getLogger(__name__)

class MessagePipeline:
    """
    Orchestrates the lifecycle of a single message through all AI and deterministic components.
    Uses strict Dependency Injection for testability and modularity.
    """

    def __init__(
        self,
        context_builder: ContextBuilder,
        history_retriever: HistoryRetriever,
        media_processor: MediaProcessor,
        router_agent: RouterAgent,
        reflection_agent: ReflectionAgent,
        confidence_calibrator: ConfidenceCalibrator
    ):
        self.context_builder = context_builder
        self.history_retriever = history_retriever
        self.media_processor = media_processor
        self.router_agent = router_agent
        self.reflection_agent = reflection_agent
        self.confidence_calibrator = confidence_calibrator

    async def process_message(self, message_id: str, msg_row: pd.Series) -> CalibratedDecision:
        """
        Executes the full AI routing pipeline for a single message.
        """
        logger.debug(f"Starting pipeline for message_id: {message_id}")
        
        # 1. Build Context
        context = self.context_builder.build_context(message_id)
        user_id = str(msg_row.get('user_id', ''))
        
        # 2. Retrieve History Evidence
        history = self.history_retriever.retrieve_evidence(user_id, msg_row)
        
        # 3. Process Media (Multimodal Extraction)
        media_analysis = None
        if context.media.has_media and context.media.file_path:
            file_path = Path(context.media.file_path)
            if context.media.media_type == MediaType.IMAGE.value:
                media_analysis = await self.media_processor.process_image(file_path)
            elif context.media.media_type == MediaType.VOICE.value:
                media_analysis = await self.media_processor.process_voice(file_path)
                
        # 4. Primary Routing Decision
        initial_decision = await self.router_agent.route_message(context, history, media_analysis)
        
        # 5. Reflection & Self-Correction (Escalation)
        reflected_decision = await self.reflection_agent.review_decision(
            initial_decision=initial_decision,
            context=context,
            history=history,
            media=media_analysis,
            use_pro_model=True
        )
        
        # 6. Deterministic Confidence Calibration
        calibrated_decision = self.confidence_calibrator.calibrate(
            initial_decision=initial_decision,
            reflected_decision=reflected_decision,
            context=context,
            history=history,
            media=media_analysis
        )
        
        return calibrated_decision


async def main():
    """
    Main execution loop.
    Handles data loading, batching, concurrency limits, and output generation.
    Supports resuming from a previously interrupted run.
    """
    logger.info("Initializing Message Routing Pipeline...")

    # Load all datasets into memory
    try:
        csv_loader.load_all()
    except Exception as e:
        logger.critical(f"Failed to load core datasets. Aborting. Error: {e}")
        return

    messages_df = csv_loader.get_messages()
    output_path = Path("output.csv")
    out_gen = OutputGenerator(output_path)

    # Resume capability: Read existing output.csv to skip already processed messages
    processed_ids = set()
    if output_path.exists():
        try:
            existing_df = pd.read_csv(output_path)
            if 'message_id' in existing_df.columns:
                processed_ids = set(existing_df['message_id'].astype(str))
                # Load existing results into the output generator to prevent overwriting
                out_gen.results = existing_df.to_dict(orient="records")
                logger.info(f"Resume state: Found {len(processed_ids)} already processed messages.")
        except Exception as e:
            logger.warning(f"Could not read existing output.csv. Starting fresh. Reason: {e}")

    # Filter messages to only those pending
    pending_messages: List[Tuple[str, pd.Series]] = []
    for _, row in messages_df.iterrows():
        msg_id = str(row['message_id'])
        if msg_id not in processed_ids:
            pending_messages.append((msg_id, row))

    if not pending_messages:
        logger.info("All messages have been successfully processed. Nothing to do.")
        return

    logger.info(f"Starting batch processing for {len(pending_messages)} pending messages.")

    # Initialize dependencies (DI Container)
    gemini_client = GeminiClient()
    prompt_builder = PromptBuilder()
    context_builder = ContextBuilder()
    history_retriever = HistoryRetriever()
    media_processor = MediaProcessor(gemini_client=gemini_client)
    router_agent = RouterAgent(gemini_client=gemini_client, prompt_builder=prompt_builder)
    reflection_agent = ReflectionAgent(gemini_client=gemini_client, prompt_builder=prompt_builder)
    confidence_calibrator = ConfidenceCalibrator()

    pipeline = MessagePipeline(
        context_builder=context_builder,
        history_retriever=history_retriever,
        media_processor=media_processor,
        router_agent=router_agent,
        reflection_agent=reflection_agent,
        confidence_calibrator=confidence_calibrator
    )

    # Concurrency control to prevent hitting rate limits
    MAX_CONCURRENT_REQUESTS = 10
    
    queue: asyncio.Queue = asyncio.Queue()
    for msg_id, msg_row in pending_messages:
        queue.put_nowait((msg_id, msg_row))
        
    pbar = tqdm(total=len(pending_messages), desc="Routing Messages", unit="msg")

    async def worker():
        """Worker task that consumes from the queue and processes a single message."""
        while True:
            try:
                msg_id, msg_row = queue.get_nowait()
            except asyncio.QueueEmpty:
                break
                
            try:
                decision = await pipeline.process_message(msg_id, msg_row)
                out_gen.add_result(msg_id, decision)
            except CircuitBreakerTrippedError as e:
                logger.critical(f"Circuit Breaker Tripped! Stopping processing gracefully. Error: {e}")
                # Clear queue to stop other workers
                while not queue.empty():
                    queue.get_nowait()
                    queue.task_done()
                break
            except Exception as e:
                logger.error(f"Failed to process message_id {msg_id}: {e}", exc_info=True)
            finally:
                pbar.update(1)
                queue.task_done()

    # Launch batch execution using fixed number of workers
    workers = [asyncio.create_task(worker()) for _ in range(MAX_CONCURRENT_REQUESTS)]
    await asyncio.gather(*workers)
    
    pbar.close()

    # Generate final validated output CSV
    try:
        out_gen.generate_csv()
        logger.info("Pipeline execution completed successfully.")
    except Exception as e:
        logger.critical(f"Pipeline finished, but failed to write final output.csv: {e}")

if __name__ == "__main__":
    # Suppress verbose httpx/httpcore logs
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    
    # Run the asyncio event loop
    asyncio.run(main())
