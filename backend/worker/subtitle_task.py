from __future__ import annotations

import json
import logging
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pysrt

from celery_app import celery_app
from core.config import settings
from core.database import SessionLocal
from models.task import Task
from smb.client import SMBClient
from worker.progress import make_stage_progress_callback
from worker.srt_writer import segments_to_srt
from worker.subtitle_extractor import (
    extract_subtitle_track,
    probe_subtitle_tracks,
    select_best_track,
)

logger = logging.getLogger(__name__)


class _TaskIdFilter(logging.Filter):
    def __init__(self, task_id: int):
        super().__init__()
        self.task_id = task_id

    def filter(self, record: logging.LogRecord) -> bool:
        record.task_id = self.task_id
        return True


def _get_log_path(task_id: int) -> str:
    return str(settings.log_dir / f"{task_id}.log")


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
    except Exception:
        pass


def _build_translate_engine(engine_name: str, db):
    from core.crypto import decrypt
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
        return OpenAITranslateEngine(
            api_key=get_setting("translate.openai.api_key"),
            model=get_setting("translate.openai.model") or "gpt-4o-mini",
            base_url=get_setting("translate.openai.base_url") or None,
            prompt_template=get_setting("translate.prompt") or None,
        )
    if engine_name == "claude":
        from engines.translate.claude_translate import ClaudeTranslateEngine
        return ClaudeTranslateEngine(
            api_key=get_setting("translate.claude.api_key"),
            model=get_setting("translate.claude.model") or "claude-haiku-4-5-20251001",
            base_url=get_setting("translate.claude.base_url") or None,
            prompt_template=get_setting("translate.prompt") or None,
        )
    raise ValueError(f"Unknown translate engine: {engine_name}")


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


@celery_app.task(bind=True, max_retries=0)
def process_subtitle_task(self, task_id: int):
    db = SessionLocal()
    log_path = _get_log_path(task_id)
    tmp_dir = _get_tmp_dir(task_id)
    os.makedirs(tmp_dir, exist_ok=True)
    os.makedirs(os.path.dirname(log_path), exist_ok=True)

    task_logger = _configure_task_logger(task_id=task_id, log_path=log_path)

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

        from models.smb_server import SMBServer

        server = db.query(SMBServer).filter(SMBServer.id == task.smb_server_id).first()
        client = SMBClient.from_server_model(server)

        local_video = os.path.join(tmp_dir, "video" + Path(task.file_path).suffix)
        task_logger.info("Downloading video from SMB...")
        download_progress = make_stage_progress_callback(
            lambda progress: _update_task(db, task_id, progress=progress),
            start=5,
            end=20,
        )
        client.download_file(task.file_path, local_video, progress_callback=download_progress)
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
            _update_task(db, task_id, progress=40)
            stt_engine = _build_stt_engine(task.stt_engine, db)
            language = task.source_lang if task.source_lang != "auto" else None

            stt_progress = make_stage_progress_callback(
                lambda progress: _update_task(db, task_id, progress=progress),
                start=40,
                end=60,
            )

            segments = stt_engine.transcribe(audio_path, language=language, progress_callback=stt_progress)

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

        translated = translator.translate_batch(
            [segment["text"] for segment in segments],
            source_lang=task.source_lang,
            target_lang=task.target_lang,
            batch_size=batch_size,
            progress_callback=translate_progress,
        )
        for segment, translated_text in zip(segments, translated):
            segment["text"] = translated_text
        _update_task(db, task_id, progress=95)

        output_srt_name = Path(task.file_path).stem + f".{task.target_lang}.srt"
        output_srt_remote = str(Path(task.file_path).parent / output_srt_name)

        if not task.overwrite and client.file_exists(output_srt_remote):
            task_logger.info(
                "SRT already exists, skipping (overwrite=False): %s",
                output_srt_remote,
            )
        else:
            local_srt = os.path.join(tmp_dir, output_srt_name)
            os.makedirs(os.path.dirname(local_srt), exist_ok=True)
            segments_to_srt(segments, local_srt)
            task_logger.info("Uploading SRT to SMB: %s", output_srt_remote)
            upload_progress = make_stage_progress_callback(
                lambda progress: _update_task(db, task_id, progress=progress),
                start=95,
                end=100,
            )
            client.upload_file(local_srt, output_srt_remote, progress_callback=upload_progress)

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
