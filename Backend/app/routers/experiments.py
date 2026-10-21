from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import AliasChoices, BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.errors import ApiError
from app.models import Experiment
from app.serializers import experiment_to_dict
from app.services.experiments import run_experiment
from app.services.vector_store import normalise_store_name

router = APIRouter(prefix="/api/experiments", tags=["experiments"])


class ExperimentRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str | None = Field(default=None, max_length=256)
    chunk_size: int | None = Field(default=None, ge=50, le=10000, validation_alias=AliasChoices("chunk_size", "chunkSize"))
    chunk_overlap: int | None = Field(default=None, ge=0, le=5000, validation_alias=AliasChoices("chunk_overlap", "chunkOverlap", "overlap"))
    vector_store: str | None = Field(default=None, validation_alias=AliasChoices("vector_store", "vectorStore", "store"))
    top_k: int | None = Field(default=None, ge=1, le=50, validation_alias=AliasChoices("top_k", "topK"))
    queries: list[str] | None = Field(default=None, description="Queries to run against the re-indexed chunks")
    query: str | None = Field(default=None, description="Single-query alias for `queries`")
    document_ids: list[int] | None = Field(default=None, validation_alias=AliasChoices("document_ids", "documentIds"))
    notes: str | None = Field(default=None, max_length=4000)


@router.post("/run", status_code=201)
def run(req: ExperimentRequest, db: Session = Depends(get_db)):
    s = get_settings()
    queries = [q.strip() for q in (req.queries or []) if q and q.strip()]
    if req.query and req.query.strip():
        queries.append(req.query.strip())
    if len(queries) > 25:
        raise ApiError(400, "too_many_queries", "At most 25 queries can be run in one experiment.")
    store = normalise_store_name(req.vector_store or s.vector_store)
    exp = run_experiment(
        db,
        name=req.name,
        chunk_size=req.chunk_size or s.chunk_size,
        chunk_overlap=s.chunk_overlap if req.chunk_overlap is None else req.chunk_overlap,
        vector_store=store,
        top_k=req.top_k or s.top_k,
        queries=queries,
        document_ids=req.document_ids,
        notes=req.notes,
    )
    return experiment_to_dict(exp)


@router.get("")
def list_experiments(db: Session = Depends(get_db)):
    rows = db.execute(select(Experiment).order_by(Experiment.id.desc())).scalars().all()
    return {"experiments": [experiment_to_dict(e) for e in rows], "total": len(rows)}
