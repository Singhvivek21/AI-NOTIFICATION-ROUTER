from typing import Optional, List, TypeVar, Generic
from pydantic import BaseModel, Field, field_validator
from constants import Action, MessageType

T = TypeVar("T")


class UserProfile(BaseModel):
    user_id: str
    do_not_disturb_window: str = ""
    quiet_hours: bool = False
    daily_notification_load: float = 0.0
    avg_daily_dismissed: float = 0.0
    dismissal_rate: float = 0.0
    recent_opens: int = 0
    recent_replies: int = 0
    dismiss_count: int = 0
    report_count: int = 0
    notification_fatigue_score: float = 0.0


class GroupContext(BaseModel):
    group_id: str = ""
    group_name: str = ""
    group_type: str = "unknown"
    group_size: int = 0
    admin_count: int = 0
    messages_30d: int = 0
    sender_role: str = "member"
    is_admin: bool = False
    is_muted: bool = False
    activity_level: str = "medium"
    reply_rate: float = 0.0
    user_messages_sent_30d: int = 0
    user_messages_read_30d: int = 0
    user_replies_sent_30d: int = 0
    user_notifications_dismissed_30d: int = 0


class BusinessContext(BaseModel):
    business_id: str = ""
    display_name: str = ""
    brand_name: str = ""
    category: str = ""
    is_verified: bool = False
    is_trusted: bool = False
    official_domain: str = ""
    domain_used_by_sender: str = ""
    domain_mismatch: bool = False
    domain_age_days: int = 0
    account_age_days: int = 0
    messages_sent_30d: int = 0
    report_count: int = 0
    why_user_knows_account: str = ""
    last_activity_at: str = ""
    has_opted_in: bool = False
    has_opted_out: bool = False
    promotions_opted_out_at: str = ""
    previous_orders: int = 0
    payments_made: int = 0
    activity_count_180d: int = 0
    messages_opened_30d: int = 0
    messages_dismissed_30d: int = 0
    messages_replied_30d: int = 0


class MessageMetadata(BaseModel):
    conversation_type: str
    forwarded_count: int = 0
    timestamp: str
    media_type: str
    media_id: str = ""
    sender_id: str


class HistoryContext(BaseModel):
    last_similar_messages: List[str] = Field(default_factory=list)
    last_messages_from_sender: List[str] = Field(default_factory=list)
    opened_count: int = 0
    replied_count: int = 0
    ignored_count: int = 0
    muted_count: int = 0
    reported_count: int = 0
    avg_reaction_time_minutes: Optional[float] = None


class MediaContext(BaseModel):
    has_media: bool = False
    media_type: Optional[str] = None
    media_id: Optional[str] = None
    file_path: Optional[str] = None


class DerivedFeatures(BaseModel):
    trust_score: float = 0.0
    urgency_score: float = 0.0
    engagement_score: float = 0.0
    spam_probability: float = 0.0
    notification_priority: float = 0.0
    domain_spoofing_detected: bool = False
    prompt_injection_suspected: bool = False


class MessageContext(BaseModel):
    """
    Master 360-degree context object serialized to JSON and fed directly
    into the Gemini routing and reflection pipeline.
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
    success: bool = True
    error_message: Optional[str] = None
    media_type: str
    image_analysis: Optional[ImageAnalysis] = None
    voice_analysis: Optional[VoiceAnalysis] = None


class PromptMetadata(BaseModel):
    version: str
    model_target: str
    task_name: str
    few_shot_count: int = 0
    includes_media: bool = False


class PromptPackage(BaseModel):
    system_prompt: str
    user_prompt: str
    metadata: PromptMetadata
    estimated_tokens: int = 0


class RoutingDecision(BaseModel):
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

    @field_validator("confidence")
    def round_confidence(cls, v):
        return round(v, 2)


class CalibratedDecision(BaseModel):
    action: Action = Field(..., description="The final routing action: 'notify', 'digest', or 'mute'.")
    message_type: MessageType = Field(..., description="The best-fit message category.")
    reason: str = Field(..., description="Human-readable explanation, potentially appended with calibration notes.")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Deterministically calibrated confidence score.")
    evidence_message_ids: str = Field(..., description="Semicolon-separated historical message IDs used as evidence.")

    @field_validator("confidence")
    def round_confidence(cls, v):
        return round(v, 2)


class UsageMetadata(BaseModel):
    prompt_token_count: Optional[int] = None
    candidates_token_count: Optional[int] = None
    total_token_count: Optional[int] = None


class GeminiResponse(BaseModel, Generic[T]):
    content: T
    model_used: str
    latency_ms: float
    success: bool
    usage: Optional[UsageMetadata] = None
