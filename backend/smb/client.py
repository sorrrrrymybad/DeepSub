from __future__ import annotations

import logging
import os
import time


logger = logging.getLogger(__name__)


class SMBConnectionError(Exception):
    pass


class SMBClient:
    def __init__(
        self,
        host: str,
        port: int,
        share: str,
        username: str,
        password: str,
        domain: str | None = None,
    ):
        self.host = host
        self.port = port
        self.share = share
        self.username = username
        self.password = password
        self.domain = domain or ""
        self._smbclient = None

    def _validate_config(self) -> None:
        if not self.host.strip():
            raise SMBConnectionError("SMB host is required")
        if not self.share.strip():
            raise SMBConnectionError("SMB share is required")
        if not self.username.strip():
            raise SMBConnectionError("SMB username is required")
        if not self.password:
            raise SMBConnectionError("SMB password is required")

    def _auth_username(self) -> str:
        if self.domain.strip():
            return f"{self.domain}\\{self.username}"
        return self.username

    def _auth_kwargs(self) -> dict:
        return {
            "username": self._auth_username(),
            "password": self.password,
            "port": self.port,
        }

    def connect(self) -> None:
        self._validate_config()
        logger.info(
            "Connecting to SMB server: host=%s port=%s share=%s domain=%s",
            self.host,
            self.port,
            self.share,
            self.domain or "",
        )
        started_at = time.monotonic()
        try:
            import smbclient

            smbclient.register_session(self.host, **self._auth_kwargs())
            self._smbclient = smbclient
            logger.info(
                "Connected to SMB server: host=%s share=%s elapsed=%.2fs",
                self.host,
                self.share,
                time.monotonic() - started_at,
            )
        except SMBConnectionError:
            raise
        except Exception as exc:
            logger.warning(
                "Failed to connect to SMB server: host=%s share=%s error=%s",
                self.host,
                self.share,
                exc,
            )
            raise SMBConnectionError(f"Cannot connect to {self.host}: {exc}") from exc

    def _ensure_connected(self) -> None:
        if self._smbclient is None:
            self.connect()

    def _smb_path(self, remote_path: str) -> str:
        self._validate_config()
        path = remote_path.lstrip("/")
        normalized = path.replace("/", "\\")
        base = f"\\\\{self.host}\\{self.share}"
        return f"{base}\\{normalized}" if normalized else base

    def list_directory(self, remote_path: str) -> list[dict]:
        self._ensure_connected()
        import smbclient

        logger.info(
            "Listing SMB directory: host=%s share=%s path=%s",
            self.host,
            self.share,
            remote_path,
        )
        started_at = time.monotonic()
        entries = []
        try:
            for entry in smbclient.scandir(self._smb_path(remote_path), **self._auth_kwargs()):
                entries.append(
                    {
                        "name": entry.name,
                        "is_dir": entry.is_dir(),
                        "size": entry.stat().st_size if not entry.is_dir() else 0,
                    }
                )
        except Exception:
            logger.exception(
                "Failed to list SMB directory: host=%s share=%s path=%s",
                self.host,
                self.share,
                remote_path,
            )
            raise
        logger.info(
            "Listed SMB directory: host=%s share=%s path=%s entries=%s elapsed=%.2fs",
            self.host,
            self.share,
            remote_path,
            len(entries),
            time.monotonic() - started_at,
        )
        return entries

    def download_file(self, remote_path: str, local_path: str, progress_callback=None) -> None:
        self._ensure_connected()
        import smbclient

        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        remote_file = self._smb_path(remote_path)
        total_size = smbclient.stat(remote_file, **self._auth_kwargs()).st_size
        read_size = 0
        logger.info(
            "Downloading SMB file: host=%s share=%s remote=%s local=%s size=%s bytes",
            self.host,
            self.share,
            remote_path,
            local_path,
            total_size,
        )
        started_at = time.monotonic()

        try:
            with smbclient.open_file(remote_file, mode="rb", **self._auth_kwargs()) as src:
                with open(local_path, "wb") as dst:
                    if progress_callback:
                        progress_callback(1.0 if total_size == 0 else 0.0)
                    while chunk := src.read(1024 * 1024):
                        dst.write(chunk)
                        read_size += len(chunk)
                        if progress_callback and total_size > 0:
                            progress_callback(read_size / total_size)
        except Exception:
            logger.exception(
                "Failed to download SMB file: host=%s share=%s remote=%s local=%s read=%s/%s bytes",
                self.host,
                self.share,
                remote_path,
                local_path,
                read_size,
                total_size,
            )
            raise
        logger.info(
            "Downloaded SMB file: host=%s share=%s remote=%s local=%s read=%s bytes elapsed=%.2fs",
            self.host,
            self.share,
            remote_path,
            local_path,
            read_size,
            time.monotonic() - started_at,
        )

    def upload_file(self, local_path: str, remote_path: str, progress_callback=None) -> None:
        self._ensure_connected()
        import smbclient

        total_size = os.path.getsize(local_path)
        written_size = 0
        logger.info(
            "Uploading SMB file: host=%s share=%s local=%s remote=%s size=%s bytes",
            self.host,
            self.share,
            local_path,
            remote_path,
            total_size,
        )
        started_at = time.monotonic()

        try:
            with open(local_path, "rb") as src:
                with smbclient.open_file(self._smb_path(remote_path), mode="wb", **self._auth_kwargs()) as dst:
                    if progress_callback:
                        progress_callback(1.0 if total_size == 0 else 0.0)
                    while chunk := src.read(1024 * 1024):
                        dst.write(chunk)
                        written_size += len(chunk)
                        if progress_callback and total_size > 0:
                            progress_callback(written_size / total_size)
        except Exception:
            logger.exception(
                "Failed to upload SMB file: host=%s share=%s local=%s remote=%s written=%s/%s bytes",
                self.host,
                self.share,
                local_path,
                remote_path,
                written_size,
                total_size,
            )
            raise
        logger.info(
            "Uploaded SMB file: host=%s share=%s local=%s remote=%s written=%s bytes elapsed=%.2fs",
            self.host,
            self.share,
            local_path,
            remote_path,
            written_size,
            time.monotonic() - started_at,
        )

    def file_exists(self, remote_path: str) -> bool:
        self._ensure_connected()
        import smbclient

        try:
            smbclient.stat(self._smb_path(remote_path), **self._auth_kwargs())
            return True
        except Exception:
            return False

    @classmethod
    def from_server_model(cls, server) -> "SMBClient":
        from core.crypto import decrypt

        return cls(
            host=server.host,
            port=server.port,
            share=server.share,
            username=server.username,
            password=decrypt(server.password),
            domain=server.domain,
        )
