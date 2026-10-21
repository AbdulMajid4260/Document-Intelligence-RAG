const PIPELINE = [
  'Document upload', 'Text extraction', 'Chunking', 'Embeddings', 'Vector database', 'Semantic retrieval',
  'LLM generation', 'Answer with source references', 'SQLite history', 'JSON / CSV / Excel export',
];

const GLOSSARY = [
  ['RAG (Retrieval-Augmented Generation)', 'A way to answer questions by first finding relevant text in your own documents and then asking a language model to write the answer from that text.'],
  ['Embeddings', 'Lists of numbers that represent the meaning of a piece of text. Texts with similar meaning get similar numbers.'],
  ['Semantic search', 'Searching by meaning instead of exact words. "Car" can match "automobile" because their embeddings are close.'],
  ['Chunking', 'Cutting a long document into smaller pieces so each piece can be embedded and retrieved on its own. Chunk size and overlap affect result quality.'],
  ['Vector database', 'A database built to store embeddings and quickly find the ones closest to a query. This project compares FAISS and Chroma.'],
  ['LLM (large language model)', 'The model that writes the final answer. It is given the question and the retrieved chunks.'],
  ['Source metadata', 'Details stored with each chunk, such as filename, page number, and chunk ID, so an answer can point back to where its text came from.'],
  ['Persistent history', 'Saved questions, answers, timestamps, and source references that remain after the app restarts.'],
  ['Export formats', 'JSON is easy for programs to read, CSV opens in any spreadsheet tool, and Excel (.xlsx) is a ready-to-use workbook.'],
];

export default function Architecture() {
  return (
    <>
      <section className="card" aria-labelledby="pipeline-heading">
        <h2 id="pipeline-heading">The pipeline</h2>
        <p>This is the planned path from a file to an answer. The frontend only shows the results. Every step below is the backend's job.</p>
        <ol className="pipeline">
          {PIPELINE.map((step) => <li key={step}>{step}</li>)}
        </ol>
        <p className="hint">In this version the steps are simulated. The frontend does not extract text, create embeddings, search vectors, call an LLM, or save a database.</p>
      </section>

      <section className="card" aria-labelledby="two-stores">
        <h2 id="two-stores">Two separate stores</h2>
        <div className="grid-2">
          <div className="callout">
            <h3>Vector storage</h3>
            <p>Used to <strong>retrieve relevant document content</strong>. It holds chunk embeddings and finds the closest ones to a question.</p>
          </div>
          <div className="callout">
            <h3>SQLite history storage</h3>
            <p>Will be used to <strong>save questions, answers, timestamps, and source references</strong> so history survives a restart.</p>
          </div>
        </div>
        <p>They are separate responsibilities. Clearing history should not remove indexed documents, and re-indexing documents should not delete history.</p>
      </section>

      <section className="card" aria-labelledby="glossary-heading">
        <h2 id="glossary-heading">Key terms</h2>
        <dl className="glossary">
          {GLOSSARY.map(([term, text]) => (
            <div key={term}><dt>{term}</dt><dd>{text}</dd></div>
          ))}
        </dl>
      </section>
    </>
  );
}
