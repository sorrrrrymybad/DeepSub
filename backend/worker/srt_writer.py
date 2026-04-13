from __future__ import annotations

from datetime import timedelta

import pysrt


def segments_to_srt(segments: list[dict], output_path: str) -> None:
    subs = pysrt.SubRipFile()
    for index, segment in enumerate(segments, start=1):
        subs.append(
            pysrt.SubRipItem(
                index=index,
                start=_seconds_to_time(segment["start"]),
                end=_seconds_to_time(segment["end"]),
                text=segment["text"],
            )
        )
    subs.save(output_path, encoding="utf-8")


def _seconds_to_time(seconds: float) -> pysrt.SubRipTime:
    delta = timedelta(seconds=seconds)
    total_ms = int(delta.total_seconds() * 1000)
    hours, remainder = divmod(total_ms, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    secs, millis = divmod(remainder, 1000)
    return pysrt.SubRipTime(hours, minutes, secs, millis)
