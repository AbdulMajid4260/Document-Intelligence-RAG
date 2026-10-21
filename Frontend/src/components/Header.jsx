import { useEffect, useState } from 'react';
import { API_BASE_URL, checkHealth, IS_MOCK } from '../services/api.js';

// Top bar: page title plus a clear statement of whether the data is simulated.
export default function Header({ title, simulateFailure, onToggleFailure }) {
  const [health, setHealth] = useState('checking');

  useEffect(() => {
    if (IS_MOCK) return;
    checkHealth()
      .then(() => setHealth('ok'))
      .catch(() => setHealth('down'));
  }, []);

  return (
    <header className="topbar">
      <h1 id="page-title">{title}</h1>
      {IS_MOCK ? (
        <div className="mode-box">
          <span className="badge badge-mock">Mock mode</span>
          <span className="mode-text mode-text-mock">Data is simulated. No backend, AI, or database is used.</span>
          <label className="check">
            <input type="checkbox" checked={simulateFailure} onChange={(e) => onToggleFailure(e.target.checked)} />
            Simulate request failures
          </label>
        </div>
      ) : (
        <div className="mode-box">
          <span className={`badge ${health === 'ok' ? 'badge-ok' : health === 'down' ? 'badge-err' : 'badge-neutral'}`}>
            {health === 'ok' ? 'Backend connected' : health === 'down' ? 'Backend unreachable' : 'Checking backend'}
          </span>
          <span className="mode-text">{API_BASE_URL}</span>
        </div>
      )}
    </header>
  );
}
