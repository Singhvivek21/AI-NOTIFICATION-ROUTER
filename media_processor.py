from schemas import ImageAnalysis, MediaAnalysis, VoiceAnalysis
import asyncio
import json
import logging
import re
from pathlib import Path
from typing import Dict, List, Optional, Type

from jinja2 import Environment, FileSystemLoader, TemplateNotFound
from pydantic import BaseModel, Field, ValidationError

from config import settings
from constants import MediaType
from gemini_client import GeminiClient, GeminiClientError

# Configure module-level logger
logger = logging.getLogger(__name__)

# ==========================================
# PYDANTIC MODELS FOR STRUCTURED ANALYSIS
# ==========================================

# ==========================================
# MEDIA PROCESSOR SERVICE
# ==========================================

class MediaProcessor:
    """
    Production-grade multimodal processor.
    Responsible exclusively for extracting structured insights from media files.
    Features:
    - Pure analysis (NO routing logic).
    - Caching for repeated media (saves API costs and time).
    - Graceful fallback on failure.
    - Template-driven prompts using Jinja2.
    """

    def __init__(self, gemini_client: GeminiClient):
        self.client = gemini_client
        
        # In-memory cache keyed by absolute file path
        # Prevents redundant API calls if the same image is forwarded multiple times
        self._cache: Dict[str, MediaAnalysis] = {}
        
        # Setup Jinja2 environment for external prompt management
        self.prompts_dir = Path("prompts")
        self.prompts_dir.mkdir(exist_ok=True)
        self.jinja_env = Environment(loader=FileSystemLoader(str(self.prompts_dir)))

    def _render_prompt(self, template_name: str, schema: Type[BaseModel]) -> str:
        """
        Renders the prompt from a Jinja2 template.
        Injects the expected JSON schema dynamically so the LLM strictly conforms.
        """
        # Expose the Pydantic schema as a formatted string to enforce structure
        schema_json = json.dumps(schema.model_json_schema(), indent=2)
        
        try:
            template = self.jinja_env.get_template(template_name)
            return template.render(schema=schema_json)
        except TemplateNotFound:
            logger.warning(f"Template '{template_name}' not found. Using safe fallback prompt.")
            return self._fallback_prompt(schema_json, template_name)

    def _fallback_prompt(self, schema_json: str, template_name: str) -> str:
        """Failsafe prompt generation if the template files haven't been created yet."""
        media_type = "image" if "image" in template_name else "voice note"
        return (
            f"You are a strict multimodal extraction system. Analyze the provided {media_type}.\n\n"
            f"Extract all requested metadata and return ONLY valid JSON matching this exact schema:\n"
            f"```json\n{schema_json}\n```\n\n"
            f"Do not include any markdown, formatting, or conversational text outside the JSON block."
        )

    def _parse_json_response(self, text: str, schema: Type[BaseModel]) -> BaseModel:
        """
        Extracts and validates JSON from the LLM's raw response string.
        Strips markdown code blocks if the model includes them accidentally.
        """
        match = re.search(r'```(?:json)?\s*(.*?)\s*```', text, re.DOTALL)
        clean_text = match.group(1) if match else text
        
        try:
            return schema.model_validate_json(clean_text)
        except ValidationError as e:
            logger.error(f"Failed to validate media extraction schema: {e}")
            raise

    async def process_image(self, image_path: Path) -> MediaAnalysis:
        """Analyzes an image and extracts structured OCR and visual metadata."""
        path_str = str(image_path)
        if path_str in self._cache:
            logger.debug(f"Media cache hit for image: {path_str}")
            return self._cache[path_str]

        logger.info(f"Processing image: {path_str}")
        prompt = self._render_prompt("image_analysis.jinja", ImageAnalysis)

        try:
            # The client automatically handles Flash -> Pro fallback via its internal retry policy
            response = await self.client.analyze_image(
                image_path=image_path,
                prompt=prompt,
                temperature=0.1 # Low temperature for highly deterministic extraction
            )
            
            image_analysis = self._parse_json_response(response.content, ImageAnalysis)
            
            result = MediaAnalysis(
                media_type=MediaType.IMAGE.value,
                image_analysis=image_analysis
            )
            self._cache[path_str] = result
            return result

        except Exception as e:
            logger.error(f"Image analysis failed for {path_str}: {e}")
            return MediaAnalysis(
                success=False,
                error_message=str(e),
                media_type=MediaType.IMAGE.value
            )

    async def process_voice(self, audio_path: Path) -> MediaAnalysis:
        """Analyzes a voice note and extracts a transcript, tone, and entities."""
        path_str = str(audio_path)
        if path_str in self._cache:
            logger.debug(f"Media cache hit for voice: {path_str}")
            return self._cache[path_str]

        logger.info(f"Processing voice note: {path_str}")
        prompt = self._render_prompt("voice_analysis.jinja", VoiceAnalysis)

        try:
            # The client automatically handles Flash -> Pro fallback via its internal retry policy
            response = await self.client.analyze_audio(
                audio_path=audio_path,
                prompt=prompt,
                temperature=0.1 # Low temperature for highly deterministic transcription
            )
            
            voice_analysis = self._parse_json_response(response.content, VoiceAnalysis)
            
            result = MediaAnalysis(
                media_type=MediaType.VOICE.value,
                voice_analysis=voice_analysis
            )
            self._cache[path_str] = result
            return result

        except Exception as e:
            logger.error(f"Voice analysis failed for {path_str}: {e}")
            return MediaAnalysis(
                success=False,
                error_message=str(e),
                media_type=MediaType.VOICE.value
            )

# Create a singleton instance to ensure the cache is shared across the application
# Note: In a true DI framework, you'd pass the existing GeminiClient instance here.
gemini_client_instance = GeminiClient()
media_processor = MediaProcessor(gemini_client=gemini_client_instance)
