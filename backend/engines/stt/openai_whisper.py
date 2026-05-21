from __future__ import annotations

from openai import OpenAI

from engines.base import STTEngine


class OpenAIWhisperEngine(STTEngine):
    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)

    def transcribe(self, audio_path: str, language: str | None = None, progress_callback=None) -> list[dict]:
        with open(audio_path, "rb") as audio_file:
            kwargs = {
                "model": "whisper-1",
                "file": audio_file,
                "response_format": "verbose_json",
                "timestamp_granularities": ["segment"],
            }
            if language and language != "auto":
                kwargs["language"] = language
            result = self.client.audio.transcriptions.create(**kwargs)
        segments = [
            {"start": segment.start, "end": segment.end, "text": segment.text.strip()}
            for segment in result.segments
        ]
        if progress_callback:
            progress_callback(1.0)
        return segments
