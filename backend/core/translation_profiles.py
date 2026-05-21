from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from core.crypto import decrypt, encrypt, mask_secret
from models.setting import Setting
from models.translation_profile import TranslationProfile

LEGACY_PROVIDER_KEYS: dict[str, dict[str, str]] = {
    "openai": {
        "api_key": "translate.openai.api_key",
        "model": "translate.openai.model",
        "base_url": "translate.openai.base_url",
        "active_profile_id": "translate.openai.active_profile_id",
    },
    "claude": {
        "api_key": "translate.claude.api_key",
        "model": "translate.claude.model",
        "base_url": "translate.claude.base_url",
        "active_profile_id": "translate.claude.active_profile_id",
    },
}


def _raw_setting(db: Session, key: str) -> str | None:
    setting = db.query(Setting).filter(Setting.key == key).first()
    if not setting:
        return None
    return setting.value


def _get_setting(db: Session, key: str) -> str | None:
    raw = _raw_setting(db, key)
    if raw is None:
        return None
    try:
        return decrypt(raw)
    except Exception:
        return raw


def _set_setting(db: Session, key: str, value: str | None) -> None:
    setting = db.query(Setting).filter(Setting.key == key).first()
    if value is None or value == "":
        if setting:
            db.delete(setting)
        return
    encrypted_value = encrypt(value) if key.endswith("api_key") else value
    if setting:
        setting.value = encrypted_value
    else:
        db.add(Setting(key=key, value=encrypted_value))


def _profile_to_dict(profile: TranslationProfile, active_profile_id: int | None) -> dict[str, Any]:
    try:
        decrypted_key = decrypt(profile.api_key)
    except Exception:
        decrypted_key = profile.api_key
    return {
        "id": profile.id,
        "provider": profile.provider,
        "name": profile.name,
        "model": profile.model,
        "base_url": profile.base_url,
        "has_api_key": bool(profile.api_key),
        "api_key_masked": mask_secret(decrypted_key),
        "is_active": profile.id == active_profile_id,
    }


def list_translation_profiles(db: Session, provider: str) -> list[dict[str, Any]]:
    active_profile_id = get_active_translation_profile_id(db, provider)
    profiles = (
        db.query(TranslationProfile)
        .filter(TranslationProfile.provider == provider)
        .order_by(TranslationProfile.id.asc())
        .all()
    )
    return [_profile_to_dict(profile, active_profile_id) for profile in profiles]


def get_translation_profile(db: Session, profile_id: int) -> TranslationProfile | None:
    return db.query(TranslationProfile).filter(TranslationProfile.id == profile_id).first()


def get_active_translation_profile_id(db: Session, provider: str) -> int | None:
    raw = _get_setting(db, LEGACY_PROVIDER_KEYS[provider]["active_profile_id"])
    if not raw:
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def get_active_translation_profile(db: Session, provider: str) -> dict[str, Any] | None:
    profile_id = get_active_translation_profile_id(db, provider)
    if profile_id is None:
        profile = (
            db.query(TranslationProfile)
            .filter(TranslationProfile.provider == provider)
            .order_by(TranslationProfile.id.asc())
            .first()
        )
    else:
        profile = get_translation_profile(db, profile_id)
    if not profile:
        return None
    try:
        api_key = decrypt(profile.api_key)
    except Exception:
        api_key = profile.api_key
    return {
        "id": profile.id,
        "provider": profile.provider,
        "name": profile.name,
        "api_key": api_key,
        "model": profile.model,
        "base_url": profile.base_url,
    }


def create_translation_profile(
    db: Session,
    provider: str,
    name: str,
    api_key: str,
    model: str,
    base_url: str | None,
) -> TranslationProfile:
    profile = TranslationProfile(
        provider=provider,
        name=name,
        api_key=encrypt(api_key),
        model=model,
        base_url=base_url or None,
    )
    db.add(profile)
    db.flush()
    if get_active_translation_profile_id(db, provider) is None:
        set_active_translation_profile(db, provider, profile.id)
    return profile


def update_translation_profile(
    db: Session,
    profile: TranslationProfile,
    *,
    name: str | None = None,
    api_key: str | None = None,
    model: str | None = None,
    base_url: str | None = None,
) -> TranslationProfile:
    if name is not None:
        profile.name = name
    if api_key is not None:
        if api_key:
            profile.api_key = encrypt(api_key)
    if model is not None:
        profile.model = model
    if base_url is not None:
        profile.base_url = base_url or None
    db.flush()
    return profile


def delete_translation_profile(db: Session, profile: TranslationProfile) -> None:
    was_active = get_active_translation_profile_id(db, profile.provider) == profile.id
    db.delete(profile)
    db.flush()
    if was_active:
        next_profile = (
            db.query(TranslationProfile)
            .filter(TranslationProfile.provider == profile.provider)
            .order_by(TranslationProfile.id.asc())
            .first()
        )
        if next_profile:
            set_active_translation_profile(db, profile.provider, next_profile.id)
        else:
            _set_setting(db, LEGACY_PROVIDER_KEYS[profile.provider]["active_profile_id"], None)


def set_active_translation_profile(db: Session, provider: str, profile_id: int) -> None:
    _set_setting(db, LEGACY_PROVIDER_KEYS[provider]["active_profile_id"], str(profile_id))


def seed_legacy_translation_profiles(db: Session) -> None:
    for provider, keys in LEGACY_PROVIDER_KEYS.items():
        existing_profiles = (
            db.query(TranslationProfile)
            .filter(TranslationProfile.provider == provider)
            .count()
        )
        legacy_api_key = _get_setting(db, keys["api_key"])
        legacy_model = _get_setting(db, keys["model"])
        legacy_base_url = _get_setting(db, keys["base_url"])

        if existing_profiles == 0 and (legacy_api_key or legacy_model or legacy_base_url):
            profile = TranslationProfile(
                provider=provider,
                name="Default",
                api_key=encrypt(legacy_api_key or ""),
                model=legacy_model or ("gpt-4o-mini" if provider == "openai" else "claude-haiku-4-5-20251001"),
                base_url=legacy_base_url or None,
            )
            db.add(profile)
            db.flush()
            set_active_translation_profile(db, provider, profile.id)
        elif existing_profiles > 0 and get_active_translation_profile_id(db, provider) is None:
            first_profile = (
                db.query(TranslationProfile)
                .filter(TranslationProfile.provider == provider)
                .order_by(TranslationProfile.id.asc())
                .first()
            )
            if first_profile:
                set_active_translation_profile(db, provider, first_profile.id)
