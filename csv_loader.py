import logging
from pathlib import Path
from typing import Dict, List

import pandas as pd

from config import settings
from constants import CSVFiles

logger = logging.getLogger(__name__)


class CSVLoaderError(Exception):
    """Base exception for CSV loader errors."""
    pass


class CSVNotFoundError(CSVLoaderError):
    """Raised when a required CSV file is missing from the dataset directory."""
    pass


class CSVColumnMissingError(CSVLoaderError):
    """Raised when a CSV file is missing required columns based on its schema."""
    pass


class CSVLoader:
    """
    Production-grade CSV loader for notification routing datasets.
    Handles strict schema validation aligned with the real input CSV files,
    in-memory caching, and strongly-typed access to pandas DataFrames.
    """

    def __init__(self):
        self.dataset_path = Path(settings.dataset_path)
        self._cache: Dict[str, pd.DataFrame] = {}

        # Exact column schemas matching the provided input CSV files
        self._schemas: Dict[str, List[str]] = {
            CSVFiles.MESSAGES: [
                "message_id",
                "user_id",
                "conversation_type",
                "group_id",
                "business_id",
                "sender_user_id",
                "created_at",
                "message_text",
                "media_type",
                "media_id",
                "forwarded_count",
            ],
            CSVFiles.SAMPLE_MESSAGES: [
                "message_id",
                "user_id",
                "conversation_type",
                "created_at",
                "action",
                "message_type",
                "reason",
                "confidence",
                "evidence_message_ids",
            ],
            CSVFiles.USERS: [
                "user_id",
                "do_not_disturb_window",
                "messages_opened_30d",
                "messages_replied_30d",
                "notifications_dismissed_30d",
                "messages_reported_30d",
            ],
            CSVFiles.GROUPS: [
                "group_id",
                "group_name",
                "group_type",
                "member_count",
                "admin_count",
                "created_at",
                "messages_30d",
            ],
            CSVFiles.GROUP_MEMBERS: [
                "group_id",
                "user_id",
                "role",
                "joined_at",
                "messages_sent_30d",
                "messages_read_30d",
                "replies_sent_30d",
                "notifications_dismissed_30d",
                "group_muted_by_user",
            ],
            CSVFiles.BUSINESS_ACCOUNTS: [
                "business_id",
                "display_name",
                "brand_name",
                "category",
                "verified",
                "official_domain",
                "domain_used_by_sender",
                "account_age_days",
                "messages_sent_30d",
                "user_reports_30d",
                "domain_used_by_sender_age_days",
            ],
            CSVFiles.USER_BUSINESS_HISTORY: [
                "user_id",
                "business_id",
                "why_user_knows_account",
                "last_activity_at",
                "allows_promotions",
                "promotions_opted_out_at",
                "activity_count_180d",
                "messages_opened_30d",
                "messages_dismissed_30d",
                "messages_replied_30d",
                "last_reply_at",
            ],
            CSVFiles.MESSAGE_HISTORY: [
                "message_id",
                "user_id",
                "conversation_type",
                "group_id",
                "business_id",
                "sender_user_id",
                "created_at",
                "message_text",
                "media_type",
                "media_id",
                "forwarded_count",
            ],
            CSVFiles.MESSAGE_EVENTS: [
                "user_id",
                "message_id",
                "message_opened",
                "message_replied",
                "reaction_time_minutes",
                "notification_dismissed",
                "muted_after_message",
                "message_reported",
            ],
            CSVFiles.IMAGES: ["image_id", "file_path"],
            CSVFiles.VOICE_NOTES: ["voice_note_id", "file_path"],
            CSVFiles.DAILY_NOTIFICATION_SUMMARY: [
                "user_id",
                "date",
                "notifications_sent",
                "notifications_dismissed",
            ],
        }

    def _load_and_validate(self, filename: str) -> pd.DataFrame:
        if filename in self._cache:
            return self._cache[filename]

        filepath = self.dataset_path / filename

        if not filepath.exists():
            logger.error(f"Required dataset missing at path: {filepath}")
            raise CSVNotFoundError(f"File not found: {filepath}")

        logger.info(f"Loading dataset: {filename} into memory.")
        try:
            df = pd.read_csv(filepath)
        except Exception as e:
            logger.error(f"Failed to read CSV {filename}. Reason: {e}")
            raise CSVLoaderError(f"Error reading {filename}: {e}")

        required_columns = self._schemas.get(filename, [])
        missing_columns = [col for col in required_columns if col not in df.columns]

        if missing_columns:
            logger.error(f"Dataset {filename} is missing required columns: {missing_columns}")
            raise CSVColumnMissingError(f"File {filename} missing columns: {missing_columns}")

        self._cache[filename] = df
        return df

    def get_messages(self) -> pd.DataFrame:
        return self._load_and_validate(CSVFiles.MESSAGES)

    def get_sample_messages(self) -> pd.DataFrame:
        return self._load_and_validate(CSVFiles.SAMPLE_MESSAGES)

    def get_users(self) -> pd.DataFrame:
        return self._load_and_validate(CSVFiles.USERS)

    def get_groups(self) -> pd.DataFrame:
        return self._load_and_validate(CSVFiles.GROUPS)

    def get_group_members(self) -> pd.DataFrame:
        return self._load_and_validate(CSVFiles.GROUP_MEMBERS)

    def get_business_accounts(self) -> pd.DataFrame:
        return self._load_and_validate(CSVFiles.BUSINESS_ACCOUNTS)

    def get_user_business_history(self) -> pd.DataFrame:
        return self._load_and_validate(CSVFiles.USER_BUSINESS_HISTORY)

    def get_message_history(self) -> pd.DataFrame:
        return self._load_and_validate(CSVFiles.MESSAGE_HISTORY)

    def get_message_events(self) -> pd.DataFrame:
        return self._load_and_validate(CSVFiles.MESSAGE_EVENTS)

    def get_images(self) -> pd.DataFrame:
        return self._load_and_validate(CSVFiles.IMAGES)

    def get_voice_notes(self) -> pd.DataFrame:
        return self._load_and_validate(CSVFiles.VOICE_NOTES)

    def get_daily_notification_summary(self) -> pd.DataFrame:
        return self._load_and_validate(CSVFiles.DAILY_NOTIFICATION_SUMMARY)

    def load_all(self) -> None:
        logger.info("Eagerly pre-loading all datasets into memory...")
        self.get_messages()
        self.get_sample_messages()
        self.get_users()
        self.get_groups()
        self.get_group_members()
        self.get_business_accounts()
        self.get_user_business_history()
        self.get_message_history()
        self.get_message_events()
        self.get_images()
        self.get_voice_notes()
        self.get_daily_notification_summary()
        logger.info("All datasets successfully loaded and validated.")


csv_loader = CSVLoader()
