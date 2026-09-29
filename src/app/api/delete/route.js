import { NextResponse } from 'next/server';

import { BadRequestError, errorResponse } from '@/lib/errors';
import { getBucket, sanitizeObjectPath } from '@/lib/gcs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_PATHS = 1000;

/**
 * POST /api/delete   body: { paths: string[] }
 *
 * A path ending in '/' is treated as a folder: every object under that prefix
 * is deleted. Anything else is deleted as a single object.
 */
export async function POST(request) {
  try {
    const payload = await request.json().catch(() => {
      throw new BadRequestError('Body must be valid JSON.');
    });

    const rawPaths = payload?.paths;
    if (!Array.isArray(rawPaths) || rawPaths.length === 0) {
      throw new BadRequestError('Provide a non-empty "paths" array.');
    }
    if (rawPaths.length > MAX_PATHS) {
      throw new BadRequestError(`Cannot delete more than ${MAX_PATHS} paths in one request.`);
    }

    const bucket = await getBucket();
    const deleted = [];
    const failed = [];

    for (const raw of rawPaths) {
      const path = sanitizeObjectPath(raw, { allowEmpty: false });
      try {
        if (path.endsWith('/')) {
          await bucket.deleteFiles({ prefix: path, force: true });
          // Remove the folder placeholder object itself, if one exists.
          await bucket.file(path).delete({ ignoreNotFound: true });
          deleted.push({ path, kind: 'folder' });
        } else {
          await bucket.file(path).delete({ ignoreNotFound: true });
          deleted.push({ path, kind: 'file' });
        }
      } catch (error) {
        failed.push({ path, error: error?.message || 'Delete failed.' });
      }
    }

    return NextResponse.json(
      { deleted, failed, count: deleted.length },
      { status: failed.length > 0 ? 207 : 200 },
    );
  } catch (error) {
    const { body, status } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}
