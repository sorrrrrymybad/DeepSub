from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.deps import get_db
from core.crypto import encrypt, mask_secret
from models.setting import Setting
from schemas.setting import STTSettingsUpdate, TranslateSettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"])

SENSITIVE_KEYS = {"api_key", "secret"}


def _is_sensitive(key: str) -> bool:
    return any(part in key for part in SENSITIVE_KEYS)


def _upsert(db: Session, key: str, value: str) -> None:
    encrypted_value = encrypt(value) if _is_sensitive(key) else value
    setting = db.query(Setting).filter(Setting.key == key).first()
    if setting:
        setting.value = encrypted_value
    else:
        db.add(Setting(key=key, value=encrypted_value))


def _get_val(db: Session, key: str) -> str | None:
    setting = db.query(Setting).filter(Setting.key == key).first()
    if not setting:
        return None

    from core.crypto import decrypt

    try:
        raw = decrypt(setting.value)
    except Exception:
        raw = setting.value
    return mask_secret(raw) if _is_sensitive(key) else raw


@router.get("/stt")
def get_stt_settings(db: Session = Depends(get_db)):
    return {
        "whisper_local_model_size": _get_val(db, "stt.whisper_local.model_size"),
        "openai_whisper_api_key": _get_val(db, "stt.openai_whisper.api_key"),
    }


@router.patch("/stt")
def update_stt_settings(data: STTSettingsUpdate, db: Session = Depends(get_db)):
    mapping = {
        "whisper_local_model_size": "stt.whisper_local.model_size",
        "openai_whisper_api_key": "stt.openai_whisper.api_key",
    }
    for field, key in mapping.items():
        value = getattr(data, field)
        if value is not None:
            _upsert(db, key, value)
    db.commit()
    return {"ok": True}


@router.get("/translate")
def get_translate_settings(db: Session = Depends(get_db)):
    keys = [
        ("deeplx_endpoint", "translate.deeplx.endpoint"),
        ("deepl_api_key", "translate.deepl.api_key"),
        ("google_api_key", "translate.google.api_key"),
        ("openai_api_key", "translate.openai.api_key"),
        ("openai_model", "translate.openai.model"),
        ("openai_base_url", "translate.openai.base_url"),
        ("claude_api_key", "translate.claude.api_key"),
        ("claude_model", "translate.claude.model"),
        ("claude_base_url", "translate.claude.base_url"),
    ]
    return {field: _get_val(db, key) for field, key in keys}


@router.patch("/translate")
def update_translate_settings(
    data: TranslateSettingsUpdate, db: Session = Depends(get_db)
):
    mapping = {
        "deeplx_endpoint": "translate.deeplx.endpoint",
        "deepl_api_key": "translate.deepl.api_key",
        "google_api_key": "translate.google.api_key",
        "openai_api_key": "translate.openai.api_key",
        "openai_model": "translate.openai.model",
        "openai_base_url": "translate.openai.base_url",
        "claude_api_key": "translate.claude.api_key",
        "claude_model": "translate.claude.model",
        "claude_base_url": "translate.claude.base_url",
    }
    for field, key in mapping.items():
        value = getattr(data, field)
        if value is not None:
            _upsert(db, key, value)
    db.commit()
    return {"ok": True}
