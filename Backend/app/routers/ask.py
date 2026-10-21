from __future__ import annotations

import json
import time

from fastapi import APIRouter, Depends
from pydantic import AliasChoices, BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.errors import ApiError
from app.models import QARecord
from app.serializers import history_to_dict
from app.services import llm
from app.services.embeddings import EmbeddingUnavailable
from app.services.rag import get_index_manager, ready_document_ids, retrieve

router = APIRouter(prefix="/api", tags=["ask"])

NO_CONTEXT_ANSWER = (
    "I couldn't find anything relevant to that question in the uploaded documents. "
    "Try rephrasing it, or upload a document that covers the topic."
)


class AskRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    question: str = Field(validation_alias=AliasChoices("question", "query", "q"), description="The user's question")
    document_ids: list[int] | None = Field(
        default=None, validation_alias=AliasChoices("document_ids", "documentIds"), description="Restrict to these documents"
    )
    top_k: int | None = Field(default=None, ge=1, le=20, validation_alias=AliasChoices("top_k", "topK"))


@router.post("/ask")
def ask(req: AskRequest, db: Session = Depends(get_db)):
    s = get_settings()
    question = (req.question or "").strip()
    if not question:
        raise ApiError(400, "empty_question", "Please enter a question.")
    if len(question) > 4000:
        raise ApiError(400, "question_too_long", "Questions are limited to 4000 characters.")

    available = ready_document_ids(db, req.document_ids)
    if not available:
        msg = (
            "None of the selected documents are ready. Upload or select a processed document."
            if req.document_ids
            else "No documents have been uploaded yet. Upload a PDF or TXT file first."
        )
        raise ApiError(409, "no_documents", msg)

    top_k = req.top_k or s.top_k
    started = time.perf_counter()
    try:
        sources = retrieve(db, question, top_k, req.document_ids)
    except EmbeddingUnavailable as exc:
        raise ApiError(503, "embeddings_unavailable", str(exc)) from exc
    mgr = get_index_manager()

    if sources:
        try:
            result = llm.generate_answer(question, sources)
        except llm.LLMError as exc:
            raise ApiError(exc.status_code, exc.code, exc.message) from exc
        answer, model = result.answer, result.model
    else:
        answer, model = NO_CONTEXT_ANSWER, None

    latency = round((time.perf_counter() - started) * 1000, 1)
    record = QARecord(
        question=question,
        answer=answer,
        sources_json=json.dumps(sources),
        document_ids_json=json.dumps(req.document_ids) if req.document_ids else None,
        model=model,
        retrieval_mode=mgr.retrieval_label(),
        top_k=top_k,
        latency_ms=latency,
    )
    db.add(record)
    db.commit()
    out = history_to_dict(record)
    out["warnings"] = mgr.warnings
    return out
