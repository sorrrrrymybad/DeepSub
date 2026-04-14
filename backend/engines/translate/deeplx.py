import itertools
import logging
import threading

import httpx

from engines.base import TranslateEngine

logger = logging.getLogger(__name__)


class DeepLXEngine(TranslateEngine):
    def __init__(self, endpoints: list[str]):
        if not endpoints:
            raise ValueError("至少需要一个 DeepLX endpoint")
        self._cycle = itertools.cycle(endpoints)
        self._lock = threading.Lock()

    def _next_endpoint(self) -> str:
        with self._lock:
            return next(self._cycle)

    def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        endpoint = self._next_endpoint()
        # logger.info("DeepLX request: endpoint=%s source=%s target=%s text=%r", endpoint, source_lang, target_lang, text)
        response = httpx.post(
            endpoint,
            json={
                "text": text,
                "source_lang": source_lang.upper(),
                "target_lang": target_lang.upper(),
            },
            timeout=30,
        )
        response.raise_for_status()
        return response.json()["data"]
