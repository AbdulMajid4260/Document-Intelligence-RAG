from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.errors import ApiError
from app.models import QARecord
from app.serializers import history_to_dict
from app.services.exports import FORMATS, build_export, export_filename

router = APIRouter(prefix="/api/history", tags=["history"])


def _check_format(fmt: str) -> str:
    fmt = (fmt or "json").lower()
    if fmt not in FORMATS:
        raise ApiError(400, "invalid_format", f"Unsupported export format '{fmt}'. Use json, csv or xlsx.")
    return fmt


def _download(records: list[dict], fmt: str, filename_prefix: str, single: bool = False) -> Response:
    content, media = build_export(records, fmt, single=single)
    return Response(
        content=content,
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{export_filename(filename_prefix, fmt)}"'},
    )


@router.get("")
def list_history(limit: int = Query(100, ge=1, le=1000), offset: int = Query(0, ge=0), db: Session = Depends(get_db)):
    total = db.execute(select(func.count(QARecord.id))).scalar_one()
    rows = db.execute(select(QARecord).order_by(QARecord.id.desc()).limit(limit).offset(offset)).scalars().all()
    return {"history": [history_to_dict(r) for r in rows], "total": total}


# NOTE: the export route must be declared before "/{record_id}" so "export" is not parsed as an id.
@router.get("/export")
def export_all(format: str = Query("json"), db: Session = Depends(get_db)):
    fmt = _check_format(format)
    rows = db.execute(select(QARecord).order_by(QARecord.id.desc())).scalars().all()
    return _download([history_to_dict(r) for r in rows], fmt, "history")


@router.get("/{record_id}")
def get_history(record_id: int, db: Session = Depends(get_db)):
    rec = db.get(QARecord, record_id)
    if rec is None:
        raise ApiError(404, "history_not_found", f"History record {record_id} not found.")
    return history_to_dict(rec)


@router.get("/{record_id}/export")
def export_one(record_id: int, format: str = Query("json"), db: Session = Depends(get_db)):
    fmt = _check_format(format)
    rec = db.get(QARecord, record_id)
    if rec is None:
        raise ApiError(404, "history_not_found", f"History record {record_id} not found.")
    return _download([history_to_dict(rec)], fmt, f"history-{record_id}", single=True)


@router.delete("")
def delete_history(db: Session = Depends(get_db)):
    result = db.execute(delete(QARecord))
    db.commit()
    return {"deleted": result.rowcount}
