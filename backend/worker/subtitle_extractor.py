from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass


@dataclass
class SubtitleTrack:
    index: int
    language: str | None
    forced: bool


def probe_subtitle_tracks(video_path: str) -> list[SubtitleTrack]:
    cmd = [
        "ffprobe",
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_streams",
        "-select_streams",
        "s",
        video_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        return []

    data = json.loads(result.stdout)
    tracks = []
    for stream in data.get("streams", []):
        tags = stream.get("tags", {})
        disposition = stream.get("disposition", {})
        language = tags.get("language") or None
        if language in {"", "und"}:
            language = None
        tracks.append(
            SubtitleTrack(
                index=stream["index"],
                language=language,
                forced=bool(disposition.get("forced", 0)),
            )
        )
    return tracks


def select_best_track(
    tracks: list[SubtitleTrack], source_lang: str
) -> SubtitleTrack | None:
    if not tracks:
        return None

    if source_lang == "auto":
        non_forced = [track for track in tracks if not track.forced]
        return (non_forced or tracks)[0]

    matched = [track for track in tracks if track.language == source_lang]
    non_forced_matched = [track for track in matched if not track.forced]
    if non_forced_matched:
        return non_forced_matched[0]
    if matched:
        return matched[0]
    return select_best_track(tracks, "auto")


def extract_subtitle_track(video_path: str, track_index: int, output_srt: str) -> None:
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        video_path,
        "-map",
        f"0:{track_index}",
        "-c:s",
        "srt",
        output_srt,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg extract failed: {result.stderr}")
