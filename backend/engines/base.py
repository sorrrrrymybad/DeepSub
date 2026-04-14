from abc import ABC, abstractmethod


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
    ) -> list[str]:
        # Strip inline newlines from each segment before translation
        cleaned = [t.replace("\n", " ").strip() for t in texts]

        if batch_size <= 1:
            return [
                self.translate(text, source_lang=source_lang, target_lang=target_lang)
                for text in cleaned
            ]

        results: list[str] = []
        for i in range(0, len(cleaned), batch_size):
            chunk = cleaned[i : i + batch_size]
            merged = "\n".join(chunk)
            translated = self.translate(merged, source_lang=source_lang, target_lang=target_lang)
            parts = translated.split("\n")
            # Pad or trim to match chunk length in case the model returns different line counts
            if len(parts) < len(chunk):
                parts += [""] * (len(chunk) - len(parts))
            results.extend(parts[: len(chunk)])
        return results


class STTEngine(ABC):
    @abstractmethod
    def transcribe(self, audio_path: str, language: str | None = None) -> list[dict]:
        """Transcribe audio into subtitle-like segments."""
