from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TaskCreate(BaseModel):
    smb_server_id: int
    file_paths: list[str]
    source_lang: str = "auto"
    target_lang: str
    stt_engine: str
    translate_engine: str
    overwrite: bool = False


class TaskResponse(BaseModel):
    id: int
    smb_server_id: int
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

    model_config = ConfigDict(from_attributes=True)


class TaskListResponse(BaseModel):
    items: list[TaskResponse]
    total: int
    page: int
    page_size: int
