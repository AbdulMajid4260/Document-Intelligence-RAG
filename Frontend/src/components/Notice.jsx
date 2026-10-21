// Inline message. Errors use role="alert" so screen readers announce them at once.
export default function Notice({ kind = 'info', title, children }) {
  return (
    <div className={`notice notice-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {title && <strong>{title}</strong>}
      <div>{children}</div>
    </div>
  );
}
