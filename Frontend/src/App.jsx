import { useCallback, useEffect, useRef, useState } from 'react';
import Header from './components/Header.jsx';
import Sidebar from './components/Sidebar.jsx';
import {
  fetchDocuments,
  fetchHistory,
  IS_MOCK,
  loadMockSample,
  resetMockDemo,
  setSimulatedFailures,
} from './services/api.js';
import Architecture from './pages/Architecture.jsx';
import AskQuestions from './pages/AskQuestions.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Documents from './pages/Documents.jsx';
import Experiments from './pages/Experiments.jsx';
import History from './pages/History.jsx';
import { PAGES, pageFromHash } from './utils/nav.js';

export default function App() {
  const [page, setPage] = useState(() => pageFromHash(window.location.hash));
  const [documents, setDocuments] = useState([]);
  const [history, setHistory] = useState([]);
  const [docsState, setDocsState] = useState({ loading: true, error: '' });
  const [historyState, setHistoryState] = useState({ loading: true, error: '' });
  const [simulateFailure, setSimulateFailure] = useState(false);
  const mainRef = useRef(null);
  const previousPage = useRef(page);

  // Follow the URL hash (#/documents) so the browser Back button works.
  useEffect(() => {
    const onHash = () => setPage(pageFromHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // After navigating to a different page, scroll to the top and move focus to the
  // main area (so keyboard and screen-reader users start at the new content).
  // Comparing with the previous page also avoids running on first load, even in
  // React StrictMode, which runs effects twice during development.
  useEffect(() => {
    if (previousPage.current === page) return;
    previousPage.current = page;
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [page]);

  const loadDocuments = useCallback(async () => {
    setDocsState({ loading: true, error: '' });
    try {
      setDocuments(await fetchDocuments());
      setDocsState({ loading: false, error: '' });
    } catch (err) {
      setDocsState({ loading: false, error: err.message });
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryState({ loading: true, error: '' });
    try {
      setHistory(await fetchHistory());
      setHistoryState({ loading: false, error: '' });
    } catch (err) {
      setHistoryState({ loading: false, error: err.message });
    }
  }, []);

  useEffect(() => {
    loadDocuments();
    loadHistory();
  }, [loadDocuments, loadHistory]);

  function handleToggleFailure(on) {
    setSimulateFailure(on);
    setSimulatedFailures(on);
  }

  async function handleResetDemo() {
    await resetMockDemo();
    await Promise.all([loadDocuments(), loadHistory()]);
  }

  async function handleLoadSample() {
    await loadMockSample();
    await Promise.all([loadDocuments(), loadHistory()]);
  }

  const title = PAGES.find((p) => p.id === page).label;

  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to main content</a>
      <Sidebar page={page} />
      <div className="content">
        <Header title={title} simulateFailure={simulateFailure} onToggleFailure={handleToggleFailure} />
        <main id="main" ref={mainRef} tabIndex={-1} className="main" aria-labelledby="page-title">
          {page === 'dashboard' && (
            <Dashboard documents={documents} history={history} onLoadSample={IS_MOCK ? handleLoadSample : undefined} />
          )}
          {page === 'documents' && (
            <Documents
              documents={documents}
              loading={docsState.loading}
              error={docsState.error}
              onUploaded={loadDocuments}
              onReload={loadDocuments}
              onResetDemo={handleResetDemo}
              onLoadSample={handleLoadSample}
            />
          )}
          {page === 'ask' && (
            <AskQuestions documents={documents} onAnswered={(record) => setHistory((current) => [record, ...current])} />
          )}
          {page === 'history' && (
            <History
              history={history}
              loading={historyState.loading}
              error={historyState.error}
              onReload={loadHistory}
              onCleared={loadHistory}
            />
          )}
          {page === 'experiments' && <Experiments />}
          {page === 'about' && <Architecture />}
        </main>
      </div>
    </div>
  );
}
