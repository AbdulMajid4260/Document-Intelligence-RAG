// Mock backend. Everything lives in memory and disappears when the page reloads.
// It mirrors the shape of the future FastAPI responses so the UI does not change
// when the real backend is connected. Nothing here performs real AI retrieval.

import {
  MOCK_RESPONSES,
  pickMockResponse,
  SAMPLE_DOCUMENTS,
  SAMPLE_EXPERIMENTS,
  SAMPLE_HISTORY_QUESTION_IDS,
  SAMPLE_QUESTIONS,
} from '../data/mockData.js';
import { fileExtension } from '../utils/format.js';

let documents = [];
let history = [];
let docCounter = 0;
let recordCounter = 0;
let simulateFailure = false;

export function setSimulateFailure(on) {
  simulateFailure = Boolean(on);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function maybeFail(action) {
  if (simulateFailure) {
    throw new Error(`Simulated failure while trying to ${action}. Turn off "Simulate request failures" to continue.`);
  }
}

function makeDocument({ name, ext, size }) {
  docCounter += 1;
  return {
    id: `doc-${String(docCounter).padStart(3, '0')}`,
    name,
    ext,
    size,
    status: 'ingested',
    uploadedAt: new Date().toISOString(),
    // Rough estimates so the list has something to show. Not real extraction.
    pages: ext === 'pdf' ? Math.max(1, Math.round(size / 45000)) : null,
    chunks: Math.max(2, Math.round(size / 3500)),
    simulated: true,
  };
}

function buildRecord(question, docs, topicId) {
  // topicId forces a specific sample topic (used by the sample session).
  const source = topicId ? MOCK_RESPONSES[topicId] : pickMockResponse(question);
  const attach = (item) => {
    const doc = docs[item.docSlot % docs.length];
    return {
      documentName: doc.name,
      page: doc.ext === 'pdf' ? item.page : null, // TXT files have no pages
      chunkId: item.chunkId,
      score: item.score,
      passage: item.passage,
    };
  };
  recordCounter += 1;
  return {
    id: `rec-${String(recordCounter).padStart(3, '0')}`,
    question,
    answer: source.answer,
    timestamp: new Date().toISOString(),
    sources: source.sources.map(attach),
    additionalChunks: source.additionalChunks.map(attach),
    simulated: true,
  };
}

export async function uploadDocuments(files) {
  await wait(900);
  maybeFail('upload documents');
  const results = files.map((file) => {
    const ext = fileExtension(file.name);
    if (!['pdf', 'txt'].includes(ext)) {
      return { fileName: file.name, ok: false, message: 'Only PDF and TXT files are supported.' };
    }
    if (file.size === 0) {
      return { fileName: file.name, ok: false, message: 'The file is empty.' };
    }
    const doc = makeDocument({ name: file.name, ext, size: file.size });
    documents = [...documents.filter((d) => d.name !== file.name), doc]; // same name replaces the old entry
    return { fileName: file.name, ok: true, message: 'Ingested (simulated).', document: doc };
  });
  return { simulated: true, results };
}

export async function fetchDocuments() {
  await wait(200);
  return [...documents];
}

export async function askQuestion(question) {
  await wait(1100);
  maybeFail('answer the question');
  if (documents.length === 0) throw new Error('Upload at least one document before asking a question.');
  const record = buildRecord(question, documents);
  history = [record, ...history];
  return record;
}

export async function fetchHistory() {
  await wait(300);
  maybeFail('load history');
  return [...history].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function fetchHistoryRecord(id) {
  await wait(250);
  const record = history.find((r) => r.id === id);
  if (!record) throw new Error(`History record "${id}" was not found.`);
  return record;
}

export async function clearHistory() {
  await wait(300);
  maybeFail('clear history');
  history = [];
  return { simulated: true, cleared: true };
}

export async function fetchExperiments() {
  await wait(250);
  return { simulated: true, runs: SAMPLE_EXPERIMENTS };
}

// Sample lookup only: finds the sample row with the same settings. Nothing is executed.
export async function runExperiment(config) {
  await wait(600);
  maybeFail('run the experiment');
  const match = SAMPLE_EXPERIMENTS.find(
    (r) =>
      r.chunkSize === config.chunkSize &&
      r.overlap === config.overlap &&
      r.vectorStore === config.vectorStore &&
      r.topK === config.topK,
  );
  return { simulated: true, executed: false, run: match || null };
}

// ---- Mock-only helpers (not part of the future real API) ----
export async function resetMockDemo() {
  documents = [];
  history = [];
  docCounter = 0;
  recordCounter = 0;
  return { simulated: true };
}

export async function loadMockSample() {
  documents = SAMPLE_DOCUMENTS.map(makeDocument);
  history = [];
  // Oldest first so the newest ends up at the top after sorting.
  SAMPLE_HISTORY_QUESTION_IDS.forEach((topicId, i) => {
    const text = SAMPLE_QUESTIONS.find((q) => q.id === topicId).text;
    const record = buildRecord(text, documents, topicId);
    record.timestamp = new Date(Date.now() - (SAMPLE_HISTORY_QUESTION_IDS.length - i) * 3600 * 1000).toISOString();
    history = [record, ...history];
  });
  return { simulated: true };
}
