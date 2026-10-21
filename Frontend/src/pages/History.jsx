
import { useEffect, useMemo, useState } from 'react';
import AnswerPanel from '../components/AnswerPanel.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ExportControls from '../components/ExportControls.jsx';
import HistoryList from '../components/HistoryList.jsx';
import LoadingState from '../components/LoadingState.jsx';
import Notice from '../components/Notice.jsx';
import {
  clearHistory,
  fetchHistoryRecord,
  IS_MOCK,
} from '../services/api.js';
import { navigate } from '../utils/nav.js';

// Safely normalize history records received from the API.
const normalizeRecord = (record = {}) => ({
  ...record,
  id: record.id ?? record.historyId ?? record.history_id ?? null,
  timestamp:
    record.timestamp ??
    record.createdAt ??
    record.created_at ??
    '',
  question: record.question ?? '',
  answer: record.answer ?? '',
  sources: Array.isArray(record.sources) ? record.sources : [],
});

const getTimestamp = (record) => {
  const value = record.timestamp;

  if (!value) return 0;

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function History({
  history = [],
  loading,
  error,
  onReload,
  onCleared,
}) {
  const [query, setQuery] = useState('');
  const [fileFilter, setFileFilter] = useState('all');
  const [order, setOrder] = useState('newest');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState({
    loading: false,
    error: '',
    record: null,
  });
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState('');

  // Normalize records before using their fields.
  const safeHistory = useMemo(
    () =>
      Array.isArray(history)
        ? history.map(normalizeRecord)
        : [],
    [history]
  );

  const files = useMemo(() => {
    const names = safeHistory.flatMap((record) =>
      record.sources
        .map((source) => source.documentName ?? source.document_name)
        .filter(
          (name) =>
            typeof name === 'string' && name.trim().length > 0
        )
    );

    return [...new Set(names)].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [safeHistory]);

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();

    const filtered = safeHistory.filter((record) => {
      const question = String(record.question ?? '');
      const answer = String(record.answer ?? '');

      const textMatch =
        !search ||
        question.toLowerCase().includes(search) ||
        answer.toLowerCase().includes(search);

      const fileMatch =
        fileFilter === 'all' ||
        record.sources.some(
          (source) =>
            (source.documentName ?? source.document_name) ===
            fileFilter
        );

      return textMatch && fileMatch;
    });

    // Sort using parsed timestamps instead of localeCompare.
    // Missing or invalid timestamps are treated as zero.
    return [...filtered].sort((a, b) => {
      const timeA = getTimestamp(a);
      const timeB = getTimestamp(b);

      return order === 'newest'
        ? timeB - timeA
        : timeA - timeB;
    });
  }, [safeHistory, query, fileFilter, order]);

  // Load the full record when a history entry is selected.
  useEffect(() => {
    if (!selectedId) return undefined;

    let cancelled = false;

    setDetail({
      loading: true,
      error: '',
      record: null,
    });

    fetchHistoryRecord(selectedId)
      .then((record) => {
        if (cancelled) return;

        setDetail({
          loading: false,
          error: '',
          record: record ? normalizeRecord(record) : null,
        });
      })
      .catch((err) => {
        if (cancelled) return;

        setDetail({
          loading: false,
          error: err?.message || 'Could not load this history record.',
          record: null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  async function handleClear() {
    setClearing(true);
    setClearError('');

    try {
      await clearHistory();
      await onCleared();
      setConfirmClear(false);
      setSelectedId(null);
    } catch (err) {
      setClearError(
        err?.message || 'History could not be cleared.'
      );
      setConfirmClear(false);
    } finally {
      setClearing(false);
    }
  }

  if (selectedId) {
    return (
      <>
        <button
          type="button"
          className="btn"
          onClick={() => setSelectedId(null)}
        >
          ← Back to history list
        </button>

        {detail.loading && (
          <LoadingState message="Loading answer…" />
        )}

        {detail.error && (
          <Notice
            kind="error"
            title="Could not load this record"
          >
            {detail.error}
          </Notice>
        )}

        {detail.record && (
          <AnswerPanel record={detail.record} />
        )}

        {!detail.loading &&
          !detail.error &&
          !detail.record && (
            <Notice
              kind="warning"
              title="Record unavailable"
            >
              The selected history record could not be found.
            </Notice>
          )}
      </>
    );
  }

  return (
    <>
      {IS_MOCK && (
        <Notice
          kind="info"
          title="History is not saved"
        >
          In mock mode, history lives in memory and disappears
          when you reload the page. The backend will save real
          history in SQLite.
        </Notice>
      )}

      {clearError && (
        <Notice
          kind="error"
          title="History was not cleared"
        >
          {clearError}
        </Notice>
      )}

      <section
        className="card"
        aria-labelledby="history-heading"
      >
        <div className="section-head">
          <h2 id="history-heading">Question history</h2>

          <button
            type="button"
            className="btn btn-small btn-danger-outline"
            onClick={() => setConfirmClear(true)}
            disabled={safeHistory.length === 0 || clearing}
          >
            Clear history
          </button>
        </div>

        {loading && (
          <LoadingState message="Loading history…" />
        )}

        {error && (
          <Notice
            kind="error"
            title="Could not load history"
          >
            {error}{' '}
            <button
              type="button"
              className="link-btn"
              onClick={onReload}
            >
              Try again
            </button>
          </Notice>
        )}

        {!loading &&
          !error &&
          safeHistory.length === 0 && (
            <EmptyState
              title="No history yet"
              actions={
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => navigate('ask')}
                >
                  Ask a question
                </button>
              }
            >
              Questions you ask appear here with their answers
              and sources.
            </EmptyState>
          )}

        {safeHistory.length > 0 && (
          <>
            <div className="filters">
              <div>
                <label htmlFor="history-search">
                  Search questions and answers
                </label>

                <input
                  id="history-search"
                  type="search"
                  value={query}
                  onChange={(event) =>
                    setQuery(event.target.value)
                  }
                />
              </div>

              <div>
                <label htmlFor="history-file">
                  Source document
                </label>

                <select
                  id="history-file"
                  value={fileFilter}
                  onChange={(event) =>
                    setFileFilter(event.target.value)
                  }
                >
                  <option value="all">All documents</option>

                  {files.map((file) => (
                    <option key={file} value={file}>
                      {file}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="history-order">Sort</label>

                <select
                  id="history-order"
                  value={order}
                  onChange={(event) =>
                    setOrder(event.target.value)
                  }
                >
                  <option value="newest">
                    Most recent first
                  </option>
                  <option value="oldest">
                    Oldest first
                  </option>
                </select>
              </div>
            </div>

            <p className="hint" role="status">
              Showing {visible.length} of {safeHistory.length}{' '}
              record(s).
            </p>

            {visible.length === 0 ? (
              <EmptyState title="No matching records">
                Try a different search or choose All documents.
              </EmptyState>
            ) : (
              <HistoryList
                records={visible}
                onSelect={setSelectedId}
              />
            )}

            <ExportControls scope="history" />
          </>
        )}
      </section>

      <ConfirmDialog
        open={confirmClear}
        title="Clear all history?"
        message={`This deletes all ${safeHistory.length} question and answer record(s). It cannot be undone.`}
        confirmLabel="Clear history"
        busy={clearing}
        onCancel={() => setConfirmClear(false)}
        onConfirm={handleClear}
      />
    </>
  );
}
