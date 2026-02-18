import { NextRequest, NextResponse } from 'next/server';
import { getTexture } from '@/lib/s3';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const key = path.join('/');

  if (!key) {
    return NextResponse.json({ error: 'Missing texture path' }, { status: 400 });
  }

  const result = await getTexture(key);

  if (!result) {
    return NextResponse.json({ error: 'Texture not found' }, { status: 404 });
  }

  return new NextResponse(result.body, {
    headers: {
      'Content-Type': result.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
