"""ORM object -> JSON-able dict helpers and response key-style handling."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone

from fastapi.responses import JSONResponse

from app.config import get_settings


def iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def document_to_dict(d) -> dict:
    return {
        "id": d.id,
        "filename": d.filename,
        "file_type": d.file_type,
        "size_bytes": d.size_bytes,
        "status": d.status,
        "error": d.error,
        "page_count": d.page_count,
        "char_count": d.char_count,
        "chunk_count": d.chunk_count,
        "chunk_size": d.chunk_size,
        "chunk_overlap": d.chunk_overlap,
        "embedding_backend": d.embedding_backend,
        "embedding_model": d.embedding_model,
        "created_at": iso(d.created_at),
    }


def history_to_dict(r) -> dict:
    return {
        "id": r.id,
        "question": r.question,
        "answer": r.answer,
        "sources": json.loads(r.sources_json or "[]"),
        "document_ids": json.loads(r.document_ids_json) if r.document_ids_json else None,
        "model": r.model,
        "retrieval_mode": r.retrieval_mode,
        "top_k": r.top_k,
        "latency_ms": r.latency_ms,
        "created_at": iso(r.created_at),
    }


def experiment_to_dict(e) -> dict:
    return {
        "id": e.id,
        "name": e.name,
        "config": json.loads(e.config_json),
        "summary": json.loads(e.summary_json),
        "results": json.loads(e.results_json),
        "notes": e.notes,
        "latency_ms": e.latency_ms,
        "created_at": iso(e.created_at),
    }


# ---- optional response key style (snake | camel | both) -------------------------------------
def _camel(key: str) -> str:
    return re.sub(r"_([a-z0-9])", lambda m: m.group(1).upper(), key)


def restyle(value, style: str):
    if style == "snake":
        return value
    if isinstance(value, list):
        return [restyle(v, style) for v in value]
    if isinstance(value, dict):
        out = {}
        for k, v in value.items():
            nv = restyle(v, style)
            ck = _camel(k) if isinstance(k, str) else k
            if style == "both":
                out[k] = nv
                if ck != k:
                    out[ck] = nv
            else:
                out[ck] = nv
        return out
    return value


class StyledJSONResponse(JSONResponse):
    """Default response class: honours RESPONSE_KEY_STYLE so the API can match the frontend's key style."""

    def render(self, content) -> bytes:
        return super().render(restyle(content, get_settings().response_key_style))
