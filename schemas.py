from typing import Optional, List, Dict, Any, TypeVar, Generic
from pydantic import BaseModel, Field, field_validator
from constants import Action, MessageType

T = TypeVar("T")

class UserProfile(BaseModel):
    user_id: str
    quiet_hours: bool = False
    daily_notification_load: int = 0
    recent_opens: int = 0
    recent_replies: int = 0
    dismiss_count: int = 0
    report_count: int = 0
    notification_fatigue_score: float = 0.0

class GroupContext(BaseModel):
    group_type: str = "unknown"
    group_size: int = 0
    sender_role: str = "member"
    is_admin: bool = False
    is_muted: bool = False
    activity_level: str = "medium"
    reply_rate: float = 0.0

class BusinessContext(BaseModel):
    is_verified: bool = False
    is_trusted: bool = False
    previous_orders: int = 0
    payments_made: int = 0
    has_opted_in: bool = False
    has_opted_out: bool = False
    account_age_days: int = 0
    report_count: int = 0

class MessageMetadata(BaseModel):
    conversation_type: str
    forwarded_count: int = 0
    timestamp: str
    media_type: str
    sender_id: str

class HistoryContext(BaseModel):
    last_similar_messages: List[str] = Field(default_factory=list)
    last_messages_from_sender: List[str] = Field(default_factory=list)
    opened_count: int = 0
    ignored_count: int = 0
    muted_count: int = 0
    reported_count: int = 0

class MediaContext(BaseModel):
    has_media: bool = False
    media_type: Optional[str] = None
    file_path: Optional[str] = None

class DerivedFeatures(BaseModel):
    trust_score: float = 0.0
    urgency_score: float = 0.0
    engagement_score: float = 0.0
    spam_probability: float = 0.0
    notification_priority: float = 0.0

class MessageContext(BaseModel):
    """
    The master context object. This is serialized to JSON and fed directly 
    into the Gemini model's prompt to provide a 360-degree view of the message.
    """
    message_id: str
    text_content: Optional[str] = None
    user: UserProfile
    group: Optional[GroupContext] = None
    business: Optional[BusinessContext] = None
    message_metadata: MessageMetadata
    history: HistoryContext
    media: MediaContext
    features: DerivedFeatures

class EngagementSummary(BaseModel):
    """Summarizes user engagement events across a set of historical messages."""
    opened: int = 0
    dismissed: int = 0
    muted: int = 0
    replied: int = 0
    reported: int = 0

class HistoryEvidence(BaseModel):
    """
    Standardized evidence object representing historical context for an incoming message.
    Returned by the retriever and fed into the ContextBuilder or LLM prompt.
    """
    evidence_message_ids: List[str] = Field(default_factory=list)
    evidence_summary: str = ""
    engagement_summary: EngagementSummary

class ImageAnalysis(BaseModel):
    """Structured extraction of features from an image message."""
    ocr_text: str = Field(default="", description="Exact text extracted from the image via OCR.")
    summary: str = Field(default="", description="A brief visual description of the image.")
    document_type: str = Field(default="unknown", description="e.g., 'poster', 'receipt', 'screenshot', 'meme', 'photo'")
    scam_indicators: List[str] = Field(default_factory=list, description="Any visual signs of scams or phishing.")
    promotion_indicators: List[str] = Field(default_factory=list, description="Signs of sales, discounts, or marketing.")
    event_indicators: List[str] = Field(default_factory=list, description="Dates, times, or invitations to events.")
    payment_indicators: List[str] = Field(default_factory=list, description="Bank details, QR codes for payment, amounts.")
    urgency_indicators: List[str] = Field(default_factory=list, description="Text like 'urgent', 'act now', 'expires soon'.")

class VoiceAnalysis(BaseModel):
    """Structured extraction of features from a voice note."""
    transcript: str = Field(default="", description="The exact spoken text transcribed from the audio.")
    summary: str = Field(default="", description="A brief summary of the audio's intent.")
    tone: str = Field(default="neutral", description="The speaker's tone, e.g., 'angry', 'calm', 'professional', 'casual'.")
    urgency: str = Field(default="low", description="The perceived urgency of the voice note ('high', 'medium', 'low').")
    emotion: str = Field(default="neutral", description="The speaker's core emotion.")
    scam_indicators: List[str] = Field(default_factory=list, description="Any spoken signs of scams, threats, or phishing.")
    important_entities: List[str] = Field(default_factory=list, description="Names, dates, locations, or amounts mentioned.")

class MediaAnalysis(BaseModel):
    """
    Standardized wrapper for multimodal analysis results.
    Includes robust error handling flags so the pipeline can degrade gracefully.
    """
    success: bool = True
    error_message: Optional[str] = None
    media_type: str
    image_analysis: Optional[ImageAnalysis] = None
    voice_analysis: Optional[VoiceAnalysis] = None

class PromptMetadata(BaseModel):
    """Tracks lineage and configuration of the generated prompt."""
    version: str
    model_target: str
    task_name: str
    few_shot_count: int = 0
    includes_media: bool = False

class PromptPackage(BaseModel):
    """
    Standardized payload containing the fully rendered prompts and metadata.
    Ready to be dispatched to the Gemini Client.
    """
    system_prompt: str
    user_prompt: str
    metadata: PromptMetadata
    estimated_tokens: int = 0

class RoutingDecision(BaseModel):
    """
    Strictly defined output schema for the final routing decision.
    Matches the exact hackathon submission requirements.
    """
    action: Action = Field(
        ..., 
        description="The final routing action: 'notify', 'digest', or 'mute'."
    )
    message_type: MessageType = Field(
        ..., 
        description="The best-fit message category (e.g., 'personal', 'spam', 'promotion')."
    )
    reason: str = Field(
        ..., 
        description="Short, human-readable explanation for the routing decision."
    )
    confidence: float = Field(
        ..., 
        ge=0.0, 
        le=1.0, 
        description="Confidence score from 0.0 to 1.0."
    )
    evidence_message_ids: str = Field(
        ..., 
        description="Semicolon-separated historical message IDs used as evidence. Write 'none' if no useful history exists."
    )

    @field_validator('confidence')
    def round_confidence(cls, v):
        """Ensures the confidence score is cleanly rounded."""
        return round(v, 2)

class CalibratedDecision(BaseModel):
    """
    Final decision output after deterministic confidence calibration.
    Mirrors the RoutingDecision schema but represents the ground-truth 
    validated state ready for final execution.
    """
    action: Action = Field(..., description="The final routing action: 'notify', 'digest', or 'mute'.")
    message_type: MessageType = Field(..., description="The best-fit message category.")
    reason: str = Field(..., description="Human-readable explanation, potentially appended with calibration notes.")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Deterministically calibrated confidence score.")
    evidence_message_ids: str = Field(..., description="Semicolon-separated historical message IDs used as evidence.")

    @field_validator('confidence')
    def round_confidence(cls, v):
        """Ensures the confidence score is cleanly rounded to 2 decimal places."""
        return round(v, 2)


class UsageMetadata(BaseModel):
    """Encapsulates token usage statistics for the API call."""
    prompt_token_count: Optional[int] = None
    candidates_token_count: Optional[int] = None
    total_token_count: Optional[int] = None

class GeminiResponse(BaseModel, Generic[T]):
    """
    Standardized, production-ready response object for all AI calls.
    Provides metadata, latency, and strongly-typed content to the consumer.
    """
    content: T
    model_used: str
    latency_ms: float
    success: bool
    usage: Optional[UsageMetadata] = None
