from __future__ import annotations

from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, ConfigDict, model_validator


class TaskCreate(BaseModel):
    source_type: str = "smb"
    smb_server_id: int | None = None
    file_paths: list[str]
    source_lang: str = "auto"
    target_lang: str
    stt_engine: str
    translate_engine: str
    overwrite: bool = False

    @model_validator(mode="after")
    def validate_source_payload(self) -> "TaskCreate":
        if self.source_type not in {"smb", "local"}:
            raise ValueError("source_type must be smb or local")

        if self.source_type == "smb" and self.smb_server_id is None:
            raise ValueError("smb_server_id is required for smb source")

        if self.source_type == "local":
            if self.smb_server_id is not None:
                raise ValueError("smb_server_id is not allowed for local source")
            if any(not Path(file_path).is_absolute() for file_path in self.file_paths):
                raise ValueError("local source file_paths must be absolute paths")

        return self


class TaskResponse(BaseModel):
    id: int
    source_type: str
    smb_server_id: int | None
    file_path: str
    status: str
    source_lang: str
    target_lang: str
    stt_engine: str
    translate_engine: str
    overwrite: bool
    progress: int
    error_message: str | None
    retry_count: int
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime
    updated_at: datetime
    elapsed_seconds: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def compute_elapsed(self) -> "TaskResponse":
        if self.started_at is None:
            self.elapsed_seconds = None
        elif self.finished_at is not None:
            self.elapsed_seconds = max(0, int((self.finished_at - self.started_at).total_seconds()))
        else:
            now = datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None)
            self.elapsed_seconds = max(0, int((now - self.started_at).total_seconds()))
        return self


class TaskListResponse(BaseModel):
    items: list[TaskResponse]
    total: int
    page: int
    page_size: int


class TaskSummary(BaseModel):
    total: int
    pending: int
    running: int
    done: int
    failed: int
    cancelled: int
