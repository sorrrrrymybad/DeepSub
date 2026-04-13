from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _resolve_path(path: Path) -> Path:
    return path if path.is_absolute() else (PROJECT_ROOT / path).resolve()


class Settings(BaseSettings):
    database_url: str = "sqlite:///./data/db/deepsub.db"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = "change-me-to-a-32-byte-random-string"
    data_dir: Path = Path("./data")
    log_dir: Path = Path("./data/logs")
    tmp_dir: Path = Path("./data/tmp")
    whisper_model_dir: Path = Path("./data/whisper-models")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @model_validator(mode="after")
    def normalize_paths(self) -> "Settings":
        self.data_dir = _resolve_path(self.data_dir)
        self.log_dir = _resolve_path(self.log_dir)
        self.tmp_dir = _resolve_path(self.tmp_dir)
        self.whisper_model_dir = _resolve_path(self.whisper_model_dir)

        sqlite_prefix = "sqlite:///"
        if self.database_url.startswith(sqlite_prefix):
            raw_path = Path(self.database_url.removeprefix(sqlite_prefix))
            self.database_url = f"{sqlite_prefix}{_resolve_path(raw_path)}"
        return self


settings = Settings()
