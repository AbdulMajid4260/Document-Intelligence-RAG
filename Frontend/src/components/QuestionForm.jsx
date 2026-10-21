import { useRef, useState } from 'react';
import { SAMPLE_QUESTIONS } from '../data/mockData.js';

const MAX_LENGTH = 1000;

export default function QuestionForm({ busy, onSubmit }) {
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);
  const areaRef = useRef(null);

  const trimmed = text.trim();
  let error = '';
  if (touched && trimmed.length === 0) error = 'Enter a question before asking.';
  if (text.length > MAX_LENGTH) error = `Keep the question under ${MAX_LENGTH} characters.`;

  function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);
    if (trimmed.length === 0 || text.length > MAX_LENGTH) return;
    onSubmit(trimmed);
  }

  function useSample(sample) {
    setText(sample);
    setTouched(true);
    areaRef.current?.focus();
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <h2>Your question</h2>
      <label htmlFor="question">Question about your documents</label>
      <textarea
        id="question"
        ref={areaRef}
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => setTouched(true)}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby="question-help question-error"
        disabled={busy}
      />
      <div className="field-row">
        <span id="question-error" className="field-error" role={error ? 'alert' : undefined}>{error}</span>
        <span id="question-help" className="hint">{text.length}/{MAX_LENGTH}</span>
      </div>

      <div className="samples">
        <span className="hint">Sample questions:</span>
        {SAMPLE_QUESTIONS.map((q) => (
          <button key={q.id} type="button" className="chip" onClick={() => useSample(q.text)} disabled={busy}>
            {q.text}
          </button>
        ))}
      </div>

      <div className="btn-row">
        <button type="submit" className="btn btn-primary" disabled={busy || trimmed.length === 0}>
          {busy ? 'Asking…' : 'Ask question'}
        </button>
        {busy && <span className="inline-loading" role="status"><span className="spinner" aria-hidden="true" /> Simulating retrieval and generation…</span>}
      </div>
    </form>
  );
}
