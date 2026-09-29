import { NextResponse } from 'next/server';

import {
  assertAdminToken,
  forgetBucket,
  getEffectiveConfig,
  getPublicStatus,
  parseServiceAccountKey,
  readStoredConfig,
  writeStoredConfig,
} from '@/lib/config';
import { BadRequestError, errorResponse } from '@/lib/errors';
import { listBuckets } from '@/lib/gcs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/buckets — buckets visible to a credential set, for the setup
 * dropdown.
 *
 * body: { serviceAccountKey?, projectId?, credentialsMode? }
 *       — omit everything to probe with the saved configuration.
 *
 * Listing requires project-level `storage.buckets.list`. A bucket-scoped
 * service account will not have it, so `listable: false` comes back with the
 * reason and the UI falls back to typing the name.
 */
export async function POST(request) {
  try {
    assertAdminToken(request);

    const payload = await request.json().catch(() => ({}));
    const stored = await getEffectiveConfig();

    let credentials = null;
    if (payload?.credentialsMode === 'ambient') {
      credentials = null;
    } else if (payload?.serviceAccountKey) {
      credentials = parseServiceAccountKey(payload.serviceAccountKey);
    } else {
      credentials = stored.credentials;
    }

    const projectId =
      String(payload?.projectId ?? '').trim() || credentials?.project_id || stored.projectId;

    if (!projectId) {
      return NextResponse.json(
        { listable: false, buckets: [], reason: 'A project ID is needed to list buckets.' },
        { status: 200 },
      );
    }

    return NextResponse.json(await listBuckets({ projectId, credentials }));
  } catch (error) {
    const { body, status } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}

/**
 * DELETE /api/buckets?name=my-bucket
 *
 * Removes a bucket from the remembered list shown in the header switcher.
 * This only edits Objex's own configuration — the bucket and its contents in
 * Cloud Storage are untouched.
 */
export async function DELETE(request) {
  try {
    assertAdminToken(request);

    const name = (request.nextUrl.searchParams.get('name') || '').trim();
    if (!name) {
      throw new BadRequestError('Provide the bucket name to forget.');
    }

    const stored = await readStoredConfig();
    if (!stored) {
      return NextResponse.json(await getPublicStatus());
    }
    if (name === stored.bucketName) {
      throw new BadRequestError('Switch to another bucket before forgetting this one.');
    }

    await writeStoredConfig({
      ...stored,
      knownBuckets: forgetBucket(stored.knownBuckets, name),
    });

    return NextResponse.json(await getPublicStatus());
  } catch (error) {
    const { body, status } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}
