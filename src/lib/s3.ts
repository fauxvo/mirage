import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';

function getS3Client(): S3Client | null {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) return null;

  return new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
  });
}

export function isS3Configured(): boolean {
  return !!process.env.S3_BUCKET;
}

export async function uploadTexture(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const client = getS3Client();
  if (!client) throw new Error('S3 not configured');

  const bucket = process.env.S3_BUCKET!;
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  // URL priority: proxy route (R2/MinIO, same-origin) > S3_PUBLIC_URL (CDN) > standard AWS URL
  // When S3_ENDPOINT is set (R2/MinIO), always use the proxy route. Cross-origin URLs
  // from S3_PUBLIC_URL can't be used as WebGL textures without CORS headers on the
  // remote server, but the same-origin proxy works universally.
  if (process.env.S3_ENDPOINT) {
    return `/api/textures/${key}`;
  }
  if (process.env.S3_PUBLIC_URL) {
    let publicUrl = process.env.S3_PUBLIC_URL.replace(/\/$/, '');
    if (!/^https?:\/\//i.test(publicUrl)) {
      publicUrl = `https://${publicUrl}`;
    }
    return `${publicUrl}/${key}`;
  }
  return `https://${bucket}.s3.${process.env.S3_REGION || 'us-east-1'}.amazonaws.com/${key}`;
}

export async function getTexture(key: string): Promise<{
  body: ReadableStream;
  contentType: string;
} | null> {
  const client = getS3Client();
  if (!client) return null;

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: key,
      })
    );

    if (!response.Body) return null;

    return {
      body: response.Body.transformToWebStream(),
      contentType: response.ContentType || 'application/octet-stream',
    };
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'name' in err && err.name === 'NoSuchKey') {
      return null;
    }
    throw err;
  }
}

export async function deleteTexture(key: string): Promise<void> {
  const client = getS3Client();
  if (!client) return;

  await client.send(
    new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
    })
  );
}
