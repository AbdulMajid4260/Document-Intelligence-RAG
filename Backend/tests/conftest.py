"""Test fixtures. Environment is configured BEFORE the app is imported so tests never touch real data."""
import os
import tempfile
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="rag-tests-"))
os.environ.update(
    {
        "DATABASE_URL": f"sqlite:///{(_TMP / 'test.db').as_posix()}",
        "UPLOAD_DIR": str(_TMP / "uploads"),
        "CHROMA_DIR": str(_TMP / "chroma"),
        "EMBEDDING_BACKEND": "hashing",  # deterministic, no model download
        "VECTOR_STORE": "numpy",
        "GROQ_API_KEY": "test-key-not-real",
        "CHUNK_SIZE": "300",
        "CHUNK_OVERLAP": "60",
        "TOP_K": "3",
        "RESPONSE_KEY_STYLE": "snake",
    }
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.services import llm  # noqa: E402
from app.services.rag import get_index_manager  # noqa: E402

SAMPLE_TXT = (
    "ChromaDB is an open-source vector database used to store embeddings for retrieval augmented generation. "
    "FAISS is a library from Meta for fast similarity search over dense vectors. "
    "Chunk overlap keeps context that would otherwise be cut at chunk boundaries. "
    "SQLite stores the question and answer history for the application. "
) * 6


@pytest.fixture()
def client():
    Base.metadata.drop_all(bind=engine)
    get_index_manager().reset()
    with TestClient(app) as c:  # runs lifespan (creates tables)
        yield c


@pytest.fixture()
def uploaded(client):
    r = client.post("/api/documents/upload", files=[("files", ("notes.txt", SAMPLE_TXT.encode(), "text/plain"))])
    assert r.status_code == 201, r.text
    return r.json()["documents"][0]


@pytest.fixture()
def mock_llm(monkeypatch):
    """Replace the Groq call so no network is used."""
    calls = []

    def fake(question, sources):
        calls.append((question, sources))
        return llm.LLMResult(answer=f"Mock answer using {len(sources)} sources [1].", model="mock-model")

    monkeypatch.setattr(llm, "generate_answer", fake)
    return calls


def make_pdf(pages: list[str]) -> bytes:
    """Build a minimal valid PDF with one line of text per page (no third-party PDF library needed)."""
    objs: list[bytes] = []
    n = len(pages)
    kids = " ".join(f"{3 + 2 * i} 0 R" for i in range(n))
    objs.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objs.append(f"<< /Type /Pages /Kids [{kids}] /Count {n} >>".encode())
    font_id = 3 + 2 * n
    for i, text in enumerate(pages):
        content_id = 4 + 2 * i
        objs.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents {content_id} 0 R "
            f"/Resources << /Font << /F1 {font_id} 0 R >> >> >>".encode()
        )
        stream = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode()
        objs.append(b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream")
    objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, body in enumerate(objs, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + body + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return bytes(out)
