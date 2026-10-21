"""Embedding backends.

* ``sentence-transformers``  -> real semantic embeddings (optional dependency).
* ``hashing``                -> lexical feature-hashing fallback. NOT semantic: it only matches
                                shared words/phrases. It is always labelled as such in API output.
"""
from __future__ import annotations

import logging
import re
import threading
import zlib

import numpy as np

log = logging.getLogger(__name__)

_TOKEN_RE = re.compile(r"[a-z0-9]+")
_STOP = frozenset(
    "a an and are as at be but by for from has have he her his i in is it its of on or she that the "
    "their them they this to was were will with you your we our not no".split()
)


class EmbeddingUnavailable(RuntimeError):
    pass


class HashingEmbedder:
    name = "hashing-lexical-v1"
    backend = "hashing"
    semantic = False

    def __init__(self, dim: int = 1024):
        self.dim = dim

    def _tokens(self, text: str) -> list[str]:
        return [t for t in _TOKEN_RE.findall(text.lower()) if t not in _STOP and len(t) > 1]

    def embed(self, texts: list[str]) -> np.ndarray:
        out = np.zeros((len(texts), self.dim), dtype=np.float32)
        for row, text in enumerate(texts):
            toks = self._tokens(text)
            feats = toks + [f"{a}_{b}" for a, b in zip(toks, toks[1:])]
            for f in feats:
                h = zlib.crc32(f.encode("utf-8"))
                sign = 1.0 if (h >> 31) & 1 else -1.0
                out[row, h % self.dim] += sign
            v = out[row]
            nz = v != 0
            v[nz] = np.sign(v[nz]) * (1.0 + np.log(np.abs(v[nz])))  # sublinear tf
            norm = float(np.linalg.norm(v))
            if norm > 0:
                out[row] = v / norm
        return out


class SentenceTransformerEmbedder:
    backend = "sentence-transformers"
    semantic = True

    def __init__(self, model_name: str):
        try:
            from sentence_transformers import SentenceTransformer
        except Exception as exc:  # ImportError or native-library OSError on Windows
            raise EmbeddingUnavailable(f"sentence-transformers could not be loaded: {exc}") from exc
        try:
            self._model = SentenceTransformer(model_name)
        except Exception as exc:  # noqa: BLE001
            raise EmbeddingUnavailable(f"Could not load embedding model '{model_name}': {exc}") from exc
        self.name = model_name
        self.dim = int(self._model.get_sentence_embedding_dimension())

    def embed(self, texts: list[str]) -> np.ndarray:
        vecs = self._model.encode(
            texts, batch_size=32, normalize_embeddings=True, show_progress_bar=False, convert_to_numpy=True
        )
        return np.asarray(vecs, dtype=np.float32)


_lock = threading.Lock()
_cache: dict[tuple[str, str], tuple[object, str | None]] = {}


def get_embedder(backend: str, model_name: str):
    """Return (embedder, warning_or_None). ``auto`` tries sentence-transformers then falls back."""
    key = (backend, model_name)
    with _lock:
        if key in _cache:
            return _cache[key]
        warning: str | None = None
        if backend == "hashing":
            emb = HashingEmbedder()
        elif backend == "sentence-transformers":
            emb = SentenceTransformerEmbedder(model_name)  # raises EmbeddingUnavailable on failure
        elif backend == "auto":
            try:
                emb = SentenceTransformerEmbedder(model_name)
            except EmbeddingUnavailable as exc:
                log.warning("Falling back to lexical hashing embeddings: %s", exc)
                emb = HashingEmbedder()
                warning = (
                    "Semantic embeddings are unavailable, so retrieval uses LEXICAL hashing embeddings "
                    f"(keyword overlap, not semantic search). Reason: {exc}"
                )
        else:
            raise EmbeddingUnavailable(
                f"Unknown EMBEDDING_BACKEND '{backend}'. Use auto, sentence-transformers or hashing."
            )
        if backend == "hashing":
            warning = "EMBEDDING_BACKEND=hashing: retrieval is lexical (keyword overlap), not semantic."
        _cache[key] = (emb, warning)
        return emb, warning


def clear_embedder_cache() -> None:
    with _lock:
        _cache.clear()
