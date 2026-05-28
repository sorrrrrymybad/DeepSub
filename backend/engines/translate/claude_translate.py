import logging

import anthropic

from engines.base import (
    TranslateEngine,
    build_indexed_translation_payload,
    parse_indexed_translation_response,
)

logger = logging.getLogger(__name__)

DEFAULT_TRANSLATE_PROMPT = (
    "You are a professional subtitle translator. "
    "Translate from {source_lang} to {target_lang}. "
    "Output ONLY the translated text, no explanations."
)

BATCH_FORMAT_INSTRUCTIONS = (
    "Batch format requirements:\n"
    "- The user input is a JSON array of objects with id and text fields.\n"
    "- Translate only the text value of each object.\n"
    "- Return ONLY a JSON array of objects using the same ids.\n"
    "- Do not add, remove, merge, split, reorder, or renumber items.\n"
    "- Each output object must be shaped as {\"id\": number, \"text\": string}."
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
        return self._translate_text(text, source_lang=source_lang, target_lang=target_lang)

    def _translate_text(
        self,
        text: str,
        source_lang: str,
        target_lang: str,
        extra_system_instructions: str | None = None,
    ) -> str:
        effective_source = "auto-detected language" if source_lang.lower() == "auto" else source_lang
        system_prompt = self.prompt_template.format(
            source_lang=effective_source, target_lang=target_lang
        )
        if extra_system_instructions:
            system_prompt = f"{system_prompt}\n\n{extra_system_instructions}"
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

    def translate_batch(
        self,
        texts: list[str],
        source_lang: str,
        target_lang: str,
        batch_size: int = 1,
        progress_callback=None,
        batch_callback=None,
    ) -> list[str]:
        cleaned = [text.replace("\n", " ").strip() for text in texts]
        total = len(cleaned)
        if total == 0:
            return []

        if batch_size <= 1:
            return super().translate_batch(
                texts,
                source_lang=source_lang,
                target_lang=target_lang,
                batch_size=batch_size,
                progress_callback=progress_callback,
                batch_callback=batch_callback,
            )

        results: list[str] = []
        for start in range(0, total, batch_size):
            chunk = cleaned[start : start + batch_size]
            translated = self._translate_batch_chunk(
                chunk,
                source_lang=source_lang,
                target_lang=target_lang,
            )
            results.extend(translated)
            if batch_callback:
                batch_callback(chunk, translated)
            if progress_callback:
                progress_callback(min(start + len(chunk), total) / total)
        return results

    def _translate_batch_chunk(
        self,
        texts: list[str],
        source_lang: str,
        target_lang: str,
    ) -> list[str]:
        if not texts:
            return []
        if len(texts) == 1:
            return [
                self.translate(
                    texts[0],
                    source_lang=source_lang,
                    target_lang=target_lang,
                )
            ]

        payload = build_indexed_translation_payload(texts)
        translated = self._translate_text(
            payload,
            source_lang=source_lang,
            target_lang=target_lang,
            extra_system_instructions=BATCH_FORMAT_INSTRUCTIONS,
        )
        return parse_indexed_translation_response(translated, expected_count=len(texts))
