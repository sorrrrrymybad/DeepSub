from datetime import datetime, timedelta, timezone

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base

_CST = timezone(timedelta(hours=8))


def _now_cst() -> datetime:
    return datetime.now(_CST).replace(tzinfo=None)


class ScheduledJob(Base):
    __tablename__ = "scheduled_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    smb_server_id: Mapped[int] = mapped_column(Integer, nullable=False)
    directory: Mapped[str] = mapped_column(String, nullable=False)
    cron_expr: Mapped[str] = mapped_column(String, nullable=False)
    source_lang: Mapped[str] = mapped_column(String, default="auto")
    target_lang: Mapped[str] = mapped_column(String, nullable=False)
    stt_engine: Mapped[str] = mapped_column(String, nullable=False)
    translate_engine: Mapped[str] = mapped_column(String, nullable=False)
    overwrite: Mapped[bool] = mapped_column(Boolean, default=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_run_status: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now_cst)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=_now_cst,
        onupdate=_now_cst,
    )
