import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('bcryptjs', () => ({
  hash: vi.fn().mockResolvedValue('$2a$12$hashed'),
}));

vi.mock('@/db/repositories/admin-user.repository', () => ({
  adminUserRepository: {
    count: vi.fn(),
    create: vi.fn(),
  },
}));

import { hash } from 'bcryptjs';
import { adminUserRepository } from '@/db/repositories/admin-user.repository';

const mockCount = vi.mocked(adminUserRepository.count);
const mockCreate = vi.mocked(adminUserRepository.create);
const mockHash = vi.mocked(hash);

describe('ensureAdminSeeded', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv('ADMIN_USERNAME', '');
    vi.stubEnv('ADMIN_PASSWORD', '');
    // Restore mock return value after clearAllMocks
    mockHash.mockResolvedValue('$2a$12$hashed' as never);
  });

  it('does nothing if admin users already exist', async () => {
    mockCount.mockResolvedValue(1);

    const { ensureAdminSeeded } = await import('./seed');
    await ensureAdminSeeded();

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('does nothing if env vars are not set', async () => {
    mockCount.mockResolvedValue(0);

    const { ensureAdminSeeded } = await import('./seed');
    await ensureAdminSeeded();

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('does nothing if password is too short', async () => {
    mockCount.mockResolvedValue(0);
    vi.stubEnv('ADMIN_USERNAME', 'admin');
    vi.stubEnv('ADMIN_PASSWORD', 'short');

    const { ensureAdminSeeded } = await import('./seed');
    await ensureAdminSeeded();

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates admin user when env vars set and no users exist', async () => {
    mockCount.mockResolvedValue(0);
    vi.stubEnv('ADMIN_USERNAME', 'admin');
    vi.stubEnv('ADMIN_PASSWORD', 'changeme123');
    mockCreate.mockResolvedValue({
      id: 1,
      username: 'admin',
      passwordHash: '$2a$12$hashed',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { ensureAdminSeeded } = await import('./seed');
    await ensureAdminSeeded();

    expect(mockCreate).toHaveBeenCalledWith({
      username: 'admin',
      passwordHash: '$2a$12$hashed',
    });
  });
});
