"""
启动 Celery worker + beat，并发数从数据库读取 translate.worker_concurrency 配置。
用法: python backend/start_worker.py
"""
import os
import signal
import subprocess
import sys

# 确保 backend 目录在 Python 路径中
sys.path.insert(0, os.path.dirname(__file__))


def get_concurrency() -> int:
    default = 2
    try:
        from core.database import SessionLocal
        from models.setting import Setting

        db = SessionLocal()
        try:
            row = db.query(Setting).filter(Setting.key == "worker.concurrency").first()
            if row and row.value:
                return max(1, int(row.value))
        finally:
            db.close()
    except Exception:
        pass
    return default


def main():
    concurrency = get_concurrency()
    print(f"[start_worker] Celery worker concurrency={concurrency}")

    base_cmd = [sys.executable, "-m", "celery", "-A", "celery_app"]

    # 低内存模式：worker + beat 合并为单进程，线程池替代 prefork，定期回收释放 Whisper 模型
    worker_proc = subprocess.Popen(
        base_cmd + [
            "worker",
            "-B",
            "--pool=threads",
            f"--concurrency={concurrency}",
            "--max-tasks-per-child=10",
            "--loglevel=info",
        ],
        cwd=os.path.dirname(__file__),
    )
    beat_proc = None

    # 旧的启动方式：worker 和 beat 各自一个进程，worker 使用默认 prefork 池
    # worker_proc = subprocess.Popen(
    #     base_cmd + ["worker", "--loglevel=info", f"--concurrency={concurrency}"],
    #     cwd=os.path.dirname(__file__),
    # )
    # beat_proc = subprocess.Popen(
    #     base_cmd + ["beat", "--loglevel=info"],
    #     cwd=os.path.dirname(__file__),
    # )

    def shutdown(signum, frame):
        worker_proc.terminate()
        if beat_proc is not None:
            beat_proc.terminate()

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    worker_proc.wait()
    if beat_proc is not None:
        beat_proc.wait()


if __name__ == "__main__":
    main()
