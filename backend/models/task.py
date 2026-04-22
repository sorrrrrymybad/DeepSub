from datetime import datetime, timedelta, timezone

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base

_CST = timezone(timedelta(hours=8))


def _now_cst() -> datetime:
    return datetime.now(_CST).replace(tzinfo=None)


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_type: Mapped[str] = mapped_column(String, default="smb")
    smb_server_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    file_path: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default="pending")
    source_lang: Mapped[str] = mapped_column(String, default="auto")
    target_lang: Mapped[str] = mapped_column(String, nullable=False)
    stt_engine: Mapped[str] = mapped_column(String, nullable=False)
    translate_engine: Mapped[str] = mapped_column(String, nullable=False)
    overwrite: Mapped[bool] = mapped_column(Boolean, default=False)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(String, nullable=True)
    celery_task_id: Mapped[str | None] = mapped_column(String, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now_cst)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=_now_cst,
        onupdate=_now_cst,
    )
