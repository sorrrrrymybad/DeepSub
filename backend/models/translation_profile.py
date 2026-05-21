from datetime import datetime, timedelta, timezone

from sqlalchemy import DateTime, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base

_CST = timezone(timedelta(hours=8))


def _now_cst() -> datetime:
    return datetime.now(_CST).replace(tzinfo=None)


class TranslationProfile(Base):
    __tablename__ = "translation_profiles"
    __table_args__ = (
        UniqueConstraint("provider", "name", name="uq_translation_profiles_provider_name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    provider: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    api_key: Mapped[str] = mapped_column(String, nullable=False)
    model: Mapped[str] = mapped_column(String, nullable=False)
    base_url: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now_cst)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=_now_cst,
        onupdate=_now_cst,
    )
