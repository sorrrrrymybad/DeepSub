import httpx

from engines.base import TranslateEngine


class GoogleTranslateEngine(TranslateEngine):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.url = "https://translation.googleapis.com/language/translate/v2"

    def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        response = httpx.post(
            self.url,
            params={"key": self.api_key},
            json={
                "q": text,
                "source": source_lang.lower(),
                "target": target_lang.lower(),
                "format": "text",
            },
            timeout=30,
        )
        response.raise_for_status()
        return response.json()["data"]["translations"][0]["translatedText"]
