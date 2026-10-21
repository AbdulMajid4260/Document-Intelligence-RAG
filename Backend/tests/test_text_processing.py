import pytest

from app.services.text_processing import (
    ExtractionError, PageText, chunk_pages, extract_pdf, extract_txt, split_text,
)
from tests.conftest import make_pdf


def test_split_respects_size_and_overlaps():
    text = "Retrieval augmented generation combines search with language models. " * 40
    chunks = split_text(text, 300, 60)
    assert len(chunks) > 5
    assert all(len(c) <= 300 for c in chunks)
    assert any(chunks[i].split()[-1] in chunks[i + 1] for i in range(len(chunks) - 1))


@pytest.mark.parametrize("size,overlap", [(300, 300), (300, 400), (10, 2), (300, -1)])
def test_invalid_chunk_params(size, overlap):
    with pytest.raises(ValueError):
        split_text("x" * 1000, size, overlap)


def test_no_infinite_loop_without_whitespace():
    assert len(split_text("a" * 5000, 500, 100)) >= 10


def test_chunks_keep_page_numbers():
    chunks = chunk_pages([PageText(1, "alpha beta " * 100), PageText(3, "gamma delta " * 100)], 200, 40)
    assert {c.page for c in chunks} == {1, 3}
    assert [c.chunk_index for c in chunks] == list(range(len(chunks)))


def test_extract_txt_and_errors():
    assert extract_txt("héllo wörld".encode())[0].text == "héllo wörld"
    for bad in (b"", b"  \n ", b"\x00\x01binary"):
        with pytest.raises(ExtractionError):
            extract_txt(bad)


def test_extract_pdf_pages():
    pages = extract_pdf(make_pdf(["First page about vectors", "Second page about overlap"]))
    assert [p.page for p in pages] == [1, 2]
    assert "overlap" in pages[1].text


def test_extract_pdf_garbage():
    with pytest.raises(ExtractionError):
        extract_pdf(b"%PDF-1.4 not really a pdf")
