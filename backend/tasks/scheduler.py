from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from croniter import croniter

from celery_app import celery_app
from core.database import SessionLocal
from models.scheduled_job import ScheduledJob
from models.task import Task
from smb.client import SMBClient

logger = logging.getLogger(__name__)

VIDEO_EXTENSIONS = {".mkv", ".mp4", ".avi", ".ts", ".mov"}


@celery_app.task
def run_scheduled_job(job_id: int):
    db = SessionLocal()
    try:
        job = (
            db.query(ScheduledJob)
            .filter(ScheduledJob.id == job_id, ScheduledJob.enabled.is_(True))
            .first()
        )
        if not job:
            return

        from models.smb_server import SMBServer
        from worker.subtitle_task import process_subtitle_task

        server = db.query(SMBServer).filter(SMBServer.id == job.smb_server_id).first()
        client = SMBClient.from_server_model(server)

        entries = client.list_directory(job.directory)
        video_files = [
            entry
            for entry in entries
            if not entry["is_dir"]
            and any(entry["name"].lower().endswith(ext) for ext in VIDEO_EXTENSIONS)
        ]

        created = 0
        for entry in video_files:
            file_path = f"{job.directory.rstrip('/')}/{entry['name']}"
            existing = (
                db.query(Task)
                .filter(
                    Task.smb_server_id == job.smb_server_id,
                    Task.file_path == file_path,
                    Task.target_lang == job.target_lang,
                    Task.status.notin_(["failed", "cancelled"]),
                )
                .first()
            )
            if existing:
                continue

            task = Task(
                smb_server_id=job.smb_server_id,
                file_path=file_path,
                source_lang=job.source_lang,
                target_lang=job.target_lang,
                stt_engine=job.stt_engine,
                translate_engine=job.translate_engine,
                overwrite=job.overwrite,
            )
            db.add(task)
            db.flush()
            process_subtitle_task.delay(task.id)
            created += 1

        db.query(ScheduledJob).filter(ScheduledJob.id == job_id).update(
            {
                "last_run_at": datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
                "last_run_status": f"created {created} tasks",
            }
        )
        db.commit()
    except Exception as exc:
        logger.exception("Scheduled job %s failed: %s", job_id, exc)
        db.query(ScheduledJob).filter(ScheduledJob.id == job_id).update(
            {
                "last_run_at": datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
                "last_run_status": f"error: {str(exc)[:200]}",
            }
        )
        db.commit()
    finally:
        db.close()


@celery_app.task
def poll_scheduled_jobs():
    db = SessionLocal()
    try:
        jobs = db.query(ScheduledJob).filter(ScheduledJob.enabled.is_(True)).all()
        now = datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None)
        for job in jobs:
            cron = croniter(job.cron_expr, job.last_run_at or (now - timedelta(minutes=2)))
            next_run = cron.get_next(datetime)
            if next_run <= now:
                run_scheduled_job.delay(job.id)
    finally:
        db.close()
