from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from app.config import get_settings
from app.database import engine
from app.services.rag import get_index_manager

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    s = get_settings()
    mgr = get_index_manager()
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception:  # noqa: BLE001
        db_ok = False
    info = {
        "status": "ok" if db_ok else "degraded",
        "version": s.app_version,
        "database": "ok" if db_ok else "unavailable",
        "groq_configured": bool(s.groq_api_key) and not s.groq_api_key.lower().startswith("your_"),
        "groq_model": s.groq_model,
        "configured_embedding_backend": s.embedding_backend,
        "configured_vector_store": s.vector_store,
        "index_loaded": mgr.loaded,
    }
    if mgr.loaded:
        info.update(
            {
                "active_embedding_model": mgr.embedder.name,
                "semantic_search": bool(mgr.embedder.semantic),
                "active_vector_store": mgr.store_name,
                "warnings": mgr.warnings,
            }
        )
    return info
