import { NextResponse } from 'next/server';

import { BadRequestError, errorResponse } from '@/lib/errors';
import { basename } from '@/lib/format';
import { getBucket, sanitizeObjectPath } from '@/lib/gcs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TTL_MS = 15 * 60 * 1000;

/**
 * GET /api/download?file=images/2026/photo.png
 *
 * Returns a V4 signed URL instead of proxying bytes: the browser then pulls the
 * object straight from Cloud Storage, so large downloads never pass through
 * this container.
 */
export async function GET(request) {
  try {
    const path = sanitizeObjectPath(request.nextUrl.searchParams.get('file'), {
      allowEmpty: false,
    });
    if (path.endsWith('/')) {
      throw new BadRequestError('Folders cannot be downloaded directly.');
    }

    const file = (await getBucket()).file(path);
    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json({ error: 'Object not found.' }, { status: 404 });
    }

    const expires = Date.now() + TTL_MS;
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires,
      // Makes the browser save the file under its original name.
      responseDisposition: `attachment; filename="${basename(path).replace(/"/g, '')}"`,
    });

    return NextResponse.json({
      url,
      path,
      filename: basename(path),
      expiresAt: new Date(expires).toISOString(),
    });
  } catch (error) {
    const { body, status } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}
