import { NextResponse } from 'next/server';

import { errorResponse } from '@/lib/errors';
import { basename, describeContentType } from '@/lib/format';
import { getBucketContext, sanitizeObjectPath } from '@/lib/gcs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 500;

/**
 * GET /api/files?prefix=images/2026/&pageToken=...
 *
 * Lists one "directory" at a time. `delimiter: '/'` makes GCS roll everything
 * below the current level up into `apiResponse.prefixes`, so we get real folder
 * behaviour instead of a flat dump of every object in the bucket.
 */
export async function GET(request) {
  try {
    const params = request.nextUrl.searchParams;
    const prefix = sanitizeObjectPath(params.get('prefix'), { directory: true });
    const pageToken = params.get('pageToken') || undefined;

    const { bucket, bucketName } = await getBucketContext();
    const [files, , apiResponse] = await bucket.getFiles({
      prefix,
      delimiter: '/',
      autoPaginate: false,
      maxResults: PAGE_SIZE,
      pageToken,
    });

    const folders = (apiResponse?.prefixes || []).map((folderPrefix) => ({
      kind: 'folder',
      name: basename(folderPrefix),
      path: folderPrefix,
    }));

    const objects = files
      // A folder placeholder is a zero-byte object whose key *is* the prefix;
      // it represents the current directory, not an entry inside it.
      .filter((file) => file.name !== prefix && !file.name.endsWith('/'))
      .map((file) => ({
        kind: 'file',
        name: basename(file.name),
        path: file.name,
        size: Number(file.metadata?.size ?? 0),
        contentType: describeContentType(file.metadata?.contentType, file.name),
        updated: file.metadata?.updated ?? null,
        storageClass: file.metadata?.storageClass ?? null,
        generation: file.metadata?.generation ?? null,
      }));

    return NextResponse.json({
      bucket: bucketName,
      prefix,
      folders,
      files: objects,
      nextPageToken: apiResponse?.nextPageToken ?? null,
    });
  } catch (error) {
    const { body, status } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}
