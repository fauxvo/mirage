import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

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

  // URL priority: S3_PUBLIC_URL (r2.dev / custom domain) > proxy route (R2/MinIO) > standard AWS URL
  if (process.env.S3_PUBLIC_URL) {
    return `${process.env.S3_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
  }
  if (process.env.S3_ENDPOINT) {
    // R2/MinIO: use proxy route since buckets aren't publicly accessible by default
    return `/api/textures/${key}`;
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
