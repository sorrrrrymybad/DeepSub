from __future__ import annotations

from openai import OpenAI

from engines.base import STTEngine


class OpenAIWhisperEngine(STTEngine):
    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)

    def transcribe(self, audio_path: str, language: str | None = None) -> list[dict]:
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
        return [
            {"start": segment.start, "end": segment.end, "text": segment.text.strip()}
            for segment in result.segments
        ]
