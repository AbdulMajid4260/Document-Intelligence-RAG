"""FastAPI application entry point.  Run with:  uvicorn app.main:app --reload --port 8000"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import update

from app.config import get_settings
from app.database import SessionLocal, init_db
from app.errors import ApiError
from app.models import Document
from app.routers import ask, documents, experiments, health, history
from app.serializers import StyledJSONResponse

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Documents left in "processing" by a crash/restart can never finish; mark them failed.
    with SessionLocal() as db:
        db.execute(
            update(Document)
            .where(Document.status == "processing")
            .values(status="failed", error="Processing was interrupted by a server restart. Please upload again.")
        )
        db.commit()
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Backend for the Document Intelligence RAG assistant (FastAPI + SQLite + Groq).",
    lifespan=lifespan,
    default_response_class=StyledJSONResponse,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


@app.exception_handler(ApiError)
async def api_error_handler(request: Request, exc: ApiError):
    body = {"detail": exc.message, "message": exc.message, "code": exc.code, **exc.extra}
    return StyledJSONResponse(status_code=exc.status_code, content=body)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    errors = [
        {"field": ".".join(str(p) for p in e.get("loc", ()) if p != "body"), "message": e.get("msg", "Invalid value")}
        for e in exc.errors()
    ]
    summary = "; ".join(f"{e['field']}: {e['message']}" if e["field"] else e["message"] for e in errors) or "Invalid request."
    return StyledJSONResponse(
        status_code=422,
        content={"detail": f"Invalid request: {summary}", "message": f"Invalid request: {summary}", "code": "validation_error", "errors": errors},
    )


app.include_router(health.router)
app.include_router(documents.router)
app.include_router(ask.router)
app.include_router(history.router)
app.include_router(experiments.router)
