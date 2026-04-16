from __future__ import annotations

from pydantic import BaseModel


class SystemSettingsUpdate(BaseModel):
    worker_concurrency: str | None = None


class STTSettingsUpdate(BaseModel):
    whisper_local_model_size: str | None = None
    whisper_local_compute_type: str | None = None
    openai_whisper_api_key: str | None = None


class TranslateSettingsUpdate(BaseModel):
    deeplx_endpoint: str | None = None
    deepl_api_key: str | None = None
    google_api_key: str | None = None
    openai_api_key: str | None = None
    openai_model: str | None = None
    openai_base_url: str | None = None
    claude_api_key: str | None = None
    claude_model: str | None = None
    claude_base_url: str | None = None
    batch_size: str | None = None
    translate_prompt: str | None = None
