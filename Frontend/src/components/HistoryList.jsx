import { formatDateTime, formatPage } from '../utils/format.js';

export default function HistoryList({ records, onSelect }) {
  return (
    <ul className="history-list">
      {records.map((r) => {
        const files = [...new Set(r.sources.map((s) => s.documentName))];
        const pages = r.sources.filter((s) => s.page !== null && s.page !== undefined).map((s) => formatPage(s.page));
        return (
          <li key={r.id} className="history-item">
            <button type="button" className="history-title" onClick={() => onSelect(r.id)}>{r.question}</button>
            <p className="snippet">{r.answer}</p>
            <div className="meta-row">
              <span className="meta">{formatDateTime(r.timestamp)}</span>
              {files.map((f) => <span key={f} className="chip chip-static">{f}</span>)}
              {pages.length > 0 && <span className="meta">{pages.join(', ')}</span>}
              {r.simulated && <span className="badge badge-mock">Simulated</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
