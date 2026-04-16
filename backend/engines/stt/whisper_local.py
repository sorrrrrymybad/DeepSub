from __future__ import annotations

from engines.base import STTEngine


class WhisperLocalEngine(STTEngine):
    def __init__(self, model_size: str = "base", model_dir: str = "./data/whisper-models", compute_type: str = "float32"):
        self.model_size = model_size
        self.model_dir = model_dir
        self.compute_type = compute_type
        self._model = None

    def _load_model(self) -> None:
        if self._model is None:
            from faster_whisper import WhisperModel

            self._model = WhisperModel(self.model_size, download_root=self.model_dir, compute_type=self.compute_type)

    def transcribe(self, audio_path: str, language: str | None = None, progress_callback=None) -> list[dict]:
        self._load_model()
        segments, info = self._model.transcribe(
            audio_path,
            language=language if language != "auto" else None,
        )
        duration = info.duration or 0
        result = []
        for segment in segments:
            result.append({"start": segment.start, "end": segment.end, "text": segment.text.strip()})
            if progress_callback and duration > 0:
                progress_callback(min(segment.end / duration, 1.0))
        return result
