import { NextResponse } from 'next/server';
import { isS3Configured } from '@/lib/s3';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    storageConfigured: isS3Configured(),
  });
}
