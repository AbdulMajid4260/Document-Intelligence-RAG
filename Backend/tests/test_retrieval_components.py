import numpy as np

from app.services.embeddings import HashingEmbedder
from app.services.vector_store import NumpyStore, make_store

DOCS = [
    "Chroma is a vector database for embeddings",
    "Cats sleep most of the day",
    "FAISS performs fast similarity search on vectors",
    "The recipe needs two eggs and flour",
]


def test_hashing_embeddings_normalised_and_deterministic():
    e = HashingEmbedder()
    a, b = e.embed(DOCS), e.embed(DOCS)
    assert np.allclose(a, b)
    assert np.allclose(np.linalg.norm(a, axis=1), 1, atol=1e-5)
    assert e.semantic is False


def test_numpy_store_query_filter_remove():
    e = HashingEmbedder()
    store = NumpyStore()
    store.add([10, 11, 12, 13], e.embed(DOCS), [1, 1, 2, 2])
    q = e.embed(["which vector database stores embeddings"])[0]
    assert store.query(q, 2)[0].key == 10
    assert {h.key for h in store.query(q, 3, {2})} <= {12, 13}
    store.remove_document(1)
    assert store.count() == 2


def test_unavailable_store_falls_back_visibly():
    store, effective, warning = make_store("definitely-not-a-store")
    assert effective == "numpy" and warning
