'use client';

import { useRef, useState } from 'react';

import Icon from './Icon';

/**
 * Everything needed to point Objex at a bucket, entered in the browser:
 * a service account key (or the runtime's default credentials), the project,
 * and the bucket. Saved server-side after the backend verifies it works.
 *
 * Rendered full-page on first run and inside a dialog from the settings menu.
 */
export default function ConnectionForm({ status, variant = 'page', onClose, onSaved }) {
  const managed = status?.managedBy || {};
  const hasStoredKey = status?.credentials?.source === 'stored-key';

  const [mode, setMode] = useState(
    status?.credentials?.source === 'ambient' ? 'ambient' : 'key',
  );
  const [keyText, setKeyText] = useState('');
  const [keyName, setKeyName] = useState('');
  const [replaceKey, setReplaceKey] = useState(!hasStoredKey);
  const [projectId, setProjectId] = useState(status?.projectId || '');
  const [bucketName, setBucketName] = useState(status?.bucketName || '');
  const [adminToken, setAdminToken] = useState('');
  const [buckets, setBuckets] = useState(null); // null = not probed yet
  const [listNote, setListNote] = useState('');
  const [listing, setListing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  // Parsed in the browser purely for instant feedback; the server re-validates.
  const parsedKey = parseKeyPreview(keyText);
  const keyIdentity = replaceKey
    ? parsedKey?.client_email
    : status?.credentials?.clientEmail;

  const envCredentials = managed.credentials === 'env';
  const envBucket = managed.bucketName === 'env';
  const envProject = managed.projectId === 'env';

  // GOOGLE_APPLICATION_CREDENTIALS is itself how Application Default
  // Credentials find a key, so env-managed credentials are submitted as
  // 'ambient': the form has no key to send and does not need one.
  const submittedMode = envCredentials ? 'ambient' : mode;

  function headers() {
    return {
      'Content-Type': 'application/json',
      ...(status?.adminTokenRequired && adminToken
        ? { 'x-objex-admin-token': adminToken }
        : {}),
    };
  }

  async function handleKeyFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const text = await file.text();
    setKeyText(text);
    setKeyName(file.name);
    setError('');
    const preview = parseKeyPreview(text);
    if (preview?.project_id && !projectId) setProjectId(preview.project_id);
  }

  function onPasteKey(value) {
    setKeyText(value);
    setKeyName('');
    const preview = parseKeyPreview(value);
    if (preview?.project_id && !projectId) setProjectId(preview.project_id);
  }

  async function listBuckets() {
    setListing(true);
    setError('');
    setListNote('');
    try {
      const response = await fetch('/api/buckets', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          credentialsMode: submittedMode,
          projectId,
          ...(submittedMode === 'key' && replaceKey && keyText
            ? { serviceAccountKey: keyText }
            : {}),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Could not list buckets.');

      if (payload.listable) {
        setBuckets(payload.buckets);
        setListNote(
          payload.buckets.length === 0
            ? 'This project has no buckets yet.'
            : `${payload.buckets.length} bucket(s) found.`,
        );
        if (!bucketName && payload.buckets.length > 0) setBucketName(payload.buckets[0]);
      } else {
        setBuckets(null);
        setListNote(payload.reason || 'Bucket listing is not permitted; type the name instead.');
      }
    } catch (listError) {
      setError(listError.message);
    } finally {
      setListing(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          bucketName: bucketName.trim(),
          projectId: projectId.trim(),
          credentialsMode: submittedMode,
          ...(submittedMode === 'key'
            ? replaceKey
              ? { serviceAccountKey: keyText }
              : { keepExistingKey: true }
            : {}),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Could not save the connection.');

      setKeyText(''); // do not keep the private key in component state
      onSaved?.(payload);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    setError('');
    try {
      const response = await fetch('/api/config', { method: 'DELETE', headers: headers() });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Could not disconnect.');
      onSaved?.(payload);
    } catch (disconnectError) {
      setError(disconnectError.message);
    } finally {
      setDisconnecting(false);
    }
  }

  const needsKey = submittedMode === 'key' && replaceKey && !keyText.trim();
  const canSave = Boolean(bucketName.trim()) && !needsKey && !saving;

  return (
    <form onSubmit={save} className="text-gcp-text">
      {/* ---- Credentials ------------------------------------------------ */}
      <fieldset disabled={envCredentials} className="min-w-0">
        <legend className="text-gcp-md font-medium text-gcp-text">Credentials</legend>
        <p className="mt-1 text-gcp-base text-gcp-secondary">
          {envCredentials
            ? 'Credentials are supplied by GOOGLE_APPLICATION_CREDENTIALS in the environment.'
            : 'Objex stores the key on the server and uses it only to reach your bucket.'}
        </p>

        {!envCredentials && (
          <div className="mt-3 space-y-2">
            <label className="flex items-start gap-2 text-gcp-base">
              <input
                type="radio"
                name="credentialsMode"
                checked={mode === 'key'}
                onChange={() => setMode('key')}
                className="mt-0.5 h-4 w-4 accent-[#1a73e8]"
              />
              <span>
                <span className="font-medium">Service account key (JSON)</span>
                <span className="block text-gcp-secondary">
                  Works anywhere, and is what V4 signed download URLs are signed with.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-gcp-base">
              <input
                type="radio"
                name="credentialsMode"
                checked={mode === 'ambient'}
                onChange={() => setMode('ambient')}
                className="mt-0.5 h-4 w-4 accent-[#1a73e8]"
              />
              <span>
                <span className="font-medium">Use this environment&apos;s default credentials</span>
                <span className="block text-gcp-secondary">
                  For Cloud Run, GKE or GCE, where a service account is already attached.
                </span>
              </span>
            </label>
          </div>
        )}

        {!envCredentials && mode === 'key' && (
          <div className="mt-3 rounded border border-gcp-border bg-gcp-canvas p-3">
            {keyIdentity && (
              <p className="mb-2 flex min-w-0 items-center gap-2 text-gcp-base">
                <Icon name="verified_user" size={18} className="shrink-0 text-gcp-green" />
                <span className="truncate font-mono" title={keyIdentity}>
                  {keyIdentity}
                </span>
              </p>
            )}

            {hasStoredKey && !replaceKey ? (
              <div className="flex flex-wrap items-center gap-2 text-gcp-base text-gcp-secondary">
                <span>
                  A key is already saved
                  {status.credentials.privateKeyIdSuffix
                    ? ` (id ending ${status.credentials.privateKeyIdSuffix})`
                    : ''}
                  .
                </span>
                <button
                  type="button"
                  className="gcp-text-button px-2"
                  onClick={() => setReplaceKey(true)}
                >
                  REPLACE KEY
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/json,.json"
                    hidden
                    onChange={handleKeyFile}
                    tabIndex={-1}
                  />
                  <button
                    type="button"
                    className="gcp-outlined-button"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Icon name="upload_file" size={18} />
                    SELECT KEY FILE
                  </button>
                  {keyName && (
                    <span className="truncate text-gcp-base text-gcp-secondary">{keyName}</span>
                  )}
                  {hasStoredKey && (
                    <button
                      type="button"
                      className="gcp-text-button px-2"
                      onClick={() => {
                        setReplaceKey(false);
                        setKeyText('');
                        setKeyName('');
                      }}
                    >
                      KEEP SAVED KEY
                    </button>
                  )}
                </div>

                <label
                  htmlFor="objex-key-text"
                  className="mt-3 block text-gcp-sm text-gcp-secondary"
                >
                  …or paste the key JSON
                </label>
                <textarea
                  id="objex-key-text"
                  value={keyText}
                  onChange={(event) => onPasteKey(event.target.value)}
                  rows={5}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder={'{\n  "type": "service_account",\n  "project_id": "…",\n  "private_key": "-----BEGIN PRIVATE KEY-----…"\n}'}
                  className="gcp-input mt-1 resize-y font-mono text-gcp-sm"
                />
                {keyText.trim() && !parsedKey && (
                  <p className="mt-1 text-gcp-sm text-gcp-red">
                    This is not valid JSON yet — paste the whole file, including the braces.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </fieldset>

      {/* ---- Project ---------------------------------------------------- */}
      <div className="mt-5">
        <label htmlFor="objex-project" className="flex items-center gap-2 text-gcp-md font-medium">
          Project ID
          {envProject && <EnvChip />}
        </label>
        <input
          id="objex-project"
          className="gcp-input mt-1"
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          disabled={envProject}
          placeholder="my-gcp-project"
          autoComplete="off"
        />
      </div>

      {/* ---- Bucket ----------------------------------------------------- */}
      <div className="mt-4">
        <label htmlFor="objex-bucket" className="flex items-center gap-2 text-gcp-md font-medium">
          Bucket
          {envBucket && <EnvChip />}
        </label>
        <div className="mt-1 flex flex-wrap items-start gap-2">
          {buckets && buckets.length > 0 ? (
            <select
              id="objex-bucket"
              className="gcp-input flex-1"
              value={bucketName}
              onChange={(event) => setBucketName(event.target.value)}
              disabled={envBucket}
            >
              {!buckets.includes(bucketName) && bucketName && (
                <option value={bucketName}>{bucketName}</option>
              )}
              {buckets.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="objex-bucket"
              className="gcp-input flex-1"
              value={bucketName}
              onChange={(event) => setBucketName(event.target.value)}
              disabled={envBucket}
              placeholder="my-bucket-name"
              autoComplete="off"
            />
          )}
          <button
            type="button"
            className="gcp-outlined-button"
            onClick={listBuckets}
            disabled={listing || envBucket}
          >
            <Icon name={listing ? 'hourglass_top' : 'search'} size={18} />
            {listing ? 'LISTING…' : 'LIST BUCKETS'}
          </button>
        </div>
        {listNote && <p className="mt-1 text-gcp-sm text-gcp-secondary">{listNote}</p>}
      </div>

      {/* ---- Admin token ------------------------------------------------ */}
      {status?.adminTokenRequired && (
        <div className="mt-4">
          <label htmlFor="objex-admin-token" className="block text-gcp-md font-medium">
            Admin token
          </label>
          <p className="text-gcp-sm text-gcp-secondary">
            This server sets OBJEX_ADMIN_TOKEN, which is required to change the connection.
          </p>
          <input
            id="objex-admin-token"
            type="password"
            className="gcp-input mt-1"
            value={adminToken}
            onChange={(event) => setAdminToken(event.target.value)}
            autoComplete="off"
          />
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded border border-[#f4c7c3] bg-[#fce8e6] px-3 py-2 text-gcp-base text-[#b3261e]"
        >
          <Icon name="error_outline" size={18} className="mt-0.5 shrink-0" />
          <span className="min-w-0">{error}</span>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
        {status?.credentials?.source === 'stored-key' || status?.bucketName ? (
          <button
            type="button"
            className="gcp-text-button mr-auto text-gcp-red hover:bg-[#fce8e6]"
            onClick={disconnect}
            disabled={disconnecting || saving}
          >
            <Icon name="link_off" size={18} />
            {disconnecting ? 'DISCONNECTING…' : 'DISCONNECT'}
          </button>
        ) : null}

        {variant === 'dialog' && (
          <button type="button" className="gcp-text-button" onClick={onClose} disabled={saving}>
            CANCEL
          </button>
        )}
        <button type="submit" className="gcp-filled-button" disabled={!canSave}>
          {saving ? 'VERIFYING…' : status?.configured ? 'SAVE' : 'CONNECT'}
        </button>
      </div>

      <p className="mt-4 text-gcp-sm text-gcp-secondary">
        Objex verifies the credentials against the bucket before saving, so a saved connection is
        always a working one.
      </p>
    </form>
  );
}

function EnvChip() {
  return (
    <span className="rounded bg-[#f1f3f4] px-2 py-0.5 text-gcp-xs font-medium uppercase tracking-wide text-gcp-secondary">
      Managed by environment
    </span>
  );
}

/** Best-effort client-side parse, used only to show the key's identity. */
function parseKeyPreview(text) {
  if (!text?.trim()) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}
