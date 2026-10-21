// A few simple line icons (decorative, so they are hidden from screen readers).
const PATHS = {
  dashboard: 'M4 4h7v7H4z M13 4h7v4h-7z M13 10h7v10h-7z M4 13h7v7H4z',
  documents: 'M7 3h7l5 5v13H7z M14 3v5h5',
  ask: 'M4 5h16v11H9l-5 4z',
  history: 'M12 7v5l3 2 M4 12a8 8 0 1 0 3-6.2 M4 4v4h4',
  experiments: 'M9 3h6 M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3',
  about: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 11v6 M12 7.5v.5',
};

export default function Icon({ name }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
