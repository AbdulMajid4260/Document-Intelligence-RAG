// ALL DATA IN THIS FILE IS SAMPLE DATA.
// Nothing here comes from real retrieval, a real vector database, or a real LLM.
// The real backend will replace these values later.

export const SAMPLE_QUESTIONS = [
  { id: 'q-rag', text: 'What is retrieval-augmented generation?', keywords: ['rag', 'retrieval', 'augmented', 'generation'] },
  { id: 'q-overlap', text: 'Why use chunk overlap when splitting documents?', keywords: ['overlap', 'chunk', 'chunks', 'split', 'chunking'] },
  { id: 'q-score', text: 'What does a similarity score tell me?', keywords: ['similarity', 'score', 'rank', 'relevance', 'distance'] },
  { id: 'q-history', text: 'Why is history stored separately from the vector database?', keywords: ['history', 'sqlite', 'persist', 'separate', 'saved'] },
];

// docSlot: which uploaded document the sample source is attached to
// (slot 0 = first uploaded document, slot 1 = second, wrapping around).
export const MOCK_RESPONSES = {
  'q-rag': {
    answer:
      'Retrieval-augmented generation (RAG) first searches your documents for passages related to the question, then gives those passages to a language model so the answer is based on them. This keeps answers tied to your own material instead of only to what the model learned during training.',
    sources: [
      { docSlot: 0, page: 2, chunkId: 'chunk-0004', score: 0.86, passage: 'RAG combines two steps. A retriever finds the passages most related to a question, and a generator writes an answer that is grounded in those passages.' },
      { docSlot: 1, page: 1, chunkId: 'chunk-0001', score: 0.78, passage: 'Grounding answers in retrieved text makes it possible to show the reader where a statement came from.' },
    ],
    additionalChunks: [
      { docSlot: 0, page: 3, chunkId: 'chunk-0006', score: 0.64, passage: 'Without retrieval, a model can only rely on patterns learned in training and may state details that are not in your documents.' },
    ],
  },
  'q-overlap': {
    answer:
      'Documents are split into chunks before embedding. Overlap repeats a small amount of text at the edges of neighbouring chunks, so a sentence or definition that falls on a boundary still appears whole in at least one chunk. Larger overlap helps continuity but increases storage and can return near-duplicate chunks.',
    sources: [
      { docSlot: 0, page: 5, chunkId: 'chunk-0011', score: 0.89, passage: 'A chunk overlap of 10 to 20 percent of the chunk size is a common starting point. It reduces the chance that an idea is cut in half at a boundary.' },
      { docSlot: 1, page: 2, chunkId: 'chunk-0003', score: 0.73, passage: 'Smaller chunks give precise matches but lose surrounding context. Larger chunks keep context but can dilute the match.' },
    ],
    additionalChunks: [
      { docSlot: 0, page: 6, chunkId: 'chunk-0012', score: 0.61, passage: 'Too much overlap produces many nearly identical chunks, which can crowd out other relevant passages in the top results.' },
    ],
  },
  'q-score': {
    answer:
      'A similarity score estimates how close the meaning of a stored chunk is to the meaning of your question, based on their embeddings. A higher score means a closer match, but it is a ranking signal and not a guarantee that the chunk answers the question. Scores from different embedding models or metrics cannot be compared directly.',
    sources: [
      { docSlot: 0, page: 7, chunkId: 'chunk-0015', score: 0.83, passage: 'Vector search ranks chunks by how close their embeddings are to the query embedding. The ranking is relative, so compare scores only within one setup.' },
    ],
    additionalChunks: [
      { docSlot: 1, page: 3, chunkId: 'chunk-0005', score: 0.58, passage: 'Different distance metrics, such as cosine similarity or L2 distance, produce values on different scales.' },
    ],
  },
  'q-history': {
    answer:
      'The vector database is built for finding similar chunks quickly. It is not designed to keep a tidy record of who asked what. A separate store such as SQLite keeps each question, answer, timestamp, and source reference so the history can be searched, shown, and exported without touching the document index.',
    sources: [
      { docSlot: 1, page: 4, chunkId: 'chunk-0009', score: 0.81, passage: 'Keep retrieval data and application records apart. The vector index answers "which chunks are similar?" and the relational store answers "what happened before?"' },
    ],
    additionalChunks: [
      { docSlot: 0, page: 8, chunkId: 'chunk-0018', score: 0.55, passage: 'Rebuilding an index should never delete saved question history, and clearing history should never delete indexed documents.' },
    ],
  },
  'q-general': {
    answer:
      'Simulated answer: your question did not match one of the sample topics, so this fixed placeholder is shown. After the backend is connected, the answer will be written from passages retrieved from your uploaded documents.',
    sources: [
      { docSlot: 0, page: 1, chunkId: 'chunk-0001', score: 0.42, passage: 'Sample passage shown for layout testing only. It was not extracted from your file.' },
    ],
    additionalChunks: [],
  },
};

/**
 * Deterministic matcher: counts how many keywords of each sample topic appear in
 * the question. The topic with the most matches wins (ties go to the first one).
 * No matches at all -> the fixed "q-general" response. There is no randomness.
 */
export function pickMockResponse(question) {
  const words = question.toLowerCase().match(/[a-z]+/g) || [];
  let best = null;
  let bestScore = 0;
  SAMPLE_QUESTIONS.forEach((topic) => {
    const score = topic.keywords.filter((k) => words.includes(k)).length;
    if (score > bestScore) {
      best = topic;
      bestScore = score;
    }
  });
  return { id: best ? best.id : 'q-general', ...MOCK_RESPONSES[best ? best.id : 'q-general'] };
}

// Used by the "Load sample session" button.
export const SAMPLE_DOCUMENTS = [
  { name: 'rag-course-notes.pdf', ext: 'pdf', size: 184320 },
  { name: 'vector-database-overview.txt', ext: 'txt', size: 20480 },
];
export const SAMPLE_HISTORY_QUESTION_IDS = ['q-rag', 'q-overlap'];

// ---- Experiments (sample dataset, NOT measured) ----
export const EXPERIMENT_NOTICE =
  'These rows are a sample dataset for layout and discussion. No experiment has been run. Real measurements will appear after backend integration and execution.';

export const EXPERIMENT_CONFIG_OPTIONS = {
  chunkSizes: [256, 512, 1024],
  overlaps: [0, 32, 64, 128],
  vectorStores: ['FAISS', 'Chroma'],
  topK: [3, 4, 5],
};

const CHUNKS_BY_SIZE = {
  256: [
    { chunkId: 'chunk-0031', score: 0.82, text: 'A chunk overlap of 10 to 20 percent of the chunk size is a common starting point.' },
    { chunkId: 'chunk-0032', score: 0.74, text: 'It reduces the chance that an idea is cut in half at a boundary.' },
  ],
  512: [
    { chunkId: 'chunk-0016', score: 0.88, text: 'A chunk overlap of 10 to 20 percent is a common starting point. It reduces the chance that an idea is cut in half at a boundary, while keeping the index small.' },
    { chunkId: 'chunk-0017', score: 0.76, text: 'Smaller chunks give precise matches but lose surrounding context. Larger chunks keep context but can dilute the match.' },
  ],
  1024: [
    { chunkId: 'chunk-0008', score: 0.79, text: 'This long chunk covers chunking, overlap, and metadata together, so the relevant sentence is surrounded by several unrelated paragraphs.' },
    { chunkId: 'chunk-0009', score: 0.71, text: 'The following long chunk continues with index structures and distance metrics.' },
  ],
};

function run(id, chunkSize, overlap, vectorStore, relevance, latencyMs, notes) {
  return { id, chunkSize, overlap, vectorStore, topK: 4, relevance, latencyMs, notes, retrievedChunks: CHUNKS_BY_SIZE[chunkSize] };
}

export const SAMPLE_EXPERIMENTS = [
  run('exp-1', 256, 32, 'FAISS', 0.71, 38, 'Precise matches, but definitions are sometimes cut across chunks.'),
  run('exp-2', 256, 32, 'Chroma', 0.71, 52, 'Same chunks as exp-1; only the vector store differs.'),
  run('exp-3', 512, 64, 'FAISS', 0.78, 41, 'Good balance of context and precision.'),
  run('exp-4', 512, 64, 'Chroma', 0.78, 57, 'Same chunks as exp-3; only the vector store differs.'),
  run('exp-5', 1024, 128, 'FAISS', 0.74, 49, 'Long chunks add unrelated text around the answer.'),
  run('exp-6', 1024, 128, 'Chroma', 0.73, 66, 'Same chunks as exp-5; only the vector store differs.'),
];
