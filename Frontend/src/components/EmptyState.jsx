export default function EmptyState({ title, children, actions }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{children}</p>
      {actions && <div className="btn-row">{actions}</div>}
    </div>
  );
}
