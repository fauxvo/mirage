import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/auth-guards', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/s3', () => ({
  isS3Configured: vi.fn(),
  uploadTexture: vi.fn(),
}));

vi.mock('@/db/repositories/set.repository', () => ({
  setRepository: { findById: vi.fn() },
}));

vi.mock('@/db/repositories/cue.repository', () => ({
  cueRepository: { findBySetIdAndId: vi.fn(), update: vi.fn() },
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('abc12345'),
}));

import { POST } from './route';
import { requireAuth } from '@/lib/auth/auth-guards';
import { isS3Configured, uploadTexture } from '@/lib/s3';
import { setRepository } from '@/db/repositories/set.repository';

const mockRequireAuth = vi.mocked(requireAuth);
const mockIsS3Configured = vi.mocked(isS3Configured);
const mockUploadTexture = vi.mocked(uploadTexture);
const mockFindById = vi.mocked(setRepository.findById);

const session = { userId: 'user-1', username: 'admin', role: 'admin' as const };

function makeFile(name: string, type: string, sizeOverride?: number): File {
  const content = new TextEncoder().encode('data');
  const file = new File([content], name, { type });
  // jsdom's File may lack arrayBuffer() — polyfill it
  if (typeof file.arrayBuffer !== 'function') {
    file.arrayBuffer = () => Promise.resolve(content.buffer as ArrayBuffer);
  }
  if (sizeOverride !== undefined) {
    Object.defineProperty(file, 'size', { value: sizeOverride });
  }
  return file;
}

function makeRequest(file: File | null, headers: Record<string, string> = {}) {
  // jsdom's FormData.get() doesn't return objects with arrayBuffer(),
  // so we create a mock FormData that returns the original File directly
  const mockFormData = {
    get: (key: string) => (key === 'file' ? file : null),
  };

  const request = {
    headers: {
      get: (key: string) => headers[key] ?? null,
    },
    formData: () => Promise.resolve(mockFormData),
  };
  return request as never;
}

describe('POST /api/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ session, error: null });
    mockIsS3Configured.mockReturnValue(true);
    mockFindById.mockResolvedValue({ id: 'set-1', userId: 'user-1' } as never);
    mockUploadTexture.mockResolvedValue('https://s3.example.com/textures/set-1/abc12345.png');
  });

  it('accepts image files under 10MB', async () => {
    const file = makeFile('test.png', 'image/png');
    const res = await POST(makeRequest(file, { 'x-set-id': 'set-1' }));
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(mockUploadTexture).toHaveBeenCalledWith(
      'textures/set-1/abc12345.png',
      expect.any(Uint8Array),
      'image/png',
      expect.any(Number)
    );
  });

  it('accepts video files under 250MB', async () => {
    const file = makeFile('clip.mp4', 'video/mp4');
    mockUploadTexture.mockResolvedValue('https://s3.example.com/videos/set-1/abc12345.mp4');
    const res = await POST(makeRequest(file, { 'x-set-id': 'set-1' }));
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(mockUploadTexture).toHaveBeenCalledWith(
      'videos/set-1/abc12345.mp4',
      expect.any(Uint8Array),
      'video/mp4',
      expect.any(Number)
    );
  });

  it('rejects non-image non-video files', async () => {
    const file = makeFile('doc.pdf', 'application/pdf');
    const res = await POST(makeRequest(file, { 'x-set-id': 'set-1' }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain('image or video');
  });

  it('rejects images over 10MB', async () => {
    const file = makeFile('big.png', 'image/png', 11 * 1024 * 1024);
    const res = await POST(makeRequest(file, { 'x-set-id': 'set-1' }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain('10MB');
  });

  it('rejects videos over 250MB', async () => {
    const file = makeFile('huge.mp4', 'video/mp4', 251 * 1024 * 1024);
    const res = await POST(makeRequest(file, { 'x-set-id': 'set-1' }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain('250MB');
  });

  it('maps video/quicktime to .mov extension', async () => {
    const file = makeFile('clip.mov', 'video/quicktime');
    mockUploadTexture.mockResolvedValue('https://s3.example.com/videos/set-1/abc12345.mov');
    await POST(makeRequest(file, { 'x-set-id': 'set-1' }));
    expect(mockUploadTexture).toHaveBeenCalledWith(
      'videos/set-1/abc12345.mov',
      expect.any(Uint8Array),
      'video/quicktime',
      expect.any(Number)
    );
  });

  it('maps video/x-matroska to .mkv extension', async () => {
    const file = makeFile('clip.mkv', 'video/x-matroska');
    mockUploadTexture.mockResolvedValue('https://s3.example.com/videos/set-1/abc12345.mkv');
    await POST(makeRequest(file, { 'x-set-id': 'set-1' }));
    expect(mockUploadTexture).toHaveBeenCalledWith(
      'videos/set-1/abc12345.mkv',
      expect.any(Uint8Array),
      'video/x-matroska',
      expect.any(Number)
    );
  });

  it('maps video/x-msvideo to .avi extension', async () => {
    const file = makeFile('clip.avi', 'video/x-msvideo');
    mockUploadTexture.mockResolvedValue('https://s3.example.com/videos/set-1/abc12345.avi');
    await POST(makeRequest(file, { 'x-set-id': 'set-1' }));
    expect(mockUploadTexture).toHaveBeenCalledWith(
      'videos/set-1/abc12345.avi',
      expect.any(Uint8Array),
      'video/x-msvideo',
      expect.any(Number)
    );
  });

  it('returns 400 when x-set-id header is missing', async () => {
    const file = makeFile('test.png', 'image/png');
    const res = await POST(makeRequest(file));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain('x-set-id');
  });

  it('returns 501 when S3 is not configured', async () => {
    mockIsS3Configured.mockReturnValue(false);
    const file = makeFile('test.png', 'image/png');
    const res = await POST(makeRequest(file, { 'x-set-id': 'set-1' }));
    expect(res.status).toBe(501);
  });
});
