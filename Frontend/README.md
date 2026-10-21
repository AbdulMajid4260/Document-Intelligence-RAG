# Document Intelligence — RAG Assistant (Frontend)

A React + Vite frontend for a Retrieval-Augmented Generation (RAG) assignment.
You upload PDF/TXT files, ask questions, and see the answer together with the source passages it came from.

> **Status: frontend only, running on simulated (mock) data.**
> There is no Python backend, no embeddings, no vector database, no LLM and no database in this project.
> Every answer, source, similarity score and experiment number in mock mode is sample data and is labelled that way in the interface.

## 1. Frontend features

| Page | What works today (mock mode) |
| --- | --- |
| Dashboard | Counts of documents, questions and estimated chunks calculated from the current session state; recent documents and questions; quick actions; short "How RAG works" explanation; empty state guiding you to upload first. |
| Documents | File picker and drag-and-drop, multiple files, PDF/TXT validation (type, empty file, 10 MB limit), filename / extension / size, remove before upload, simulated upload with loading and success/error messages, document list, empty state, **Load sample session**, **Reset mock demo**. |
| Ask Questions | Multiline input, validation, sample questions, loading state, deterministic simulated answer, source cards you can expand, additional retrieved chunks, "Ask another question". |
| History | Search by question or answer, filter by source document, sort newest/oldest, detail view, back to list, clear history with confirmation, loading and error states, export of all history. |
| Experiments | Chunk size / overlap / vector store (FAISS, Chroma) / top-k selectors, comparison table, relevance + latency bar chart, retrieved chunks per run, guidance for a fair comparison. **All numbers are a labelled sample dataset, not measurements.** |
| About / Architecture | The full pipeline, the "vector storage vs SQLite history" distinction, and beginner-friendly explanations of each concept. |

**Exports (real, client-side in mock mode):** JSON, CSV and Excel (`.xlsx`) files are genuinely generated in your browser from the mock records, for a single answer and for all history. A success message appears only after the file has been created and the download started. The `.xlsx` writer is a small hand-written module (`src/utils/xlsx.js`), so no spreadsheet library is needed. CSV cells starting with `= + - @` are prefixed with an apostrophe to prevent spreadsheet-formula injection.

## 2. Technology stack

- React 18 (functional components and hooks), Vite 5, JavaScript, HTML, plain CSS
- Dependencies: `react`, `react-dom` (runtime); `vite`, `@vitejs/plugin-react` (development)
- No UI framework, no router library (a tiny hash-based router lives in `src/utils/nav.js`), no TypeScript

## 3. Folder structure

```text
rag-document-intelligence/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/          Reusable UI pieces
│   │   ├── Sidebar.jsx          navigation (sidebar on desktop, bottom bar on mobile)
│   │   ├── Header.jsx           page title + mock/real mode indicator
│   │   ├── DocumentUploader.jsx file picker, drag-and-drop, validation, upload
│   │   ├── DocumentList.jsx     table of uploaded documents
│   │   ├── QuestionForm.jsx     question input, validation, sample questions
│   │   ├── AnswerPanel.jsx      question, answer, timestamp, sources, export
│   │   ├── SourceCard.jsx       one retrieved chunk (expandable passage)
│   │   ├── HistoryList.jsx      list of history records
│   │   ├── ExportControls.jsx   JSON / CSV / Excel buttons
│   │   ├── ConfirmDialog.jsx    confirmation before destructive actions
│   │   ├── LoadingState.jsx, Notice.jsx, EmptyState.jsx, Icon.jsx
│   ├── pages/               One file per navigation item
│   │   ├── Dashboard.jsx, Documents.jsx, AskQuestions.jsx
│   │   ├── History.jsx, Experiments.jsx, Architecture.jsx
│   ├── services/
│   │   ├── api.js               THE ONLY file the UI uses to reach a backend
│   │   └── mockApi.js           in-memory fake backend (mock mode only)
│   ├── data/
│   │   └── mockData.js          all sample questions, answers, sources, experiments
│   ├── utils/
│   │   ├── exporters.js         builds JSON / CSV / XLSX files and starts downloads
│   │   ├── xlsx.js              minimal .xlsx writer
│   │   ├── format.js, nav.js
│   ├── styles/global.css
│   ├── App.jsx                  shared state (documents, history) and page switching
│   └── main.jsx
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

## 4. Prerequisites

- **Node.js 18 or newer** (20 LTS recommended) from <https://nodejs.org>. This also installs `npm`.
- VS Code (optional but recommended).

Check in PowerShell:

```powershell
node -v
npm -v
```

## 5. Setup on Windows (PowerShell)

1. Unzip the project and open the folder in VS Code (**File → Open Folder…**).
2. Open the VS Code terminal (**Terminal → New Terminal**, make sure it is PowerShell).
3. Install dependencies (needs internet, takes about a minute):

```powershell
npm install
```

4. Start the development server:

```powershell
npm run dev
```

5. Open the address printed in the terminal (normally <http://localhost:5173>). Press `Ctrl + C` in the terminal to stop the server.

If PowerShell says that running scripts is disabled, run the commands from **Command Prompt** instead, or run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.

## 6. Production build

```powershell
npm run build      # creates the "dist" folder
npm run preview    # optional: serves the built site locally
```

## 7. How to test the mock interface

1. Open **Dashboard**. It shows 0 documents and guides you to upload.
2. Open **Documents**. Choose a `.docx` file: you get an "not supported" message. Choose a `.pdf` or `.txt` file and select **Upload**. A loading indicator appears, then the document appears in the list.
   (Shortcut: **Load sample session** adds two sample documents and two history records.)
3. Open **Ask Questions**. The button is disabled while the box is empty. Select a sample question and **Ask question**. Expand **Show retrieved passage** on a source card.
4. Ask the same question twice: the answer is identical (answers are deterministic, never random).
   A custom question is matched to a sample topic by keywords; if nothing matches, a fixed placeholder answer is used.
5. Open **History**: search, filter by document, sort, open a record, go back, export JSON / CSV / Excel, and try **Clear history** (a confirmation dialog appears).
6. Tick **Simulate request failures** in the top bar and try an upload, a question, or Clear history to see the error states. Untick it to continue.
7. Open **Experiments** and **About / Architecture**.
8. Use **Reset mock demo** (Documents page) to start over. Reloading the browser page also clears everything, because mock data lives only in memory.

## 8. Switching between mock and real API mode

1. Copy `.env.example` to `.env` (same folder as `package.json`):

```powershell
Copy-Item .env.example .env
```

2. Edit `.env`:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_API_MODE=mock     # change to "real" when your FastAPI backend is running
```

3. Stop and restart `npm run dev` (Vite reads `.env` only at start-up).

The top bar shows **Mock mode** or the backend connection status. In real mode the mock-only buttons (Load sample session, Reset mock demo, Simulate failures) are hidden or inactive, and network errors, HTTP errors and invalid-JSON responses are turned into readable messages by `src/services/api.js`.

If the browser reports a CORS error in real mode, the backend must allow the frontend origin (for example `http://localhost:5173`) and expose the `Content-Disposition` header so export filenames can be read.

## 9. Planned backend integration

These are **planned contracts, not implemented endpoints**. Names and response shapes can change when the backend is built; adjust only `src/services/api.js`.

| Service function | Planned endpoint |
| --- | --- |
| `checkHealth()` | `GET /health` |
| `uploadDocuments(files)` | `POST /api/documents/upload` (multipart, field name `files`) |
| `fetchDocuments()` | `GET /api/documents` |
| `askQuestion(question)` | `POST /api/ask` with JSON `{ "question": "..." }` |
| `fetchHistory()` | `GET /api/history` |
| `fetchHistoryRecord(id)` | `GET /api/history/{id}` |
| `clearHistory()` | `DELETE /api/history` |
| `exportHistory(format)` | `GET /api/history/export?format=json\|csv\|xlsx` |
| `exportAnswer(id, format)` | `GET /api/history/{id}/export?format=json\|csv\|xlsx` |
| `runExperiment(configuration)` | `POST /api/experiments/run` |
| `fetchExperiments()` | `GET /api/experiments` |

### Record shape the UI expects

```jsonc
// history record / answer from POST /api/ask
{
  "id": "rec-001",
  "question": "...",
  "answer": "...",
  "timestamp": "2026-10-19T11:39:15.562Z",
  "sources": [
    { "documentName": "file.pdf", "page": 5, "chunkId": "chunk-0011", "score": 0.89, "passage": "..." }
  ],
  "additionalChunks": [ /* same shape as sources, optional */ ]
}
// document: { id, name, ext, size, status, uploadedAt, pages, chunks }
// upload response: { results: [ { fileName, ok, message } ] }
// experiment run: { id, chunkSize, overlap, vectorStore, topK, relevance, latencyMs, notes, retrievedChunks: [ { chunkId, score, text } ] }
```

`page` may be `null` for TXT files. Records with `"simulated": true` are labelled as simulated in the UI and in exports; real backend records should leave that field out.

In real mode the export functions download the file the backend returns. In mock mode the same buttons build the file in the browser.

## 10. Security notes

- Variables prefixed with `VITE_` are compiled into the browser code and visible to anyone. **Never put API keys, passwords or tokens in them.**
- No LLM key is used or needed in the frontend. The backend must hold any LLM or database credentials.
- `.env` and `.env.local` are in `.gitignore`; `.env.example` contains no secret and is safe to commit.
- Nothing in the app uses `localStorage` or `sessionStorage`. The project is safe to publish publicly.

## 11. Known limitations

- Everything is simulated: no text extraction, chunking, embeddings, retrieval, LLM answers or persistence. Uploaded files are never read. Only name and size are used. Page and chunk counts are rough estimates.
- Mock answers come from four sample topics plus one fixed fallback. Their passages are sample text and are not taken from your files.
- History, documents and experiments reset when the page is reloaded.
- Real mode is written from the planned contracts but has **not** been tested against a backend, because no backend exists yet. Expect to adjust field names in `api.js`.
- The experiments table is a sample dataset. Real runs need the backend.
- No login, no multi-user support, no automated unit tests, English only.
- `package-lock.json` is not included. `npm install` creates it; commit it afterwards if you want reproducible installs.

## 12. Screenshots

Add your own screenshots after running the project (for example in a `docs/` folder):

| Page | Screenshot |
| --- | --- |
| Dashboard | `docs/dashboard.png` *(placeholder)* |
| Documents | `docs/documents.png` *(placeholder)* |
| Ask Questions + answer | `docs/answer.png` *(placeholder)* |
| History | `docs/history.png` *(placeholder)* |
| Experiments | `docs/experiments.png` *(placeholder)* |
| Architecture | `docs/architecture.png` *(placeholder)* |
| Mobile layout | `docs/mobile.png` *(placeholder)* |
