from __future__ import annotations

import os


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
        try:
            import smbclient

            smbclient.register_session(self.host, **self._auth_kwargs())
            self._smbclient = smbclient
        except SMBConnectionError:
            raise
        except Exception as exc:
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

        entries = []
        for entry in smbclient.scandir(self._smb_path(remote_path), **self._auth_kwargs()):
            entries.append(
                {
                    "name": entry.name,
                    "is_dir": entry.is_dir(),
                    "size": entry.stat().st_size if not entry.is_dir() else 0,
                }
            )
        return entries

    def download_file(self, remote_path: str, local_path: str) -> None:
        self._ensure_connected()
        import smbclient

        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        with smbclient.open_file(self._smb_path(remote_path), mode="rb", **self._auth_kwargs()) as src:
            with open(local_path, "wb") as dst:
                while chunk := src.read(1024 * 1024):
                    dst.write(chunk)

    def upload_file(self, local_path: str, remote_path: str) -> None:
        self._ensure_connected()
        import smbclient

        with open(local_path, "rb") as src:
            with smbclient.open_file(self._smb_path(remote_path), mode="wb", **self._auth_kwargs()) as dst:
                while chunk := src.read(1024 * 1024):
                    dst.write(chunk)

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
