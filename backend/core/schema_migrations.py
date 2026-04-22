from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def run_schema_migrations(engine: Engine) -> None:
    if engine.dialect.name == "sqlite":
        _ensure_sqlite_tasks_table_supports_source_types(engine)


def _ensure_sqlite_tasks_table_supports_source_types(engine: Engine) -> None:
    inspector = inspect(engine)
    if "tasks" not in inspector.get_table_names():
        return

    columns = {
        column["name"]: column
        for column in inspector.get_columns("tasks")
    }
    source_type_exists = "source_type" in columns
    smb_server_nullable = columns.get("smb_server_id", {}).get("nullable") is True

    if source_type_exists and smb_server_nullable:
        return

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE tasks_new (
                    id INTEGER PRIMARY KEY,
                    source_type VARCHAR NOT NULL DEFAULT 'smb',
                    smb_server_id INTEGER,
                    file_path VARCHAR NOT NULL,
                    status VARCHAR DEFAULT 'pending',
                    source_lang VARCHAR DEFAULT 'auto',
                    target_lang VARCHAR NOT NULL,
                    stt_engine VARCHAR NOT NULL,
                    translate_engine VARCHAR NOT NULL,
                    overwrite BOOLEAN DEFAULT 0,
                    progress INTEGER DEFAULT 0,
                    error_message VARCHAR,
                    celery_task_id VARCHAR,
                    retry_count INTEGER DEFAULT 0,
                    started_at DATETIME,
                    finished_at DATETIME,
                    created_at DATETIME,
                    updated_at DATETIME
                )
                """
            )
        )
        conn.execute(
            text(
                """
                INSERT INTO tasks_new (
                    id,
                    source_type,
                    smb_server_id,
                    file_path,
                    status,
                    source_lang,
                    target_lang,
                    stt_engine,
                    translate_engine,
                    overwrite,
                    progress,
                    error_message,
                    celery_task_id,
                    retry_count,
                    started_at,
                    finished_at,
                    created_at,
                    updated_at
                )
                SELECT
                    id,
                    'smb',
                    smb_server_id,
                    file_path,
                    status,
                    source_lang,
                    target_lang,
                    stt_engine,
                    translate_engine,
                    overwrite,
                    progress,
                    error_message,
                    celery_task_id,
                    retry_count,
                    started_at,
                    finished_at,
                    created_at,
                    updated_at
                FROM tasks
                """
            )
        )
        conn.execute(text("DROP TABLE tasks"))
        conn.execute(text("ALTER TABLE tasks_new RENAME TO tasks"))
