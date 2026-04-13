import httpx

from engines.base import TranslateEngine


class DeepLXEngine(TranslateEngine):
    def __init__(self, endpoint: str):
        self.endpoint = endpoint

    def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        response = httpx.post(
            self.endpoint,
            json={
                "text": text,
                "source_lang": source_lang.upper(),
                "target_lang": target_lang.upper(),
            },
            timeout=30,
        )
        response.raise_for_status()
        return response.json()["data"]
