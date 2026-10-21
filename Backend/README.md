# Document Intelligence RAG – Backend

FastAPI backend for the Document Intelligence RAG assistant: upload PDF/TXT files, chunk and index them,
ask questions answered by Groq from the retrieved passages (with citations), keep history, export it,
and run retrieval experiments.

**Stack:** Python 3.12 · FastAPI · Uvicorn · SQLAlchemy + SQLite · pypdf · NumPy vector search (optional
Chroma / FAISS / sentence-transformers) · Groq API · pandas + openpyxl · pytest

---

## 1. Setup on Windows (PowerShell)

Run these from the `Backend` folder (adjust the path if yours differs):

```powershell
cd C:\Users\shaik\OneDrive\Documents\Document-Intelligence-RAG\Backend

# create and activate a Python 3.12 virtual environment
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1

# install dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt

# create your settings file, then add your Groq key (section 2)
Copy-Item .env.example .env
notepad .env

# start the server
uvicorn app.main:app --reload --port 8000
```

If activation is blocked ("running scripts is disabled"), run this once in the same window and retry:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Open **http://127.0.0.1:8000/docs** (Swagger UI) and **http://127.0.0.1:8000/health**.

> **OneDrive tip:** your project lives in OneDrive, which can lock or sync the `.venv` folder and the SQLite
> file while they are in use. If you see odd file-lock errors, create the venv outside OneDrive
> (e.g. `py -3.12 -m venv C:\venvs\rag`) and/or set `DATABASE_URL` and `UPLOAD_DIR` in `.env` to a folder
> outside OneDrive, e.g. `DATABASE_URL=sqlite:///C:/rag-data/rag.db`.

## 2. Add your Groq API key

1. Create a key at https://console.groq.com/keys
2. Open `Backend\.env` and replace the placeholder:
   ```
   GROQ_API_KEY=gsk_your_real_key_here
   ```
3. Restart the server (stop with `Ctrl+C`, start again). `/health` shows `"groq_configured": true`.

Never commit `.env` (it is in `.gitignore`). If the key is missing, `/api/ask` returns HTTP 503 with
`"code": "missing_api_key"`; uploads, history and experiments still work.

## 3. Embeddings and vector store (important honesty note)

| `EMBEDDING_BACKEND` | What you get |
|---|---|
| `auto` (default) | Real semantic embeddings if `sentence-transformers` is installed and loads; otherwise a **lexical keyword-hashing fallback** |
| `sentence-transformers` | Semantic embeddings or a clear error |
| `hashing` | Always the lexical fallback |

The fallback matches shared **words and phrases only** – it does **not** understand meaning. Whenever it is
in use the API says so: `/health` → `"semantic_search": false`, `/api/ask` → `retrieval_mode` starts with
`lexical`, and experiment summaries include `"semantic": false` plus a warning.

To enable semantic search (large download: PyTorch + model; may be blocked on some Windows machines):

```powershell
pip install sentence-transformers
```

Vector stores (`VECTOR_STORE` in `.env`): `numpy` (default, exact, always works), `chroma`
(`pip install chromadb`) or `faiss` (`pip install faiss-cpu`). If a chosen store cannot load, the app falls
back to `numpy` and reports it (`/health` warnings, experiment `effective_vector_store`).
Chunk vectors are saved in SQLite, so the index is rebuilt automatically after a restart.
If you change the embedding backend/model, existing chunks are re-embedded on the next start.

## 4. Connect the frontend

CORS already allows `http://localhost:5173` and `http://127.0.0.1:5173`.

1. Start this backend (port 8000).
2. In `Frontend`, point the API base URL to `http://127.0.0.1:8000` and switch off mock mode
   (check `Frontend\src\services\api.js` and `Frontend\README.md` for the exact variable names, e.g. in
   `Frontend\.env`).
3. Restart `npm run dev` and use the app on http://localhost:5173.

**Compatibility note:** this backend was written from the API contract in the project brief; the frontend
source was not inspected. If a field name differs, you have two quick options:
* set `RESPONSE_KEY_STYLE=camel` (or `both`) in `.env` to get `documentName`-style keys instead of `document_name`;
* adjust the mapping in `api.js`, or send `api.js` to be matched exactly.

Requests accept both `snake_case` and `camelCase` field names.

## 5. API reference

Errors always look like `{"detail": "...", "message": "...", "code": "machine_readable_code"}`.

| Method & path | Purpose |
|---|---|
| `GET /health` | Status, DB check, whether Groq is configured, active embedding/vector store |
| `POST /api/documents/upload` | multipart field `files` (several allowed; `file` also accepted). PDF/TXT only, size/empty checks. → `{documents:[…], errors:[…], uploaded:n}` (HTTP 201; 422 if nothing could be processed) |
| `GET /api/documents` | → `{documents:[…], total}` with status, `page_count`, `chunk_count`, … |
| `DELETE /api/documents/{id}` | Remove a document, its chunks and index entries |
| `POST /api/ask` | Body `{"question": "...", "document_ids": [1], "top_k": 4}` (last two optional) → `{id, question, answer, sources:[{document_id, document_name, page, chunk_id, chunk_index, score, passage}], model, retrieval_mode, top_k, latency_ms, created_at}` |
| `GET /api/history?limit&offset` | → `{history:[…], total}` newest first |
| `GET /api/history/{id}` | One record |
| `DELETE /api/history` | Delete all history → `{deleted: n}` |
| `GET /api/history/export?format=json\|csv\|xlsx` | Download all history |
| `GET /api/history/{id}/export?format=json\|csv\|xlsx` | Download one record |
| `POST /api/experiments/run` | Body `{"chunk_size":500,"chunk_overlap":100,"vector_store":"numpy","top_k":3,"queries":["…"],"notes":"…","document_ids":[…]}` → saved experiment |
| `GET /api/experiments` | → `{experiments:[…], total}` newest first |

Details worth knowing:

* **TXT files** have no pages, so their citations have `"page": null`. **PDF** chunks never span pages, so
  each citation has an accurate page number. Scanned/image-only PDFs have no extractable text and are rejected
  with a clear message (no OCR).
* `chunk_id` looks like `doc3-chunk12`. `score` is the cosine similarity (higher = more similar).
* **Experiments** re-chunk the stored document text with the requested settings, index it in a temporary
  store (the live index is untouched) and run your queries. Recorded: chunk counts, average chunk size,
  embedding/index/query timings, the actual top-k hits with scores, the effective embedding and vector store.
  The summary's `avg_top1_score` is a raw similarity average – **not** a relevance or accuracy metric; no such
  metrics are invented. Judging which settings retrieve better passages is up to you, reading the hits.
* Exports: CSV is UTF-8 with BOM (opens correctly in Excel); cells beginning with `= + - @` are prefixed with
  `'` to prevent spreadsheet formula injection; XLSX cells are capped below Excel's 32,767-character limit.
* If the question matches nothing in the documents, the answer says so without calling Groq.

## 6. Run the tests

```powershell
.\.venv\Scripts\Activate.ps1
pytest -v
```

Tests use a temporary database/upload folder, the offline hashing embedder and a mocked LLM (plus a fake HTTP
layer for the Groq client), so they need no API key or internet. They never touch your real data.

## 7. Project layout

```
Backend/
├─ app/
│  ├─ main.py            FastAPI app, CORS, error handlers
│  ├─ config.py          settings from .env
│  ├─ database.py        SQLAlchemy engine/session
│  ├─ models.py          Document, Chunk, QARecord, Experiment
│  ├─ serializers.py     JSON shaping + optional camelCase responses
│  ├─ errors.py
│  ├─ routers/           health, documents, ask, history, experiments
│  └─ services/          text_processing, embeddings, vector_store, rag, llm, exports, experiments
├─ tests/
├─ data/                 created at runtime (SQLite DB, uploads, Chroma) – git-ignored
├─ requirements.txt  requirements-optional.txt  .env.example  .gitignore  pytest.ini
```

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `py -3.12` not found | Install Python 3.12 from python.org (tick "Add to PATH") or use `python -m venv .venv` if `python --version` is 3.12 |
| `ModuleNotFoundError` | Activate the venv, then `pip install -r requirements.txt` |
| `/api/ask` → 503 `missing_api_key` | Fill in `GROQ_API_KEY` in `.env` and restart |
| `/api/ask` → 502 `provider_auth_error` | The Groq key is wrong or revoked |
| Port 8000 busy | `uvicorn app.main:app --reload --port 8001` and update the frontend URL |
| Browser CORS error | The frontend must run on `localhost:5173` or `127.0.0.1:5173`, or add its origin to `CORS_ORIGINS` |
| `/health` shows `semantic_search: false` | Expected without `sentence-transformers`; see section 3 |
