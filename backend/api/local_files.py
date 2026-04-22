from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/local-files", tags=["local-files"])


@router.get("/browse")
def browse_local_directory(path: str = "/"):
    target = Path(path)

    if not target.exists():
        raise HTTPException(status_code=400, detail="Path not found")
    if not target.is_dir():
        raise HTTPException(status_code=400, detail="Path is not a directory")

    try:
        items = sorted(
            target.iterdir(),
            key=lambda entry: (not entry.is_file(), entry.name.lower()),
        )
    except OSError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return [
        {
            "name": entry.name,
            "is_dir": entry.is_dir(),
            "size": 0 if entry.is_dir() else entry.stat().st_size,
        }
        for entry in items
    ]
