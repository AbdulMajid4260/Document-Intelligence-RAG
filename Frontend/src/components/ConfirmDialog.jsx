import { useEffect, useRef } from 'react';

// Uses the native <dialog> element: focus stays inside and Esc closes it.
export default function ConfirmDialog({ open, title, message, confirmLabel, busy, onConfirm, onCancel }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="dialog" aria-labelledby="dialog-title" onCancel={(e) => { e.preventDefault(); if (!busy) onCancel(); }}>
      <h2 id="dialog-title">{title}</h2>
      <p>{message}</p>
      <div className="btn-row">
        <button type="button" className="btn" onClick={onCancel} disabled={busy} autoFocus>Cancel</button>
        <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
