from enum import Enum

class Action(str, Enum):
    """Allowed actions for routing the message."""
    NOTIFY = "notify"
    DIGEST = "digest"
    MUTE = "mute"

class MessageType(str, Enum):
    """Allowed classifications for incoming messages."""
    PERSONAL = "personal"
    URGENT = "urgent"
    EVENT = "event"
    PAYMENT = "payment"
    BUSINESS_UPDATE = "business_update"
    PROMOTION = "promotion"
    GREETING = "greeting"
    FORWARD = "forward"
    SPAM = "spam"
    SCAM = "scam"
    UNKNOWN = "unknown"

class MediaType(str, Enum):
    """Types of media attached to a message."""
    TEXT = "text" # Internally used for empty media_type
    IMAGE = "image"
    VOICE = "voice"

class ConversationType(str, Enum):
    """Context of the message sender."""
    PERSONAL = "personal"
    GROUP = "group"
    BUSINESS = "business"

class Defaults:
    """System-wide default operational values."""
    CONFIDENCE_THRESHOLD = 0.75
    MAX_EVIDENCE_IDS = 3
    MAX_RETRIEVED_HISTORY = 20
    MAX_RETRY_COUNT = 3
    API_TIMEOUT_SECONDS = 30.0

class PromptFiles:
    """Filenames for Jinja2 prompt templates."""
    ROUTER_SYSTEM = "router_system.jinja"
    ROUTER_USER = "router_user.jinja"
    # Additional templates can be added here (e.g., for visual extraction, safety rails)

class CSVFiles:
    """Filenames for provided datasets."""
    MESSAGES = "messages.csv"
    SAMPLE_MESSAGES = "sample_messages.csv"
    USERS = "users.csv"
    GROUPS = "groups.csv"
    GROUP_MEMBERS = "group_members.csv"
    BUSINESS_ACCOUNTS = "business_accounts.csv"
    USER_BUSINESS_HISTORY = "user_business_history.csv"
    MESSAGE_HISTORY = "message_history.csv"
    MESSAGE_EVENTS = "message_events.csv"
    IMAGES = "images.csv"
    VOICE_NOTES = "voice_notes.csv"
    DAILY_NOTIFICATION_SUMMARY = "daily_notification_summary.csv"
    OUTPUT = "output.csv"
