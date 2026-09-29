import { NextResponse } from 'next/server';

import {
  assertAdminToken,
  clearStoredConfig,
  getEffectiveConfig,
  getPublicStatus,
  parseServiceAccountKey,
  rememberBucket,
  readStoredConfig,
  writeStoredConfig,
} from '@/lib/config';
import { BadRequestError, errorResponse } from '@/lib/errors';
import { probeBucketAccess } from '@/lib/gcs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/config — what Objex is connected to. Never returns the private key. */
export async function GET() {
  try {
    return NextResponse.json(await getPublicStatus());
  } catch (error) {
    const { body, status } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}

/**
 * POST /api/config — save the connection entered in the UI.
 *
 * body: {
 *   bucketName: string,
 *   projectId?: string,
 *   credentialsMode: 'key' | 'ambient',
 *   serviceAccountKey?: string | object,   // required for 'key', unless keepExistingKey
 *   keepExistingKey?: boolean
 * }
 *
 * The credentials are tested against the bucket before anything is written, so
 * a saved configuration is always one that actually works.
 */
export async function POST(request) {
  try {
    assertAdminToken(request);

    const payload = await request.json().catch(() => {
      throw new BadRequestError('Body must be valid JSON.');
    });

    const bucketName = String(payload?.bucketName ?? '').trim();
    if (!bucketName) {
      throw new BadRequestError('Enter the name of the bucket to manage.');
    }
    if (!/^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/.test(bucketName)) {
      throw new BadRequestError(
        'That is not a valid bucket name. Use the bucket name only, without "gs://" or a path.',
      );
    }

    const mode = payload?.credentialsMode === 'ambient' ? 'ambient' : 'key';
    const stored = await readStoredConfig();

    let serviceAccount = null;
    if (mode === 'key') {
      if (payload?.keepExistingKey) {
        serviceAccount = stored?.credentialsMode === 'key' ? stored.serviceAccount : null;
        if (!serviceAccount) {
          throw new BadRequestError('There is no saved key to keep. Paste a service account key.');
        }
      } else {
        serviceAccount = parseServiceAccountKey(payload?.serviceAccountKey);
      }
    }

    const projectId =
      String(payload?.projectId ?? '').trim() || serviceAccount?.project_id || '';

    // Verify before persisting: listing objects is what every screen needs.
    const probe = await probeBucketAccess({
      projectId,
      credentials: serviceAccount,
      bucketName,
    });
    if (!probe.ok) {
      return NextResponse.json({ error: probe.reason, verified: false }, { status: 400 });
    }

    await writeStoredConfig({
      version: 1,
      bucketName,
      projectId,
      credentialsMode: mode,
      serviceAccount,
      // Every bucket that verifies is remembered, so the header switcher can
      // offer it later even if the credentials cannot list buckets.
      knownBuckets: rememberBucket(stored?.knownBuckets, bucketName),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ...(await getPublicStatus()), verified: true }, { status: 200 });
  } catch (error) {
    const { body, status } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}

/**
 * DELETE /api/config — forget the saved connection, including the stored key.
 * Environment-provided values are untouched; they are not ours to remove.
 */
export async function DELETE(request) {
  try {
    assertAdminToken(request);
    await clearStoredConfig();

    const config = await getEffectiveConfig();
    return NextResponse.json({
      ...(await getPublicStatus()),
      // True when env vars still supply a working configuration.
      stillConfiguredByEnvironment: config.configured,
    });
  } catch (error) {
    const { body, status } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}
