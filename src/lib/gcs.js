import { Storage } from '@google-cloud/storage';

import { getEffectiveConfig } from './config';
import { BadRequestError, ConfigError } from './errors';

// One client per distinct credential set, so normal requests reuse a warm
// client but re-configuring in the UI takes effect on the next request.
const clients = new Map();

function clientKey(config) {
  return [
    config.projectId || '-',
    config.credentialsSource || '-',
    config.credentials?.private_key_id || config.credentials?.client_email || '-',
  ].join('|');
}

/**
 * Builds a Storage client for an explicit credential set.
 * Used both for live requests and for validating credentials during setup.
 */
function createStorage({ projectId, credentials }) {
  return new Storage({
    ...(projectId ? { projectId } : {}),
    // With no credentials the client falls back to Application Default
    // Credentials (a mounted key file, or the service account attached to the
    // GCP runtime).
    ...(credentials ? { credentials } : {}),
  });
}

function getStorageFor(config) {
  const key = clientKey(config);
  let client = clients.get(key);
  if (!client) {
    client = createStorage(config);
    clients.set(key, client);
  }
  return client;
}

/**
 * The bucket Objex is configured to manage.
 * @returns {Promise<{ bucket: import('@google-cloud/storage').Bucket, bucketName: string, config: object }>}
 */
export async function getBucketContext() {
  const config = await getEffectiveConfig();
  if (!config.bucketName) {
    throw new ConfigError('No bucket is configured yet. Open Objex settings to connect one.');
  }
  if (!config.credentialsSource) {
    throw new ConfigError('No credentials are configured yet. Open Objex settings to add a service account key.');
  }
  return {
    bucket: getStorageFor(config).bucket(config.bucketName),
    bucketName: config.bucketName,
    config,
  };
}

/** Convenience wrapper for routes that only need the bucket handle. */
export async function getBucket() {
  return (await getBucketContext()).bucket;
}

const CONTROL_CHARS = /[\x00-\x1f\x7f]/;

/**
 * Normalizes an object key coming from the browser and refuses anything that
 * tries to escape the bucket root or smuggle control characters.
 *
 * @param {unknown} value raw path from the request
 * @param {{ allowEmpty?: boolean, directory?: boolean }} options
 * @returns {string} a clean key, '' for the bucket root
 */
export function sanitizeObjectPath(value, { allowEmpty = true, directory = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (allowEmpty) return '';
    throw new BadRequestError('A path is required.');
  }
  if (typeof value !== 'string') {
    throw new BadRequestError('Path must be a string.');
  }

  // Collapse duplicate slashes and strip a leading one; GCS keys are relative.
  let key = value.replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\//, '');

  if (key.length > 1024) {
    throw new BadRequestError('Path is too long.');
  }
  if (CONTROL_CHARS.test(key)) {
    throw new BadRequestError('Path contains control characters.');
  }
  if (key.split('/').some((segment) => segment === '.' || segment === '..')) {
    throw new BadRequestError('Path may not contain relative segments.');
  }

  if (directory && key !== '' && !key.endsWith('/')) {
    key += '/';
  }
  if (!allowEmpty && key === '') {
    throw new BadRequestError('A path is required.');
  }
  return key;
}

/**
 * Confirms a credential set can actually list the bucket — the permission every
 * Objex screen depends on. Returns a human-readable reason instead of throwing.
 *
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function probeBucketAccess({ projectId, credentials, bucketName }) {
  try {
    const storage = createStorage({ projectId, credentials });
    await storage.bucket(bucketName).getFiles({ maxResults: 1, autoPaginate: false });
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: describeAccessError(error, bucketName) };
  }
}

/**
 * Lists the buckets a credential set can see, for the setup dropdown.
 * Listing needs project-level `storage.buckets.list`, which a bucket-scoped
 * service account will not have — that is reported, not treated as fatal.
 */
export async function listBuckets({ projectId, credentials }) {
  try {
    const storage = createStorage({ projectId, credentials });
    const [buckets] = await storage.getBuckets();
    return { listable: true, buckets: buckets.map((bucket) => bucket.name).sort() };
  } catch (error) {
    return { listable: false, buckets: [], reason: describeAccessError(error) };
  }
}

function describeAccessError(error, bucketName) {
  const status = Number(error?.code);
  const message = error?.message || 'Unknown error.';
  if (status === 401) {
    return 'Google rejected these credentials. Check that the key is current and has not been disabled.';
  }
  if (status === 403) {
    return bucketName
      ? `The service account cannot list objects in "${bucketName}". Grant it roles/storage.objectAdmin on the bucket.`
      : 'The service account is not allowed to list buckets in this project.';
  }
  if (status === 404) {
    return bucketName
      ? `Bucket "${bucketName}" does not exist, or belongs to another project.`
      : 'Not found.';
  }
  return message;
}
