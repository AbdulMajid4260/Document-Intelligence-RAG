"""Retrieval experiments: re-chunk the uploaded documents with the requested settings, index them in a
temporary store and run the supplied queries. Everything reported is measured, nothing is estimated."""
from __future__ import annotations

import json
import time
from statistics import mean

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.errors import ApiError
from app.models import Document, Experiment
from app.services.embeddings import EmbeddingUnavailable, get_embedder
from app.services.text_processing import PageText, chunk_pages, validate_chunk_params
from app.services.vector_store import make_store, normalise_store_name

PASSAGE_PREVIEW_CHARS = 400


def run_experiment(
    db: Session,
    *,
    name: str | None,
    chunk_size: int,
    chunk_overlap: int,
    vector_store: str,
    top_k: int,
    queries: list[str],
    document_ids: list[int] | None,
    notes: str | None,
) -> Experiment:
    t_total = time.perf_counter()
    try:
        validate_chunk_params(chunk_size, chunk_overlap)
    except ValueError as exc:
        raise ApiError(400, "invalid_experiment_config", str(exc)) from exc

    q = select(Document).where(Document.status == "ready")
    if document_ids:
        q = q.where(Document.id.in_(document_ids))
    docs = list(db.execute(q.order_by(Document.id)).scalars())
    if not docs:
        raise ApiError(409, "no_documents", "No processed documents found. Upload at least one PDF or TXT file first.")

    s = get_settings()
    try:
        embedder, emb_warning = get_embedder(s.embedding_backend, s.embedding_model)
    except EmbeddingUnavailable as exc:
        raise ApiError(503, "embeddings_unavailable", str(exc)) from exc

    # 1. chunk
    meta: list[dict] = []
    for d in docs:
        pages = [PageText(p["page"], p["text"]) for p in json.loads(d.pages_json or "[]")]
        for c in chunk_pages(pages, chunk_size, chunk_overlap):
            meta.append({"document_id": d.id, "document_name": d.filename, "page": c.page, "chunk_index": c.chunk_index, "text": c.text})
    if not meta:
        raise ApiError(409, "no_chunks", "The selected documents produced no chunks with these settings.")

    # 2. embed + index
    t0 = time.perf_counter()
    vectors = embedder.embed([m["text"] for m in meta])
    embed_ms = (time.perf_counter() - t0) * 1000

    store, effective, store_warning = make_store(vector_store)  # temporary (in-memory) index
    try:
        t0 = time.perf_counter()
        store.add(list(range(len(meta))), vectors, [m["document_id"] for m in meta])
        index_ms = (time.perf_counter() - t0) * 1000

        # 3. queries
        results = []
        for text in queries:
            t0 = time.perf_counter()
            qv = embedder.embed([text])[0]
            hits = store.query(qv, top_k)
            latency = (time.perf_counter() - t0) * 1000
            results.append(
                {
                    "query": text,
                    "latency_ms": round(latency, 3),
                    "hits": [
                        {
                            "rank": r,
                            "document_id": meta[h.key]["document_id"],
                            "document_name": meta[h.key]["document_name"],
                            "page": meta[h.key]["page"],
                            "chunk_index": meta[h.key]["chunk_index"],
                            "score": round(h.score, 4),
                            "passage": meta[h.key]["text"][:PASSAGE_PREVIEW_CHARS],
                        }
                        for r, h in enumerate(hits, start=1)
                    ],
                }
            )
    finally:
        closer = getattr(store, "close", None)
        if closer:
            closer()

    warnings = [w for w in (emb_warning, store_warning) if w]
    if not queries:
        warnings.append("No queries were supplied, so only indexing statistics were recorded.")
    top1 = [r["hits"][0]["score"] for r in results if r["hits"]]
    summary = {
        "document_count": len(docs),
        "total_chunks": len(meta),
        "avg_chunk_chars": round(mean(len(m["text"]) for m in meta), 1),
        "embedding_ms": round(embed_ms, 2),
        "index_build_ms": round(index_ms, 2),
        "query_count": len(results),
        "avg_query_latency_ms": round(mean(r["latency_ms"] for r in results), 3) if results else None,
        "avg_top1_score": round(mean(top1), 4) if top1 else None,
        "embedding_model": embedder.name,
        "semantic": embedder.semantic,
        "requested_vector_store": normalise_store_name(vector_store),
        "effective_vector_store": effective,
        "warnings": warnings,
        "note": "Scores are raw cosine similarities between query and chunk vectors. "
        "They are not relevance judgments or accuracy metrics.",
    }
    config = {
        "chunk_size": chunk_size,
        "chunk_overlap": chunk_overlap,
        "vector_store": normalise_store_name(vector_store),
        "top_k": top_k,
        "document_ids": [d.id for d in docs],
    }
    total_ms = (time.perf_counter() - t_total) * 1000
    exp = Experiment(
        name=(name or "").strip() or f"chunk{chunk_size}-overlap{chunk_overlap}-{effective}-top{top_k}",
        config_json=json.dumps(config),
        results_json=json.dumps(results),
        summary_json=json.dumps(summary),
        notes=notes,
        latency_ms=round(total_ms, 2),
    )
    db.add(exp)
    db.commit()
    return exp
