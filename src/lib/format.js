const EM_DASH = '—';

/** Human-readable byte counts, matching how the GCP console labels sizes. */
export function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return EM_DASH;
  if (value === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const scaled = value / 1024 ** exponent;
  const digits = exponent === 0 ? 0 : scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  return `${scaled.toFixed(digits)} ${units[exponent]}`;
}

/** e.g. "Sep 12, 2026, 6:08:41 PM" — the console's "Last modified" format. */
export function formatTimestamp(iso) {
  if (!iso) return EM_DASH;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return EM_DASH;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

const EXTENSION_LABELS = {
  csv: 'text/csv',
  gz: 'application/gzip',
  html: 'text/html',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  js: 'text/javascript',
  json: 'application/json',
  md: 'text/markdown',
  mp4: 'video/mp4',
  pdf: 'application/pdf',
  png: 'image/png',
  svg: 'image/svg+xml',
  txt: 'text/plain',
  webp: 'image/webp',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  zip: 'application/zip',
};

/** Falls back to the extension when GCS reports no contentType. */
export function describeContentType(contentType, name) {
  if (contentType) return contentType;
  const ext = name?.split('.').pop()?.toLowerCase();
  if (ext && EXTENSION_LABELS[ext]) return EXTENSION_LABELS[ext];
  return 'application/octet-stream';
}

/** Material icon ligature for a given object, picked from its content type. */
export function iconForObject(contentType, name) {
  const type = describeContentType(contentType, name);
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'movie';
  if (type.startsWith('audio/')) return 'audiotrack';
  if (type === 'application/pdf') return 'picture_as_pdf';
  if (type === 'application/zip' || type === 'application/gzip') return 'folder_zip';
  if (type.startsWith('text/') || type === 'application/json' || type === 'application/yaml') {
    return 'description';
  }
  return 'insert_drive_file';
}

/**
 * Turns a prefix into breadcrumb segments.
 * 'images/2026/' -> [{ label: 'images', prefix: 'images/' }, { label: '2026', prefix: 'images/2026/' }]
 */
export function breadcrumbSegments(prefix) {
  if (!prefix) return [];
  return prefix
    .split('/')
    .filter(Boolean)
    .map((label, index, all) => ({
      label,
      prefix: `${all.slice(0, index + 1).join('/')}/`,
    }));
}

/** Last path segment of an object key ('a/b/c.txt' -> 'c.txt'). */
export function basename(key) {
  const parts = key.replace(/\/$/, '').split('/');
  return parts[parts.length - 1] || key;
}

/** Parent prefix of a key ('a/b/c.txt' -> 'a/b/'). */
export function parentPrefix(key) {
  const trimmed = key.replace(/\/$/, '');
  const index = trimmed.lastIndexOf('/');
  return index === -1 ? '' : trimmed.slice(0, index + 1);
}
