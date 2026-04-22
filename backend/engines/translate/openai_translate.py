import logging
from typing import Any

from openai import OpenAI

from engines.base import TranslateEngine

logger = logging.getLogger(__name__)

DEFAULT_TRANSLATE_PROMPT = (
    "You are a professional subtitle translator. "
    "Translate from {source_lang} to {target_lang}. "
    "Output ONLY the translated text, no explanations."
)


class OpenAITranslateEngine(TranslateEngine):
    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4o-mini",
        base_url: str | None = None,
        prompt_template: str | None = None,
    ):
        self.client = OpenAI(api_key=api_key, base_url=base_url)
        self.model = model
        self.prompt_template = prompt_template or DEFAULT_TRANSLATE_PROMPT

    def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        if not text.strip():
            return ""

        effective_source = "auto-detected language" if source_lang.lower() == "auto" else source_lang
        system_prompt = self.prompt_template.format(
            source_lang=effective_source, target_lang=target_lang
        )
        request_payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text},
            ],
            "temperature": 0.3,
        }
        # logger.info("[OpenAI] base_url=%s model=%s", self.client.base_url, self.model)
        # logger.info("[OpenAI] request payload: %s", request_payload)
        try:
            response = self.client.chat.completions.create(**request_payload)
            # logger.info("[OpenAI] response: %s", response)
            return self._extract_text(response)
        except Exception as e:
            logger.error("[OpenAI] error: %s", e)
            raise

    def _extract_text(self, response: Any) -> str:
        choices = getattr(response, "choices", None) or []
        if not choices:
            raise ValueError("OpenAI returned no choices for translation request")

        choice = choices[0]
        message = getattr(choice, "message", None)
        if message is None:
            raise ValueError("OpenAI returned no message for translation request")

        content = getattr(message, "content", None)
        if isinstance(content, str):
            return content.strip()

        finish_reason = getattr(choice, "finish_reason", None)
        refusal = getattr(message, "refusal", None)
        raise ValueError(
            "OpenAI returned no text content for translation "
            f"(finish_reason={finish_reason}, refusal={refusal})"
        )
