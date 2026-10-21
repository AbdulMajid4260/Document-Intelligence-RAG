import { useEffect, useRef, useState } from 'react';
import AnswerPanel from '../components/AnswerPanel.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Notice from '../components/Notice.jsx';
import QuestionForm from '../components/QuestionForm.jsx';
import { askQuestion, IS_MOCK } from '../services/api.js';
import { navigate } from '../utils/nav.js';

export default function AskQuestions({ documents, onAnswered }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [record, setRecord] = useState(null);
  const answerRef = useRef(null);

  // Move keyboard focus to the answer when it appears.
  useEffect(() => {
    if (record) answerRef.current?.focus();
  }, [record]);

  async function handleSubmit(question) {
    setBusy(true);
    setError('');
    try {
      const result = await askQuestion(question);
      setRecord(result);
      onAnswered(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (documents.length === 0) {
    return (
      <div className="card">
        <EmptyState title="Upload a document first" actions={<button type="button" className="btn btn-primary" onClick={() => navigate('documents')}>Go to Documents</button>}>
          Questions are answered from your uploaded documents, so add at least one PDF or TXT file.
        </EmptyState>
      </div>
    );
  }

  return (
    <>
      {IS_MOCK && (
        <Notice kind="warning" title="Answers are simulated">
          This page returns fixed sample answers. No search over your files and no language model is involved until the backend is connected.
        </Notice>
      )}

      {record ? (
        <div ref={answerRef} tabIndex={-1} className="focus-target">
          <AnswerPanel record={record}>
            <div className="btn-row">
              <button type="button" className="btn btn-primary" onClick={() => setRecord(null)}>Ask another question</button>
              <button type="button" className="btn" onClick={() => navigate('history')}>View history</button>
            </div>
          </AnswerPanel>
        </div>
      ) : (
        <>
          <QuestionForm busy={busy} onSubmit={handleSubmit} />
          {error && <Notice kind="error" title="The question could not be answered">{error}</Notice>}
          {!busy && !error && (
            <div className="card">
              <EmptyState title="No answer yet">Type a question or pick a sample question, then select Ask question. The answer and its sources appear here.</EmptyState>
            </div>
          )}
        </>
      )}
    </>
  );
}
