"""History export helpers (JSON / CSV / XLSX). Pure functions: take dicts, return bytes."""
from __future__ import annotations

import io
import json

import pandas as pd

FORMATS = {
    "json": ("application/json", "json"),
    "csv": ("text/csv; charset=utf-8", "csv"),
    "xlsx": ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"),
}
_XLSX_CELL_LIMIT = 32000
_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def _safe_cell(value):
    """Prevent spreadsheet formula injection and Excel's 32,767-char cell limit."""
    if isinstance(value, str):
        if value.startswith(_FORMULA_PREFIXES):
            value = "'" + value
        if len(value) > _XLSX_CELL_LIMIT:
            value = value[:_XLSX_CELL_LIMIT] + " …[truncated]"
    return value


def _format_sources(sources: list[dict]) -> str:
    lines = []
    for i, s in enumerate(sources, start=1):
        page = f", page {s['page']}" if s.get("page") is not None else ""
        lines.append(f"[{i}] {s.get('document_name', '?')}{page} ({s.get('chunk_id', '?')}, score {s.get('score')})")
    return "\n".join(lines)


def flatten_record(rec: dict) -> dict:
    sources = rec.get("sources") or []
    return {
        "id": rec.get("id"),
        "created_at": rec.get("created_at"),
        "question": rec.get("question"),
        "answer": rec.get("answer"),
        "model": rec.get("model"),
        "retrieval_mode": rec.get("retrieval_mode"),
        "top_k": rec.get("top_k"),
        "latency_ms": rec.get("latency_ms"),
        "source_count": len(sources),
        "sources": _format_sources(sources),
    }


def build_export(records: list[dict], fmt: str, single: bool = False) -> tuple[bytes, str]:
    """Return (content_bytes, media_type). ``single`` makes JSON a single object instead of a list."""
    fmt = fmt.lower()
    if fmt not in FORMATS:
        raise ValueError(f"Unsupported export format '{fmt}'. Use json, csv or xlsx.")
    media = FORMATS[fmt][0]
    if fmt == "json":
        payload = records[0] if (single and records) else records
        return json.dumps(payload, indent=2, ensure_ascii=False).encode("utf-8"), media

    rows = [{k: _safe_cell(v) for k, v in flatten_record(r).items()} for r in records]
    columns = list(flatten_record({}).keys())
    df = pd.DataFrame(rows, columns=columns)
    if fmt == "csv":
        return df.to_csv(index=False).encode("utf-8-sig"), media  # BOM so Excel opens UTF-8 correctly
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="History")
        ws = writer.sheets["History"]
        widths = {"question": 50, "answer": 80, "sources": 60, "created_at": 26}
        for idx, col in enumerate(columns, start=1):
            letter = ws.cell(row=1, column=idx).column_letter
            ws.column_dimensions[letter].width = widths.get(col, 16)
    return buf.getvalue(), media


def export_filename(prefix: str, fmt: str) -> str:
    return f"{prefix}.{FORMATS[fmt.lower()][1]}"
