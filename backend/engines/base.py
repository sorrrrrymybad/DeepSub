from abc import ABC, abstractmethod


class TranslateEngine(ABC):
    @abstractmethod
    def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        """Translate a single text segment."""

    def translate_batch(
        self, texts: list[str], source_lang: str, target_lang: str
    ) -> list[str]:
        return [
            self.translate(text, source_lang=source_lang, target_lang=target_lang)
            for text in texts
        ]


class STTEngine(ABC):
    @abstractmethod
    def transcribe(self, audio_path: str, language: str | None = None) -> list[dict]:
        """Transcribe audio into subtitle-like segments."""
