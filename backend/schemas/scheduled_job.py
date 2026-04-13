from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ScheduledJobCreate(BaseModel):
    smb_server_id: int
    directory: str
    cron_expr: str
    source_lang: str = "auto"
    target_lang: str
    stt_engine: str
    translate_engine: str
    overwrite: bool = False
    enabled: bool = True


class ScheduledJobResponse(BaseModel):
    id: int
    smb_server_id: int
    directory: str
    cron_expr: str
    source_lang: str
    target_lang: str
    stt_engine: str
    translate_engine: str
    overwrite: bool
    enabled: bool
    last_run_at: datetime | None
    last_run_status: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
