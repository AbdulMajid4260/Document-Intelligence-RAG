"""Groq chat-completions client (OpenAI-compatible endpoint). Uses httpx; no vendor SDK required."""
from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.config import get_settings

SYSTEM_PROMPT = (
    "You are a careful document question-answering assistant. Answer ONLY from the numbered context "
    "passages provided. Cite the passages you rely on with bracketed numbers like [1] or [2][3]. "
    "If the context does not contain the answer, say you could not find it in the uploaded documents "
    "rather than guessing. Be concise and do not invent facts, page numbers or quotations."
)


class LLMError(Exception):
    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


@dataclass(frozen=True)
class LLMResult:
    answer: str
    model: str


def build_context(sources: list[dict], max_chars: int) -> str:
    parts: list[str] = []
    used = 0
    for i, s in enumerate(sources, start=1):
        page = f", page {s['page']}" if s.get("page") is not None else ""
        header = f"[{i}] Source: {s['document_name']}{page}\n"
        room = max_chars - used - len(header)
        if room <= 200 and parts:
            break
        passage = s["passage"][: max(room, 200)]
        block = header + passage
        parts.append(block)
        used += len(block) + 2
    return "\n\n".join(parts)


def build_messages(question: str, sources: list[dict], max_chars: int) -> list[dict]:
    context = build_context(sources, max_chars)
    user = f"Context passages:\n\n{context}\n\nQuestion: {question}\n\nAnswer using only the context above."
    return [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user}]


def _post(url: str, headers: dict, payload: dict, timeout: float) -> httpx.Response:
    """Isolated so tests can replace the network call."""
    return httpx.post(url, headers=headers, json=payload, timeout=timeout)


def _provider_message(resp: httpx.Response) -> str:
    try:
        err = resp.json().get("error", {})
        return err.get("message") or resp.text[:300]
    except Exception:  # noqa: BLE001
        return resp.text[:300]


def generate_answer(question: str, sources: list[dict]) -> LLMResult:
    s = get_settings()
    if not s.groq_api_key or s.groq_api_key.lower().startswith("your_"):
        raise LLMError(
            503,
            "missing_api_key",
            "GROQ_API_KEY is not configured. Add it to Backend/.env and restart the server.",
        )
    payload = {
        "model": s.groq_model,
        "messages": build_messages(question, sources, s.max_context_chars),
        "temperature": 0.1,
        "max_tokens": 1024,
    }
    headers = {"Authorization": f"Bearer {s.groq_api_key}", "Content-Type": "application/json"}
    try:
        resp = _post(s.groq_api_url, headers, payload, s.groq_timeout)
    except httpx.TimeoutException as exc:
        raise LLMError(504, "provider_timeout", "The Groq API timed out. Try again.") from exc
    except httpx.HTTPError as exc:
        raise LLMError(502, "provider_unreachable", f"Could not reach the Groq API: {exc}") from exc

    if resp.status_code in (401, 403):
        raise LLMError(502, "provider_auth_error", "Groq rejected the API key. Check GROQ_API_KEY in .env.")
    if resp.status_code == 429:
        raise LLMError(429, "provider_rate_limited", "Groq rate limit reached. Wait a moment and retry.")
    if resp.status_code >= 400:
        raise LLMError(502, "provider_error", f"Groq returned HTTP {resp.status_code}: {_provider_message(resp)}")
    try:
        data = resp.json()
        answer = data["choices"][0]["message"]["content"].strip()
        model = data.get("model") or s.groq_model
    except Exception as exc:  # noqa: BLE001
        raise LLMError(502, "provider_bad_response", "Groq returned an unexpected response format.") from exc
    if not answer:
        raise LLMError(502, "provider_empty_answer", "Groq returned an empty answer.")
    return LLMResult(answer=answer, model=model)
