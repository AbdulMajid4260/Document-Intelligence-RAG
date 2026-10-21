import { useId, useState } from 'react';
import { formatPage } from '../utils/format.js';

// One retrieved chunk. The passage is hidden until the reader expands the card.
export default function SourceCard({ source, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const percent = Math.round(Math.max(0, Math.min(1, source.score)) * 100);

  return (
    <article className="source">
      <div className="source-head">
        <div>
          <strong>{source.documentName}</strong>
          <span className="meta">{formatPage(source.page)} · <code>{source.chunkId}</code></span>
        </div>
        <div className="score" title="Illustrative similarity score">
          <span className="score-bar" aria-hidden="true"><span style={{ width: `${percent}%` }} /></span>
          <span>{source.score.toFixed(2)} <span className="hint">(illustrative)</span></span>
        </div>
      </div>
      <button type="button" className="link-btn" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
        {open ? 'Hide retrieved passage' : 'Show retrieved passage'}
      </button>
      {open && (
        <blockquote id={panelId} className="passage">{source.passage}</blockquote>
      )}
    </article>
  );
}
