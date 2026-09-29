'use client';

import Icon from './Icon';
import { breadcrumbSegments, parentPrefix } from '@/lib/format';

/**
 * GCP-style breadcrumb trail: Objex / bucket-name / images / 2026
 * Every segment except the last navigates up the tree.
 */
export default function Breadcrumbs({ bucketName, prefix, onNavigate }) {
  const segments = breadcrumbSegments(prefix);
  const trail = [
    { label: 'Objex', prefix: '', key: 'root' },
    { label: bucketName, prefix: '', key: 'bucket' },
    ...segments.map((segment) => ({ ...segment, key: segment.prefix })),
  ];

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 py-1">
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-gcp-md">
        {trail.map((crumb, index) => {
          const isLast = index === trail.length - 1;
          return (
            <li key={crumb.key} className="flex min-w-0 items-center gap-1">
              {index > 0 && (
                <span className="select-none px-0.5 text-gcp-secondary" aria-hidden="true">
                  /
                </span>
              )}
              {isLast ? (
                <span
                  className="max-w-[280px] truncate font-medium text-gcp-text"
                  aria-current="page"
                >
                  {crumb.label}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate(crumb.prefix)}
                  className="max-w-[240px] truncate rounded px-1 text-gcp-blue hover:underline"
                >
                  {crumb.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>

      {prefix && (
        <button
          type="button"
          onClick={() => onNavigate(parentPrefix(prefix))}
          className="gcp-text-button ml-2 shrink-0 px-2"
          title="Up one level"
        >
          <Icon name="arrow_upward" size={16} />
          UP
        </button>
      )}
    </nav>
  );
}
