import httpx

from engines.base import TranslateEngine


class DeepLEngine(TranslateEngine):
    def __init__(self, api_key: str, free_tier: bool = True):
        base_url = "https://api-free.deepl.com" if free_tier else "https://api.deepl.com"
        self.url = f"{base_url}/v2/translate"
        self.headers = {"Authorization": f"DeepL-Auth-Key {api_key}"}

    def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        response = httpx.post(
            self.url,
            headers=self.headers,
            data={
                "text": text,
                "source_lang": source_lang.upper(),
                "target_lang": target_lang.upper(),
            },
            timeout=30,
        )
        response.raise_for_status()
        return response.json()["translations"][0]["text"]
