import base64

from cryptography.fernet import Fernet

from core.config import settings


def _get_fernet() -> Fernet:
    key_bytes = settings.secret_key.encode()
    padded = key_bytes[:32].ljust(32, b"0")
    key = base64.urlsafe_b64encode(padded)
    return Fernet(key)


def encrypt(plaintext: str) -> str:
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt(token: str) -> str:
    return _get_fernet().decrypt(token.encode()).decode()


def mask_secret(value: str) -> str:
    if len(value) <= 4:
        return "****"
    return "****" + value[-4:]
