"""Index manager, document ingestion and retrieval (DB-backed)."""
from __future__ import annotations

import json
import logging
import threading
import zlib
from pathlib import Path

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Chunk, Document
from app.services.embeddings import get_embedder
from app.services.text_processing import chunk_pages, extract_text, validate_chunk_params
from app.services.vector_store import make_store

log = logging.getLogger(__name__)


class IndexManager:
    """Holds the live embedder + vector store. Chunk vectors are persisted in SQLite and the
    vector store is rebuilt from them on first use, so restarts never lose the index."""

    def __init__(self):
        self.lock = threading.RLock()
        self.reset()

    def reset(self) -> None:
        self.loaded = False
        self.embedder = None
        self.store = None
        self.store_name: str | None = None
        self.warnings: list[str] = []

    def ensure_loaded(self, db: Session) -> None:
        with self.lock:
            if self.loaded:
                return
            s = get_settings()
            embedder, w1 = get_embedder(s.embedding_backend, s.embedding_model)
            collection = f"rag_{zlib.crc32(embedder.name.encode('utf-8')):08x}"
            store, eff, w2 = make_store(s.vector_store, persist_dir=str(s.chroma_dir), collection=collection)
            store.clear()

            rows = list(
                db.execute(
                    select(Chunk).join(Document, Chunk.document_id == Document.id).where(Document.status == "ready")
                ).scalars()
            )
            stale = [r for r in rows if r.embedding is None or r.embedding_model != embedder.name]
            for i in range(0, len(stale), 64):
                batch = stale[i : i + 64]
                vecs = embedder.embed([r.text for r in batch])
                for r, v in zip(batch, vecs):
                    r.embedding = np.asarray(v, dtype=np.float32).tobytes()
                    r.embedding_model = embedder.name
            if stale:
                db.commit()
            if rows:
                mat = np.vstack([np.frombuffer(r.embedding, dtype=np.float32) for r in rows])
                store.add([r.id for r in rows], mat, [r.document_id for r in rows])

            self.embedder, self.store, self.store_name = embedder, store, eff
            self.warnings = [w for w in (w1, w2) if w]
            self.loaded = True
            log.info("Index ready: %d chunks, embedder=%s, store=%s", len(rows), embedder.name, eff)

    def retrieval_label(self) -> str:
        kind = "semantic" if self.embedder.semantic else "lexical"
        return f"{kind} ({self.embedder.name}, {self.store_name})"


_manager = IndexManager()


def get_index_manager() -> IndexManager:
    return _manager


def ingest_document(db: Session, doc: Document, data: bytes) -> None:
    """Extract -> chunk -> embed -> persist chunks -> add to vector store. Raises on failure."""
    s = get_settings()
    mgr = get_index_manager()
    mgr.ensure_loaded(db)
    validate_chunk_params(s.chunk_size, s.chunk_overlap)

    pages = extract_text(doc.file_type, data)
    chunks = chunk_pages(pages, s.chunk_size, s.chunk_overlap)
    if not chunks:
        raise ValueError("No text chunks could be produced from this document.")
    vectors = mgr.embedder.embed([c.text for c in chunks])

    with mgr.lock:
        rows = [
            Chunk(
                document_id=doc.id,
                chunk_index=c.chunk_index,
                page=c.page,
                text=c.text,
                embedding=np.asarray(v, dtype=np.float32).tobytes(),
                embedding_model=mgr.embedder.name,
            )
            for c, v in zip(chunks, vectors)
        ]
        db.add_all(rows)
        db.flush()  # assigns chunk ids
        mgr.store.add([r.id for r in rows], vectors, [doc.id] * len(rows))
        try:
            doc.pages_json = json.dumps([{"page": p.page, "text": p.text} for p in pages])
            doc.page_count = len(pages)
            doc.char_count = sum(len(p.text) for p in pages)
            doc.chunk_count = len(rows)
            doc.chunk_size, doc.chunk_overlap = s.chunk_size, s.chunk_overlap
            doc.embedding_backend = mgr.embedder.backend
            doc.embedding_model = mgr.embedder.name
            doc.status, doc.error = "ready", None
            db.commit()
        except Exception:
            mgr.store.remove_document(doc.id)
            db.rollback()
            raise


def delete_document(db: Session, doc: Document) -> None:
    mgr = get_index_manager()
    with mgr.lock:
        if mgr.loaded:
            mgr.store.remove_document(doc.id)
        stored = doc.stored_path
        db.delete(doc)
        db.commit()
    if stored:
        try:
            Path(stored).unlink(missing_ok=True)
        except OSError:
            log.warning("Could not delete stored file %s", stored)


def ready_document_ids(db: Session, document_ids: list[int] | None = None) -> list[int]:
    q = select(Document.id).where(Document.status == "ready")
    if document_ids:
        q = q.where(Document.id.in_(document_ids))
    return list(db.execute(q).scalars())


def retrieve(db: Session, question: str, top_k: int, document_ids: list[int] | None = None) -> list[dict]:
    mgr = get_index_manager()
    mgr.ensure_loaded(db)
    qvec = mgr.embedder.embed([question])[0]
    with mgr.lock:
        hits = mgr.store.query(qvec, top_k, set(document_ids) if document_ids else None)
    hits = [h for h in hits if h.score > 0]  # drop zero/negative similarity: nothing in common with the query
    if not hits:
        return []
    rows = db.execute(
        select(Chunk, Document.filename).join(Document, Chunk.document_id == Document.id).where(
            Chunk.id.in_([h.key for h in hits])
        )
    ).all()
    by_id = {c.id: (c, fn) for c, fn in rows}
    sources = []
    for h in hits:
        if h.key not in by_id:
            continue
        chunk, filename = by_id[h.key]
        sources.append(
            {
                "rank": len(sources) + 1,
                "document_id": chunk.document_id,
                "document_name": filename,
                "page": chunk.page,
                "chunk_id": chunk.chunk_ref,
                "chunk_index": chunk.chunk_index,
                "score": round(h.score, 4),
                "passage": chunk.text,
            }
        )
    return sources
