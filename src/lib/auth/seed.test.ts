import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('bcryptjs', () => ({
  hash: vi.fn().mockResolvedValue('$2a$12$hashed'),
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('mock-nanoid-id-16'),
}));

vi.mock('@/db/repositories/user.repository', () => ({
  userRepository: {
    countAdmins: vi.fn(),
    create: vi.fn(),
  },
}));

import { hash } from 'bcryptjs';
import { userRepository } from '@/db/repositories/user.repository';

const mockCountAdmins = vi.mocked(userRepository.countAdmins);
const mockCreate = vi.mocked(userRepository.create);
const mockHash = vi.mocked(hash);

describe('ensureAdminSeeded', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv('ADMIN_USERNAME', '');
    vi.stubEnv('ADMIN_PASSWORD', '');
    vi.stubEnv('ADMIN_EMAIL', '');
    // Restore mock return value after clearAllMocks
    mockHash.mockResolvedValue('$2a$12$hashed' as never);
  });

  it('does nothing if admin users already exist', async () => {
    mockCountAdmins.mockResolvedValue(1);

    const { ensureAdminSeeded } = await import('./seed');
    await ensureAdminSeeded();

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('does nothing if env vars are not set', async () => {
    mockCountAdmins.mockResolvedValue(0);

    const { ensureAdminSeeded } = await import('./seed');
    await ensureAdminSeeded();

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('does nothing if password is too short', async () => {
    mockCountAdmins.mockResolvedValue(0);
    vi.stubEnv('ADMIN_USERNAME', 'admin');
    vi.stubEnv('ADMIN_PASSWORD', 'short');
    vi.stubEnv('ADMIN_EMAIL', 'admin@test.com');

    const { ensureAdminSeeded } = await import('./seed');
    await ensureAdminSeeded();

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('does nothing if email is not set', async () => {
    mockCountAdmins.mockResolvedValue(0);
    vi.stubEnv('ADMIN_USERNAME', 'admin');
    vi.stubEnv('ADMIN_PASSWORD', 'changeme123');

    const { ensureAdminSeeded } = await import('./seed');
    await ensureAdminSeeded();

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates admin user when env vars set and no admins exist', async () => {
    mockCountAdmins.mockResolvedValue(0);
    vi.stubEnv('ADMIN_USERNAME', 'admin');
    vi.stubEnv('ADMIN_PASSWORD', 'changeme123');
    vi.stubEnv('ADMIN_EMAIL', 'admin@test.com');
    mockCreate.mockResolvedValue({
      id: 'mock-nanoid-id-16',
      username: 'admin',
      email: 'admin@test.com',
      passwordHash: '$2a$12$hashed',
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { ensureAdminSeeded } = await import('./seed');
    await ensureAdminSeeded();

    expect(mockCreate).toHaveBeenCalledWith({
      id: 'mock-nanoid-id-16',
      username: 'admin',
      email: 'admin@test.com',
      passwordHash: '$2a$12$hashed',
      role: 'admin',
    });
  });

  it('retries on next call after a transient DB error', async () => {
    vi.stubEnv('ADMIN_USERNAME', 'admin');
    vi.stubEnv('ADMIN_PASSWORD', 'changeme123');
    vi.stubEnv('ADMIN_EMAIL', 'admin@test.com');

    // First call: countAdmins throws a transient error
    mockCountAdmins.mockRejectedValueOnce(new Error('SQLITE_BUSY'));

    const { ensureAdminSeeded } = await import('./seed');
    await ensureAdminSeeded(); // Should catch error, NOT set seeded=true

    expect(mockCreate).not.toHaveBeenCalled();

    // Second call: DB recovers, seed should proceed
    mockCountAdmins.mockResolvedValue(0);
    mockCreate.mockResolvedValue({
      id: 'mock-nanoid-id-16',
      username: 'admin',
      email: 'admin@test.com',
      passwordHash: '$2a$12$hashed',
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await ensureAdminSeeded(); // Should retry and succeed

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'admin', role: 'admin' })
    );
  });

  it('concurrent calls share a single execution', async () => {
    mockCountAdmins.mockResolvedValue(0);
    vi.stubEnv('ADMIN_USERNAME', 'admin');
    vi.stubEnv('ADMIN_PASSWORD', 'changeme123');
    vi.stubEnv('ADMIN_EMAIL', 'admin@test.com');
    mockCreate.mockResolvedValue({
      id: 'mock-nanoid-id-16',
      username: 'admin',
      email: 'admin@test.com',
      passwordHash: '$2a$12$hashed',
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { ensureAdminSeeded } = await import('./seed');

    // Fire two concurrent calls — both should resolve, but create only once
    await Promise.all([ensureAdminSeeded(), ensureAdminSeeded()]);

    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('defaults username to admin when ADMIN_USERNAME not set', async () => {
    mockCountAdmins.mockResolvedValue(0);
    vi.stubEnv('ADMIN_PASSWORD', 'changeme123');
    vi.stubEnv('ADMIN_EMAIL', 'admin@test.com');
    mockCreate.mockResolvedValue({
      id: 'mock-nanoid-id-16',
      username: 'admin',
      email: 'admin@test.com',
      passwordHash: '$2a$12$hashed',
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { ensureAdminSeeded } = await import('./seed');
    await ensureAdminSeeded();

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ username: 'admin' }));
  });
});
