"""Text extraction (PDF/TXT) and overlapping chunking. No web/DB dependencies."""
from __future__ import annotations

import io
import re
from dataclasses import dataclass


class ExtractionError(Exception):
    """Raised when a file cannot be read or contains no extractable text."""


@dataclass(frozen=True)
class PageText:
    page: int | None  # 1-based for PDF, None for TXT
    text: str


@dataclass(frozen=True)
class ChunkData:
    chunk_index: int
    page: int | None
    text: str


def normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\x00", "")
    text = re.sub(r"[ \t\f\v]+", " ", text)
    text = re.sub(r" ?\n ?", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_txt(data: bytes) -> list[PageText]:
    if b"\x00" in data[:4096]:
        raise ExtractionError("File looks binary, not a plain-text file.")
    text = None
    for enc in ("utf-8-sig", "utf-16", "cp1252", "latin-1"):
        try:
            text = data.decode(enc)
            break
        except (UnicodeDecodeError, UnicodeError):
            continue
    text = normalize_text(text or "")
    if not text:
        raise ExtractionError("The text file contains no readable text.")
    return [PageText(page=None, text=text)]


def extract_pdf(data: bytes) -> list[PageText]:
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError

    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            try:
                ok = reader.decrypt("")
            except Exception:  # noqa: BLE001
                ok = 0
            if not ok:
                raise ExtractionError("The PDF is password-protected.")
        pages: list[PageText] = []
        for idx, page in enumerate(reader.pages, start=1):
            try:
                raw = page.extract_text() or ""
            except Exception:  # noqa: BLE001  (one bad page should not kill the document)
                raw = ""
            text = normalize_text(raw)
            if text:
                pages.append(PageText(page=idx, text=text))
    except ExtractionError:
        raise
    except (PdfReadError, ValueError, KeyError, OSError) as exc:
        raise ExtractionError(f"Could not read the PDF: {exc}") from exc
    except Exception as exc:  # noqa: BLE001
        raise ExtractionError(f"Could not read the PDF: {exc}") from exc
    if not pages:
        raise ExtractionError(
            "No extractable text found in the PDF (it may be a scanned image; OCR is not supported)."
        )
    return pages


def extract_text(file_type: str, data: bytes) -> list[PageText]:
    if file_type == "pdf":
        return extract_pdf(data)
    if file_type == "txt":
        return extract_txt(data)
    raise ExtractionError(f"Unsupported file type: {file_type}")


def validate_chunk_params(chunk_size: int, overlap: int) -> None:
    if chunk_size < 50:
        raise ValueError("chunk_size must be at least 50 characters.")
    if overlap < 0:
        raise ValueError("chunk_overlap cannot be negative.")
    if overlap >= chunk_size:
        raise ValueError("chunk_overlap must be smaller than chunk_size.")


def split_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    """Character-window splitter with overlap; prefers to cut at whitespace near the window end."""
    validate_chunk_params(chunk_size, overlap)
    text = text.strip()
    n = len(text)
    if n == 0:
        return []
    if n <= chunk_size:
        return [text]
    chunks: list[str] = []
    start = 0
    while start < n:
        end = min(start + chunk_size, n)
        if end < n:
            lo = start + int(chunk_size * 0.8)
            cut = max(text.rfind(" ", lo, end), text.rfind("\n", lo, end))
            if cut > start:
                end = cut
        piece = text[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= n:
            break
        nxt = end - overlap
        if nxt <= start:  # guarantee forward progress
            nxt = end
        start = nxt
        # avoid starting in the middle of a word
        if start < n and not text[start - 1].isspace() and not text[start].isspace():
            sp = text.find(" ", start, end)
            if sp != -1:
                start = sp + 1
    return chunks


def chunk_pages(pages: list[PageText], chunk_size: int, overlap: int) -> list[ChunkData]:
    """Chunk each page separately so every chunk keeps a single, accurate page number."""
    out: list[ChunkData] = []
    for p in pages:
        for piece in split_text(p.text, chunk_size, overlap):
            out.append(ChunkData(chunk_index=len(out), page=p.page, text=piece))
    return out
