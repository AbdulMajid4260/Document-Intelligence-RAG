import { PAGES, pageHref } from '../utils/nav.js';
import Icon from './Icon.jsx';

// Vertical sidebar on desktop; the same links become a bottom bar on small screens.
export default function Sidebar({ page }) {
  return (
    <nav className="sidebar" aria-label="Main navigation">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <span>
          Document Intelligence
          <small>RAG Assistant</small>
        </span>
      </div>
      <ul className="nav-list">
        {PAGES.map((p) => (
          <li key={p.id}>
            <a className="nav-link" href={pageHref(p.id)} aria-current={page === p.id ? 'page' : undefined}>
              <Icon name={p.id} />
              <span className="label-full">{p.label}</span>
              <span className="label-short">{p.short}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
