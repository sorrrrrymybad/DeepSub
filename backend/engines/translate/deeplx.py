import logging

import httpx

from engines.base import TranslateEngine

logger = logging.getLogger(__name__)

class DeepLXEngine(TranslateEngine):
    def __init__(self, endpoint: str):
        self.endpoint = endpoint

    def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        # logger.info("DeepLX request: endpoint=%s source=%s target=%s text=%r", self.endpoint, source_lang, target_lang, text)
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
