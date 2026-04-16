import logging

import anthropic

from engines.base import TranslateEngine

logger = logging.getLogger(__name__)

DEFAULT_TRANSLATE_PROMPT = (
    "You are a professional subtitle translator. "
    "Translate from {source_lang} to {target_lang}. "
    "Output ONLY the translated text, no explanations."
)


class ClaudeTranslateEngine(TranslateEngine):
    def __init__(
        self,
        api_key: str,
        model: str = "claude-haiku-4-5-20251001",
        base_url: str | None = None,
        prompt_template: str | None = None,
    ):
        client_kwargs = {"api_key": api_key}
        if base_url:
            client_kwargs["base_url"] = base_url
        self.client = anthropic.Anthropic(**client_kwargs)
        self.model = model
        self.prompt_template = prompt_template or DEFAULT_TRANSLATE_PROMPT

    def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        effective_source = "auto-detected language" if source_lang.lower() == "auto" else source_lang
        system_prompt = self.prompt_template.format(
            source_lang=effective_source, target_lang=target_lang
        )
        request_payload = {
            "model": self.model,
            "max_tokens": 4096,
            "system": system_prompt,
            "messages": [{"role": "user", "content": text}],
        }
        # logger.info("[Claude] base_url=%s model=%s", getattr(self.client, 'base_url', None), self.model)
        # logger.info("[Claude] request payload: %s", request_payload)
        try:
            message = self.client.messages.create(**request_payload)
            # logger.info("[Claude] response: %s", message)
            return message.content[0].text.strip()
        except Exception as e:
            logger.error("[Claude] error: %s", e)
            raise
