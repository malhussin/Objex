'use client';

import { useEffect, useRef, useState } from 'react';

import Dialog from './Dialog';

const INVALID = /[\\/]/;

export default function CreateFolderDialog({ prefix, busy, onCancel, onSubmit }) {
  const [name, setName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const trimmed = name.trim();
  const invalid = trimmed !== '' && INVALID.test(trimmed);
  const canSubmit = trimmed !== '' && !invalid && !busy;

  function submit(event) {
    event.preventDefault();
    if (canSubmit) onSubmit(trimmed);
  }

  return (
    <Dialog
      title="Create folder"
      onClose={onCancel}
      actions={
        <>
          <button type="button" className="gcp-text-button" onClick={onCancel} disabled={busy}>
            CANCEL
          </button>
          <button type="submit" form="objex-create-folder" className="gcp-filled-button" disabled={!canSubmit}>
            {busy ? 'CREATING…' : 'CREATE'}
          </button>
        </>
      }
    >
      <form id="objex-create-folder" onSubmit={submit}>
        <p className="mb-3 text-gcp-base">
          The folder is created inside{' '}
          <span className="font-mono text-gcp-text">{prefix || '/'}</span>. Cloud Storage has no
          real directories — Objex writes a zero-byte placeholder object ending in
          <span className="font-mono"> /</span>.
        </p>
        <label htmlFor="objex-folder-name" className="mb-1 block text-gcp-sm text-gcp-secondary">
          Folder name
        </label>
        <input
          id="objex-folder-name"
          ref={inputRef}
          className="gcp-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="new-folder"
          autoComplete="off"
          aria-invalid={invalid}
          aria-describedby={invalid ? 'objex-folder-error' : undefined}
        />
        {invalid && (
          <p id="objex-folder-error" className="mt-1 text-gcp-sm text-gcp-red">
            Folder names cannot contain slashes.
          </p>
        )}
      </form>
    </Dialog>
  );
}
