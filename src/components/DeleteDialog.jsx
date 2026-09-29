'use client';

import Dialog from './Dialog';

/**
 * Confirmation for destructive deletes. Folder targets are called out
 * explicitly, since deleting a prefix removes everything beneath it.
 */
export default function DeleteDialog({ targets, busy, onCancel, onConfirm }) {
  const folders = targets.filter((path) => path.endsWith('/'));
  const files = targets.filter((path) => !path.endsWith('/'));
  const preview = targets.slice(0, 6);

  return (
    <Dialog
      title={targets.length === 1 ? 'Delete this object?' : `Delete ${targets.length} objects?`}
      onClose={onCancel}
      actions={
        <>
          <button type="button" className="gcp-text-button" onClick={onCancel} disabled={busy}>
            CANCEL
          </button>
          <button type="button" className="gcp-danger-button" onClick={onConfirm} disabled={busy}>
            {busy ? 'DELETING…' : 'DELETE'}
          </button>
        </>
      }
    >
      <p className="text-gcp-base">
        This permanently removes {files.length > 0 && <strong>{files.length} object(s)</strong>}
        {files.length > 0 && folders.length > 0 && ' and '}
        {folders.length > 0 && (
          <strong>
            {folders.length} folder(s), including everything inside them
          </strong>
        )}
        . Deleted objects cannot be recovered unless object versioning is enabled on the bucket.
      </p>

      <ul className="mt-3 max-h-[168px] overflow-y-auto rounded border border-gcp-border bg-gcp-canvas p-2 font-mono text-gcp-sm text-gcp-text">
        {preview.map((path) => (
          <li key={path} className="truncate py-0.5" title={path}>
            {path}
          </li>
        ))}
        {targets.length > preview.length && (
          <li className="py-0.5 text-gcp-secondary">
            + {targets.length - preview.length} more
          </li>
        )}
      </ul>
    </Dialog>
  );
}
