# Document Intelligence – RAG Assistant

Upload PDF or text documents, ask questions in plain language, and get answers that are **grounded in your documents** – with the source passages (file, page, similarity score) shown for every answer.

Built as a Retrieval-Augmented Generation (RAG) project: **React + Vite** frontend, **FastAPI** backend, pluggable **vector search** (NumPy / FAISS / Chroma), **Groq** LLM, and **SQLite** for documents and history.

---

## Features

- **Upload** PDF/TXT files (type, size and file-count validation, per-file error messages)
- **Ask questions** and receive an answer with numbered citations and expandable source cards (document, page, score)
- **"Not found" handling** – if nothing relevant is retrieved, the app says so instead of letting the LLM guess
- **History** – every question and answer is saved; search, view, delete
- **Export** a single answer or the whole history as **JSON, CSV or XLSX** (spreadsheet formula injection is neutralised)
- **Experiments page** – compare chunk size, overlap, vector store and top-k, with measured indexing time, query latency and cosine scores
- **Honest labelling** – the app reports whether retrieval is *semantic* or *lexical* and which vector store is really in use

---

## How it works

```
Upload ──► Extract text ──► Chunk ──► Embed ──► Store vectors
(PDF/TXT)  (pypdf, per page) (1000 chars,  (semantic or     (NumPy / FAISS / Chroma
                              200 overlap)  lexical)         + SQLite)

Question ─► Embed ─► Top-k similar chunks ─► Prompt (system prompt + context) ─► Groq LLM ─► Answer + sources
```

| Stage | File |
|---|---|
| Upload endpoint and validation | `Backend/app/routers/documents.py` |
| Text extraction and chunking | `Backend/app/services/text_processing.py` |
| Embeddings (semantic + lexical fallback) | `Backend/app/services/embeddings.py` |
| Vector stores (NumPy, FAISS, Chroma) | `Backend/app/services/vector_store.py` |
| Ingestion and retrieval | `Backend/app/services/rag.py` |
| Prompt building and Groq call | `Backend/app/services/llm.py` |
| Ask endpoint | `Backend/app/routers/ask.py` |
| History, export, experiments | `routers/history.py`, `services/exports.py`, `services/experiments.py` |
| Frontend ↔ backend bridge | `Frontend/src/services/api.js` |

### Embeddings and vector stores

- **Embeddings:** `sentence-transformers/all-MiniLM-L6-v2` gives semantic search. If it is not installed, the app falls back to a **lexical hashing embedder** (keyword overlap, not semantic) and says so in `/health`, in each answer's `retrieval_mode`, and in experiment summaries.
- **Vector store:** `VECTOR_STORE=numpy` (default, exact search, no extra dependencies), `faiss` or `chroma`. If the chosen library is missing, the app falls back to NumPy and reports it.
- Vectors are also stored in SQLite, so the index is rebuilt automatically after a restart.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, JavaScript, plain CSS |
| Backend | Python 3.12, FastAPI, Uvicorn, SQLAlchemy, Pydantic |
| Storage | SQLite (documents, chunks + vectors, history, experiments) |
| Documents | pypdf |
| Retrieval | NumPy (default); optional sentence-transformers, FAISS, Chroma |
| LLM | Groq API (OpenAI-compatible endpoint) |
| Export | pandas, openpyxl |
| Testing | pytest, httpx |

---

## Project structure

```
Document-Intelligence-RAG/
├── Backend/
│   ├── app/
│   │   ├── main.py            # app setup, CORS, error handlers, routers
│   │   ├── config.py          # settings from .env
│   │   ├── database.py        # SQLAlchemy engine/session
│   │   ├── models.py          # documents, chunks, history, experiments
│   │   ├── routers/           # documents, ask, history, experiments, health
│   │   └── services/          # text_processing, embeddings, vector_store, rag, llm, exports, experiments
│   ├── tests/                 # pytest suite
│   ├── requirements.txt
│   ├── requirements-optional.txt
│   └── .env.example
└── Frontend/
    ├── src/
    │   ├── pages/             # Dashboard, Documents, AskQuestions, History, Experiments, Architecture
    │   ├── components/
    │   └── services/api.js    # all backend calls (mock or real mode)
    ├── package.json
    └── .env.example
```

---

## Getting started

**Requirements:** Python 3.12, Node.js 18+, and a free [Groq API key](https://console.groq.com/).

### 1. Backend

```bash
cd Backend

# create and activate a virtual environment
python -m venv .venv
# Windows (PowerShell):  .\.venv\Scripts\Activate.ps1
# macOS / Linux:         source .venv/bin/activate

pip install -r requirements.txt

# create your settings file and add your Groq key
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
# edit .env  ->  GROQ_API_KEY=your_key_here

uvicorn app.main:app --reload --port 8000
```

Check it is running: open <http://127.0.0.1:8000/health> (API docs at <http://127.0.0.1:8000/docs>).

*Optional – semantic search and other vector stores (install what you want, one at a time):*

```bash
pip install sentence-transformers   # semantic embeddings (downloads PyTorch + a ~90 MB model)
pip install faiss-cpu               # then set VECTOR_STORE=faiss
pip install chromadb                # then set VECTOR_STORE=chroma
```

### 2. Frontend

```bash
cd Frontend
npm install
cp .env.example .env
```

Set these in `Frontend/.env`:

```
VITE_API_MODE=real
VITE_API_BASE_URL=http://127.0.0.1:8000
```

```bash
npm run dev
```

Open <http://localhost:5173>. With `VITE_API_MODE=mock` the UI runs on simulated data without a backend.

> Never put secrets in a `VITE_` variable – they are bundled into the browser code. The Groq key belongs only in `Backend/.env`.

### 3. Try it

1. Go to **Documents** and upload a PDF or TXT file.
2. Go to **Ask Questions** and ask something the document answers, then something it does not – the second should return a "not found" style answer.
3. Open **History** to review and export answers, and **Experiments** to compare chunking settings.

---

## Configuration (`Backend/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `GROQ_API_KEY` | – | Groq API key (**required**, never commit) |
| `GROQ_MODEL` | see `.env.example` | Groq model id (the project was run with `openai/gpt-oss-120b`) |
| `GROQ_TIMEOUT_SECONDS` | 60 | LLM request timeout |
| `DATABASE_URL` | `sqlite:///./data/rag.db` | SQLite database |
| `MAX_UPLOAD_MB` / `MAX_FILES_PER_UPLOAD` | 20 / 10 | Upload limits |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | 1000 / 200 | Chunking (characters) |
| `TOP_K` | 4 | Chunks retrieved per question |
| `MAX_CONTEXT_CHARS` | 12000 | Cap on context sent to the LLM |
| `EMBEDDING_BACKEND` | `auto` | `auto`, `sentence-transformers` or `hashing` |
| `EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | Semantic model name |
| `VECTOR_STORE` | `numpy` | `numpy`, `faiss` or `chroma` |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Allowed frontend origins |

---

## API overview

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Status, embedding backend, vector store, warnings |
| POST | `/api/documents/upload` | Upload one or more files (`files` form field) |
| GET | `/api/documents` | List documents |
| DELETE | `/api/documents/{id}` | Delete a document and its chunks |
| POST | `/api/ask` | Ask a question → answer, sources, retrieval mode |
| GET | `/api/history` | List saved questions and answers |
| GET | `/api/history/{id}` | One record |
| GET | `/api/history/export?format=json\|csv\|xlsx` | Export all history |
| GET | `/api/history/{id}/export?format=json\|csv\|xlsx` | Export one answer |
| DELETE | `/api/history` | Clear history |
| POST | `/api/experiments/run` | Run a chunking / retrieval experiment |
| GET | `/api/experiments` | List saved experiments |

Interactive docs: <http://127.0.0.1:8000/docs>

---

## Tests

```bash
cd Backend
pytest
```

The suite (38 tests) covers upload validation, ask error handling, Groq error mapping, exports, experiments and chunking.

---

## Findings (summary)

A small retrieval experiment on a 4-page sample document (10 factual questions, lexical embeddings, NumPy store, top-4):

| Chunk size / overlap | Chunks | hit@1 | hit@4 |
|---|---|---|---|
| 256 / 32 | 29 | 8/10 | 9/10 |
| 512 / 64 | 15 | 8/10 | 9/10 |
| **1000 / 200 (default)** | 10 | **9/10** | 9/10 |
| 1500 / 300 | 6 | 7/10 | 10/10 |

Questions phrased differently from the document text (for example *"minimum attendance"* versus *"attend at least 80%"*) were missed by lexical retrieval – the case semantic embeddings are meant to fix. This is a small, single-run test; details and caveats are in the research notes.

---

## Limitations and future work

- No OCR – scanned PDFs are rejected with a clear message
- Single-user, local app; no authentication
- Ingestion runs inside the upload request (large files would need background processing)
- Compare semantic vs. lexical retrieval and FAISS vs. Chroma vs. NumPy with the optional packages installed
- Reranking, hybrid search, conversation memory and answer-quality scoring

---

## Author

[Your name] – [course / assignment name]
