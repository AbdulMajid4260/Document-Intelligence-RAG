
"""Application settings, loaded from environment variables / Backend/.env."""
from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent  # the Backend/ folder
load_dotenv(BASE_DIR / ".env")


def _int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    try:
        return int(raw) if raw else default
    except ValueError:
        return default


def _float(name: str, default: float) -> float:
    raw = os.getenv(name, "").strip()
    try:
        return float(raw) if raw else default
    except ValueError:
        return default


def _path(value: str) -> Path:
    p = Path(value).expanduser()
    return p if p.is_absolute() else (BASE_DIR / p).resolve()


def _database_url(raw: str) -> str:
    """Make relative SQLite paths absolute relative to Backend/."""
    prefix = "sqlite:///"
    if (
        raw.startswith(prefix)
        and not raw.startswith("sqlite:////")
        and ":memory:" not in raw
    ):
        rel = raw[len(prefix):]
        if not (len(rel) > 1 and rel[1] == ":"):
            return prefix + _path(rel).as_posix()
    return raw


@dataclass(frozen=True)
class Settings:
    app_name: str
    app_version: str
    groq_api_key: str
    groq_model: str
    groq_api_url: str
    groq_timeout: float
    database_url: str
    upload_dir: Path
    chroma_dir: Path
    max_upload_mb: int
    max_files_per_upload: int
    chunk_size: int
    chunk_overlap: int
    top_k: int
    max_context_chars: int
    embedding_backend: str
    embedding_model: str
    vector_store: str
    cors_origins: tuple[str, ...]
    response_key_style: str

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    origins = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    )

    return Settings(
        app_name="Document Intelligence RAG API",
        app_version="1.0.0",
        groq_api_key=os.getenv("GROQ_API_KEY", "").strip(),
        groq_model=os.getenv(
            "GROQ_MODEL",
            "openai/gpt-oss-120b",
        ).strip(),
        groq_api_url=os.getenv(
            "GROQ_API_URL",
            "https://api.groq.com/openai/v1/chat/completions",
        ).strip(),
        groq_timeout=_float("GROQ_TIMEOUT_SECONDS", 60.0),
        database_url=_database_url(
            os.getenv("DATABASE_URL", "sqlite:///./data/rag.db").strip()
        ),
        upload_dir=_path(os.getenv("UPLOAD_DIR", "./data/uploads")),
        chroma_dir=_path(os.getenv("CHROMA_DIR", "./data/chroma")),
        max_upload_mb=_int("MAX_UPLOAD_MB", 20),
        max_files_per_upload=_int("MAX_FILES_PER_UPLOAD", 10),
        chunk_size=_int("CHUNK_SIZE", 1000),
        chunk_overlap=_int("CHUNK_OVERLAP", 200),
        top_k=_int("TOP_K", 4),
        max_context_chars=_int("MAX_CONTEXT_CHARS", 12000),
        embedding_backend=os.getenv(
            "EMBEDDING_BACKEND", "auto"
        ).strip().lower(),
        embedding_model=os.getenv(
            "EMBEDDING_MODEL",
            "sentence-transformers/all-MiniLM-L6-v2",
        ).strip(),
        vector_store=os.getenv("VECTOR_STORE", "numpy").strip().lower(),
        cors_origins=tuple(
            origin.strip() for origin in origins.split(",") if origin.strip()
        ),
        response_key_style=os.getenv(
            "RESPONSE_KEY_STYLE", "snake"
        ).strip().lower(),
    )
