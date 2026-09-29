'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import ActionBar from './ActionBar';
import Breadcrumbs from './Breadcrumbs';
import ConnectionForm from './ConnectionForm';
import CreateFolderDialog from './CreateFolderDialog';
import DeleteDialog from './DeleteDialog';
import Dialog from './Dialog';
import FileTable from './FileTable';
import Header from './Header';
import Icon from './Icon';
import SnackbarStack from './Snackbar';

/** Normalizes a directory prefix: no leading slash, always a trailing one. */
function normalizeDir(value) {
  if (!value) return '';
  const clean = value.replace(/^\/+/, '').replace(/\/{2,}/g, '/');
  return clean === '' || clean.endsWith('/') ? clean : `${clean}/`;
}

let toastSequence = 0;

export default function ObjexBrowser({ status: initialStatus }) {
  // Seeded by the server, then kept current from /api/config responses: those
  // return the full new status, so switching bucket or editing the connection
  // needs no extra round trip and no route refresh.
  const [status, setStatus] = useState(initialStatus);
  const { bucketName, projectId } = status;

  useEffect(() => setStatus(initialStatus), [initialStatus]);

  const [prefix, setPrefix] = useState('');
  const [listing, setListing] = useState({ folders: [], files: [], nextPageToken: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [search, setSearch] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [deleteTargets, setDeleteTargets] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [buckets, setBuckets] = useState(null);
  const [bucketsNote, setBucketsNote] = useState('');
  const [bucketsLoading, setBucketsLoading] = useState(false);
  const [switchingBucket, setSwitchingBucket] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [dragging, setDragging] = useState(false);

  const dragDepth = useRef(0);

  // ---- Toasts ---------------------------------------------------------

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((toast) => {
    const id = `toast-${++toastSequence}`;
    setToasts((current) => [...current, { id, ...toast }]);
    if (toast.timeout !== 0) {
      setTimeout(() => dismissToast(id), toast.timeout ?? 6000);
    }
    return id;
  }, [dismissToast]);

  const updateToast = useCallback((id, patch) => {
    setToasts((current) =>
      current.map((toast) => (toast.id === id ? { ...toast, ...patch } : toast)),
    );
  }, []);

  // ---- Navigation (kept in the URL so Back/Forward work) --------------

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPrefix(normalizeDir(params.get('prefix') || ''));

    function onPopState() {
      const next = new URLSearchParams(window.location.search).get('prefix') || '';
      setPrefix(normalizeDir(next));
      setSelected(new Set());
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((next) => {
    const dir = normalizeDir(next);
    setPrefix(dir);
    setSelected(new Set());
    setSearch('');
    const url = dir ? `?prefix=${encodeURIComponent(dir)}` : window.location.pathname;
    window.history.pushState({ prefix: dir }, '', url);
  }, []);

  const refresh = useCallback(() => setRefreshToken((token) => token + 1), []);

  // ---- Listing --------------------------------------------------------

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/files?prefix=${encodeURIComponent(prefix)}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        const payload = await response.json();
        if (payload?.needsSetup) {
          // The connection was cleared (here or in another tab): reload so the
          // server renders the setup screen.
          window.location.assign('/');
          return;
        }
        if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status})`);
        if (!active) return;
        setListing({
          folders: payload.folders || [],
          files: payload.files || [],
          nextPageToken: payload.nextPageToken || null,
        });
      } catch (requestError) {
        if (requestError.name === 'AbortError' || !active) return;
        setListing({ folders: [], files: [], nextPageToken: null });
        setError(requestError.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [prefix, refreshToken]);

  const rows = useMemo(() => {
    const all = [...listing.folders, ...listing.files];
    const needle = search.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((row) => row.name.toLowerCase().includes(needle));
  }, [listing, search]);

  // Drop selections that are no longer visible in this folder.
  useEffect(() => {
    setSelected((current) => {
      if (current.size === 0) return current;
      const visible = new Set([
        ...listing.folders.map((row) => row.path),
        ...listing.files.map((row) => row.path),
      ]);
      const next = new Set([...current].filter((path) => visible.has(path)));
      return next.size === current.size ? current : next;
    });
  }, [listing]);

  // ---- Selection ------------------------------------------------------

  const toggleRow = useCallback((path) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const toggleAll = useCallback(
    (checked) => {
      setSelected(checked ? new Set(rows.map((row) => row.path)) : new Set());
    },
    [rows],
  );

  // ---- Bucket switcher ------------------------------------------------

  /** Fetched when the switcher opens, then cached for the session. */
  const loadBuckets = useCallback(async () => {
    if (buckets || bucketsLoading) return;
    setBucketsLoading(true);
    try {
      const response = await fetch('/api/buckets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Could not list buckets.');

      if (payload.listable) {
        setBuckets(payload.buckets);
        setBucketsNote(payload.buckets.length <= 1 ? 'No other buckets in this project.' : '');
      } else {
        setBuckets([]);
        setBucketsNote(
          `${payload.reason || 'Bucket listing is not permitted.'} Buckets you have opened before are listed above; use "Add another bucket…" for any other.`,
        );
      }
    } catch (bucketError) {
      setBuckets([]);
      setBucketsNote(bucketError.message);
    } finally {
      setBucketsLoading(false);
    }
  }, [buckets, bucketsLoading]);

  /**
   * Switching bucket rewrites the saved connection, keeping the credentials as
   * they are, then returns to the root of the new bucket.
   */
  const switchBucket = useCallback(
    async (name) => {
      setSwitchingBucket(true);
      try {
        const response = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bucketName: name,
            projectId: status.projectId || '',
            ...(status.credentials?.source === 'stored-key'
              ? { credentialsMode: 'key', keepExistingKey: true }
              : { credentialsMode: 'ambient' }),
          }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(
            response.status === 401
              ? 'This server requires an admin token to change the bucket. Use Connection settings.'
              : payload?.error || 'Could not switch bucket.',
          );
        }

        setStatus(payload);
        setSelected(new Set());
        setSearch('');
        setPrefix('');
        window.history.pushState({ prefix: '' }, '', window.location.pathname);
        refresh();
        pushToast({ message: `Switched to ${name}`, variant: 'success' });
      } catch (switchError) {
        pushToast({ message: switchError.message, variant: 'error', timeout: 10000 });
      } finally {
        setSwitchingBucket(false);
      }
    },
    [status, refresh, pushToast],
  );

  const forgetBucket = useCallback(
    async (name) => {
      try {
        const response = await fetch(`/api/buckets?name=${encodeURIComponent(name)}`, {
          method: 'DELETE',
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(
            response.status === 401
              ? 'This server requires an admin token to change the bucket list.'
              : payload?.error || 'Could not remove that bucket from the list.',
          );
        }
        setStatus(payload);
        pushToast({ message: `Removed ${name} from the list`, timeout: 4000 });
      } catch (forgetError) {
        pushToast({ message: forgetError.message, variant: 'error', timeout: 10000 });
      }
    },
    [pushToast],
  );

  // ---- Upload ---------------------------------------------------------

  const uploadFiles = useCallback(
    (files, { preservePaths = false } = {}) => {
      if (files.length === 0) return;

      const totalBytes = files.reduce((sum, file) => sum + (file.size || 0), 0);
      const label =
        files.length === 1 ? files[0].name : `${files.length} files`;
      const toastId = pushToast({
        message: `Uploading ${label}…`,
        progress: 0,
        timeout: 0,
        dismissible: false,
      });

      const form = new FormData();
      form.append('prefix', prefix);
      for (const file of files) {
        const relative =
          preservePaths && file.webkitRelativePath ? file.webkitRelativePath : file.name;
        form.append('paths', relative);
        form.append('files', file, file.name);
      }

      // XMLHttpRequest rather than fetch: it is the only browser API that
      // reports request upload progress.
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload');

      xhr.upload.onprogress = (event) => {
        const total = event.lengthComputable ? event.total : totalBytes;
        if (total > 0) {
          updateToast(toastId, { progress: Math.min(99, (event.loaded / total) * 100) });
        }
      };

      xhr.onload = () => {
        dismissToast(toastId);
        if (xhr.status >= 200 && xhr.status < 300) {
          pushToast({
            message: `Uploaded ${label} to ${prefix || bucketName}`,
            variant: 'success',
          });
          refresh();
        } else {
          let message = `Upload failed (${xhr.status})`;
          try {
            message = JSON.parse(xhr.responseText)?.error || message;
          } catch {
            /* keep the status-code message */
          }
          pushToast({ message, variant: 'error', timeout: 10000 });
        }
      };

      xhr.onerror = () => {
        dismissToast(toastId);
        pushToast({
          message: 'Upload failed: the connection was interrupted.',
          variant: 'error',
          timeout: 10000,
        });
      };

      xhr.send(form);
    },
    [prefix, bucketName, pushToast, updateToast, dismissToast, refresh],
  );

  // ---- Download (V4 signed URL, fetched then triggered client-side) ---

  const download = useCallback(
    async (row) => {
      if (row.kind === 'folder') {
        pushToast({ message: 'Folders cannot be downloaded — open it and pick objects.' });
        return;
      }
      const toastId = pushToast({ message: `Preparing ${row.name}…`, timeout: 0 });
      try {
        const response = await fetch(`/api/download?file=${encodeURIComponent(row.path)}`, {
          cache: 'no-store',
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || 'Could not sign this object.');

        const anchor = document.createElement('a');
        anchor.href = payload.url;
        anchor.rel = 'noopener';
        anchor.download = payload.filename || row.name;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        dismissToast(toastId);
        pushToast({ message: `Downloading ${row.name}`, variant: 'success', timeout: 4000 });
      } catch (downloadError) {
        dismissToast(toastId);
        pushToast({ message: downloadError.message, variant: 'error', timeout: 10000 });
      }
    },
    [pushToast, dismissToast],
  );

  // ---- Delete ---------------------------------------------------------

  const confirmDelete = useCallback(async () => {
    if (!deleteTargets) return;
    setBusy(true);
    try {
      const response = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: deleteTargets }),
      });
      const payload = await response.json();
      if (!response.ok && response.status !== 207) {
        throw new Error(payload?.error || 'Delete failed.');
      }

      const failed = payload.failed?.length ?? 0;
      if (failed > 0) {
        pushToast({
          message: `Deleted ${payload.count} object(s); ${failed} failed.`,
          variant: 'error',
          timeout: 10000,
        });
      } else {
        pushToast({
          message: `Deleted ${payload.count} object(s).`,
          variant: 'success',
        });
      }
      setSelected(new Set());
      setDeleteTargets(null);
      refresh();
    } catch (deleteError) {
      pushToast({ message: deleteError.message, variant: 'error', timeout: 10000 });
    } finally {
      setBusy(false);
    }
  }, [deleteTargets, pushToast, refresh]);

  // ---- Create folder --------------------------------------------------

  const createFolder = useCallback(
    async (name) => {
      setBusy(true);
      try {
        const response = await fetch('/api/folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefix, name }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || 'Could not create the folder.');
        setShowCreateFolder(false);
        pushToast({ message: `Created folder ${payload.name}`, variant: 'success' });
        refresh();
      } catch (folderError) {
        pushToast({ message: folderError.message, variant: 'error', timeout: 10000 });
      } finally {
        setBusy(false);
      }
    },
    [prefix, pushToast, refresh],
  );

  const copyPath = useCallback(
    async (row) => {
      const uri = `gs://${bucketName}/${row.path}`;
      try {
        await navigator.clipboard.writeText(uri);
        pushToast({ message: `Copied ${uri}`, variant: 'success', timeout: 4000 });
      } catch {
        pushToast({ message: `Path: ${uri}`, timeout: 10000 });
      }
    },
    [bucketName, pushToast],
  );

  // ---- Drag and drop --------------------------------------------------

  function onDragEnter(event) {
    if (!event.dataTransfer?.types?.includes('Files')) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  }

  function onDragOver(event) {
    if (!event.dataTransfer?.types?.includes('Files')) return;
    event.preventDefault();
  }

  function onDragLeave() {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  function onDrop(event) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const files = Array.from(event.dataTransfer?.files || []);
    if (files.length > 0) uploadFiles(files);
  }

  const objectCount = listing.files.length;
  const folderCount = listing.folders.length;

  return (
    <div className="flex min-h-screen flex-col bg-gcp-canvas">
      <Header
        search={search}
        onSearchChange={setSearch}
        userEmail={status.credentials?.clientEmail || 'admin@objex.app'}
        onOpenSettings={() => setShowSettings(true)}
        bucketName={bucketName}
        buckets={buckets}
        knownBuckets={status.knownBuckets}
        bucketsLoading={bucketsLoading}
        bucketsNote={bucketsNote}
        canSwitchBucket={status.managedBy?.bucketName !== 'env'}
        switchingBucket={switchingBucket}
        onOpenBucketMenu={loadBuckets}
        onSwitchBucket={switchBucket}
        onForgetBucket={forgetBucket}
      />

      <ActionBar
        bucketName={bucketName}
        selectedCount={selected.size}
        busy={busy}
        onUploadFiles={(files) => uploadFiles(files)}
        onUploadFolder={(files) => uploadFiles(files, { preservePaths: true })}
        onCreateFolder={() => setShowCreateFolder(true)}
        onRefresh={refresh}
        onDelete={() => setDeleteTargets([...selected])}
      />

      <main
        className="flex-1 px-4 py-4 sm:px-6 sm:py-6"
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="mx-auto max-w-[1400px]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <Breadcrumbs bucketName={bucketName} prefix={prefix} onNavigate={navigate} />
            <p className="text-gcp-base text-gcp-secondary">
              {folderCount} folder(s), {objectCount} object(s)
              {search && ` · ${rows.length} match(es)`}
            </p>
          </div>

          <div className="relative">
            <FileTable
              rows={rows}
              loading={loading}
              error={error}
              selected={selected}
              search={search}
              onToggleRow={toggleRow}
              onToggleAll={toggleAll}
              onOpenFolder={navigate}
              onDownload={download}
              onDeleteOne={(row) => setDeleteTargets([row.path])}
              onCopyPath={copyPath}
            />

            {dragging && (
              <div className="gcp-fade-in pointer-events-none absolute inset-0 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gcp-blue bg-[#e8f0fe]/90">
                <Icon name="cloud_upload" size={40} className="text-gcp-blue" />
                <p className="mt-2 text-gcp-md font-medium text-gcp-blue">
                  Drop to upload into {prefix || bucketName}
                </p>
              </div>
            )}
          </div>

          {listing.nextPageToken && (
            <p className="mt-3 text-gcp-base text-gcp-secondary">
              Showing the first {objectCount + folderCount} entries in this folder. Narrow the view
              by opening a subfolder.
            </p>
          )}

          <footer className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-gcp-sm text-gcp-secondary">
            <span>
              Project: <span className="font-mono">{projectId || 'not set'}</span>
            </span>
            <span>
              Bucket: <span className="font-mono">gs://{bucketName}</span>
            </span>
            {status.credentials?.clientEmail && (
              <span>
                Signed in as{' '}
                <span className="font-mono">{status.credentials.clientEmail}</span>
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="text-gcp-blue hover:underline"
            >
              Connection settings
            </button>
          </footer>
        </div>
      </main>

      {showCreateFolder && (
        <CreateFolderDialog
          prefix={prefix}
          busy={busy}
          onCancel={() => setShowCreateFolder(false)}
          onSubmit={createFolder}
        />
      )}

      {deleteTargets && deleteTargets.length > 0 && (
        <DeleteDialog
          targets={deleteTargets}
          busy={busy}
          onCancel={() => setDeleteTargets(null)}
          onConfirm={confirmDelete}
        />
      )}

      {showSettings && (
        <Dialog
          title="Connection settings"
          widthClass="max-w-[640px]"
          onClose={() => setShowSettings(false)}
        >
          <ConnectionForm
            status={status}
            variant="dialog"
            onClose={() => setShowSettings(false)}
            onSaved={(payload) => {
              // Disconnecting leaves nothing to browse: let the server decide
              // what to render.
              if (!payload?.configured) {
                window.location.assign('/');
                return;
              }
              setStatus(payload);
              setShowSettings(false);
              setSelected(new Set());
              setSearch('');
              setPrefix('');
              setBuckets(null);
              setBucketsNote('');
              refresh();
            }}
          />
        </Dialog>
      )}

      <SnackbarStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
