// Client-side export helpers (used in mock mode).
// In real mode the backend creates the files and the frontend only downloads them.

import { buildXlsx } from './xlsx.js';

export const EXPORT_FORMATS = ['json', 'csv', 'xlsx'];

const MIME = {
  json: 'application/json',
  csv: 'text/csv;charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function sourceLabel(s) {
  const page = s.page === null || s.page === undefined ? 'no page' : `p.${s.page}`;
  return `${s.documentName} (${page}, ${s.chunkId}, score ${Number(s.score).toFixed(2)})`;
}

const HISTORY_HEADER = ['ID', 'Timestamp', 'Question', 'Answer', 'Sources', 'Retrieved passages', 'Data origin'];
const SOURCE_HEADER = ['Record ID', 'Role', 'Document', 'Page', 'Chunk ID', 'Similarity (illustrative)', 'Retrieved passage'];

function origin(record) {
  return record.simulated ? 'Mock (simulated)' : 'Backend';
}

function historyRow(r) {
  return [
    r.id,
    r.timestamp,
    r.question,
    r.answer,
    (r.sources || []).map(sourceLabel).join('; '),
    (r.sources || []).map((s) => s.passage).join(' | '),
    origin(r),
  ];
}

function sourceRows(records) {
  const rows = [];
  records.forEach((r) => {
    (r.sources || []).forEach((s) => rows.push(sourceRow(r, 'Source', s)));
    (r.additionalChunks || []).forEach((s) => rows.push(sourceRow(r, 'Additional chunk', s)));
  });
  return rows;
}

function sourceRow(r, role, s) {
  return [r.id, role, s.documentName, s.page ?? '', s.chunkId, Number(s.score), s.passage];
}

// A cell that starts with = + - @ can run as a formula when a CSV is opened in
// Excel ("CSV injection"). A leading apostrophe makes Excel treat it as text.
function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(records) {
  const lines = [HISTORY_HEADER, ...records.map(historyRow)].map((row) => row.map(csvCell).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`; // BOM helps Excel read UTF-8
}

function toJson(records, scope) {
  const simulated = records.some((r) => r.simulated);
  const payload = {
    exportedAt: new Date().toISOString(),
    generatedBy: 'frontend (browser)',
    note: simulated
      ? 'These records come from simulated mock data. No AI retrieval or database was involved.'
      : 'Generated in the browser from records returned by the backend.',
    ...(scope === 'answer' ? { record: records[0] } : { count: records.length, records }),
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Builds a downloadable file from records.
 * scope: 'history' (many records) or 'answer' (one record)
 * Returns { blob, filename }.
 */
export function buildExport(records, format, scope = 'history') {
  if (!EXPORT_FORMATS.includes(format)) throw new Error(`Unsupported export format: ${format}`);
  const day = new Date().toISOString().slice(0, 10);
  const base = scope === 'answer' ? `rag-answer-${records[0].id}` : `rag-history-${day}`;
  let data;
  if (format === 'json') data = toJson(records, scope);
  else if (format === 'csv') data = toCsv(records);
  else {
    data = buildXlsx([
      { name: 'History', rows: [HISTORY_HEADER, ...records.map(historyRow)], widths: [12, 22, 40, 70, 50, 70, 16] },
      { name: 'Sources', rows: [SOURCE_HEADER, ...sourceRows(records)], widths: [12, 16, 28, 8, 14, 14, 70] },
    ]);
  }
  return { blob: new Blob([data], { type: MIME[format] }), filename: `${base}.${format}` };
}

/** Starts a browser download for a Blob. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
