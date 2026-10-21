// The ONLY file the UI uses to talk to a backend.
//
// Mock mode (default): calls go to ./mockApi.js, which is simulated and in memory.
// Real mode: calls go to the FastAPI backend at VITE_API_BASE_URL.
//
// Switch with VITE_API_MODE=mock|real in a ".env" file, then restart `npm run dev`.
// SECURITY: VITE_ variables are visible in the browser. Never put secrets in them.

import * as mock from './mockApi.js';
import { buildExport, EXPORT_FORMATS } from '../utils/exporters.js';

export const API_MODE = String(import.meta.env.VITE_API_MODE || 'mock').toLowerCase() === 'real' ? 'real' : 'mock';
export const IS_MOCK = API_MODE === 'mock';
export const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, kind, status) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind; // 'network' | 'http' | 'parse'
    this.status = status;
  }
}

// ---------- Real-mode HTTP helper ----------
async function request(path, options = {}, expect = 'json') {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, options);
  } catch (err) {
    throw new ApiError(`Cannot reach the backend at ${API_BASE_URL}. Check that it is running and that CORS allows this page. (${err.message})`, 'network');
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail ?? body);
    } catch {
      /* the error body was not JSON; keep the status text */
    }
    throw new ApiError(`Backend returned ${response.status}: ${detail}`, 'http', response.status);
  }

  if (expect === 'blob') {
    const blob = await response.blob();
    // The backend must expose this header with CORS (expose_headers=["Content-Disposition"]).
    const header = response.headers.get('Content-Disposition') || '';
    const match = header.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    return { blob, filename: match ? decodeURIComponent(match[1]) : 'export' };
  }

  try {
    return await response.json();
  } catch {
    throw new ApiError('The backend response was not valid JSON.', 'parse', response.status);
  }
}

const jsonPost = (body) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

function assertFormat(format) {
  if (!EXPORT_FORMATS.includes(format)) throw new Error(`Unsupported export format: ${format}`);
}

const asList = (data, key) => (Array.isArray(data) ? data : data?.[key] || []);

// ---------- Public service functions ----------
export async function checkHealth() {
  if (IS_MOCK) return { status: 'mock', simulated: true };
  return request('/health'); // GET /health
}

export async function uploadDocuments(files) {
  if (IS_MOCK) return mock.uploadDocuments(files);
  const form = new FormData();
  files.forEach((file) => form.append('files', file)); // field name "files" is a proposal; adjust to the backend
  return request('/api/documents/upload', { method: 'POST', body: form }); // browser sets the multipart header
}

export async function fetchDocuments() {
  if (IS_MOCK) return mock.fetchDocuments();
  return asList(await request('/api/documents'), 'documents');
}

export async function askQuestion(question) {
  if (IS_MOCK) return mock.askQuestion(question);
  return request('/api/ask', jsonPost({ question }));
}

export async function fetchHistory() {
  if (IS_MOCK) return mock.fetchHistory();
  return asList(await request('/api/history'), 'history');
}

export async function fetchHistoryRecord(id) {
  if (IS_MOCK) return mock.fetchHistoryRecord(id);
  return request(`/api/history/${encodeURIComponent(id)}`);
}

export async function clearHistory() {
  if (IS_MOCK) return mock.clearHistory();
  return request('/api/history', { method: 'DELETE' });
}

// Export functions return { blob, filename }. The caller starts the download.
export async function exportHistory(format) {
  assertFormat(format);
  if (IS_MOCK) {
    const records = await mock.fetchHistory();
    if (records.length === 0) throw new Error('There is no history to export yet.');
    return buildExport(records, format, 'history');
  }
  return request(`/api/history/export?format=${format}`, {}, 'blob');
}

export async function exportAnswer(id, format) {
  assertFormat(format);
  if (IS_MOCK) {
    const record = await mock.fetchHistoryRecord(id);
    return buildExport([record], format, 'answer');
  }
  return request(`/api/history/${encodeURIComponent(id)}/export?format=${format}`, {}, 'blob');
}

export async function runExperiment(configuration) {
  if (IS_MOCK) return mock.runExperiment(configuration);
  return request('/api/experiments/run', jsonPost(configuration));
}

export async function fetchExperiments() {
  if (IS_MOCK) return mock.fetchExperiments();
  const data = await request('/api/experiments');
  return { simulated: false, runs: asList(data, 'experiments') };
}

// ---------- Mock-only controls (the UI hides them in real mode) ----------
export const setSimulatedFailures = mock.setSimulateFailure;
export const resetMockDemo = mock.resetMockDemo;
export const loadMockSample = mock.loadMockSample;
