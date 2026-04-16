import httpx

from engines.base import TranslateEngine


class GoogleTranslateEngine(TranslateEngine):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.url = "https://translation.googleapis.com/language/translate/v2"

    def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        body: dict = {
            "q": text,
            "target": target_lang.lower(),
            "format": "text",
        }
        if source_lang and source_lang.lower() != "auto":
            body["source"] = source_lang.lower()
        response = httpx.post(
            self.url,
            params={"key": self.api_key},
            json=body,
            timeout=30,
        )
        response.raise_for_status()
        return response.json()["data"]["translations"][0]["translatedText"]
