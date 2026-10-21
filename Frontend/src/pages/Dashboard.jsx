
import EmptyState from '../components/EmptyState.jsx';
import { formatDateTime } from '../utils/format.js';
import { navigate } from '../utils/nav.js';

const RAG_STEPS = [
  ['Split', 'Documents are cut into small chunks of text.'],
  ['Embed', 'Each chunk becomes a list of numbers that captures its meaning.'],
  ['Retrieve', 'Your question is embedded too, and the closest chunks are found.'],
  [
    'Generate',
    'A language model writes an answer using only those chunks, and the sources are shown.',
  ],
];

export default function Dashboard({
  documents = [],
  history = [],
  onLoadSample,
}) {
  // Prevent the dashboard from crashing if the API returns missing data.
  const safeDocuments = Array.isArray(documents) ? documents : [];
  const safeHistory = Array.isArray(history) ? history : [];

  const recentDocs = [...safeDocuments]
    .sort((a, b) => {
      const dateA = a?.uploadedAt || '';
      const dateB = b?.uploadedAt || '';
      return dateB.localeCompare(dateA);
    })
    .slice(0, 3);

  const recentQuestions = safeHistory.slice(0, 3);

  const totalChunks = safeDocuments.reduce((sum, document) => {
    const chunks = Number(document?.chunks);
    return sum + (Number.isFinite(chunks) ? chunks : 0);
  }, 0);

  return (
    <>
      <section className="card intro">
        <h2>Ask questions about your own documents</h2>
        <p>
          Upload PDF or TXT files, ask a question, and see which passages
          the answer is based on. This is the frontend of a
          Retrieval-Augmented Generation (RAG) project.
        </p>

        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('documents')}
          >
            Upload documents
          </button>

          <button
            type="button"
            className="btn"
            onClick={() => navigate('ask')}
            disabled={safeDocuments.length === 0}
          >
            Ask a question
          </button>

          {onLoadSample && safeDocuments.length === 0 && (
            <button
              type="button"
              className="btn"
              onClick={onLoadSample}
            >
              Load sample session
            </button>
          )}
        </div>

        {safeDocuments.length === 0 && (
          <p className="hint">
            Upload a document first. Questions need at least one document.
          </p>
        )}
      </section>

      <section aria-label="Session summary" className="stats">
        <div className="stat">
          <span className="stat-num">{safeDocuments.length}</span>
          <span>Documents in this session</span>
        </div>

        <div className="stat">
          <span className="stat-num">{safeHistory.length}</span>
          <span>Questions asked in this session</span>
        </div>

        <div className="stat">
          <span className="stat-num">{totalChunks}</span>
          <span>Chunks</span>
        </div>
      </section>

      <div className="grid-2">
        <section className="card" aria-labelledby="recent-docs">
          <h2 id="recent-docs">Recent documents</h2>

          {recentDocs.length === 0 ? (
            <EmptyState
              title="No documents yet"
              actions={
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => navigate('documents')}
                >
                  Go to Documents
                </button>
              }
            >
              Start by uploading a PDF or TXT file.
            </EmptyState>
          ) : (
            <ul className="plain-list">
              {recentDocs.map((document, index) => {
                const extension =
                  typeof document?.ext === 'string' &&
                  document.ext.trim()
                    ? document.ext.trim().toUpperCase()
                    : typeof document?.name === 'string' &&
                        document.name.includes('.')
                      ? document.name.split('.').pop().toUpperCase()
                      : 'FILE';

                return (
                  <li
                    key={document?.id ?? `${document?.name ?? 'document'}-${index}`}
                  >
                    <strong>
                      {document?.name || 'Untitled document'}
                    </strong>

                    <span className="meta">
                      {extension} ·{' '}
                      {document?.uploadedAt
                        ? formatDateTime(document.uploadedAt)
                        : 'Date unavailable'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="recent-questions">
          <h2 id="recent-questions">Recent questions</h2>

          {recentQuestions.length === 0 ? (
            <EmptyState
              title="No questions yet"
              actions={
                safeDocuments.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => navigate('ask')}
                  >
                    Ask a question
                  </button>
                )
              }
            >
              {safeDocuments.length === 0
                ? 'Upload a document, then ask your first question.'
                : 'Ask your first question about the uploaded documents.'}
            </EmptyState>
          ) : (
            <ul className="plain-list">
              {recentQuestions.map((question, index) => (
                <li
                  key={
                    question?.id ??
                    `${question?.timestamp ?? 'question'}-${index}`
                  }
                >
                  <strong>
                    {question?.question || 'Question unavailable'}
                  </strong>

                  <span className="meta">
                    {question?.timestamp
                      ? formatDateTime(question.timestamp)
                      : 'Date unavailable'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card" aria-labelledby="how-rag">
        <h2 id="how-rag">How RAG works</h2>

        <ol className="steps">
          {RAG_STEPS.map(([name, text]) => (
            <li key={name}>
              <strong>{name}</strong>
              <span>{text}</span>
            </li>
          ))}
        </ol>

        <p className="hint">
          The Architecture page explains each part in more detail.
        </p>
      </section>
    </>
  );
}
