from abc import ABC, abstractmethod
import inspect
import json


class TranslateEngine(ABC):
    @abstractmethod
    def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        """Translate a single text segment."""

    def translate_batch(
        self,
        texts: list[str],
        source_lang: str,
        target_lang: str,
        batch_size: int = 1,
        progress_callback=None,
        batch_callback=None,
    ) -> list[str]:
        # Default to per-segment translation. Joining subtitles and splitting by
        # newlines can silently shift translated text onto the wrong timestamps.
        cleaned = [t.replace("\n", " ").strip() for t in texts]
        total = len(cleaned)
        results: list[str] = []
        for idx, text in enumerate(cleaned):
            result = self.translate(text, source_lang=source_lang, target_lang=target_lang)
            results.append(result)
            emit_batch_callback(
                batch_callback,
                [text],
                [result],
                raw_input=text,
                raw_output=result,
            )
            if progress_callback:
                progress_callback((idx + 1) / total if total else 1.0)
        return results


class STTEngine(ABC):
    @abstractmethod
    def transcribe(self, audio_path: str, language: str | None = None, progress_callback=None) -> list[dict]:
        """Transcribe audio into subtitle-like segments.

        progress_callback(ratio: float) called with 0.0-1.0 as transcription progresses.
        """


def build_indexed_translation_payload(texts: list[str]) -> str:
    return json.dumps(
        [{"id": index, "text": text} for index, text in enumerate(texts)],
        ensure_ascii=False,
    )


def parse_indexed_translation_response(response_text: str, expected_count: int) -> list[str]:
    raw = response_text.strip()
    if raw.startswith("```"):
        lines = raw.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        raw = "\n".join(lines).strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError("Translation response must be a JSON array") from exc

    if isinstance(data, dict) and isinstance(data.get("translations"), list):
        data = data["translations"]
    if not isinstance(data, list):
        raise ValueError("Translation response must be a JSON array")

    translated_by_id: dict[int, str] = {}
    for item in data:
        if not isinstance(item, dict):
            raise ValueError("Translation response items must be objects")
        item_id = item.get("id")
        text = item.get("text")
        if not isinstance(item_id, int):
            raise ValueError("Translation response item id must be an integer")
        if item_id < 0 or item_id >= expected_count:
            raise ValueError(f"Translation response contains unexpected id: {item_id}")
        if item_id in translated_by_id:
            raise ValueError(f"Translation response contains duplicate id: {item_id}")
        if not isinstance(text, str):
            raise ValueError(f"Translation response text for id {item_id} must be a string")
        translated_by_id[item_id] = text.strip()

    missing = [index for index in range(expected_count) if index not in translated_by_id]
    if missing:
        raise ValueError(f"Translation response missing item ids: {missing}")

    return [translated_by_id[index] for index in range(expected_count)]


def emit_batch_callback(
    batch_callback,
    inputs: list[str],
    outputs: list[str],
    *,
    raw_input: str | None = None,
    raw_output: str | None = None,
) -> None:
    if not batch_callback:
        return

    metadata = {
        "raw_input": raw_input if raw_input is not None else "\n".join(inputs),
        "raw_output": raw_output if raw_output is not None else "\n".join(outputs),
    }
    try:
        parameters = inspect.signature(batch_callback).parameters
    except (TypeError, ValueError):
        batch_callback(inputs, outputs, metadata)
        return

    accepts_varargs = any(
        parameter.kind == inspect.Parameter.VAR_POSITIONAL
        for parameter in parameters.values()
    )
    if accepts_varargs or len(parameters) >= 3:
        batch_callback(inputs, outputs, metadata)
    else:
        batch_callback(inputs, outputs)
