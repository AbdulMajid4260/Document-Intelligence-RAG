// Tiny hash-based navigation so we do not need a router library.
// "#/documents" shows the Documents page, and the browser Back button works.

export const PAGES = [
  { id: 'dashboard', label: 'Dashboard', short: 'Home' },
  { id: 'documents', label: 'Documents', short: 'Docs' },
  { id: 'ask', label: 'Ask Questions', short: 'Ask' },
  { id: 'history', label: 'History', short: 'History' },
  { id: 'experiments', label: 'Experiments', short: 'Tests' },
  { id: 'about', label: 'About / Architecture', short: 'About' },
];

export function pageFromHash(hash) {
  const id = hash.replace(/^#\/?/, '');
  return PAGES.some((p) => p.id === id) ? id : 'dashboard';
}

export function pageHref(id) {
  return `#/${id}`;
}

export function navigate(id) {
  window.location.hash = pageHref(id);
}
