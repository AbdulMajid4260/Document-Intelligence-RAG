"""Vector stores with a common interface: numpy (always available), faiss and chromadb (optional).

All stores expect L2-normalised float32 vectors and return cosine similarity as ``score``.
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass

import numpy as np

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class Hit:
    key: int
    score: float


class NumpyStore:
    name = "numpy"

    def __init__(self):
        self._keys = np.zeros((0,), dtype=np.int64)
        self._docs = np.zeros((0,), dtype=np.int64)
        self._mat: np.ndarray | None = None

    def add(self, keys, vectors, doc_ids) -> None:
        vectors = np.asarray(vectors, dtype=np.float32)
        if len(keys) == 0:
            return
        self._mat = vectors if self._mat is None else np.vstack([self._mat, vectors])
        self._keys = np.concatenate([self._keys, np.asarray(keys, dtype=np.int64)])
        self._docs = np.concatenate([self._docs, np.asarray(doc_ids, dtype=np.int64)])

    def remove_document(self, doc_id: int) -> None:
        if self._mat is None:
            return
        keep = self._docs != doc_id
        self._mat, self._keys, self._docs = self._mat[keep], self._keys[keep], self._docs[keep]

    def clear(self) -> None:
        self.__init__()

    def count(self) -> int:
        return int(self._keys.shape[0])

    def query(self, vector, top_k: int, doc_ids: set[int] | None = None) -> list[Hit]:
        if self._mat is None or self.count() == 0:
            return []
        scores = self._mat @ np.asarray(vector, dtype=np.float32)
        if doc_ids:
            scores = np.where(np.isin(self._docs, list(doc_ids)), scores, -np.inf)
        k = min(top_k, scores.shape[0])
        idx = np.argpartition(-scores, k - 1)[:k]
        idx = idx[np.argsort(-scores[idx])]
        return [Hit(int(self._keys[i]), float(scores[i])) for i in idx if np.isfinite(scores[i])]


class FaissStore:
    """Exact (flat inner-product) FAISS index. Filtering by document is done after search."""

    name = "faiss"

    def __init__(self):
        import faiss  # noqa: F401  (raises ImportError if unavailable)

        self._faiss = faiss
        self._index = None
        self._doc_of: dict[int, int] = {}

    def add(self, keys, vectors, doc_ids) -> None:
        vectors = np.ascontiguousarray(vectors, dtype=np.float32)
        if len(keys) == 0:
            return
        if self._index is None:
            self._index = self._faiss.IndexIDMap(self._faiss.IndexFlatIP(vectors.shape[1]))
        self._index.add_with_ids(vectors, np.asarray(keys, dtype=np.int64))
        for k, d in zip(keys, doc_ids):
            self._doc_of[int(k)] = int(d)

    def remove_document(self, doc_id: int) -> None:
        if self._index is None:
            return
        ids = [k for k, d in self._doc_of.items() if d == doc_id]
        if ids:
            self._index.remove_ids(np.asarray(ids, dtype=np.int64))
            for k in ids:
                self._doc_of.pop(k, None)

    def clear(self) -> None:
        self._index = None
        self._doc_of = {}

    def count(self) -> int:
        return 0 if self._index is None else int(self._index.ntotal)

    def query(self, vector, top_k: int, doc_ids: set[int] | None = None) -> list[Hit]:
        if self._index is None or self.count() == 0:
            return []
        k = self.count() if doc_ids else min(top_k, self.count())
        scores, ids = self._index.search(np.asarray([vector], dtype=np.float32), k)
        hits = []
        for s, i in zip(scores[0], ids[0]):
            if i < 0 or (doc_ids and self._doc_of.get(int(i)) not in doc_ids):
                continue
            hits.append(Hit(int(i), float(s)))
            if len(hits) >= top_k:
                break
        return hits


class ChromaStore:
    name = "chroma"

    def __init__(self, persist_dir: str | None = None, collection: str | None = None):
        import chromadb  # raises ImportError if unavailable

        self._persistent = persist_dir is not None
        if persist_dir:
            self._client = chromadb.PersistentClient(path=persist_dir)
        else:
            self._client = chromadb.EphemeralClient()
        self._cname = collection or f"tmp_{uuid.uuid4().hex[:12]}"
        self._col = self._client.get_or_create_collection(self._cname, metadata={"hnsw:space": "cosine"})

    def add(self, keys, vectors, doc_ids) -> None:
        if len(keys) == 0:
            return
        vectors = np.asarray(vectors, dtype=np.float32)
        step = 500
        for i in range(0, len(keys), step):
            self._col.add(
                ids=[str(k) for k in keys[i : i + step]],
                embeddings=vectors[i : i + step].tolist(),
                metadatas=[{"document_id": int(d)} for d in doc_ids[i : i + step]],
            )

    def remove_document(self, doc_id: int) -> None:
        self._col.delete(where={"document_id": int(doc_id)})

    def clear(self) -> None:
        self._client.delete_collection(self._cname)
        self._col = self._client.get_or_create_collection(self._cname, metadata={"hnsw:space": "cosine"})

    def count(self) -> int:
        return int(self._col.count())

    def query(self, vector, top_k: int, doc_ids: set[int] | None = None) -> list[Hit]:
        total = self.count()
        if total == 0:
            return []
        kwargs = {}
        if doc_ids:
            kwargs["where"] = {"document_id": {"$in": [int(d) for d in doc_ids]}}
        res = self._col.query(
            query_embeddings=[np.asarray(vector, dtype=np.float32).tolist()],
            n_results=min(top_k, total),
            include=["distances"],
            **kwargs,
        )
        ids, dists = res["ids"][0], res["distances"][0]
        return [Hit(int(i), 1.0 - float(d)) for i, d in zip(ids, dists)]

    def close(self) -> None:
        """Drop temporary collections (no-op for persistent ones)."""
        if not self._persistent:
            try:
                self._client.delete_collection(self._cname)
            except Exception:  # noqa: BLE001
                pass


def normalise_store_name(name: str | None) -> str:
    n = (name or "numpy").strip().lower()
    aliases = {"chromadb": "chroma", "faiss-cpu": "faiss", "flat": "numpy", "in-memory": "numpy", "memory": "numpy"}
    return aliases.get(n, n)


def make_store(name: str, persist_dir: str | None = None, collection: str | None = None):
    """Return (store, effective_name, warning_or_None). Falls back to numpy if the backend can't load."""
    requested = normalise_store_name(name)
    try:
        if requested == "numpy":
            return NumpyStore(), "numpy", None
        if requested == "faiss":
            return FaissStore(), "faiss", None
        if requested == "chroma":
            return ChromaStore(persist_dir=persist_dir, collection=collection), "chroma", None
    except Exception as exc:  # ImportError or native-library failures
        warn = (
            f"Vector store '{requested}' is unavailable ({exc.__class__.__name__}: {exc}); "
            "using the exact NumPy store instead."
        )
        log.warning(warn)
        return NumpyStore(), "numpy", warn
    warn = f"Unknown vector store '{name}'; using the exact NumPy store instead."
    return NumpyStore(), "numpy", warn
