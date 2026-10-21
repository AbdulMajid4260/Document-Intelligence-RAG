
import { formatBytes, formatDateTime } from '../utils/format.js';

export default function DocumentList({ documents = [] }) {
  // Ensure the component receives an array before rendering.
  const safeDocuments = Array.isArray(documents) ? documents : [];

  return (
    <div className="table-wrap">
      <table>
        <caption className="visually-hidden">
          Uploaded documents
        </caption>

        <thead>
          <tr>
            <th scope="col">File</th>
            <th scope="col">Type</th>
            <th scope="col">Size</th>
            <th scope="col">Pages (est.)</th>
            <th scope="col">Chunks (est.)</th>
            <th scope="col">Status</th>
            <th scope="col">Uploaded</th>
          </tr>
        </thead>

        <tbody>
          {safeDocuments.length === 0 ? (
            <tr>
              <td colSpan={7}>No documents uploaded yet.</td>
            </tr>
          ) : (
            safeDocuments.map((document, index) => {
              const fileName =
                typeof document?.name === 'string'
                  ? document.name
                  : 'Untitled document';

              // Use the extension if available; otherwise derive it
              // from the filename. Avoid calling methods on undefined.
              const extension =
                typeof document?.ext === 'string' &&
                document.ext.trim()
                  ? document.ext.trim().toUpperCase()
                  : fileName.includes('.')
                    ? fileName.split('.').pop().toUpperCase()
                    : 'FILE';

              const size = Number(document?.size);
              const chunks = Number(document?.chunks);
              const pages = document?.pages;

              return (
                <tr
                  key={
                    document?.id ??
                    `${fileName}-${document?.uploadedAt ?? index}`
                  }
                >
                  <th scope="row">{fileName}</th>

                  <td>{extension}</td>

                  <td>
                    {Number.isFinite(size) && size >= 0
                      ? formatBytes(size)
                      : 'n/a'}
                  </td>

                  <td>{pages ?? 'n/a'}</td>

                  <td>
                    {Number.isFinite(chunks) && chunks >= 0
                      ? chunks
                      : 'n/a'}
                  </td>

                  <td>
                    <span className="badge badge-ok">
                      Ingested
                      {document?.simulated ? ' (simulated)' : ''}
                    </span>
                  </td>

                  <td>
                    {document?.uploadedAt
                      ? formatDateTime(document.uploadedAt)
                      : 'n/a'}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
