from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """
    Core application configuration management using pydantic-settings.
    Values are automatically loaded from environment variables and the .env file.
    """
    # Environment mode
    environment: Literal["development", "production"] = "development"

    # API Credentials (no default means it's strictly required at startup)
    gemini_api_key: str

    # Gemini Models
    gemini_flash_model: str = "gemini-2.5-flash"
    gemini_pro_model: str = "gemini-2.5-pro"

    # Dataset & I/O Paths
    dataset_path: str = "dataset/"
    media_path: str = "dataset/media/"
    output_path: str = "output.csv"

    # Pydantic v2 configuration dictionary
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False
    )

# Instantiate a global settings object to be imported across the application
settings = Settings()
