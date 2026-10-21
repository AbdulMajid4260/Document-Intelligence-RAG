import { IS_MOCK } from '../services/api.js';
import { formatDateTime } from '../utils/format.js';
import ExportControls from './ExportControls.jsx';
import Notice from './Notice.jsx';
import SourceCard from './SourceCard.jsx';

export default function AnswerPanel({ record, children }) {
  const extra = record.additionalChunks || [];
  return (
    <section className="card answer" aria-labelledby="answer-heading">
      <div className="answer-head">
        <h2 id="answer-heading">Answer</h2>
        {record.simulated && <span className="badge badge-mock">Simulated answer</span>}
      </div>

      <dl className="qa">
        <dt>Question</dt>
        <dd className="question-text">{record.question}</dd>
        <dt>Answer</dt>
        <dd className="answer-text">{record.answer}</dd>
        <dt>Timestamp</dt>
        <dd>{formatDateTime(record.timestamp)}</dd>
      </dl>

      <h3>Source references</h3>
      {record.simulated && (
        <Notice kind="warning">
          These sources and similarity scores are sample values. Real source references will come from the backend after integration.
        </Notice>
      )}
      <div className="source-list">
        {record.sources.map((s) => <SourceCard key={`${s.documentName}-${s.chunkId}`} source={s} />)}
      </div>

      {extra.length > 0 && (
        <details className="more">
          <summary>Additional retrieved chunks ({extra.length})</summary>
          <div className="source-list">
            {extra.map((s) => <SourceCard key={`${s.documentName}-${s.chunkId}`} source={s} />)}
          </div>
        </details>
      )}

      <ExportControls scope="answer" recordId={record.id} />
      {IS_MOCK && <p className="hint">Record {record.id} exists only in this browser session.</p>}
      {children}
    </section>
  );
}
