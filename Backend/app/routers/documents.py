from __future__ import annotations

import logging
from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.errors import ApiError
from app.models import Document
from app.serializers import StyledJSONResponse, document_to_dict
from app.services.embeddings import EmbeddingUnavailable
from app.services.rag import delete_document, ingest_document
from app.services.text_processing import ExtractionError

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/documents", tags=["documents"])

ALLOWED = {".pdf": "pdf", ".txt": "txt"}


def _clean_name(raw: str | None) -> str:
    name = (raw or "").replace("\\", "/").split("/")[-1].strip()
    return name or "unnamed"


@router.post("/upload", status_code=201)
def upload_documents(
    files: list[UploadFile] | None = File(None, description="One or more PDF/TXT files"),
    file: UploadFile | None = File(None, description="Single-file alias for `files`"),
    db: Session = Depends(get_db),
):
    s = get_settings()
    uploads = list(files or []) + ([file] if file else [])
    uploads = [u for u in uploads if u is not None and u.filename is not None]
    if not uploads:
        raise ApiError(400, "no_files", "No files were uploaded. Send multipart form data with field 'files'.")
    if len(uploads) > s.max_files_per_upload:
        raise ApiError(400, "too_many_files", f"At most {s.max_files_per_upload} files can be uploaded at once.")

    s.upload_dir.mkdir(parents=True, exist_ok=True)
    created: list[Document] = []
    errors: list[dict] = []

    for up in uploads:
        name = _clean_name(up.filename)
        ext = Path(name).suffix.lower()
        if ext not in ALLOWED:
            errors.append({"filename": name, "code": "unsupported_type", "error": "Only PDF and TXT files are supported."})
            continue
        data = up.file.read(s.max_upload_bytes + 1)
        if not data or not data.strip():
            errors.append({"filename": name, "code": "empty_file", "error": "The file is empty."})
            continue
        if len(data) > s.max_upload_bytes:
            errors.append({"filename": name, "code": "file_too_large", "error": f"File exceeds the {s.max_upload_mb} MB limit."})
            continue
        if ext == ".pdf" and b"%PDF-" not in data[:1024]:
            errors.append({"filename": name, "code": "invalid_pdf", "error": "The file is not a valid PDF."})
            continue

        doc = Document(filename=name, file_type=ALLOWED[ext], size_bytes=len(data), status="processing")
        db.add(doc)
        db.commit()  # get an id
        stored = s.upload_dir / f"{doc.id}{ext}"
        try:
            stored.write_bytes(data)
            doc.stored_path = str(stored)
            db.commit()
            ingest_document(db, doc, data)
        except (ExtractionError, ValueError, EmbeddingUnavailable) as exc:
            _mark_failed(db, doc, stored, str(exc))
            errors.append({"filename": name, "code": "processing_failed", "error": str(exc)})
        except Exception as exc:  # noqa: BLE001
            log.exception("Unexpected failure while processing %s", name)
            _mark_failed(db, doc, stored, f"Unexpected processing error: {exc}")
            errors.append({"filename": name, "code": "processing_failed", "error": f"Unexpected processing error: {exc}"})
        created.append(doc)

    ready = [d for d in created if d.status == "ready"]
    if not ready:
        msg = "; ".join(f"{e['filename']}: {e['error']}" for e in errors) or "No documents were processed."
        raise ApiError(422, "no_documents_processed", msg, {"errors": errors})
    return StyledJSONResponse(
        status_code=201,
        content={
            "documents": [document_to_dict(d) for d in created],
            "errors": errors,
            "uploaded": len(ready),
        },
    )


def _mark_failed(db: Session, doc: Document, stored: Path, message: str) -> None:
    db.rollback()
    doc.status, doc.error, doc.stored_path = "failed", message, None
    db.add(doc)
    db.commit()
    try:
        stored.unlink(missing_ok=True)
    except OSError:
        pass


@router.get("")
def list_documents(db: Session = Depends(get_db)):
    docs = db.execute(select(Document).order_by(Document.id.desc())).scalars().all()
    return {"documents": [document_to_dict(d) for d in docs], "total": len(docs)}


@router.delete("/{document_id}")
def remove_document(document_id: int, db: Session = Depends(get_db)):
    doc = db.get(Document, document_id)
    if doc is None:
        raise ApiError(404, "document_not_found", f"Document {document_id} not found.")
    delete_document(db, doc)
    return {"deleted": document_id}
