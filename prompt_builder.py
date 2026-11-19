from schemas import HistoryEvidence, MediaAnalysis, MessageContext, PromptMetadata, PromptPackage
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
from jinja2 import Environment, FileSystemLoader, StrictUndefined
from jinja2.exceptions import TemplateNotFound, UndefinedError
from pydantic import BaseModel, Field

from csv_loader import csv_loader

# Configure module-level logger
logger = logging.getLogger(__name__)

# ==========================================
# EXCEPTIONS
# ==========================================

class PromptBuilderError(Exception):
    """Base exception for prompt construction failures."""
    pass

class TemplateMissingError(PromptBuilderError):
    """Raised when a requested Jinja2 template file cannot be found."""
    pass

class VariableMissingError(PromptBuilderError):
    """Raised when a Jinja2 template requires a variable that was not provided."""
    pass

# ==========================================
# PYDANTIC MODELS FOR PROMPT OUTPUT
# ==========================================

# ==========================================
# PROMPT BUILDER SERVICE
# ==========================================

class PromptBuilder:
    """
    Production-grade template engine for AI prompts.
    Completely decoupled from the LLM execution layer.
    
    Features:
    - Strict variable validation (fails fast if context is missing).
    - Dynamic template resolution (supports versioning and model-specific overrides).
    - Intelligent few-shot example selection using dataset joins.
    - Deterministic token estimation heuristics.
    """

    def __init__(self, prompts_dir: str = "prompts"):
        self.prompts_dir = Path(prompts_dir)
        self.prompts_dir.mkdir(parents=True, exist_ok=True)
        
        # StrictUndefined ensures that if a template references a variable (e.g., {{ user.name }})
        # that wasn't passed, it raises an exception instead of silently rendering empty text.
        self.jinja_env = Environment(
            loader=FileSystemLoader(str(self.prompts_dir)),
            undefined=StrictUndefined,
            trim_blocks=True,
            lstrip_blocks=True
        )

    def _estimate_tokens(self, text: str) -> int:
        """
        Fast offline heuristic for token estimation.
        Using a standard approximation of ~4 characters per token for English text.
        """
        if not text:
            return 0
        return max(1, len(text) // 4)

    def _resolve_template_name(self, base_name: str, version: str, model_target: str) -> str:
        """
        Implements a fallback resolution strategy for templates.
        Allows highly specialized prompts for specific models or versions,
        while falling back to defaults if the specialized ones don't exist.
        
        Order of precedence:
        1. {base_name}_{version}_{model_target}.jinja
        2. {base_name}_{version}.jinja
        3. {base_name}.jinja
        """
        candidates = [
            f"{base_name}_{version}_{model_target}.jinja",
            f"{base_name}_{version}.jinja",
            f"{base_name}.jinja"
        ]
        
        for candidate in candidates:
            try:
                # Trigger a load attempt. If it exists, return this candidate.
                self.jinja_env.get_template(candidate)
                return candidate
            except TemplateNotFound:
                continue
                
        raise TemplateMissingError(
            f"Could not resolve template for base '{base_name}'. "
            f"Attempted: {candidates}. Ensure files exist in {self.prompts_dir}."
        )

    def _render_safe(self, template_name: str, **kwargs: Any) -> str:
        """Renders the template and cleanly traps strict undefined errors."""
        try:
            template = self.jinja_env.get_template(template_name)
            return template.render(**kwargs)
        except UndefinedError as e:
            logger.error(f"Missing required context variable in {template_name}: {e}")
            raise VariableMissingError(f"Template {template_name} failed strict validation: {e}")
        except TemplateNotFound as e:
            logger.error(f"Template not found during rendering: {template_name}")
            raise TemplateMissingError(f"Template missing: {template_name}")

    def _get_dynamic_few_shot(self, context: MessageContext, limit: int = 4) -> List[Dict[str, Any]]:
        """
        Dynamically selects the best few-shot examples directly from sample_messages.csv,
        which already includes conversation_type, media_type, message_text, and ground-truth labels.
        """
        try:
            samples_df = csv_loader.get_sample_messages()
            if samples_df.empty:
                return []

            target_conv = context.message_metadata.conversation_type
            target_media = context.message_metadata.media_type

            def calculate_score(row: pd.Series) -> int:
                score = 0
                if str(row.get("conversation_type", "")) == target_conv:
                    score += 3
                row_media = str(row.get("media_type", "") or "text")
                if row_media == target_media:
                    score += 2
                if context.features.prompt_injection_suspected and "ignore all previous" in str(row.get("message_text", "")).lower():
                    score += 5
                return score

            scored_df = samples_df.copy()
            scored_df["relevance"] = scored_df.apply(calculate_score, axis=1)
            best_matches = scored_df.sort_values(by="relevance", ascending=False).head(limit)

            examples = []
            for _, row in best_matches.iterrows():
                examples.append({
                    "message_text": str(row.get("message_text", "") or "[media only]"),
                    "conversation_type": str(row.get("conversation_type", "")),
                    "media_type": str(row.get("media_type", "") or "text"),
                    "expected_action": str(row.get("action", "")),
                    "expected_message_type": str(row.get("message_type", "")),
                    "expected_reason": str(row.get("reason", "")),
                })
            return examples

        except Exception as e:
            logger.warning(f"Failed to retrieve dynamic few-shot examples: {e}")
            return []

    def build_router_prompt(
        self, 
        context: MessageContext, 
        history: HistoryEvidence, 
        media: Optional[MediaAnalysis] = None,
        version: str = "v1", 
        model_target: str = "flash"
    ) -> PromptPackage:
        """
        Builds the primary routing prompt package.
        Injects the complete 360-context, history evidence, and media analysis (if any),
        along with dynamically selected few-shot examples.
        """
        sys_template = self._resolve_template_name("router_system", version, model_target)
        usr_template = self._resolve_template_name("router_user", version, model_target)
        
        few_shots = self._get_dynamic_few_shot(context)
        
        template_kwargs = {
            "context": context.model_dump(),
            "history": history.model_dump(),
            "media": media.model_dump() if media and media.success else None,
            "few_shot_examples": few_shots
        }
        
        system_prompt = self._render_safe(sys_template, **template_kwargs)
        user_prompt = self._render_safe(usr_template, **template_kwargs)
        
        metadata = PromptMetadata(
            version=version,
            model_target=model_target,
            task_name="message_routing",
            few_shot_count=len(few_shots),
            includes_media=bool(media and media.success)
        )
        
        return PromptPackage(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            metadata=metadata,
            estimated_tokens=self._estimate_tokens(system_prompt + user_prompt)
        )

    def build_media_analysis_prompt(
        self, 
        media_type: str,
        schema_json: str,
        version: str = "v1", 
        model_target: str = "flash"
    ) -> PromptPackage:
        """
        Builds the multimodal extraction prompt for the media processor.
        Does not require full message context—only the schema constraints.
        """
        base_name = f"{media_type}_analysis_system" # e.g., image_analysis_system
        sys_template = self._resolve_template_name(base_name, version, model_target)
        
        system_prompt = self._render_safe(sys_template, schema_json=schema_json)
        
        metadata = PromptMetadata(
            version=version,
            model_target=model_target,
            task_name=f"{media_type}_analysis",
            includes_media=True
        )
        
        return PromptPackage(
            system_prompt=system_prompt,
            user_prompt="Analyze the attached media.", # Minimal user prompt, Gemini focuses on the system prompt + media
            metadata=metadata,
            estimated_tokens=self._estimate_tokens(system_prompt)
        )

    def build_reflection_prompt(
        self, 
        original_context: MessageContext,
        history: HistoryEvidence,
        initial_decision: Dict[str, Any],
        media: Optional[MediaAnalysis] = None,
        version: str = "v1", 
        model_target: str = "pro" # Defaulting reflection to Pro for deeper reasoning
    ) -> PromptPackage:
        """
        Builds the prompt for the Reflection/Self-Correction agent.
        Feeds the initial decision back to the LLM to critique and refine.
        """
        sys_template = self._resolve_template_name("reflection_system", version, model_target)
        usr_template = self._resolve_template_name("reflection_user", version, model_target)
        
        template_kwargs = {
            "context": original_context.model_dump(),
            "history": history.model_dump(),
            "initial_decision": initial_decision,
            "media": media.model_dump() if media and media.success else None
        }
        
        system_prompt = self._render_safe(sys_template, **template_kwargs)
        user_prompt = self._render_safe(usr_template, **template_kwargs)
        
        metadata = PromptMetadata(
            version=version,
            model_target=model_target,
            task_name="decision_reflection"
        )
        
        return PromptPackage(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            metadata=metadata,
            estimated_tokens=self._estimate_tokens(system_prompt + user_prompt)
        )

    def build_confidence_calibration_prompt(
        self, 
        final_decision: Dict[str, Any],
        context: MessageContext,
        history: HistoryEvidence,
        reflection_result: Dict[str, Any],
        version: str = "v1", 
        model_target: str = "flash"
    ) -> PromptPackage:
        """
        Builds the prompt for the Confidence Calibration agent.
        Normalizes the confidence score based on the clarity of the evidence.
        """
        sys_template = self._resolve_template_name("calibration_system", version, model_target)
        usr_template = self._resolve_template_name("calibration_user", version, model_target)
        
        template_kwargs = {
            "routing_decision": final_decision,
            "context": context.model_dump(),
            "history": history.model_dump(),
            "reflection_result": reflection_result
        }
        
        system_prompt = self._render_safe(sys_template, **template_kwargs)
        user_prompt = self._render_safe(usr_template, **template_kwargs)
        
        metadata = PromptMetadata(
            version=version,
            model_target=model_target,
            task_name="confidence_calibration"
        )
        
        return PromptPackage(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            metadata=metadata,
            estimated_tokens=self._estimate_tokens(system_prompt + user_prompt)
        )

# Export a single instance
prompt_builder = PromptBuilder()
