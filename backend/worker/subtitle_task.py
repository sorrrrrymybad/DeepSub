from __future__ import annotations

import json
import logging
import os
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pysrt

from celery_app import celery_app
from core.config import settings
from core.database import SessionLocal
from models.task import Task
from smb.client import SMBClient
from engines.base import parse_indexed_translation_response
from worker.progress import make_stage_progress_callback
from worker.srt_writer import segments_to_srt
from worker.subtitle_extractor import (
    extract_subtitle_track,
    probe_subtitle_tracks,
    select_best_track,
)

logger = logging.getLogger(__name__)
VIDEO_EXTS = {".mkv", ".mp4", ".avi", ".ts", ".mov"}
WHISPER_RAW_CACHE = "source_whisper.json"
WHISPER_SEGMENTS_CACHE = "source_segments.json"


class _TaskIdFilter(logging.Filter):
    def __init__(self, task_id: int):
        super().__init__()
        self.task_id = task_id

    def filter(self, record: logging.LogRecord) -> bool:
        record.task_id = self.task_id
        return True


def _get_log_dir(task_id: int) -> Path:
    return settings.log_dir / str(task_id)


def _get_tmp_dir(task_id: int) -> str:
    return str(settings.tmp_dir / str(task_id))


def _cleanup_task_logger(task_logger: logging.Logger) -> None:
    for handler in list(task_logger.handlers):
        task_logger.removeHandler(handler)
        handler.close()


def _configure_task_logger(task_id: int, log_path: str | Path) -> logging.Logger:
    task_logger = logging.getLogger(f"task.{task_id}")
    _cleanup_task_logger(task_logger)

    formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] [task:%(task_id)s] %(message)s"
    )
    task_id_filter = _TaskIdFilter(task_id)

    file_handler = logging.FileHandler(log_path, encoding="utf-8")
    file_handler.setFormatter(formatter)
    file_handler.addFilter(task_id_filter)

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)
    stream_handler.addFilter(task_id_filter)

    task_logger.setLevel(logging.INFO)
    task_logger.propagate = False
    task_logger.addHandler(file_handler)
    task_logger.addHandler(stream_handler)
    return task_logger


def _update_task(db, task_id: int, **kwargs) -> None:
    db.query(Task).filter(Task.id == task_id).update(kwargs)
    db.commit()
    try:
        import redis as sync_redis

        redis_client = sync_redis.from_url(settings.redis_url)
        payload = {
            key: value.isoformat() if hasattr(value, "isoformat") else value
            for key, value in kwargs.items()
        }
        redis_client.publish("task_updates", json.dumps({"task_id": task_id, **payload}))
    except Exception as exc:
        logger.warning("Failed to publish task update for task %s: %s", task_id, exc)


def _build_translate_engine(engine_name: str, db):
    from core.crypto import decrypt
    from core.translation_profiles import get_active_translation_profile
    from engines.translate.deepl import DeepLEngine
    from engines.translate.deeplx import DeepLXEngine
    from engines.translate.google import GoogleTranslateEngine
    from engines.translate.openai_translate import OpenAITranslateEngine
    from models.setting import Setting

    def get_setting(key: str) -> str:
        setting = db.query(Setting).filter(Setting.key == key).first()
        if not setting:
            return ""
        try:
            return decrypt(setting.value)
        except Exception:
            return setting.value

    if engine_name == "deeplx":
        raw = get_setting("translate.deeplx.endpoint") or ""
        endpoints = [u.strip() for u in raw.splitlines() if u.strip()]
        return DeepLXEngine(endpoints=endpoints)
    if engine_name == "deepl":
        return DeepLEngine(api_key=get_setting("translate.deepl.api_key"))
    if engine_name == "google":
        return GoogleTranslateEngine(api_key=get_setting("translate.google.api_key"))
    if engine_name == "openai":
        profile = get_active_translation_profile(db, "openai")
        if profile:
            return OpenAITranslateEngine(
                api_key=profile["api_key"],
                model=profile["model"] or "gpt-4o-mini",
                base_url=profile["base_url"] or None,
                prompt_template=get_setting("translate.prompt") or None,
            )
        return OpenAITranslateEngine(
            api_key=get_setting("translate.openai.api_key"),
            model=get_setting("translate.openai.model") or "gpt-4o-mini",
            base_url=get_setting("translate.openai.base_url") or None,
            prompt_template=get_setting("translate.prompt") or None,
        )
    if engine_name == "claude":
        from engines.translate.claude_translate import ClaudeTranslateEngine
        profile = get_active_translation_profile(db, "claude")
        if profile:
            return ClaudeTranslateEngine(
                api_key=profile["api_key"],
                model=profile["model"] or "claude-haiku-4-5-20251001",
                base_url=profile["base_url"] or None,
                prompt_template=get_setting("translate.prompt") or None,
            )
        return ClaudeTranslateEngine(
            api_key=get_setting("translate.claude.api_key"),
            model=get_setting("translate.claude.model") or "claude-haiku-4-5-20251001",
            base_url=get_setting("translate.claude.base_url") or None,
            prompt_template=get_setting("translate.prompt") or None,
        )
    raise ValueError(f"Unknown translate engine: {engine_name}")


def _normalize_translated_text(text: str) -> str:
    text = text.replace("。", " ").replace(".", " ")
    return re.sub(r"[,，]\s*$", " ", text)


def _load_cached_translations(
    jsonl_path: Path,
    expected_count: int,
    cache_logger: logging.Logger | None = None,
) -> list[str | None]:
    cached: list[str | None] = [None] * expected_count
    if not jsonl_path.exists():
        return cached
    active_logger = cache_logger or logger

    with open(jsonl_path, "r", encoding="utf-8") as f:
        for line_number, line in enumerate(f, start=1):
            try:
                record = json.loads(line)
                start, end = record["segment_range"]
                if not isinstance(start, int) or not isinstance(end, int):
                    active_logger.warning(
                        "Skipping invalid cached translation line %s in %s: invalid segment_range types",
                        line_number,
                        jsonl_path,
                    )
                    continue
                if start < 0 or end > expected_count or start >= end:
                    active_logger.warning(
                        "Skipping invalid cached translation line %s in %s: segment_range out of bounds",
                        line_number,
                        jsonl_path,
                    )
                    continue
                output = record.get("output")
                if not isinstance(output, str):
                    active_logger.warning(
                        "Skipping invalid cached translation line %s in %s: missing output",
                        line_number,
                        jsonl_path,
                    )
                    continue
                span = end - start
                translated = (
                    [output.strip()]
                    if span == 1
                    else parse_indexed_translation_response(output, expected_count=span)
                )
                if len(translated) != span:
                    active_logger.warning(
                        "Skipping invalid cached translation line %s in %s: output count mismatch",
                        line_number,
                        jsonl_path,
                    )
                    continue
            except Exception as exc:
                active_logger.warning(
                    "Skipping invalid cached translation line %s in %s: %s",
                    line_number,
                    jsonl_path,
                    exc,
                )
                continue

            for index, text in enumerate(translated, start=start):
                cached[index] = text
    return cached


def _get_cached_translation_prefix_length(cached: list[str | None]) -> int:
    for index, text in enumerate(cached):
        if text is None:
            return index
    return len(cached)


def _build_stt_engine(engine_name: str, db):
    from core.crypto import decrypt
    from engines.stt.openai_whisper import OpenAIWhisperEngine
    from engines.stt.whisper_local import WhisperLocalEngine
    from models.setting import Setting

    def get_setting(key: str) -> str:
        setting = db.query(Setting).filter(Setting.key == key).first()
        if not setting:
            return ""
        try:
            return decrypt(setting.value)
        except Exception:
            return setting.value

    if engine_name == "whisper_local":
        return WhisperLocalEngine(
            model_size=get_setting("stt.whisper_local.model_size") or "base",
            model_dir=str(settings.whisper_model_dir),
            compute_type=get_setting("stt.whisper_local.compute_type") or "float32",
        )
    if engine_name == "openai_whisper":
        return OpenAIWhisperEngine(api_key=get_setting("stt.openai_whisper.api_key"))
    raise ValueError(f"Unknown STT engine: {engine_name}")


def load_cached_whisper_result(log_dir: str | Path) -> list[dict] | None:
    segments_path = Path(log_dir) / WHISPER_SEGMENTS_CACHE
    if not segments_path.exists():
        return None

    with open(segments_path, "r", encoding="utf-8") as f:
        segments = json.load(f)

    if not isinstance(segments, list):
        raise ValueError("Cached Whisper segments must be a list")
    return segments


def save_whisper_result(log_dir: str | Path, segments: list[dict]) -> None:
    log_path = Path(log_dir)
    log_path.mkdir(parents=True, exist_ok=True)
    raw_result = {
        "text": "\n".join(segment.get("text", "") for segment in segments),
        "segments": segments,
    }
    with open(log_path / WHISPER_RAW_CACHE, "w", encoding="utf-8") as f:
        json.dump(raw_result, f, ensure_ascii=False, indent=2)
    with open(log_path / WHISPER_SEGMENTS_CACHE, "w", encoding="utf-8") as f:
        json.dump(segments, f, ensure_ascii=False, indent=2)


def get_or_transcribe_segments(
    task,
    db,
    audio_path: str,
    log_dir: str | Path,
    task_id: int,
    task_logger: logging.Logger,
    progress_callback=None,
) -> list[dict]:
    cached_segments = load_cached_whisper_result(log_dir)
    if cached_segments is not None:
        task_logger.info(
            "Using cached Whisper result for task %s (%s segments)",
            task_id,
            len(cached_segments),
        )
        return cached_segments

    stt_engine = _build_stt_engine(task.stt_engine, db)
    language = task.source_lang if task.source_lang != "auto" else None
    segments = stt_engine.transcribe(
        audio_path,
        language=language,
        progress_callback=progress_callback,
    )
    save_whisper_result(log_dir, segments)
    return segments


def prepare_smb_output_client(task, db) -> SMBClient | None:
    if task.source_type != "smb":
        return None

    from models.smb_server import SMBServer

    server = db.query(SMBServer).filter(SMBServer.id == task.smb_server_id).first()
    if not server:
        raise ValueError("SMB server not found")
    return SMBClient.from_server_model(server)


def prepare_source_video(task, db, tmp_dir: str, task_logger: logging.Logger) -> tuple[str, SMBClient | None]:
    local_video = os.path.join(tmp_dir, "video" + Path(task.file_path).suffix)

    if task.source_type == "smb":
        from models.smb_server import SMBServer

        server = db.query(SMBServer).filter(SMBServer.id == task.smb_server_id).first()
        if not server:
            raise ValueError("SMB server not found")

        client = SMBClient.from_server_model(server)
        task_logger.info(
            "Preparing SMB video download: server_id=%s remote=%s local=%s",
            task.smb_server_id,
            task.file_path,
            local_video,
        )
        return local_video, client

    source_path = Path(task.file_path)
    if not source_path.is_absolute():
        raise ValueError("Local file path must be absolute")
    if not source_path.exists():
        raise FileNotFoundError(f"Local file not found: {task.file_path}")
    if not source_path.is_file():
        raise ValueError(f"Local path is not a file: {task.file_path}")
    if source_path.suffix.lower() not in VIDEO_EXTS:
        raise ValueError(f"Unsupported local video file: {task.file_path}")

    task_logger.info("Preparing local video: %s", task.file_path)
    copy_started_at = time.monotonic()
    shutil.copy2(source_path, local_video)
    task_logger.info(
        "Copied local video to temp path: %s (size=%s bytes, elapsed=%.2fs)",
        local_video,
        Path(local_video).stat().st_size,
        time.monotonic() - copy_started_at,
    )
    return local_video, None


def _output_srt_name(file_path: str | Path, target_lang: str, suffix: int = 0) -> str:
    stem = Path(file_path).stem
    if suffix > 0:
        return f"{stem}.{target_lang}.{suffix}.srt"
    return f"{stem}.{target_lang}.srt"


def _resolve_output_srt_path(
    video_path: str | Path,
    target_lang: str,
    overwrite: bool,
) -> Path:
    output_path = Path(video_path).with_name(_output_srt_name(video_path, target_lang))
    if overwrite:
        return output_path

    suffix = 1
    while output_path.exists():
        output_path = Path(video_path).with_name(
            _output_srt_name(video_path, target_lang, suffix)
        )
        suffix += 1
    return output_path


def _resolve_output_srt_remote(
    file_path: str,
    target_lang: str,
    overwrite: bool,
    file_exists,
) -> str:
    output_remote = str(Path(file_path).parent / _output_srt_name(file_path, target_lang))
    if overwrite:
        return output_remote

    suffix = 1
    while file_exists(output_remote):
        output_remote = str(
            Path(file_path).parent / _output_srt_name(file_path, target_lang, suffix)
        )
        suffix += 1
    return output_remote


def write_output_subtitle(
    task,
    client,
    tmp_dir: str,
    segments,
    task_logger: logging.Logger,
    progress_callback=None,
) -> str:
    output_srt_name = _output_srt_name(task.file_path, task.target_lang)

    if task.source_type == "smb":
        output_srt_remote = _resolve_output_srt_remote(
            file_path=task.file_path,
            target_lang=task.target_lang,
            overwrite=task.overwrite,
            file_exists=client.file_exists,
        )

        local_srt = os.path.join(tmp_dir, output_srt_name)
        os.makedirs(os.path.dirname(local_srt), exist_ok=True)
        segments_to_srt(segments, local_srt)
        upload_started_at = time.monotonic()
        task_logger.info(
            "Uploading SRT to SMB: remote=%s local=%s size=%s bytes",
            output_srt_remote,
            local_srt,
            os.path.getsize(local_srt),
        )
        client.upload_file(
            local_srt,
            output_srt_remote,
            progress_callback=progress_callback,
        )
        task_logger.info(
            "Uploaded SRT to SMB: %s (elapsed=%.2fs)",
            output_srt_remote,
            time.monotonic() - upload_started_at,
        )
        return output_srt_remote

    output_srt_path = _resolve_output_srt_path(
        video_path=task.file_path,
        target_lang=task.target_lang,
        overwrite=task.overwrite,
    )
    segments_to_srt(segments, str(output_srt_path))
    task_logger.info(
        "Writing SRT to local path: %s (size=%s bytes)",
        output_srt_path,
        output_srt_path.stat().st_size,
    )
    return str(output_srt_path)


@celery_app.task(bind=True, max_retries=0)
def process_subtitle_task(self, task_id: int):
    db = SessionLocal()
    log_dir = _get_log_dir(task_id)
    tmp_dir = _get_tmp_dir(task_id)
    os.makedirs(tmp_dir, exist_ok=True)
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / "task.log"

    task_logger = _configure_task_logger(task_id=task_id, log_path=str(log_path))

    try:
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            return

        _update_task(
            db,
            task_id,
            status="running",
            started_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
            celery_task_id=self.request.id,
            progress=5,
        )
        task_logger.info("Started processing: %s", task.file_path)

        cached_segments = load_cached_whisper_result(log_dir)
        if cached_segments is not None:
            task_logger.info(
                "Cached Whisper result found, skipping source preparation and STT."
            )
            segments = cached_segments
            client = prepare_smb_output_client(task, db)
            _update_task(db, task_id, progress=60)
        else:
            local_video, client = prepare_source_video(task, db, tmp_dir, task_logger)
            if task.source_type == "smb":
                download_progress = make_stage_progress_callback(
                    lambda progress: _update_task(db, task_id, progress=progress),
                    start=5,
                    end=20,
                )
                download_started_at = time.monotonic()
                client.download_file(
                    task.file_path,
                    local_video,
                    progress_callback=download_progress,
                )
                task_logger.info(
                    "Downloaded SMB video to temp path: %s (size=%s bytes, elapsed=%.2fs)",
                    local_video,
                    Path(local_video).stat().st_size,
                    time.monotonic() - download_started_at,
                )
            else:
                _update_task(db, task_id, progress=20)
            _update_task(db, task_id, progress=20)

            tracks = probe_subtitle_tracks(local_video)
            task_logger.info("Found %s subtitle track(s)", len(tracks))

            if tracks:
                best = select_best_track(tracks, task.source_lang)
                extracted_srt = os.path.join(tmp_dir, "extracted.srt")
                task_logger.info(
                    "Extracting track index=%s, lang=%s", best.index, best.language
                )
                extract_subtitle_track(local_video, best.index, extracted_srt)
                _update_task(db, task_id, progress=40)
                subs = pysrt.open(extracted_srt)
                segments = [
                    {
                        "start": sub.start.ordinal / 1000,
                        "end": sub.end.ordinal / 1000,
                        "text": sub.text,
                    }
                    for sub in subs
                ]
            else:
                task_logger.info("No subtitle tracks found, running STT...")
                audio_path = os.path.join(tmp_dir, "audio.wav")
                task_logger.info(
                    "Extracting audio with ffmpeg: input=%s output=%s",
                    local_video,
                    audio_path,
                )
                audio_started_at = time.monotonic()
                try:
                    subprocess.run(
                        [
                            "ffmpeg",
                            "-y",
                            "-i",
                            local_video,
                            "-vn",
                            "-ar",
                            "16000",
                            "-ac",
                            "1",
                            audio_path,
                        ],
                        check=True,
                        capture_output=True,
                        timeout=1800,
                    )
                except subprocess.CalledProcessError as exc:
                    stderr = exc.stderr or ""
                    if isinstance(stderr, bytes):
                        stderr = stderr.decode(errors="replace")
                    task_logger.error(
                        "ffmpeg audio extraction failed: returncode=%s stderr=%s",
                        exc.returncode,
                        stderr[-1000:],
                    )
                    raise
                except subprocess.TimeoutExpired:
                    task_logger.error("ffmpeg audio extraction timed out after 1800s")
                    raise
                task_logger.info(
                    "Audio extraction completed: %s (size=%s bytes, elapsed=%.2fs)",
                    audio_path,
                    Path(audio_path).stat().st_size,
                    time.monotonic() - audio_started_at,
                )
                _update_task(db, task_id, progress=40)
                stt_progress = make_stage_progress_callback(
                    lambda progress: _update_task(db, task_id, progress=progress),
                    start=40,
                    end=60,
                )
                segments = get_or_transcribe_segments(
                    task=task,
                    db=db,
                    audio_path=audio_path,
                    log_dir=log_dir,
                    task_id=task_id,
                    task_logger=task_logger,
                    progress_callback=stt_progress,
                )

        try:
            segments_to_srt(segments, str(log_dir / "source.srt"))
        except Exception as exc:
            task_logger.warning("Failed to write source.srt: %s", exc)

        task_logger.info("Got %s segments, starting translation...", len(segments))
        _update_task(db, task_id, progress=60)

        translator = _build_translate_engine(task.translate_engine, db)
        from models.setting import Setting as _Setting
        _batch_setting = db.query(_Setting).filter(_Setting.key == "translate.batch_size").first()
        try:
            batch_size = int(_batch_setting.value) if _batch_setting else 1
        except (ValueError, TypeError):
            batch_size = 1
        translate_progress = make_stage_progress_callback(
            lambda progress: _update_task(db, task_id, progress=progress),
            start=60,
            end=95,
        )

        jsonl_path = log_dir / "translate.jsonl"
        originals = [segment["text"] for segment in segments]
        cached_translations = _load_cached_translations(
            jsonl_path,
            expected_count=len(originals),
            cache_logger=task_logger,
        )
        cached_count = _get_cached_translation_prefix_length(cached_translations)
        if cached_count > 0:
            task_logger.info(
                "Using cached translation results for %s segment(s).",
                cached_count,
            )
        remaining_originals = originals[cached_count:]
        task_logger.info(
            "Translation config: engine=%s source_lang=%s target_lang=%s batch_size=%s total_segments=%s cached_segments=%s remaining_segments=%s",
            task.translate_engine,
            task.source_lang,
            task.target_lang,
            batch_size,
            len(originals),
            cached_count,
            len(remaining_originals),
        )
        batch_state = {"index": 0, "offset": cached_count}

        def batch_callback(
            inputs: list[str],
            outputs: list[str],
            metadata: dict | None = None,
        ) -> None:
            start = batch_state["offset"]
            end = start + len(inputs)
            raw_input = (metadata or {}).get("raw_input")
            raw_output = (metadata or {}).get("raw_output")
            record = {
                "batch_index": batch_state["index"],
                "segment_range": [start, end],
                "input": raw_input if raw_input is not None else "\n".join(inputs),
                "output": raw_output if raw_output is not None else "\n".join(outputs),
            }
            try:
                with open(jsonl_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps(record, ensure_ascii=False) + "\n")
            except Exception as exc:
                task_logger.warning("Failed to append translate.jsonl: %s", exc)
            task_logger.info(
                "Translated batch %s: segment_range=%s-%s input_count=%s output_count=%s",
                batch_state["index"],
                start,
                end,
                len(inputs),
                len(outputs),
            )
            batch_state["index"] += 1
            batch_state["offset"] = end

        def cached_translate_progress(ratio: float) -> None:
            if not originals:
                translate_progress(1.0)
                return
            completed = cached_count + int(round(len(remaining_originals) * ratio))
            translate_progress(min(completed, len(originals)) / len(originals))

        translated = [
            text if text is not None else ""
            for text in cached_translations[:cached_count]
        ]
        if remaining_originals:
            translated.extend(
                translator.translate_batch(
                    remaining_originals,
                    source_lang=task.source_lang,
                    target_lang=task.target_lang,
                    batch_size=batch_size,
                    progress_callback=cached_translate_progress,
                    batch_callback=batch_callback,
                )
            )
        else:
            translate_progress(1.0)
        translated = [_normalize_translated_text(text) for text in translated]
        task_logger.info("Translation completed: translated_segments=%s", len(translated))

        try:
            bilingual_segments = [
                {**seg, "text": f"{orig}\n{tr}" if tr else orig}
                for seg, orig, tr in zip(segments, originals, translated)
            ]
            segments_to_srt(bilingual_segments, str(log_dir / "bilingual.srt"))
        except Exception as exc:
            task_logger.warning("Failed to write bilingual.srt: %s", exc)

        for segment, translated_text in zip(segments, translated):
            segment["text"] = translated_text
        _update_task(db, task_id, progress=95)

        upload_progress = None
        if task.source_type == "smb":
            upload_progress = make_stage_progress_callback(
                lambda progress: _update_task(db, task_id, progress=progress),
                start=95,
                end=100,
            )
        write_output_subtitle(
            task,
            client,
            tmp_dir,
            segments,
            task_logger,
            progress_callback=upload_progress,
        )
        _update_task(db, task_id, progress=100)

        _update_task(
            db,
            task_id,
            status="done",
            progress=100,
            finished_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
        )
        task_logger.info("Task completed successfully.")
    except Exception as exc:
        task_logger.exception("Task failed: %s", exc)
        _update_task(
            db,
            task_id,
            status="failed",
            error_message=str(exc)[:500],
            finished_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
        )
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        _cleanup_task_logger(task_logger)
        db.close()
