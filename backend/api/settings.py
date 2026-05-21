from fastapi import APIRouter, Depends, Query
from fastapi import HTTPException
from sqlalchemy.orm import Session

from api.deps import get_db
from core.crypto import encrypt, mask_secret
from core.translation_profiles import (
    create_translation_profile,
    delete_translation_profile,
    get_active_translation_profile,
    get_active_translation_profile_id,
    get_translation_profile,
    list_translation_profiles,
    set_active_translation_profile,
    update_translation_profile,
)
from models.setting import Setting
from schemas.setting import (
    STTSettingsUpdate,
    SystemSettingsUpdate,
    TranslateProfileCreate,
    TranslateProfileUpdate,
    TranslateSettingsUpdate,
)

router = APIRouter(prefix="/api/settings", tags=["settings"])

SENSITIVE_KEYS = {"api_key", "secret"}


def _is_sensitive(key: str) -> bool:
    return any(part in key for part in SENSITIVE_KEYS)


def _upsert(db: Session, key: str, value: str) -> None:
    setting = db.query(Setting).filter(Setting.key == key).first()
    if value == "":
        if setting:
            db.delete(setting)
        return
    encrypted_value = encrypt(value) if _is_sensitive(key) else value
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
        "whisper_local_compute_type": _get_val(db, "stt.whisper_local.compute_type"),
        "openai_whisper_api_key": _get_val(db, "stt.openai_whisper.api_key"),
    }


@router.patch("/stt")
def update_stt_settings(data: STTSettingsUpdate, db: Session = Depends(get_db)):
    mapping = {
        "whisper_local_model_size": "stt.whisper_local.model_size",
        "whisper_local_compute_type": "stt.whisper_local.compute_type",
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
        ("batch_size", "translate.batch_size"),
        ("translate_prompt", "translate.prompt"),
    ]
    data = {field: _get_val(db, key) for field, key in keys}
    data["openai_profiles"] = list_translation_profiles(db, "openai")
    data["claude_profiles"] = list_translation_profiles(db, "claude")
    active_openai = get_active_translation_profile_id(db, "openai")
    active_claude = get_active_translation_profile_id(db, "claude")
    data["openai_active_profile_id"] = active_openai
    data["claude_active_profile_id"] = active_claude
    if active_openai is not None:
        openai_profile = next(
            (profile for profile in data["openai_profiles"] if profile["id"] == active_openai),
            None,
        )
        data["openai_active_profile"] = openai_profile
        if openai_profile:
            data["openai_api_key"] = openai_profile["api_key_masked"]
            data["openai_model"] = openai_profile["model"]
            data["openai_base_url"] = openai_profile["base_url"]
    if active_claude is not None:
        claude_profile = next(
            (profile for profile in data["claude_profiles"] if profile["id"] == active_claude),
            None,
        )
        data["claude_active_profile"] = claude_profile
        if claude_profile:
            data["claude_api_key"] = claude_profile["api_key_masked"]
            data["claude_model"] = claude_profile["model"]
            data["claude_base_url"] = claude_profile["base_url"]
    return data


@router.patch("/translate")
def update_translate_settings(
    data: TranslateSettingsUpdate, db: Session = Depends(get_db)
):
    mapping = {
        "deeplx_endpoint": "translate.deeplx.endpoint",
        "deepl_api_key": "translate.deepl.api_key",
        "google_api_key": "translate.google.api_key",
        "batch_size": "translate.batch_size",
        "translate_prompt": "translate.prompt",
    }
    for field, key in mapping.items():
        value = getattr(data, field)
        if value is not None:
            _upsert(db, key, value)

    for provider, prefix in (("openai", "translate.openai"), ("claude", "translate.claude")):
        profile = get_active_translation_profile(db, provider)
        if not profile:
            continue
        profile_update = {}
        if getattr(data, f"{provider}_api_key", None) is not None:
            profile_update["api_key"] = getattr(data, f"{provider}_api_key")
        if getattr(data, f"{provider}_model", None) is not None:
            profile_update["model"] = getattr(data, f"{provider}_model")
        if getattr(data, f"{provider}_base_url", None) is not None:
            profile_update["base_url"] = getattr(data, f"{provider}_base_url")
        if profile_update:
            db_profile = get_translation_profile(db, profile["id"])
            if db_profile:
                update_translation_profile(db, db_profile, **profile_update)
    db.commit()
    return {"ok": True}


@router.get("/translate/providers/{provider}/profiles")
def get_translate_provider_profiles(provider: str, db: Session = Depends(get_db)):
    if provider not in {"openai", "claude"}:
        raise HTTPException(status_code=404, detail="Unknown provider")
    return {
        "profiles": list_translation_profiles(db, provider),
        "active_profile_id": get_active_translation_profile_id(db, provider),
        "active_profile": get_active_translation_profile(db, provider),
    }


@router.post("/translate/providers/{provider}/profiles")
def create_translate_provider_profile(
    provider: str,
    data: TranslateProfileCreate,
    db: Session = Depends(get_db),
):
    if provider not in {"openai", "claude"}:
        raise HTTPException(status_code=404, detail="Unknown provider")
    profile = create_translation_profile(
        db,
        provider=provider,
        name=data.name,
        api_key=data.api_key,
        model=data.model,
        base_url=data.base_url,
    )
    db.commit()
    db.refresh(profile)
    created = next(
        (item for item in list_translation_profiles(db, provider) if item["id"] == profile.id),
        None,
    )
    return {"profile": created}


@router.patch("/translate/providers/{provider}/profiles/{profile_id}")
def update_translate_provider_profile(
    provider: str,
    profile_id: int,
    data: TranslateProfileUpdate,
    db: Session = Depends(get_db),
):
    profile = get_translation_profile(db, profile_id)
    if not profile or profile.provider != provider:
        raise HTTPException(status_code=404, detail="Profile not found")
    update_translation_profile(
        db,
        profile,
        name=data.name,
        api_key=data.api_key,
        model=data.model,
        base_url=data.base_url,
    )
    db.commit()
    db.refresh(profile)
    updated = next(
        (item for item in list_translation_profiles(db, provider) if item["id"] == profile.id),
        None,
    )
    return {"profile": updated}


@router.delete("/translate/providers/{provider}/profiles/{profile_id}")
def delete_translate_provider_profile(
    provider: str,
    profile_id: int,
    db: Session = Depends(get_db),
):
    profile = get_translation_profile(db, profile_id)
    if not profile or profile.provider != provider:
        raise HTTPException(status_code=404, detail="Profile not found")
    delete_translation_profile(db, profile)
    db.commit()
    return {"ok": True}


@router.post("/translate/providers/{provider}/active/{profile_id}")
def set_translate_provider_active_profile(
    provider: str,
    profile_id: int,
    db: Session = Depends(get_db),
):
    profile = get_translation_profile(db, profile_id)
    if not profile or profile.provider != provider:
        raise HTTPException(status_code=404, detail="Profile not found")
    set_active_translation_profile(db, provider, profile_id)
    db.commit()
    return {"ok": True, "active_profile_id": profile_id}


@router.get("/system")
def get_system_settings(db: Session = Depends(get_db)):
    return {
        "worker_concurrency": _get_val(db, "worker.concurrency"),
    }


@router.patch("/system")
def update_system_settings(data: SystemSettingsUpdate, db: Session = Depends(get_db)):
    mapping = {
        "worker_concurrency": "worker.concurrency",
    }
    for field, key in mapping.items():
        value = getattr(data, field)
        if value is not None:
            _upsert(db, key, value)
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Whisper model management
# ---------------------------------------------------------------------------

@router.get("/stt/whisper/status")
def get_whisper_status(model_size: str = Query(default="base")):
    """检测指定模型是否已下载，以及当前下载进度。"""
    from worker.whisper_downloader import get_download_progress
    return get_download_progress(model_size)


@router.post("/stt/whisper/download")
def trigger_whisper_download(model_size: str = Query(...)):
    """触发后台下载指定模型（query param: model_size）。"""
    from worker.whisper_downloader import get_download_progress, start_download

    status = get_download_progress(model_size)
    if status["exists"]:
        return {"ok": False, "reason": "already_exists", **status}
    if status["downloading"]:
        return {"ok": False, "reason": "already_downloading", **status}

    start_download(model_size)
    return {"ok": True, "reason": "started", **get_download_progress(model_size)}
