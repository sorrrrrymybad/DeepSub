from __future__ import annotations

# Created by Sorrymybad


def make_stage_progress_callback(update_progress, start: int, end: int):
    width = end - start

    def callback(ratio: float) -> None:
        clamped = max(0.0, min(ratio, 1.0))
        update_progress(int(start + clamped * width))

    return callback
