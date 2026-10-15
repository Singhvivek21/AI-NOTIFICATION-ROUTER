from schemas import UsageMetadata, GeminiResponse
import asyncio
import logging
import time
from pathlib import Path
from typing import Any, Dict, Generic, List, Optional, Type, TypeVar, Union

from google import genai
from google.genai import types
from google.genai.errors import APIError
from pydantic import BaseModel, ValidationError
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from config import settings
from constants import Defaults

# Configure module-level logger
logger = logging.getLogger(__name__)

# Type variable for generics (can represent raw strings or Pydantic models)
T = TypeVar("T")

class CircuitBreakerTrippedError(Exception):
    """Raised when the circuit breaker trips due to consecutive API errors."""
    pass

class GeminiClientError(Exception):
    """Custom exception for wrapping Gemini-specific operational errors."""
    pass

class GeminiClient:
    """
    A robust, asynchronous, and production-ready wrapper for the Google GenAI SDK.
    Designed to be completely stateless and reusable across different AI agents.
    Features include: automatic model fallback, structured logging, latency tracking, 
    and strongly-typed responses.
    """

    def __init__(self):
        # Initialize the official GenAI client using the secure API key from settings
        self.client = genai.Client(api_key=settings.gemini_api_key)
        self.flash_model = settings.gemini_flash_model
        self.pro_model = settings.gemini_pro_model
        self._consecutive_errors = 0
        self._circuit_breaker_tripped = False

    async def _execute_with_fallback(
        self,
        contents: Any,
        config_args: Dict[str, Any],
        model_name: Optional[str] = None,
        response_schema: Optional[Type[BaseModel]] = None,
    ) -> GeminiResponse[Any]:
        """
        Core execution engine handling the fallback logic, retries, latency 
        measurement, structured logging, and unified response formatting.
        """
        if self._circuit_breaker_tripped:
            raise CircuitBreakerTrippedError("Circuit breaker is currently tripped. Rejecting request.")

        # Determine the fallback chain. Use specific model if requested, else try Flash -> Pro.
        models_to_try = [model_name or self.flash_model]
        if not model_name and self.flash_model != self.pro_model:
            models_to_try.append(self.pro_model)

        last_exception = None

        for model in models_to_try:
            try:
                # AsyncRetrying provides deep control over the retry loop, allowing 
                # us to track exact attempt numbers and measure per-attempt latency.
                async for attempt in AsyncRetrying(
                    stop=stop_after_attempt(Defaults.MAX_RETRY_COUNT),
                    wait=wait_exponential(multiplier=1, min=2, max=10),
                    retry=retry_if_exception_type((APIError, ValidationError, GeminiClientError)),
                    reraise=True,
                ):
                    with attempt:
                        attempt_number = attempt.retry_state.attempt_number
                        start_time = time.perf_counter()
                        
                        try:
                            config = types.GenerateContentConfig(**config_args)
                            response = await self.client.aio.models.generate_content(
                                model=model,
                                contents=contents,
                                config=config,
                            )

                            latency_ms = (time.perf_counter() - start_time) * 1000

                            # Parse usage metadata
                            usage = None
                            if hasattr(response, "usage_metadata") and response.usage_metadata:
                                usage = UsageMetadata(
                                    prompt_token_count=response.usage_metadata.prompt_token_count,
                                    candidates_token_count=response.usage_metadata.candidates_token_count,
                                    total_token_count=response.usage_metadata.total_token_count,
                                )

                            # Handle strongly-typed JSON vs raw text
                            if response_schema:
                                if hasattr(response, "parsed") and response.parsed is not None:
                                    content = response.parsed
                                elif not response.text:
                                    raise GeminiClientError("Received empty response text for JSON parsing.")
                                else:
                                    content = response_schema.model_validate_json(response.text)
                            else:
                                if not response.text:
                                    raise GeminiClientError("Received an empty response from Gemini API.")
                                content = response.text

                            logger.info(
                                f"Gemini API Success | Model: {model} | Latency: {latency_ms:.2f}ms | "
                                f"Attempt: {attempt_number}/{Defaults.MAX_RETRY_COUNT}"
                            )
                            
                            self._consecutive_errors = 0
                            return GeminiResponse(
                                content=content,
                                model_used=model,
                                latency_ms=latency_ms,
                                success=True,
                                usage=usage
                            )

                        except Exception as e:
                            latency_ms = (time.perf_counter() - start_time) * 1000
                            logger.warning(
                                f"Gemini API Failure | Model: {model} | Latency: {latency_ms:.2f}ms | "
                                f"Attempt: {attempt_number}/{Defaults.MAX_RETRY_COUNT} | Error: {type(e).__name__} - {str(e)}"
                            )
                            
                            # Circuit breaker tracking
                            error_str = str(e).lower()
                            is_critical = False
                            if isinstance(e, APIError):
                                if getattr(e, 'code', None) in (429, 500) or "quota" in error_str:
                                    is_critical = True
                            elif "429" in error_str or "500" in error_str or "quota" in error_str:
                                is_critical = True
                            
                            if is_critical:
                                self._consecutive_errors += 1
                                if self._consecutive_errors >= 5:
                                    self._circuit_breaker_tripped = True
                                    logger.critical("Circuit breaker tripped! 5 consecutive critical API errors.")
                                    raise CircuitBreakerTrippedError("Circuit breaker tripped after 5 consecutive critical errors.") from e
                            else:
                                self._consecutive_errors = 0
                                
                            raise e

            except CircuitBreakerTrippedError:
                raise
            except Exception as e:
                last_exception = e

                # If the primary model fails after all retries and we have a fallback, log and continue
                if model == models_to_try[0] and len(models_to_try) > 1:
                    logger.warning(
                        f"All retries exhausted for primary model {model}. "
                        f"Initiating automatic fallback to {models_to_try[1]}..."
                    )
                else:
                    logger.error(f"All retries exhausted for all models. Final error: {type(e).__name__} - {str(e)}")
                    raise

        # Fallback safeguard
        raise last_exception or GeminiClientError("Unknown execution failure within model chain.")

    async def generate_text(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        model_name: Optional[str] = None,
        temperature: float = 0.2,
        max_output_tokens: Optional[int] = None,
    ) -> GeminiResponse[str]:
        """Generates raw text response for standard LLM queries."""
        config_args: Dict[str, Any] = {"temperature": temperature}
        if system_instruction:
            config_args["system_instruction"] = system_instruction
        if max_output_tokens:
            config_args["max_output_tokens"] = max_output_tokens

        return await self._execute_with_fallback(
            contents=prompt,
            config_args=config_args,
            model_name=model_name
        )

    async def generate_json(
        self,
        prompt: str,
        response_schema: Type[BaseModel],
        system_instruction: Optional[str] = None,
        model_name: Optional[str] = None,
        temperature: float = 0.1,
    ) -> GeminiResponse[Any]:
        """
        Forces the LLM to output valid JSON conforming strictly to a Pydantic schema.
        Returns a clean GeminiResponse with an instantiated Pydantic object as its content.
        """
        config_args: Dict[str, Any] = {
            "temperature": temperature,
            "response_mime_type": "application/json",
            "response_schema": response_schema,
        }
        if system_instruction:
            config_args["system_instruction"] = system_instruction

        return await self._execute_with_fallback(
            contents=prompt,
            config_args=config_args,
            model_name=model_name,
            response_schema=response_schema
        )

    async def analyze_image(
        self,
        image_path: Union[str, Path],
        prompt: str,
        system_instruction: Optional[str] = None,
        model_name: Optional[str] = None,
        temperature: float = 0.2,
    ) -> GeminiResponse[str]:
        """Analyzes an image file alongside a text prompt."""
        return await self._analyze_media(image_path, prompt, system_instruction, model_name, temperature)

    async def analyze_audio(
        self,
        audio_path: Union[str, Path],
        prompt: str,
        system_instruction: Optional[str] = None,
        model_name: Optional[str] = None,
        temperature: float = 0.2,
    ) -> GeminiResponse[str]:
        """Analyzes an audio file alongside a text prompt."""
        return await self._analyze_media(audio_path, prompt, system_instruction, model_name, temperature)

    async def _analyze_media(
        self,
        file_path: Union[str, Path],
        prompt: str,
        system_instruction: Optional[str] = None,
        model_name: Optional[str] = None,
        temperature: float = 0.2,
    ) -> GeminiResponse[str]:
        """Internal shared logic for handling multimodal files securely."""
        config_args: Dict[str, Any] = {"temperature": temperature}
        if system_instruction:
            config_args["system_instruction"] = system_instruction

        uploaded_file = None
        try:
            # File uploads block the event loop, wrap in to_thread to keep async healthy
            uploaded_file = await asyncio.to_thread(
                self.client.files.upload, file=str(file_path)
            )

            return await self._execute_with_fallback(
                contents=[uploaded_file, prompt],
                config_args=config_args,
                model_name=model_name
            )
            
        except Exception as e:
            logger.error(f"Error during media upload or analysis: {e}")
            raise
        finally:
            # Prevent quota bloat by rigorously deleting processed media
            if uploaded_file:
                try:
                    await asyncio.to_thread(self.client.files.delete, name=uploaded_file.name)
                except Exception as cleanup_error:
                    logger.warning(f"Failed to delete remote file {uploaded_file.name}: {cleanup_error}")

    async def health_check(self) -> bool:
        """
        Validates API keys and network connectivity.
        Useful for app startup routines and readiness probes.
        """
        try:
            res = await self.generate_text("Reply with exactly 'OK'", max_output_tokens=5)
            return res.success and "OK" in res.content.upper()
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return False
