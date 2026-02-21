import { describe, it, expect } from 'vitest';
import {
  LoginSchema,
  RegisterSchema,
  CreateUserSchema,
  CreateApiKeySchema,
  ChangeUsernameSchema,
} from './auth-schemas';

describe('LoginSchema', () => {
  it('accepts valid credentials', () => {
    const result = LoginSchema.safeParse({ username: 'admin', password: 'password123' });
    expect(result.success).toBe(true);
  });

  it('rejects empty username', () => {
    const result = LoginSchema.safeParse({ username: '', password: 'password' });
    expect(result.success).toBe(false);
  });

  it('rejects empty password', () => {
    const result = LoginSchema.safeParse({ username: 'admin', password: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing fields', () => {
    expect(LoginSchema.safeParse({}).success).toBe(false);
    expect(LoginSchema.safeParse({ username: 'admin' }).success).toBe(false);
    expect(LoginSchema.safeParse({ password: 'pass' }).success).toBe(false);
  });
});

describe('RegisterSchema', () => {
  const validData = { username: 'newuser', email: 'test@test.com', password: 'password123' };

  it('accepts valid registration data', () => {
    const result = RegisterSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('rejects username shorter than 3 chars', () => {
    const result = RegisterSchema.safeParse({ ...validData, username: 'ab' });
    expect(result.success).toBe(false);
  });

  it('rejects username longer than 32 chars', () => {
    const result = RegisterSchema.safeParse({ ...validData, username: 'a'.repeat(33) });
    expect(result.success).toBe(false);
  });

  it('rejects username with special characters', () => {
    const result = RegisterSchema.safeParse({ ...validData, username: 'user name!' });
    expect(result.success).toBe(false);
  });

  it('accepts username with hyphens and underscores', () => {
    const result = RegisterSchema.safeParse({ ...validData, username: 'user-name_123' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = RegisterSchema.safeParse({ ...validData, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects password shorter than 8 chars', () => {
    const result = RegisterSchema.safeParse({ ...validData, password: 'short' });
    expect(result.success).toBe(false);
  });
});

describe('CreateUserSchema', () => {
  const validData = {
    username: 'newuser',
    email: 'test@test.com',
    password: 'password123',
    role: 'user' as const,
  };

  it('accepts valid data with role', () => {
    const result = CreateUserSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('defaults role to user when not provided', () => {
    const { role: _, ...withoutRole } = validData;
    const result = CreateUserSchema.safeParse(withoutRole);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe('user');
    }
  });

  it('accepts admin role', () => {
    const result = CreateUserSchema.safeParse({ ...validData, role: 'admin' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid role', () => {
    const result = CreateUserSchema.safeParse({ ...validData, role: 'superadmin' });
    expect(result.success).toBe(false);
  });
});

describe('ChangeUsernameSchema', () => {
  it('accepts valid username', () => {
    const result = ChangeUsernameSchema.safeParse({ username: 'newuser' });
    expect(result.success).toBe(true);
  });

  it('rejects username shorter than 3 chars', () => {
    const result = ChangeUsernameSchema.safeParse({ username: 'ab' });
    expect(result.success).toBe(false);
  });

  it('rejects username longer than 32 chars', () => {
    const result = ChangeUsernameSchema.safeParse({ username: 'a'.repeat(33) });
    expect(result.success).toBe(false);
  });

  it('rejects username with special characters', () => {
    const result = ChangeUsernameSchema.safeParse({ username: 'bad name!' });
    expect(result.success).toBe(false);
  });

  it('accepts hyphens and underscores', () => {
    const result = ChangeUsernameSchema.safeParse({ username: 'my-user_name' });
    expect(result.success).toBe(true);
  });
});

describe('CreateApiKeySchema', () => {
  it('accepts valid name', () => {
    const result = CreateApiKeySchema.safeParse({ name: 'Production Key' });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = CreateApiKeySchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects name over 100 chars', () => {
    const result = CreateApiKeySchema.safeParse({ name: 'a'.repeat(101) });
    expect(result.success).toBe(false);
  });
});
