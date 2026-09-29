'use client';

import { useRef } from 'react';

import Icon from './Icon';

/**
 * White bar under the header: bucket identity plus the only five operations
 * Objex exposes. DELETE stays disabled until at least one row is selected.
 */
export default function ActionBar({
  bucketName,
  selectedCount,
  busy,
  onUploadFiles,
  onUploadFolder,
  onCreateFolder,
  onRefresh,
  onDelete,
}) {
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  function handleFilePick(event) {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) onUploadFiles(files);
    // Reset so picking the same file twice still fires a change event.
    event.target.value = '';
  }

  function handleFolderPick(event) {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) onUploadFolder(files);
    event.target.value = '';
  }

  return (
    <div className="border-b border-gcp-border bg-white">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-4 sm:px-6">
        <Icon name="folder_shared" size={22} className="text-gcp-secondary" />
        <h1 className="text-gcp-xl font-normal leading-7 text-gcp-text">
          Bucket details
        </h1>
        <span className="rounded bg-[#f1f3f4] px-2 py-0.5 font-mono text-gcp-sm text-gcp-secondary">
          {bucketName}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1 px-3 pb-2 pt-2 sm:px-5">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={handleFilePick}
          aria-hidden="true"
          tabIndex={-1}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          hidden
          onChange={handleFolderPick}
          aria-hidden="true"
          tabIndex={-1}
          // Non-standard but supported in Chromium/WebKit/Firefox; React needs
          // these spelled out explicitly.
          {...{ webkitdirectory: '', directory: '', mozdirectory: '' }}
        />

        <button
          type="button"
          className="gcp-text-button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
        >
          <Icon name="add" size={18} />
          UPLOAD FILES
        </button>

        <button
          type="button"
          className="gcp-text-button"
          onClick={() => folderInputRef.current?.click()}
          disabled={busy}
        >
          <Icon name="add" size={18} />
          UPLOAD FOLDER
        </button>

        <button type="button" className="gcp-text-button" onClick={onCreateFolder} disabled={busy}>
          <Icon name="create_new_folder" size={18} />
          CREATE FOLDER
        </button>

        <button type="button" className="gcp-text-button" onClick={onRefresh} disabled={busy}>
          <Icon name="refresh" size={18} />
          REFRESH
        </button>

        <button
          type="button"
          className="gcp-text-button"
          onClick={onDelete}
          disabled={busy || selectedCount === 0}
          aria-disabled={busy || selectedCount === 0}
        >
          <Icon name="delete" size={18} />
          DELETE
        </button>

        {selectedCount > 0 && (
          <span className="ml-2 text-gcp-base text-gcp-secondary">
            {selectedCount} selected
          </span>
        )}
      </div>
    </div>
  );
}
