import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { NextResponse } from 'next/server';

import { BadRequestError, errorResponse } from '@/lib/errors';
import { getBucket, sanitizeObjectPath } from '@/lib/gcs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/upload  (multipart/form-data)
 *
 * Fields:
 *   prefix  - destination directory, '' for the bucket root
 *   files   - one or more File parts
 *   paths   - optional, one per file, in the same order; carries the browser's
 *             webkitRelativePath so "upload folder" keeps its tree
 *
 * Each part is streamed straight into GCS rather than buffered whole.
 */
export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      throw new BadRequestError('Expected multipart/form-data.');
    }

    const form = await request.formData();
    const prefix = sanitizeObjectPath(form.get('prefix'), { directory: true });
    const parts = form.getAll('files').filter((part) => typeof part?.stream === 'function');
    const relativePaths = form.getAll('paths').map((value) => String(value));

    if (parts.length === 0) {
      throw new BadRequestError('No files were included in the request.');
    }

    const bucket = await getBucket();
    const uploaded = [];

    for (const [index, part] of parts.entries()) {
      const relative = relativePaths[index] || part.name;
      // Sanitize the relative path on its own first, so a hostile
      // "../../secret" can never be joined onto the destination prefix.
      const safeRelative = sanitizeObjectPath(relative, { allowEmpty: false });
      const destination = `${prefix}${safeRelative}`;
      const file = bucket.file(destination);

      await pipeline(
        Readable.fromWeb(part.stream()),
        file.createWriteStream({
          resumable: false,
          contentType: part.type || 'application/octet-stream',
          metadata: {
            cacheControl: 'private, max-age=0',
            metadata: { uploadedVia: 'objex' },
          },
        }),
      );

      uploaded.push({ path: destination, size: part.size ?? null });
    }

    return NextResponse.json({ uploaded, count: uploaded.length }, { status: 201 });
  } catch (error) {
    const { body, status } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}
