'use client';

import { useEffect, useRef, useState } from 'react';

import Icon from './Icon';

/**
 * The blue console app bar: Objex wordmark, bucket switcher, search field, and
 * the account cluster.
 *
 * The help and notification icons are deliberately inert — Objex exposes file
 * operations only. The gear and the account menu open the connection settings.
 */
export default function Header({
  search,
  onSearchChange,
  onOpenSettings,
  bucketName,
  buckets,
  knownBuckets = [],
  bucketsLoading,
  bucketsNote,
  canSwitchBucket = true,
  switchingBucket = false,
  onOpenBucketMenu,
  onSwitchBucket,
  onForgetBucket,
  userEmail = 'admin@objex.app',
}) {
  const [bucketOpen, setBucketOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newBucket, setNewBucket] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const bucketRef = useRef(null);
  const accountRef = useRef(null);

  useEffect(() => {
    function onPointerDown(event) {
      if (bucketRef.current && !bucketRef.current.contains(event.target)) setBucketOpen(false);
      if (accountRef.current && !accountRef.current.contains(event.target)) setAccountOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setBucketOpen(false);
        setAccountOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  function toggleBucketMenu() {
    const opening = !bucketOpen;
    setBucketOpen(opening);
    setAdding(false);
    setNewBucket('');
    // Buckets are fetched when the menu opens, not on every page load.
    if (opening) onOpenBucketMenu?.();
  }

  function closeAndSwitch(name) {
    setBucketOpen(false);
    setAdding(false);
    setNewBucket('');
    if (name !== bucketName) onSwitchBucket?.(name);
  }

  function submitNewBucket(event) {
    event.preventDefault();
    const name = newBucket.trim();
    if (name) closeAndSwitch(name);
  }

  // Buckets Objex has connected to before, plus anything the credentials can
  // enumerate right now. Remembered ones come first and can be forgotten.
  const remembered = [...new Set([bucketName, ...knownBuckets])].filter(Boolean).sort();
  const alsoListed = (buckets || []).filter((name) => !remembered.includes(name)).sort();

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-2 bg-gcp-blue px-3 text-white sm:px-4">
      <div className="flex shrink-0 items-center gap-2">
        <Icon name="folder_shared" size={22} className="text-white/95" />
        <span className="text-[20px] font-medium leading-none tracking-[-0.2px] text-white">
          Objex
        </span>
      </div>

      {/* Bucket switcher — the buckets these credentials can see. */}
      <div ref={bucketRef} className="relative ml-1 shrink-0 sm:ml-3">
        <button
          type="button"
          onClick={toggleBucketMenu}
          aria-haspopup="listbox"
          aria-expanded={bucketOpen}
          aria-label={`Bucket: ${bucketName}. Switch bucket`}
          className="flex h-8 max-w-[150px] items-center gap-1 rounded border border-white/40 px-2 text-gcp-md text-white transition-colors hover:bg-white/10 sm:max-w-[280px] sm:px-3"
        >
          <Icon name="storage" size={18} className="hidden shrink-0 sm:block" />
          <span className="truncate">{bucketName}</span>
          <Icon
            name={switchingBucket ? 'hourglass_top' : 'arrow_drop_down'}
            size={20}
            className="shrink-0"
          />
        </button>

        {bucketOpen && (
          <div
            className="gcp-menu gcp-fade-in absolute left-0 top-10 max-h-[70vh] w-[320px] overflow-y-auto text-gcp-text"
            role="listbox"
            aria-label="Buckets"
          >
            <p className="px-4 pb-2 text-gcp-sm font-medium uppercase tracking-wide text-gcp-secondary">
              Bucket
            </p>

            {bucketsLoading && (
              <p className="flex items-center gap-2 px-4 py-2 text-gcp-base text-gcp-secondary">
                <Icon name="hourglass_top" size={18} />
                Loading buckets…
              </p>
            )}

            {remembered.map((name) => {
              const current = name === bucketName;
              return (
                <div key={name} className="group relative flex items-center">
                  <button
                    type="button"
                    role="option"
                    aria-selected={current}
                    disabled={(!canSwitchBucket && !current) || switchingBucket}
                    className="gcp-menu-item flex-1 pr-10"
                    onClick={() => closeAndSwitch(name)}
                  >
                    <Icon
                      name={current ? 'check' : 'storage'}
                      size={18}
                      className={current ? 'text-gcp-blue' : 'text-gcp-secondary'}
                    />
                    <span className="truncate" title={name}>
                      {name}
                    </span>
                  </button>
                  {!current && onForgetBucket && (
                    <button
                      type="button"
                      onClick={() => onForgetBucket(name)}
                      disabled={switchingBucket}
                      aria-label={`Remove ${name} from this list`}
                      // Removing here only forgets the name; nothing in Cloud
                      // Storage is touched.
                      title="Remove from this list (the bucket itself is not deleted)"
                      className="absolute right-2 rounded-full p-1 text-[#9aa0a6] transition-colors hover:bg-[#e8eaed] hover:text-gcp-text"
                    >
                      <Icon name="close" size={16} />
                    </button>
                  )}
                </div>
              );
            })}

            {alsoListed.length > 0 && (
              <>
                <p className="px-4 pb-1 pt-2 text-gcp-sm text-gcp-secondary">In this project</p>
                {alsoListed.map((name) => (
                  <button
                    key={name}
                    type="button"
                    role="option"
                    aria-selected="false"
                    disabled={!canSwitchBucket || switchingBucket}
                    className="gcp-menu-item"
                    onClick={() => closeAndSwitch(name)}
                  >
                    <Icon name="storage" size={18} className="text-gcp-secondary" />
                    <span className="truncate" title={name}>
                      {name}
                    </span>
                  </button>
                ))}
              </>
            )}

            {!bucketsLoading && bucketsNote && (
              <p className="px-4 pb-1 pt-2 text-gcp-sm text-gcp-secondary">{bucketsNote}</p>
            )}

            {canSwitchBucket && (
              <>
                <div className="my-1 border-t border-gcp-divider" />
                {adding ? (
                  <form onSubmit={submitNewBucket} className="px-4 py-2">
                    <label
                      htmlFor="objex-add-bucket"
                      className="mb-1 block text-gcp-sm text-gcp-secondary"
                    >
                      Bucket name
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="objex-add-bucket"
                        autoFocus
                        value={newBucket}
                        onChange={(event) => setNewBucket(event.target.value)}
                        placeholder="my-other-bucket"
                        autoComplete="off"
                        spellCheck={false}
                        className="gcp-input py-1"
                      />
                      <button
                        type="submit"
                        className="gcp-filled-button shrink-0 px-3"
                        disabled={!newBucket.trim() || switchingBucket}
                      >
                        OPEN
                      </button>
                    </div>
                    <p className="mt-1 text-gcp-sm text-gcp-secondary">
                      Any bucket these credentials can reach, in any project.
                    </p>
                  </form>
                ) : (
                  <button type="button" className="gcp-menu-item" onClick={() => setAdding(true)}>
                    <Icon name="add" size={18} className="text-gcp-secondary" />
                    Add another bucket…
                  </button>
                )}
              </>
            )}

            {!canSwitchBucket && (
              <p className="px-4 pb-1 pt-2 text-gcp-sm text-gcp-secondary">
                The bucket is pinned by <span className="font-mono">GCP_BUCKET_NAME</span> in the
                environment.
              </p>
            )}

            <div className="my-1 border-t border-gcp-divider" />
            <button
              type="button"
              className="gcp-menu-item"
              onClick={() => {
                setBucketOpen(false);
                onOpenSettings?.();
              }}
            >
              <Icon name="settings" size={18} className="text-gcp-secondary" />
              Connection settings
            </button>
          </div>
        )}
      </div>

      {/* Search — filters the objects listed in the current folder. */}
      <div className="mx-auto flex w-full max-w-[720px] items-center">
        <div className="flex h-8 w-full items-center gap-2 rounded bg-white px-3 shadow-none">
          <Icon name="search" size={20} className="shrink-0 text-gcp-secondary" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            type="search"
            placeholder="Search for files and folders in this bucket"
            aria-label="Search for files and folders in this bucket"
            className="w-full bg-transparent text-gcp-md text-gcp-text outline-none placeholder:text-gcp-secondary"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
              className="shrink-0 text-gcp-secondary hover:text-gcp-text"
            >
              <Icon name="close" size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onOpenSettings}
          className="gcp-icon-button hover:bg-white/10"
          aria-label="Connection settings"
          title="Connection settings"
        >
          <Icon name="settings" size={22} />
        </button>
        <button
          type="button"
          className="gcp-icon-button hidden hover:bg-white/10 sm:inline-flex"
          aria-label="Help"
        >
          <Icon name="help_outline" size={22} />
        </button>
        <button
          type="button"
          className="gcp-icon-button hidden hover:bg-white/10 sm:inline-flex"
          aria-label="Notifications"
        >
          <Icon name="notifications_none" size={22} />
        </button>

        <div ref={accountRef} className="relative">
          <button
            type="button"
            onClick={() => setAccountOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={accountOpen}
            aria-label={`Connected as ${userEmail}`}
            className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-white/25 text-gcp-md font-medium uppercase text-white ring-1 ring-white/40 transition-colors hover:bg-white/35"
          >
            {userEmail.charAt(0)}
          </button>
          {accountOpen && (
            <div className="gcp-menu gcp-fade-in absolute right-0 top-11 w-[260px] text-gcp-text" role="menu">
              <div className="flex items-center gap-3 px-4 pb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gcp-blue text-gcp-md font-medium uppercase text-white">
                  {userEmail.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-gcp-base font-medium">Service account</p>
                  <p className="truncate text-gcp-sm text-gcp-secondary">{userEmail}</p>
                </div>
              </div>
              <div className="my-1 border-t border-gcp-divider" />
              <button
                type="button"
                role="menuitem"
                className="gcp-menu-item"
                onClick={() => {
                  setAccountOpen(false);
                  onOpenSettings?.();
                }}
              >
                <Icon name="settings" size={18} className="text-gcp-secondary" />
                Connection settings
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
