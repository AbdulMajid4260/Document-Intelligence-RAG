import { useEffect, useState } from 'react';
import LoadingState from '../components/LoadingState.jsx';
import Notice from '../components/Notice.jsx';
import { fetchExperiments, IS_MOCK, runExperiment } from '../services/api.js';

// Options differ slightly: mock mode only has sample rows for these combinations,
// the real backend can run any combination.
const OPTIONS = IS_MOCK
  ? { chunkSizes: [256, 512, 1024], overlaps: [0, 32, 64, 128], vectorStores: ['FAISS', 'Chroma'], topK: [3, 4, 5] }
  : { chunkSizes: [256, 512, 1000, 1500], overlaps: [0, 32, 64, 200, 300], vectorStores: ['NumPy', 'FAISS', 'Chroma'], topK: [3, 4, 5] };

const DEFAULT_CONFIG = IS_MOCK
  ? { chunkSize: 512, overlap: 64, vectorStore: 'FAISS', topK: 4 }
  : { chunkSize: 1000, overlap: 200, vectorStore: 'NumPy', topK: 4 };

const EXAMPLE_QUESTIONS = [
  'Who is the operations manager?',
  'Why was Project Cedar paused?',
  'How long are platform error logs retained?',
  'What is the fee for Cloud Basics?',
  'What is the minimum attendance needed for a certificate?',
].join('\n');

const fmt = (v, digits = 2) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(digits));
const label = (r) => `${r.chunkSize}/${r.overlap} · ${r.vectorStore}`;

// The backend returns { id, name, config, summary, results, latency_ms }.
// The UI works with a flat shape, so convert once here. Mock rows are already flat.
function normalize(e) {
  if (e && (e.config || e.summary)) {
    const c = e.config || {};
    const s = e.summary || {};
    return {
      id: e.id,
      name: e.name,
      chunkSize: c.chunk_size,
      overlap: c.chunk_overlap,
      vectorStore: s.effective_vector_store || c.vector_store,
      requestedStore: c.vector_store,
      topK: c.top_k,
      totalChunks: s.total_chunks,
      embedding: s.semantic ? 'semantic' : 'lexical',
      embeddingModel: s.embedding_model,
      relevance: s.avg_top1_score ?? null,
      queryMs: s.avg_query_latency_ms ?? null,
      totalMs: e.latency_ms,
      queryCount: s.query_count ?? 0,
      warnings: s.warnings || [],
      results: e.results || [],
      notes: e.notes,
    };
  }
  return {
    ...e,
    requestedStore: e.vectorStore,
    totalChunks: null,
    embedding: 'sample',
    relevance: e.relevance ?? null,
    queryMs: e.latencyMs ?? null,
    totalMs: null,
    queryCount: 0,
    warnings: [],
    results: [],
  };
}

export default function Experiments() {
  const [runs, setRuns] = useState([]);
  const [simulated, setSimulated] = useState(IS_MOCK);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [questions, setQuestions] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [chartIds, setChartIds] = useState([]);
  const [runBusy, setRunBusy] = useState(false);
  const [runMessage, setRunMessage] = useState(null);

  useEffect(() => {
    fetchExperiments()
      .then((data) => {
        const list = (data.runs || []).map(normalize);
        setRuns(list);
        setSimulated(Boolean(data.simulated));
        setChartIds(list.filter((r) => r.relevance != null).map((r) => r.id));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const update = (key) => (e) => setConfig({ ...config, [key]: key === 'vectorStore' ? e.target.value : Number(e.target.value) });
  const toggleChart = (id) => setChartIds((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));

  async function handleRun(e) {
    e.preventDefault();
    setRunMessage(null);
    if (config.overlap >= config.chunkSize) {
      setRunMessage({ kind: 'error', text: 'Chunk overlap must be smaller than the chunk size.' });
      return;
    }
    const queries = questions.split('\n').map((q) => q.trim()).filter(Boolean);
    setRunBusy(true);
    try {
      const result = await runExperiment(IS_MOCK ? config : { ...config, queries });
      const raw = result.run ?? (result.id != null ? result : null);
      if (!raw) {
        setRunMessage({ kind: 'warning', text: 'The backend did not return an experiment result.' });
        return;
      }
      const run = normalize(raw);
      setRuns((current) => (current.some((r) => r.id === run.id) ? current : [run, ...current]));
      if (run.relevance != null) setChartIds((ids) => (ids.includes(run.id) ? ids : [...ids, run.id]));
      setSelectedId(run.id);
      if (IS_MOCK) {
        setRunMessage({ kind: 'warning', text: 'Simulated lookup: a matching sample row was selected below. Nothing was executed.' });
      } else if (queries.length === 0) {
        setRunMessage({ kind: 'warning', text: 'Finished, but no questions were entered, so only indexing statistics were recorded. Add questions to get scores and query times.' });
      } else {
        setRunMessage({ kind: 'success', text: 'Experiment finished.' });
      }
    } catch (err) {
      setRunMessage({ kind: 'error', text: err.message });
    } finally {
      setRunBusy(false);
    }
  }

  const selected = runs.find((r) => r.id === selectedId);
  const chartRuns = runs.filter((r) => chartIds.includes(r.id) && r.relevance != null);
  const maxQueryMs = Math.max(0.001, ...chartRuns.map((r) => r.queryMs || 0));

  return (
    <>
      {simulated && (
        <Notice kind="warning" title="Sample data, not measurements">
          These rows are simulated sample data. Connect the backend (VITE_API_MODE=real) to run real experiments.
        </Notice>
      )}

      <form className="card" onSubmit={handleRun} aria-labelledby="config-heading">
        <h2 id="config-heading">Experiment configuration</h2>
        <div className="filters">
          <div><label htmlFor="cfg-size">Chunk size (characters)</label>
            <select id="cfg-size" value={config.chunkSize} onChange={update('chunkSize')}>{OPTIONS.chunkSizes.map((v) => <option key={v}>{v}</option>)}</select></div>
          <div><label htmlFor="cfg-overlap">Chunk overlap (characters)</label>
            <select id="cfg-overlap" value={config.overlap} onChange={update('overlap')}>{OPTIONS.overlaps.map((v) => <option key={v}>{v}</option>)}</select></div>
          <div><label htmlFor="cfg-store">Vector store</label>
            <select id="cfg-store" value={config.vectorStore} onChange={update('vectorStore')}>{OPTIONS.vectorStores.map((v) => <option key={v}>{v}</option>)}</select></div>
          <div><label htmlFor="cfg-topk">Top-k (chunks retrieved)</label>
            <select id="cfg-topk" value={config.topK} onChange={update('topK')}>{OPTIONS.topK.map((v) => <option key={v}>{v}</option>)}</select></div>
        </div>

        {!IS_MOCK && (
          <div style={{ marginTop: 14 }}>
            <label htmlFor="cfg-questions">Test questions (one per line, up to 25)</label>
            <textarea
              id="cfg-questions"
              rows={5}
              style={{ width: '100%', boxSizing: 'border-box', font: 'inherit', padding: 8 }}
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
              placeholder="Type questions about your uploaded documents, one per line"
            />
            <p className="hint">
              Without questions, only indexing statistics are recorded (no scores, no query time).{' '}
              <button type="button" className="link-btn" onClick={() => setQuestions(EXAMPLE_QUESTIONS)}>Fill sample-document questions</button>
            </p>
          </div>
        )}

        <div className="btn-row">
          <button type="submit" className="btn btn-primary" disabled={runBusy || loading}>
            {runBusy ? (IS_MOCK ? 'Looking up…' : 'Running…') : IS_MOCK ? 'Show sample result' : 'Run experiment'}
          </button>
        </div>
        {runMessage && <Notice kind={runMessage.kind}>{runMessage.text}</Notice>}
      </form>

      <section className="card" aria-labelledby="runs-heading">
        <h2 id="runs-heading">Compare configurations</h2>
        {loading && <LoadingState message="Loading experiments…" />}
        {error && <Notice kind="error" title="Could not load experiments">{error}</Notice>}
        {!loading && !error && runs.length === 0 && <p>No experiment runs yet. Upload a document, then run an experiment.</p>}
        {runs.length > 0 && (
          <div className="table-wrap">
            <table>
              <caption className="visually-hidden">Experiment runs</caption>
              <thead>
                <tr>
                  <th scope="col">Chart</th><th scope="col">Chunk size</th><th scope="col">Overlap</th><th scope="col">Vector store</th>
                  <th scope="col">Top-k</th><th scope="col">Chunks</th><th scope="col">Embeddings</th>
                  <th scope="col">Avg top-1 score</th><th scope="col">Avg query time</th><th scope="col">Total run time</th><th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className={r.id === selectedId ? 'row-selected' : undefined}>
                    <td>
                      <input type="checkbox" checked={chartIds.includes(r.id)} disabled={r.relevance == null} onChange={() => toggleChart(r.id)} aria-label={`Include ${label(r)} in chart`} />
                    </td>
                    <td>{r.chunkSize ?? '—'}</td>
                    <td>{r.overlap ?? '—'}</td>
                    <td>
                      {r.vectorStore ?? '—'}
                      {r.requestedStore && r.vectorStore && r.requestedStore !== r.vectorStore && <div className="hint">requested {r.requestedStore}</div>}
                    </td>
                    <td>{r.topK ?? '—'}</td>
                    <td>{r.totalChunks ?? '—'}</td>
                    <td>{r.embedding}</td>
                    <td>{fmt(r.relevance, 3)}</td>
                    <td>{r.queryMs == null ? '—' : `${fmt(r.queryMs, 3)} ms`}</td>
                    <td>{r.totalMs == null ? '—' : `${fmt(r.totalMs, 1)} ms`}</td>
                    <td><button type="button" className="link-btn" aria-pressed={r.id === selectedId} onClick={() => setSelectedId(r.id === selectedId ? null : r.id)}>{r.id === selectedId ? 'Hide' : 'View'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!IS_MOCK && runs.length > 0 && (
          <p className="hint">
            Scores are raw cosine similarities, not accuracy. Total run time includes loading the embedding model, so the first run after a restart can be much slower than later ones.
          </p>
        )}
      </section>

      {chartRuns.length > 0 && (
        <section className="card" aria-labelledby="chart-heading">
          <h2 id="chart-heading">Score and query time{simulated && ' (sample values)'}</h2>
          <p className="hint">Only runs that had test questions can be charted. The table above holds the exact numbers.</p>
          <div className="chart" role="img" aria-label={`Bar chart comparing score and query time for ${chartRuns.length} configurations. The table above lists the same values.`}>
            {chartRuns.map((r) => (
              <div key={r.id} className="chart-row">
                <span className="chart-label">{label(r)}</span>
                <span className="bar-pair">
                  <span className="bar bar-relevance" style={{ width: `${Math.min(1, r.relevance) * 100}%` }}><span>{fmt(r.relevance, 3)}</span></span>
                  <span className="bar bar-latency" style={{ width: `${((r.queryMs || 0) / maxQueryMs) * 100}%` }}><span>{fmt(r.queryMs, 3)} ms</span></span>
                </span>
              </div>
            ))}
          </div>
          <p className="legend"><span className="swatch swatch-relevance" /> Avg top-1 cosine score <span className="swatch swatch-latency" /> Avg query time (shorter is faster)</p>
        </section>
      )}

      {selected && (
        <section className="card" aria-labelledby="chunks-heading">
          <h2 id="chunks-heading">Details for {label(selected)}{simulated && ' (sample)'}</h2>
          {selected.embeddingModel && <p className="hint">Embedding model: {selected.embeddingModel}</p>}
          {selected.warnings.map((w) => <Notice key={w} kind="warning">{w}</Notice>)}

          {selected.results.length > 0 &&
            selected.results.map((res) => (
              <div key={res.query} style={{ marginBottom: 16 }}>
                <h3>{res.query} <span className="hint">({fmt(res.latency_ms, 3)} ms)</span></h3>
                <div className="source-list">
                  {res.hits.map((h) => (
                    <article key={`${res.query}-${h.rank}`} className="source">
                      <div className="source-head">
                        <strong>#{h.rank} · {h.document_name}, page {h.page}</strong>
                        <span>{fmt(h.score, 3)}</span>
                      </div>
                      <blockquote className="passage">{h.passage}</blockquote>
                    </article>
                  ))}
                </div>
              </div>
            ))}

          {selected.results.length === 0 && selected.retrievedChunks && (
            <div className="source-list">
              {selected.retrievedChunks.map((c) => (
                <article key={c.chunkId} className="source">
                  <div className="source-head"><strong><code>{c.chunkId}</code></strong><span>{fmt(c.score)} <span className="hint">(illustrative)</span></span></div>
                  <blockquote className="passage">{c.text}</blockquote>
                </article>
              ))}
            </div>
          )}

          {selected.results.length === 0 && !selected.retrievedChunks && (
            <p>No questions were run for this experiment, so there are no retrieved passages. Only indexing statistics were recorded.</p>
          )}
        </section>
      )}

      <section className="card" aria-labelledby="fair-heading">
        <h2 id="fair-heading">How to run a fair comparison</h2>
        <ol className="plain-ol">
          <li>Change one setting at a time (chunk size, overlap, or vector store) and keep everything else the same.</li>
          <li>Use the same embedding backend for every run (check the Embeddings column). Scores from different models cannot be compared.</li>
          <li>Use the same fixed set of questions for every run.</li>
          <li>Use the same documents and the same top-k.</li>
          <li>Compare the passages in the details view to judge whether the expected passage is in the top-k.</li>
          <li>Repeat runs and ignore the first one after a restart, because it includes model loading time.</li>
        </ol>
      </section>
    </>
  );
}