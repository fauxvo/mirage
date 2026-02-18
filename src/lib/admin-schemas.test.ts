import { describe, it, expect } from 'vitest';
import { LoginSchema, CreateAdminUserSchema, CreateApiKeySchema } from './admin-schemas';

describe('LoginSchema', () => {
  it('accepts valid credentials', () => {
    expect(LoginSchema.safeParse({ username: 'admin', password: 'pass' }).success).toBe(true);
  });

  it('rejects empty username', () => {
    expect(LoginSchema.safeParse({ username: '', password: 'pass' }).success).toBe(false);
  });

  it('rejects empty password', () => {
    expect(LoginSchema.safeParse({ username: 'admin', password: '' }).success).toBe(false);
  });

  it('rejects missing fields', () => {
    expect(LoginSchema.safeParse({}).success).toBe(false);
    expect(LoginSchema.safeParse({ username: 'admin' }).success).toBe(false);
  });
});

describe('CreateAdminUserSchema', () => {
  it('accepts valid username and password', () => {
    const result = CreateAdminUserSchema.safeParse({
      username: 'new-admin',
      password: 'securepass123',
    });
    expect(result.success).toBe(true);
  });

  it('accepts underscores and hyphens in username', () => {
    expect(
      CreateAdminUserSchema.safeParse({ username: 'my_user-1', password: '12345678' }).success
    ).toBe(true);
  });

  it('rejects username shorter than 3 chars', () => {
    expect(
      CreateAdminUserSchema.safeParse({ username: 'ab', password: '12345678' }).success
    ).toBe(false);
  });

  it('rejects username with special chars', () => {
    expect(
      CreateAdminUserSchema.safeParse({ username: 'user@name', password: '12345678' }).success
    ).toBe(false);
    expect(
      CreateAdminUserSchema.safeParse({ username: 'user name', password: '12345678' }).success
    ).toBe(false);
  });

  it('rejects password shorter than 8 chars', () => {
    expect(
      CreateAdminUserSchema.safeParse({ username: 'admin', password: '1234567' }).success
    ).toBe(false);
  });

  it('accepts password exactly 8 chars', () => {
    expect(
      CreateAdminUserSchema.safeParse({ username: 'admin', password: '12345678' }).success
    ).toBe(true);
  });
});

describe('CreateApiKeySchema', () => {
  it('accepts valid name', () => {
    expect(CreateApiKeySchema.safeParse({ name: 'Production Key' }).success).toBe(true);
  });

  it('rejects empty name', () => {
    expect(CreateApiKeySchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('rejects name over 100 chars', () => {
    expect(CreateApiKeySchema.safeParse({ name: 'x'.repeat(101) }).success).toBe(false);
  });

  it('accepts name exactly 100 chars', () => {
    expect(CreateApiKeySchema.safeParse({ name: 'x'.repeat(100) }).success).toBe(true);
  });
});
