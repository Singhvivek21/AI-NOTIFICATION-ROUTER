from schemas import HistoryEvidence, MediaAnalysis, MessageContext, RoutingDecision
import logging
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field, field_validator

from config import settings
from constants import Action, MessageType
from gemini_client import GeminiClient, GeminiClientError
from prompt_builder import PromptBuilder

# Configure module-level logger
logger = logging.getLogger(__name__)

# ==========================================
# PYDANTIC MODELS FOR STRUCTURED OUTPUT
# ==========================================

# ==========================================
# ROUTER AGENT SERVICE
# ==========================================

class RouterAgent:
    """
    The core AI decision engine. 
    Responsible only for generating the initial primary routing decision (using Gemini Flash).
    
    Completely isolated from data loading and prompt construction logic.
    Utilizes dependency injection for client and prompt builder.
    """

    def __init__(self, gemini_client: GeminiClient, prompt_builder: PromptBuilder):
        self.client = gemini_client
        self.prompt_builder = prompt_builder

    async def route_message(
        self, 
        context: MessageContext, 
        history: HistoryEvidence, 
        media: Optional[MediaAnalysis] = None
    ) -> RoutingDecision:
        """
        Main entry point for deciding a message's fate.
        Executes the primary routing attempt.
        """
        logger.info(f"Initiating primary routing decision for message_id: {context.message_id}")

        try:
            # Step 1: Fast initial routing using Flash
            decision = await self._primary_routing(context, history, media)
            logger.info(f"Primary routing complete. Action: {decision.action}, Confidence: {decision.confidence}")
            return decision

        except Exception as e:
            logger.error(f"Critical failure during routing for {context.message_id}: {e}")
            # Fallback failsafe decision to ensure the pipeline never breaks
            return self._generate_failsafe_decision(context, history)

    async def _primary_routing(
        self, 
        context: MessageContext, 
        history: HistoryEvidence, 
        media: Optional[MediaAnalysis]
    ) -> RoutingDecision:
        """Executes the initial routing attempt using the faster, cheaper model."""
        prompt_pkg = self.prompt_builder.build_router_prompt(
            context=context,
            history=history,
            media=media,
            model_target="flash"
        )

        response = await self.client.generate_json(
            prompt=prompt_pkg.user_prompt,
            response_schema=RoutingDecision,
            system_instruction=prompt_pkg.system_prompt,
            model_name=settings.gemini_flash_model,
            temperature=0.1
        )
        return response.content

    def _generate_failsafe_decision(self, context: MessageContext, history: HistoryEvidence) -> RoutingDecision:
        """
        Provides a deterministic fallback if the AI pipeline catastrophically fails.
        Ensures the system always returns a valid output.
        """
        logger.warning(f"Generating failsafe routing decision for {context.message_id}")
        
        # Simple heuristic fallback
        evidence = "none"
        if history.evidence_message_ids:
            evidence = ";".join(history.evidence_message_ids)

        return RoutingDecision(
            action=Action.DIGEST, # Safe middle-ground
            message_type=MessageType.UNKNOWN,
            reason="Fallback triggered due to internal processing error. Defaulting to digest.",
            confidence=0.1,
            evidence_message_ids=evidence
        )
