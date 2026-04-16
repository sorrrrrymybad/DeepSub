from datetime import datetime, timedelta, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base

_CST = timezone(timedelta(hours=8))


def _now_cst() -> datetime:
    return datetime.now(_CST).replace(tzinfo=None)


class Setting(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=_now_cst,
        onupdate=_now_cst,
    )
