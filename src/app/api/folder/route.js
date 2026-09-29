import { NextResponse } from 'next/server';

import { BadRequestError, errorResponse } from '@/lib/errors';
import { getBucket, sanitizeObjectPath } from '@/lib/gcs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/folder   body: { prefix: string, name: string }
 *
 * GCS has no directories, so a folder is a zero-byte object whose key ends in
 * '/'. Listing with `delimiter: '/'` then reports it as a prefix.
 */
export async function POST(request) {
  try {
    const payload = await request.json().catch(() => {
      throw new BadRequestError('Body must be valid JSON.');
    });

    const prefix = sanitizeObjectPath(payload?.prefix, { directory: true });
    const name = String(payload?.name ?? '').trim();

    if (!name) {
      throw new BadRequestError('Folder name is required.');
    }
    if (name.includes('/')) {
      throw new BadRequestError('Folder name may not contain "/".');
    }

    const path = sanitizeObjectPath(`${prefix}${name}`, {
      allowEmpty: false,
      directory: true,
    });

    const file = (await getBucket()).file(path);
    const [exists] = await file.exists();
    if (exists) {
      throw new BadRequestError('A folder with that name already exists.');
    }

    await file.save('', {
      resumable: false,
      // A zero-byte body has nothing meaningful to checksum.
      validation: false,
      contentType: 'application/x-www-form-urlencoded;charset=UTF-8',
      metadata: { metadata: { createdVia: 'objex' } },
    });

    return NextResponse.json({ path, name }, { status: 201 });
  } catch (error) {
    const { body, status } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}
