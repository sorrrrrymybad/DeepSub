from __future__ import annotations

from engines.base import STTEngine


class WhisperLocalEngine(STTEngine):
    def __init__(self, model_size: str = "base", model_dir: str = "./data/whisper-models"):
        self.model_size = model_size
        self.model_dir = model_dir
        self._model = None

    def _load_model(self) -> None:
        if self._model is None:
            from faster_whisper import WhisperModel

            self._model = WhisperModel(self.model_size, download_root=self.model_dir)

    def transcribe(self, audio_path: str, language: str | None = None) -> list[dict]:
        self._load_model()
        segments, _ = self._model.transcribe(
            audio_path,
            language=language if language != "auto" else None,
        )
        return [
            {"start": segment.start, "end": segment.end, "text": segment.text.strip()}
            for segment in segments
        ]
