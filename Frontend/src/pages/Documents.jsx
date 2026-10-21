import { useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import DocumentList from '../components/DocumentList.jsx';
import DocumentUploader from '../components/DocumentUploader.jsx';
import EmptyState from '../components/EmptyState.jsx';
import LoadingState from '../components/LoadingState.jsx';
import Notice from '../components/Notice.jsx';
import { IS_MOCK } from '../services/api.js';

export default function Documents({ documents, loading, error, onUploaded, onReload, onResetDemo, onLoadSample }) {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <>
      <DocumentUploader onUploaded={onUploaded} />

      <section className="card" aria-labelledby="doc-list-heading">
        <div className="section-head">
          <h2 id="doc-list-heading">Uploaded documents</h2>
          {IS_MOCK && (
            <div className="btn-row">
              <button type="button" className="btn btn-small" onClick={onLoadSample}>Load sample session</button>
              <button type="button" className="btn btn-small btn-danger-outline" onClick={() => setConfirmReset(true)}>Reset mock demo</button>
            </div>
          )}
        </div>
        {IS_MOCK && <p className="hint">Ingestion is simulated. Files are not read, chunked, or embedded. Only their names and sizes are used.</p>}
        {loading && <LoadingState message="Loading documents…" />}
        {error && (
          <Notice kind="error" title="Could not load documents">
            {error} <button type="button" className="link-btn" onClick={onReload}>Try again</button>
          </Notice>
        )}
        {!loading && !error && documents.length === 0 && (
          <EmptyState title="No documents uploaded">Choose PDF or TXT files above and select Upload documents.</EmptyState>
        )}
        {documents.length > 0 && <DocumentList documents={documents} />}
      </section>

      <ConfirmDialog
        open={confirmReset}
        title="Reset the mock demo?"
        message="This removes all simulated documents and history from this session. It cannot be undone."
        confirmLabel="Reset demo"
        onCancel={() => setConfirmReset(false)}
        onConfirm={async () => { await onResetDemo(); setConfirmReset(false); }}
      />
    </>
  );
}
