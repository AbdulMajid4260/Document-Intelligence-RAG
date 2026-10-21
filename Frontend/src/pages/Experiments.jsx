
import { useEffect, useState } from 'react';
import LoadingState from '../components/LoadingState.jsx';
import Notice from '../components/Notice.jsx';
import {
  EXPERIMENT_CONFIG_OPTIONS as OPTIONS,
  EXPERIMENT_NOTICE,
  SAMPLE_QUESTIONS,
} from '../data/mockData.js';
import { fetchExperiments, IS_MOCK, runExperiment } from '../services/api.js';

const label = (r) =>
  `${r.chunkSize ?? 'N/A'}/${r.overlap ?? 'N/A'} · ${r.vectorStore ?? 'Unknown'}`;

const formatMetric = (value, digits = 2) => {
  if (
    value === null ||
    value === undefined ||
    value === '' ||
    !Number.isFinite(Number(value))
  ) {
    return 'N/A';
  }

  return Number(value).toFixed(digits);
};

const normalizeRun = (run = {}) => ({
  ...run,
  id: run.id ?? `experiment-${Math.random().toString(36).slice(2)}`,
  chunkSize: run.chunkSize ?? run.chunk_size ?? null,
  overlap: run.overlap ?? run.chunkOverlap ?? run.chunk_overlap ?? null,
  vectorStore: run.vectorStore ?? run.vector_store ?? 'Unknown',
  topK: run.topK ?? run.top_k ?? null,
  relevance:
    run.relevance ??
    run.retrievalRelevance ??
    run.retrieval_relevance ??
    null,
  latencyMs: run.latencyMs ?? run.latency_ms ?? null,
  notes: run.notes ?? '',
  retrievedChunks: Array.isArray(run.retrievedChunks)
    ? run.retrievedChunks
    : Array.isArray(run.retrieved_chunks)
      ? run.retrieved_chunks
      : [],
});

export default function Experiments() {
  const [runs, setRuns] = useState([]);
  const [simulated, setSimulated] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [config, setConfig] = useState({
    chunkSize: 512,
    overlap: 64,
    vectorStore: 'FAISS',
    topK: 4,
  });
  const [selectedId, setSelectedId] = useState(null);
  const [chartIds, setChartIds] = useState([]);
  const [runBusy, setRunBusy] = useState(false);
  const [runMessage, setRunMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetchExperiments()
      .then((data) => {
        if (cancelled) return;

        const fetchedRuns = Array.isArray(data?.runs)
          ? data.runs.map(normalizeRun)
          : [];

        setRuns(fetchedRuns);
        setSimulated(Boolean(data?.simulated));
        setChartIds(fetchedRuns.map((run) => run.id));
        setError('');
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err?.message ||
              'An error occurred while loading experiments.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const update = (key) => (event) => {
    const value = event.target.value;

    setConfig((current) => ({
      ...current,
      [key]: key === 'vectorStore' ? value : Number(value),
    }));
  };

  const toggleChart = (id) => {
    setChartIds((ids) =>
      ids.includes(id)
        ? ids.filter((item) => item !== id)
        : [...ids, id]
    );
  };

  async function handleRun(event) {
    event.preventDefault();
    setRunBusy(true);
    setRunMessage(null);

    try {
      const result = await runExperiment(config);

      if (result?.run) {
        const newRun = normalizeRun(result.run);

        setRuns((current) =>
          current.some((run) => run.id === newRun.id)
            ? current
            : [...current, newRun]
        );

        setChartIds((current) =>
          current.includes(newRun.id)
            ? current
            : [...current, newRun.id]
        );

        setSelectedId(newRun.id);

        setRunMessage({
          kind: result.executed === false ? 'warning' : 'success',
          text:
            result.executed === false
              ? 'Simulated lookup: a matching sample row was selected below. Nothing was executed.'
              : 'Experiment finished.',
        });
      } else {
        setRunMessage({
          kind: 'warning',
          text:
            'No sample result exists for this combination. Check the backend experiment implementation.',
        });
      }
    } catch (err) {
      setRunMessage({
        kind: 'error',
        text: err?.message || 'The experiment could not be run.',
      });
    } finally {
      setRunBusy(false);
    }
  }

  const selected = runs.find((run) => run.id === selectedId);
  const chartRuns = runs.filter((run) => chartIds.includes(run.id));

  const maxLatency = Math.max(
    1,
    ...chartRuns.map((run) => {
      const value = Number(run.latencyMs);
      return Number.isFinite(value) && value > 0 ? value : 0;
    })
  );

  return (
    <>
      {simulated && (
        <Notice
          kind="warning"
          title="Sample data, not measurements"
        >
          {EXPERIMENT_NOTICE}
        </Notice>
      )}

      <form
        className="card"
        onSubmit={handleRun}
        aria-labelledby="config-heading"
      >
        <h2 id="config-heading">Experiment configuration</h2>

        <div className="filters">
          <div>
            <label htmlFor="cfg-size">
              Chunk size (characters)
            </label>
            <select
              id="cfg-size"
              value={config.chunkSize}
              onChange={update('chunkSize')}
            >
              {OPTIONS.chunkSizes.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="cfg-overlap">
              Chunk overlap (characters)
            </label>
            <select
              id="cfg-overlap"
              value={config.overlap}
              onChange={update('overlap')}
            >
              {OPTIONS.overlaps.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="cfg-store">Vector store</label>
            <select
              id="cfg-store"
              value={config.vectorStore}
              onChange={update('vectorStore')}
            >
              {OPTIONS.vectorStores.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="cfg-topk">
              Top-k (chunks retrieved)
            </label>
            <select
              id="cfg-topk"
              value={config.topK}
              onChange={update('topK')}
            >
              {OPTIONS.topK.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="btn-row">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={runBusy || loading}
          >
            {runBusy
              ? 'Looking up…'
              : IS_MOCK
                ? 'Show sample result'
                : 'Run experiment'}
          </button>
        </div>

        {runMessage && (
          <Notice kind={runMessage.kind}>
            {runMessage.text}
          </Notice>
        )}
      </form>

      <section className="card" aria-labelledby="runs-heading">
        <h2 id="runs-heading">Compare configurations</h2>

        {loading && (
          <LoadingState message="Loading experiments…" />
        )}

        {error && (
          <Notice
            kind="error"
            title="Could not load experiments"
          >
            {error}
          </Notice>
        )}

        {!loading && !error && runs.length === 0 && (
          <p>No experiment runs available yet.</p>
        )}

        {runs.length > 0 && (
          <div className="table-wrap">
            <table>
              <caption className="visually-hidden">
                Experiment runs
              </caption>

              <thead>
                <tr>
                  <th scope="col">Chart</th>
                  <th scope="col">Chunk size</th>
                  <th scope="col">Overlap</th>
                  <th scope="col">Vector store</th>
                  <th scope="col">Top-k</th>
                  <th scope="col">
                    Retrieval relevance{simulated && ' (sample)'}
                  </th>
                  <th scope="col">
                    Latency{simulated && ' (sample)'}
                  </th>
                  <th scope="col">Notes</th>
                  <th scope="col">Chunks</th>
                </tr>
              </thead>

              <tbody>
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    className={
                      run.id === selectedId
                        ? 'row-selected'
                        : undefined
                    }
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={chartIds.includes(run.id)}
                        onChange={() => toggleChart(run.id)}
                        aria-label={`Include ${label(run)} in chart`}
                      />
                    </td>

                    <td>{run.chunkSize ?? 'N/A'}</td>
                    <td>{run.overlap ?? 'N/A'}</td>
                    <td>{run.vectorStore}</td>
                    <td>{run.topK ?? 'N/A'}</td>
                    <td>{formatMetric(run.relevance)}</td>

                    <td>
                      {run.latencyMs !== null &&
                      run.latencyMs !== undefined &&
                      Number.isFinite(Number(run.latencyMs))
                        ? `${run.latencyMs} ms`
                        : 'N/A'}
                    </td>

                    <td className="notes">
                      {run.notes || '—'}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="link-btn"
                        aria-pressed={run.id === selectedId}
                        onClick={() =>
                          setSelectedId(
                            run.id === selectedId ? null : run.id
                          )
                        }
                      >
                        {run.id === selectedId ? 'Hide' : 'View'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {chartRuns.length > 0 && (
        <section className="card" aria-labelledby="chart-heading">
          <h2 id="chart-heading">
            Relevance and latency
            {simulated && ' (sample values)'}
          </h2>

          <p className="hint">
            The table above holds the exact numbers. Use the Chart
            checkboxes to choose which runs appear here.
          </p>

          <div
            className="chart"
            role="img"
            aria-label={`Bar chart comparing relevance and latency for ${chartRuns.length} configurations.`}
          >
            {chartRuns.map((run) => {
              const relevance = Number(run.relevance);
              const hasRelevance =
                run.relevance !== null &&
                run.relevance !== undefined &&
                run.relevance !== '' &&
                Number.isFinite(relevance);

              const latency = Number(run.latencyMs);
              const hasLatency =
                run.latencyMs !== null &&
                run.latencyMs !== undefined &&
                run.latencyMs !== '' &&
                Number.isFinite(latency);

              return (
                <div key={run.id} className="chart-row">
                  <span className="chart-label">
                    {label(run)}
                  </span>

                  <span className="bar-pair">
                    <span
                      className="bar bar-relevance"
                      style={{
                        width: `${
                          hasRelevance
                            ? Math.min(
                                100,
                                Math.max(0, relevance * 100)
                              )
                            : 0
                        }%`,
                      }}
                    >
                      <span>{formatMetric(run.relevance)}</span>
                    </span>

                    <span
                      className="bar bar-latency"
                      style={{
                        width: `${
                          hasLatency
                            ? Math.min(
                                100,
                                Math.max(
                                  0,
                                  (latency / maxLatency) * 100
                                )
                              )
                            : 0
                        }%`,
                      }}
                    >
                      <span>
                        {hasLatency
                          ? `${run.latencyMs} ms`
                          : 'N/A'}
                      </span>
                    </span>
                  </span>
                </div>
              );
            })}
          </div>

          <p className="legend">
            <span className="swatch swatch-relevance" />
            {' '}Relevance (0 to 1, higher is better)
            {' '}
            <span className="swatch swatch-latency" />
            {' '}Latency (shorter is faster)
          </p>
        </section>
      )}

      {selected && (
        <section className="card" aria-labelledby="chunks-heading">
          <h2 id="chunks-heading">
            Retrieved chunks for {label(selected)}
            {simulated && ' (sample)'}
          </h2>

          {selected.retrievedChunks.length === 0 ? (
            <p>
              No retrieved chunk details are available for this run.
            </p>
          ) : (
            <div className="source-list">
              {selected.retrievedChunks.map((chunk, index) => (
                <article
                  key={
                    chunk.chunkId ??
                    chunk.chunk_id ??
                    index
                  }
                  className="source"
                >
                  <div className="source-head">
                    <strong>
                      <code>
                        {chunk.chunkId ??
                          chunk.chunk_id ??
                          `Chunk ${index + 1}`}
                      </code>
                    </strong>

                    <span>
                      {formatMetric(chunk.score)}
                      {' '}
                      <span className="hint">
                        (illustrative)
                      </span>
                    </span>
                  </div>

                  <blockquote className="passage">
                    {chunk.text ??
                      chunk.content ??
                      'No chunk text available.'}
                  </blockquote>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="card" aria-labelledby="fair-heading">
        <h2 id="fair-heading">
          How to run a fair comparison
        </h2>

        <ol className="plain-ol">
          <li>
            Change one setting at a time (chunk size, overlap, or
            vector store) and keep everything else the same.
          </li>
          <li>
            Use the same embedding model for every run. Scores
            from different models cannot be compared.
          </li>
          <li>
            Use the same fixed set of questions for every run,
            such as the sample questions below.
          </li>
          <li>Use the same documents and the same top-k.</li>
          <li>
            Judge relevance consistently, for example by checking
            whether the expected passage is in the top-k.
          </li>
          <li>
            Repeat latency measurements several times and report
            the average, because a single run is noisy.
          </li>
        </ol>

        <h3>Fixed query set (sample)</h3>

        <ul className="plain-ol">
          {SAMPLE_QUESTIONS.map((question) => (
            <li key={question.id}>
              {question.text}
            </li>
          ))}
        </ul>

        <p className="hint">
          Embedding model: to be chosen when the backend is built,
          then kept constant across all runs.
        </p>
      </section>
    </>
  );
}
