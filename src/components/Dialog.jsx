'use client';

import { useEffect, useRef } from 'react';

// Only one dialog is ever open at a time, so a fixed id is enough to tie the
// card to its heading.
const TITLE_ID = 'objex-dialog-title';

/** Material modal shell: scrim, centred card, Escape to close. */
export default function Dialog({
  title,
  children,
  actions,
  onClose,
  widthClass = 'max-w-[480px]',
}) {
  const cardRef = useRef(null);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="gcp-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (cardRef.current && !cardRef.current.contains(event.target)) onClose();
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        className={`gcp-dialog w-full ${widthClass} max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-gcp-2`}
      >
        <h2 id={TITLE_ID} className="px-6 pt-6 text-gcp-lg font-normal text-gcp-text">
          {title}
        </h2>
        <div className="px-6 py-4 text-gcp-md text-gcp-secondary">{children}</div>
        {actions && (
          <div className="flex items-center justify-end gap-2 px-6 pb-5 pt-1">{actions}</div>
        )}
      </div>
    </div>
  );
}
