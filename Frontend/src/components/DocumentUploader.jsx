import { useRef, useState } from 'react';
import { uploadDocuments } from '../services/api.js';
import { fileExtension, formatBytes } from '../utils/format.js';
import Notice from './Notice.jsx';

const ALLOWED = ['pdf', 'txt'];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB limit for this demo

function checkFile(file) {
  const ext = fileExtension(file.name);
  if (!ALLOWED.includes(ext)) return `"${file.name}" is not supported. Choose a PDF or TXT file.`;
  if (file.size === 0) return `"${file.name}" is empty.`;
  if (file.size > MAX_BYTES) return `"${file.name}" is larger than 10 MB.`;
  return '';
}

export default function DocumentUploader({ onUploaded }) {
  const inputRef = useRef(null);
  const [items, setItems] = useState([]); // { key, file, error }
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { kind, text }

  function addFiles(fileList) {
    const incoming = Array.from(fileList);
    setMessage(null);
    setItems((current) => {
      const next = [...current];
      incoming.forEach((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (!next.some((i) => i.key === key)) next.push({ key, file, error: checkFile(file) });
      });
      return next;
    });
  }

  function removeItem(key) {
    setItems((current) => current.filter((i) => i.key !== key));
  }

  async function handleUpload() {
    const valid = items.filter((i) => !i.error);
    if (valid.length === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await uploadDocuments(valid.map((i) => i.file));
      const results = response.results || [];
      const okNames = results.filter((r) => r.ok).map((r) => r.fileName);
      const failed = results.filter((r) => !r.ok);
      setItems((current) => current.filter((i) => !okNames.includes(i.file.name)));
      if (failed.length === 0) {
        setMessage({ kind: 'success', text: `${okNames.length} file(s) uploaded${response.simulated ? ' (simulated - nothing was sent anywhere)' : ''}.` });
      } else {
        setMessage({ kind: 'error', text: `${okNames.length} uploaded, ${failed.length} failed: ${failed.map((f) => `${f.fileName} (${f.message})`).join('; ')}` });
      }
      await onUploaded();
    } catch (err) {
      setMessage({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  const validCount = items.filter((i) => !i.error).length;

  return (
    <section className="card" aria-labelledby="upload-heading">
      <h2 id="upload-heading">Upload documents</h2>
      <div
        className={`dropzone${dragging ? ' dropzone-active' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
      >
        <p>Drag PDF or TXT files here, or</p>
        <input ref={inputRef} id="file-input" type="file" accept=".pdf,.txt" multiple className="visually-hidden" tabIndex={-1} aria-label="Choose PDF or TXT files" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        <button type="button" className="btn" onClick={() => inputRef.current.click()} disabled={busy}>Choose files</button>
        <p className="hint">PDF or TXT, up to 10 MB each. Multiple files allowed.</p>
      </div>

      {items.length > 0 && (
        <ul className="file-list" aria-label="Selected files">
          {items.map((item) => (
            <li key={item.key} className={item.error ? 'file-item file-invalid' : 'file-item'}>
              <div>
                <strong>{item.file.name}</strong>
                <span className="meta">
                  {fileExtension(item.file.name).toUpperCase() || 'no extension'} · {formatBytes(item.file.size)}
                </span>
                {item.error && <span className="field-error">{item.error}</span>}
              </div>
              <button type="button" className="btn btn-small" onClick={() => removeItem(item.key)} disabled={busy} aria-label={`Remove ${item.file.name}`}>Remove</button>
            </li>
          ))}
        </ul>
      )}

      <div className="btn-row">
        <button type="button" className="btn btn-primary" onClick={handleUpload} disabled={busy || validCount === 0}>
          {busy ? 'Uploading…' : `Upload ${validCount > 0 ? validCount : ''} document${validCount === 1 ? '' : 's'}`}
        </button>
        {busy && <span className="inline-loading" role="status"><span className="spinner" aria-hidden="true" /> Simulating upload…</span>}
      </div>
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
    </section>
  );
}
