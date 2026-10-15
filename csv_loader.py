import logging
from pathlib import Path
from typing import Dict, List

import pandas as pd

from config import settings
from constants import CSVFiles

# Configure module-level logger
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
    Production-grade CSV loader for hackathon datasets.
    Handles validation, in-memory caching, and provides strongly-typed access to pandas DataFrames.
    Follows the Open/Closed Principle: easily extensible for new datasets via the _schemas dictionary.
    """

    def __init__(self):
        # Resolve dataset path from global configuration
        self.dataset_path = Path(settings.dataset_path)
        
        # In-memory cache to prevent redundant I/O operations
        self._cache: Dict[str, pd.DataFrame] = {}
        
        # Schema definitions mapping filenames to their minimum required columns
        # This enables strict validation to fail fast if datasets are malformed
        self._schemas: Dict[str, List[str]] = {
            CSVFiles.MESSAGES: ["message_id", "user_id", "conversation_type", "created_at"],
            CSVFiles.SAMPLE_MESSAGES: ["message_id", "action", "message_type", "reason", "confidence", "evidence_message_ids"],
            CSVFiles.USERS: ["user_id"],
            CSVFiles.GROUPS: ["group_id"],
            CSVFiles.GROUP_MEMBERS: ["user_id", "group_id"],
            CSVFiles.BUSINESS_ACCOUNTS: ["business_id"],
            CSVFiles.USER_BUSINESS_HISTORY: ["user_id", "business_id"],
            CSVFiles.MESSAGE_HISTORY: ["message_id", "user_id"],
            CSVFiles.MESSAGE_EVENTS: ["message_id", "user_id", "event_type"],
            CSVFiles.IMAGES: ["media_id", "file_path"],
            CSVFiles.VOICE_NOTES: ["media_id", "file_path"],
            CSVFiles.DAILY_NOTIFICATION_SUMMARY: ["user_id"],
        }

    def _load_and_validate(self, filename: str) -> pd.DataFrame:
        """
        Core internal method to load, validate, and cache a CSV file.
        Implements lazy loading: only reads from disk if the dataset is not in cache.
        """
        # Return cached DataFrame if already loaded (O(1) lookup)
        if filename in self._cache:
            return self._cache[filename]

        filepath = self.dataset_path / filename
        
        # Validate existence before attempting to read
        if not filepath.exists():
            logger.error(f"Required dataset missing at path: {filepath}")
            raise CSVNotFoundError(f"File not found: {filepath}")

        logger.info(f"Loading dataset: {filename} into memory.")
        try:
            df = pd.read_csv(filepath)
        except Exception as e:
            logger.error(f"Failed to read CSV {filename}. Reason: {e}")
            raise CSVLoaderError(f"Error reading {filename}: {e}")

        # Validate schema requirements (Fail-fast mechanism)
        required_columns = self._schemas.get(filename, [])
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            logger.error(f"Dataset {filename} is missing required columns: {missing_columns}")
            raise CSVColumnMissingError(f"File {filename} missing columns: {missing_columns}")

        # Populate cache and return
        self._cache[filename] = df
        return df

    def get_messages(self) -> pd.DataFrame:
        """Returns the incoming messages dataset."""
        return self._load_and_validate(CSVFiles.MESSAGES)

    def get_sample_messages(self) -> pd.DataFrame:
        """Returns the sample messages dataset containing ground-truth examples."""
        return self._load_and_validate(CSVFiles.SAMPLE_MESSAGES)

    def get_users(self) -> pd.DataFrame:
        """Returns user notification behavior and preferences dataset."""
        return self._load_and_validate(CSVFiles.USERS)

    def get_groups(self) -> pd.DataFrame:
        """Returns group chat context dataset."""
        return self._load_and_validate(CSVFiles.GROUPS)

    def get_group_members(self) -> pd.DataFrame:
        """Returns the relationships and roles of users within groups."""
        return self._load_and_validate(CSVFiles.GROUP_MEMBERS)

    def get_business_accounts(self) -> pd.DataFrame:
        """Returns business account information and verification statuses."""
        return self._load_and_validate(CSVFiles.BUSINESS_ACCOUNTS)

    def get_user_business_history(self) -> pd.DataFrame:
        """Returns historical interactions between users and businesses."""
        return self._load_and_validate(CSVFiles.USER_BUSINESS_HISTORY)

    def get_message_history(self) -> pd.DataFrame:
        """Returns historical messages received by users."""
        return self._load_and_validate(CSVFiles.MESSAGE_HISTORY)

    def get_message_events(self) -> pd.DataFrame:
        """Returns user engagement events for past messages (opened, muted, etc.)."""
        return self._load_and_validate(CSVFiles.MESSAGE_EVENTS)

    def get_images(self) -> pd.DataFrame:
        """Returns image media metadata."""
        return self._load_and_validate(CSVFiles.IMAGES)

    def get_voice_notes(self) -> pd.DataFrame:
        """Returns voice note media metadata."""
        return self._load_and_validate(CSVFiles.VOICE_NOTES)

    def get_daily_notification_summary(self) -> pd.DataFrame:
        """Returns daily notification loads for users."""
        return self._load_and_validate(CSVFiles.DAILY_NOTIFICATION_SUMMARY)

    def load_all(self) -> None:
        """
        Eagerly pre-loads and caches all datasets. 
        Highly recommended during application startup to ensure data integrity,
        fail fast on missing files/columns, and avoid blocking the event loop later.
        """
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

# Expose a singleton instance to ensure the cache is shared across the entire application
csv_loader = CSVLoader()
