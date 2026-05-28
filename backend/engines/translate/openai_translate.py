import logging
from typing import Any

from openai import APIStatusError, OpenAI

from engines.base import (
    TranslateEngine,
    build_indexed_translation_payload,
    emit_batch_callback,
    parse_indexed_translation_response,
)

logger = logging.getLogger(__name__)
CONTEXT_WINDOW_SIZE = 10

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
        return self._translate_with_context(
            text,
            source_lang=source_lang,
            target_lang=target_lang,
            context_texts=None,
        )

    def _translate_with_context(
        self,
        text: str,
        source_lang: str,
        target_lang: str,
        context_texts: list[str] | None = None,
        extra_instructions: str | None = None,
    ) -> str:
        if not text.strip():
            return ""

        effective_source = "auto-detected language" if source_lang.lower() == "auto" else source_lang
        instructions = self.prompt_template.format(
            source_lang=effective_source, target_lang=target_lang
        )
        if extra_instructions:
            instructions = f"{instructions}\n\n{extra_instructions}"
        input_text = self._build_input_text(text, context_texts)
        request_payload = {
            "model": self.model,
            "instructions": instructions,
            "input": input_text,
            "temperature": 0.3,
        }
        # logger.info("[OpenAI] base_url=%s model=%s", self.client.base_url, self.model)
        # logger.info("[OpenAI] request payload: %s", request_payload)
        try:
            response = self._create_response(request_payload)
            # logger.info("[OpenAI] response: %s", response)
            return self._extract_text(response)
        except Exception as e:
            logger.error("[OpenAI] error: %s", e)
            raise

    def _create_response(self, request_payload: dict) -> Any:
        try:
            return self.client.responses.create(**request_payload)
        except APIStatusError as exc:
            if getattr(exc, "status_code", None) != 404:
                raise
            logger.info(
                "[OpenAI] responses API unavailable, falling back to chat completions"
            )
            completion = self.client.chat.completions.create(
                model=request_payload["model"],
                messages=[
                    {"role": "system", "content": request_payload["instructions"]},
                    {"role": "user", "content": request_payload["input"]},
                ],
                temperature=request_payload.get("temperature", 0.3),
            )
            return completion

    def translate_batch(
        self,
        texts: list[str],
        source_lang: str,
        target_lang: str,
        batch_size: int = 1,
        progress_callback=None,
        batch_callback=None,
    ) -> list[str]:
        cleaned = [t.replace("\n", " ").strip() for t in texts]
        total = len(cleaned)
        if total == 0:
            return []

        if batch_size <= 1:
            results: list[str] = []
            for idx, text in enumerate(cleaned):
                context_texts = cleaned[max(0, idx - CONTEXT_WINDOW_SIZE) : idx]
                result = self._translate_with_context(
                    text,
                    source_lang=source_lang,
                    target_lang=target_lang,
                    context_texts=context_texts,
                )
                results.append(result)
                emit_batch_callback(
                    batch_callback,
                    [text],
                    [result],
                    raw_input=self._build_input_text(text, context_texts),
                    raw_output=result,
                )
                if progress_callback:
                    progress_callback((idx + 1) / total)
            return results

        results: list[str] = []
        for start in range(0, total, batch_size):
            chunk = cleaned[start : start + batch_size]
            context_texts = cleaned[max(0, start - CONTEXT_WINDOW_SIZE) : start]
            translated, metadata = self._translate_batch_chunk_with_metadata(
                chunk,
                source_lang=source_lang,
                target_lang=target_lang,
                context_texts=context_texts,
            )
            results.extend(translated)
            emit_batch_callback(
                batch_callback,
                chunk,
                translated,
                raw_input=metadata["raw_input"],
                raw_output=metadata["raw_output"],
            )
            if progress_callback:
                progress_callback(min(start + len(chunk), total) / total)
        return results

    def _translate_batch_chunk(
        self,
        texts: list[str],
        source_lang: str,
        target_lang: str,
        context_texts: list[str] | None = None,
    ) -> list[str]:
        translated, _ = self._translate_batch_chunk_with_metadata(
            texts,
            source_lang=source_lang,
            target_lang=target_lang,
            context_texts=context_texts,
        )
        return translated

    def _translate_batch_chunk_with_metadata(
        self,
        texts: list[str],
        source_lang: str,
        target_lang: str,
        context_texts: list[str] | None = None,
    ) -> tuple[list[str], dict[str, str]]:
        if not texts:
            return [], {"raw_input": "", "raw_output": ""}
        if len(texts) == 1:
            raw_output = self._translate_with_context(
                texts[0],
                source_lang=source_lang,
                target_lang=target_lang,
                context_texts=context_texts,
            )
            return [raw_output], {
                "raw_input": self._build_input_text(texts[0], context_texts),
                "raw_output": raw_output,
            }

        payload = build_indexed_translation_payload(texts)
        raw_input = self._build_input_text(payload, context_texts)
        translated = self._translate_with_context(
            payload,
            source_lang=source_lang,
            target_lang=target_lang,
            context_texts=context_texts,
            extra_instructions=BATCH_FORMAT_INSTRUCTIONS,
        )
        return parse_indexed_translation_response(translated, expected_count=len(texts)), {
            "raw_input": raw_input,
            "raw_output": translated,
        }

    def _build_input_text(self, text: str, context_texts: list[str] | None = None) -> str:
        if not context_texts:
            return f"Current subtitle to translate:\n{text}"
        context = "\n".join(context_texts)
        return (
            "Previous subtitles for context only. Do not translate them:\n"
            f"{context}\n\n"
            "Current subtitle to translate:\n"
            f"{text}"
        )

    def _extract_text(self, response: Any) -> str:
        output_text = getattr(response, "output_text", None)
        if isinstance(output_text, str) and output_text.strip():
            return output_text.strip()

        choices = getattr(response, "choices", None) or []
        if choices:
            message = getattr(choices[0], "message", None)
            content = getattr(message, "content", None)
            if isinstance(content, str) and content.strip():
                return content.strip()

        for item in getattr(response, "output", None) or []:
            for content in getattr(item, "content", None) or []:
                text = getattr(content, "text", None)
                if isinstance(text, str) and text.strip():
                    return text.strip()

        raise ValueError("OpenAI returned no text output for translation request")
