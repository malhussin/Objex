import { timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { BadRequestError, UnauthorizedError } from './errors';

const DEFAULT_CONFIG_PATH = path.join(process.cwd(), '.objex', 'config.json');

/** Upper bound on the remembered-bucket list, so it cannot grow without end. */
const MAX_KNOWN_BUCKETS = 50;

/** Where the in-app configuration is persisted. Docker points this at a volume. */
function configPath() {
  return process.env.OBJEX_CONFIG_PATH || DEFAULT_CONFIG_PATH;
}

// Cached by mtime so a request does not re-read and re-parse the file every time.
let cache = { loaded: false, mtimeMs: 0, value: null };

/** The configuration saved through the UI, or null if setup has not run. */
export async function readStoredConfig() {
  const file = configPath();
  try {
    const info = await stat(file);
    if (cache.loaded && cache.mtimeMs === info.mtimeMs) return cache.value;
    const parsed = JSON.parse(await readFile(file, 'utf8'));
    cache = { loaded: true, mtimeMs: info.mtimeMs, value: parsed };
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') {
      cache = { loaded: true, mtimeMs: 0, value: null };
      return null;
    }
    throw error;
  }
}

/** Persists configuration with owner-only permissions (it holds a private key). */
export async function writeStoredConfig(config) {
  const file = configPath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  cache = { loaded: false, mtimeMs: 0, value: null };
}

export async function clearStoredConfig() {
  await rm(configPath(), { force: true });
  cache = { loaded: false, mtimeMs: 0, value: null };
}

/**
 * Validates a pasted service account key.
 *
 * @param {string|object} input raw JSON text or an already-parsed object
 * @returns {object} the parsed key
 */
export function parseServiceAccountKey(input) {
  let key = input;
  if (typeof input === 'string') {
    const text = input.trim();
    if (!text) throw new BadRequestError('Paste the service account key JSON.');
    try {
      key = JSON.parse(text);
    } catch {
      throw new BadRequestError('That is not valid JSON. Paste the whole key file, including the braces.');
    }
  }
  if (!key || typeof key !== 'object') {
    throw new BadRequestError('The service account key must be a JSON object.');
  }
  if (key.type && key.type !== 'service_account') {
    throw new BadRequestError(`Expected a service account key, but this file has type "${key.type}".`);
  }
  if (!key.client_email || !key.private_key) {
    throw new BadRequestError('The key is missing "client_email" or "private_key".');
  }
  if (!String(key.private_key).includes('PRIVATE KEY')) {
    throw new BadRequestError('The "private_key" field does not look like a PEM private key.');
  }
  return key;
}

/**
 * Buckets Objex has been connected to, newest last. Remembering them is what
 * lets the header switcher offer buckets a bucket-scoped service account
 * cannot enumerate.
 */
export function rememberBucket(existing, name) {
  const list = (Array.isArray(existing) ? existing : []).filter(
    (bucket) => typeof bucket === 'string' && bucket,
  );
  return [...new Set([...list, name])].slice(-MAX_KNOWN_BUCKETS);
}

/** Drops one name from the remembered list. Nothing in Cloud Storage changes. */
export function forgetBucket(existing, name) {
  return (Array.isArray(existing) ? existing : []).filter((bucket) => bucket !== name);
}

/**
 * Merges environment variables with the stored configuration.
 *
 * Environment variables win per field, so an operator can pin any part of the
 * configuration in a deployment while everything they leave unset stays
 * editable in the UI.
 */
export async function getEffectiveConfig() {
  const stored = await readStoredConfig();

  const envBucket = (process.env.GCP_BUCKET_NAME || '').trim();
  const envProject = (process.env.GCP_PROJECT_ID || '').trim();
  const envKeyFile = (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();

  const bucketName = envBucket || stored?.bucketName || '';
  const storedKey = stored?.credentialsMode === 'key' ? stored.serviceAccount : null;
  const projectId = envProject || stored?.projectId || storedKey?.project_id || '';

  let credentialsSource = null;
  if (envKeyFile) credentialsSource = 'env-file';
  else if (storedKey) credentialsSource = 'stored-key';
  else if (stored?.credentialsMode === 'ambient') credentialsSource = 'ambient';

  return {
    bucketName,
    projectId,
    knownBuckets: rememberBucket(stored?.knownBuckets, bucketName).filter(Boolean),
    credentials: credentialsSource === 'stored-key' ? storedKey : null,
    credentialsSource,
    configured: Boolean(bucketName && credentialsSource),
    managedBy: {
      bucketName: envBucket ? 'env' : 'app',
      projectId: envProject ? 'env' : 'app',
      credentials: envKeyFile ? 'env' : 'app',
    },
    updatedAt: stored?.updatedAt || null,
  };
}

/** The shape sent to the browser: identity only, never the private key. */
export async function getPublicStatus() {
  const config = await getEffectiveConfig();
  const key = config.credentials;
  return {
    configured: config.configured,
    bucketName: config.bucketName,
    projectId: config.projectId,
    knownBuckets: [...config.knownBuckets].sort(),
    credentials: config.credentialsSource
      ? {
          source: config.credentialsSource,
          clientEmail: key?.client_email || null,
          // Enough to recognize which key is installed, not enough to use it.
          privateKeyIdSuffix: key?.private_key_id ? key.private_key_id.slice(-6) : null,
        }
      : null,
    managedBy: config.managedBy,
    adminTokenRequired: Boolean(process.env.OBJEX_ADMIN_TOKEN),
    updatedAt: config.updatedAt,
  };
}

/**
 * Guards the endpoints that change configuration. Unset OBJEX_ADMIN_TOKEN means
 * no check — the same openness the rest of the app has.
 */
export function assertAdminToken(request) {
  const expected = process.env.OBJEX_ADMIN_TOKEN;
  if (!expected) return;

  const provided = request.headers.get('x-objex-admin-token') || '';
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new UnauthorizedError('Incorrect admin token.');
  }
}
