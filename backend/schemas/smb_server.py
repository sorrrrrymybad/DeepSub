from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


class SMBServerCreate(BaseModel):
    name: str
    host: str
    port: int = 445
    share: str
    domain: str | None = None
    username: str
    password: str

    @field_validator("share")
    @classmethod
    def validate_share(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("share must not be blank")
        return normalized


class SMBServerUpdate(BaseModel):
    name: str | None = None
    host: str | None = None
    port: int | None = None
    share: str | None = None
    domain: str | None = None
    username: str | None = None
    password: str | None = None

    @field_validator("share")
    @classmethod
    def validate_share(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("share must not be blank")
        return normalized


class SMBServerResponse(BaseModel):
    id: int
    name: str
    host: str
    port: int
    share: str
    domain: str | None
    username: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
