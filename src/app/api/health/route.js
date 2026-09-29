import { NextResponse } from 'next/server';

import { getPublicStatus } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Liveness probe used by the docker-compose healthcheck. It reports whether
 * setup has been completed but never contacts Cloud Storage, so an
 * unconfigured container is still "healthy" and can serve its setup screen.
 */
export async function GET() {
  const status = await getPublicStatus();
  return NextResponse.json({
    status: 'ok',
    configured: status.configured,
    bucket: status.bucketName || null,
    project: status.projectId || null,
    credentials: status.credentials?.source || null,
    time: new Date().toISOString(),
  });
}
