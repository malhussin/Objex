'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import Icon from './Icon';
import { formatBytes, formatTimestamp, iconForObject } from '@/lib/format';

const COLUMN_CLASSES = {
  head: 'px-4 py-0 text-left text-gcp-sm font-medium text-gcp-secondary',
  cell: 'px-4 py-0 text-gcp-base text-gcp-text',
};

/**
 * Material data table: checkbox column, name/size/type/last-modified, and a
 * three-dot overflow menu per row.
 */
export default function FileTable({
  rows,
  loading,
  error,
  selected,
  search,
  onToggleRow,
  onToggleAll,
  onOpenFolder,
  onDownload,
  onDeleteOne,
  onCopyPath,
}) {
  const [menu, setMenu] = useState(null); // { row, anchor: DOMRect }

  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.path));
  const someSelected = rows.some((row) => selected.has(row.path));

  return (
    <div className="relative rounded-lg border border-gcp-border bg-white shadow-none">
      {loading && (
        <div className="absolute inset-x-0 top-0 h-[3px] overflow-hidden rounded-t-lg bg-[#e8f0fe]">
          <div className="gcp-indeterminate-bar" />
        </div>
      )}

      <div className="gcp-scroll overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="h-10 border-b border-gcp-border">
              <th scope="col" className="w-12 pl-4 pr-0">
                <input
                  type="checkbox"
                  className="gcp-checkbox"
                  checked={allSelected}
                  ref={(node) => {
                    if (node) node.indeterminate = !allSelected && someSelected;
                  }}
                  onChange={(event) => onToggleAll(event.target.checked)}
                  aria-label="Select all objects in this folder"
                  disabled={rows.length === 0}
                />
              </th>
              <th scope="col" className={COLUMN_CLASSES.head}>
                Name
              </th>
              <th scope="col" className={`${COLUMN_CLASSES.head} w-[120px]`}>
                Size
              </th>
              <th scope="col" className={`${COLUMN_CLASSES.head} w-[200px]`}>
                Type
              </th>
              <th scope="col" className={`${COLUMN_CLASSES.head} w-[230px]`}>
                Last modified
              </th>
              <th scope="col" className="w-12 px-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const isSelected = selected.has(row.path);
              const isFolder = row.kind === 'folder';
              return (
                <tr
                  key={row.path}
                  className={`h-12 border-b border-gcp-divider transition-colors last:border-b-0 ${
                    isSelected ? 'bg-gcp-blue-selected' : 'hover:bg-gcp-canvas'
                  }`}
                >
                  <td className="pl-4 pr-0">
                    <input
                      type="checkbox"
                      className="gcp-checkbox"
                      checked={isSelected}
                      onChange={() => onToggleRow(row.path)}
                      aria-label={`Select ${row.name}`}
                    />
                  </td>

                  <td className={COLUMN_CLASSES.cell}>
                    <div className="flex items-center gap-3">
                      <Icon
                        name={isFolder ? 'folder' : iconForObject(row.contentType, row.name)}
                        size={20}
                        className={isFolder ? 'text-[#5f6368]' : 'text-[#80868b]'}
                      />
                      <button
                        type="button"
                        onClick={() => (isFolder ? onOpenFolder(row.path) : onDownload(row))}
                        className="max-w-[420px] truncate text-left text-gcp-base text-gcp-blue hover:underline"
                        title={row.path}
                      >
                        {row.name}
                        {isFolder ? '/' : ''}
                      </button>
                    </div>
                  </td>

                  <td className={COLUMN_CLASSES.cell}>
                    {isFolder ? '—' : formatBytes(row.size)}
                  </td>

                  <td className={`${COLUMN_CLASSES.cell} truncate`} title={row.contentType || ''}>
                    {isFolder ? 'Folder' : row.contentType}
                  </td>

                  <td className={`${COLUMN_CLASSES.cell} whitespace-nowrap`}>
                    {isFolder ? '—' : formatTimestamp(row.updated)}
                  </td>

                  <td className="px-2 text-right">
                    <button
                      type="button"
                      className="gcp-icon-button h-8 w-8 text-gcp-secondary hover:bg-[#f1f3f4]"
                      aria-label={`More actions for ${row.name}`}
                      aria-haspopup="menu"
                      onClick={(event) =>
                        setMenu({ row, anchor: event.currentTarget.getBoundingClientRect() })
                      }
                    >
                      <Icon name="more_vert" size={20} />
                    </button>
                  </td>
                </tr>
              );
            })}

            {!loading && !error && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <Icon name={search ? 'search_off' : 'folder_open'} size={40} className="mx-auto text-[#bdc1c6]" />
                  <p className="mt-3 text-gcp-md text-gcp-text">
                    {search ? 'No objects match your search' : 'This folder is empty'}
                  </p>
                  <p className="mt-1 text-gcp-base text-gcp-secondary">
                    {search
                      ? 'Try a different name, or clear the search field.'
                      : 'Upload files or create a folder to get started.'}
                  </p>
                </td>
              </tr>
            )}

            {error && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center">
                  <Icon name="error_outline" size={36} className="mx-auto text-gcp-red" />
                  <p className="mt-3 text-gcp-md text-gcp-text">Could not list this bucket</p>
                  <p className="mx-auto mt-1 max-w-[560px] text-gcp-base text-gcp-secondary">{error}</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {menu && (
        <RowMenu
          row={menu.row}
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          onDownload={onDownload}
          onOpenFolder={onOpenFolder}
          onCopyPath={onCopyPath}
          onDeleteOne={onDeleteOne}
        />
      )}
    </div>
  );
}

/**
 * Fixed-position menu anchored to the clicked ⋮ button, so it is never clipped
 * by the table's horizontal scroll container.
 */
function RowMenu({ row, anchor, onClose, onDownload, onOpenFolder, onCopyPath, onDeleteOne }) {
  const ref = useRef(null);
  const [position, setPosition] = useState({ top: anchor.bottom + 4, left: anchor.right - 176 });

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const { height, width } = node.getBoundingClientRect();
    const top =
      anchor.bottom + height + 8 > window.innerHeight ? anchor.top - height - 4 : anchor.bottom + 4;
    const left = Math.max(8, Math.min(anchor.right - width, window.innerWidth - width - 8));
    setPosition({ top, left });
  }, [anchor]);

  useEffect(() => {
    function onPointerDown(event) {
      if (ref.current && !ref.current.contains(event.target)) onClose();
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onClose, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [onClose]);

  const isFolder = row.kind === 'folder';

  function run(action) {
    onClose();
    action();
  }

  return (
    <div
      ref={ref}
      role="menu"
      className="gcp-menu gcp-fade-in fixed z-40 w-[200px]"
      style={{ top: position.top, left: position.left }}
    >
      {isFolder ? (
        <button type="button" role="menuitem" className="gcp-menu-item" onClick={() => run(() => onOpenFolder(row.path))}>
          <Icon name="folder_open" size={18} className="text-gcp-secondary" />
          Open
        </button>
      ) : (
        <button type="button" role="menuitem" className="gcp-menu-item" onClick={() => run(() => onDownload(row))}>
          <Icon name="download" size={18} className="text-gcp-secondary" />
          Download
        </button>
      )}

      <button type="button" role="menuitem" className="gcp-menu-item" onClick={() => run(() => onCopyPath(row))}>
        <Icon name="content_copy" size={18} className="text-gcp-secondary" />
        Copy path
      </button>

      <div className="my-1 border-t border-gcp-divider" />

      <button
        type="button"
        role="menuitem"
        className="gcp-menu-item text-gcp-red hover:bg-[#fce8e6]"
        onClick={() => run(() => onDeleteOne(row))}
      >
        <Icon name="delete" size={18} className="text-gcp-red" />
        Delete
      </button>
    </div>
  );
}
