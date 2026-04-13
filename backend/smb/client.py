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

    def connect(self) -> None:
        try:
            import smbclient

            smbclient.register_session(
                self.host,
                username=self.username,
                password=self.password,
                port=self.port,
            )
            self._smbclient = smbclient
        except Exception as exc:
            raise SMBConnectionError(f"Cannot connect to {self.host}: {exc}") from exc

    def _smb_path(self, remote_path: str) -> str:
        path = remote_path.lstrip("/")
        normalized = path.replace("/", "\\")
        return f"\\\\{self.host}\\{self.share}\\{normalized}"

    def list_directory(self, remote_path: str) -> list[dict]:
        import smbclient

        entries = []
        for entry in smbclient.scandir(self._smb_path(remote_path)):
            entries.append(
                {
                    "name": entry.name,
                    "is_dir": entry.is_dir(),
                    "size": entry.stat().st_size if not entry.is_dir() else 0,
                }
            )
        return entries

    def download_file(self, remote_path: str, local_path: str) -> None:
        import smbclient

        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        with smbclient.open_file(self._smb_path(remote_path), mode="rb") as src:
            with open(local_path, "wb") as dst:
                while chunk := src.read(1024 * 1024):
                    dst.write(chunk)

    def upload_file(self, local_path: str, remote_path: str) -> None:
        import smbclient

        with open(local_path, "rb") as src:
            with smbclient.open_file(self._smb_path(remote_path), mode="wb") as dst:
                while chunk := src.read(1024 * 1024):
                    dst.write(chunk)

    def file_exists(self, remote_path: str) -> bool:
        import smbclient

        try:
            smbclient.stat(self._smb_path(remote_path))
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
