import { z } from 'zod';

const usernameField = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(32, 'Username must be 32 characters or less')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username must be alphanumeric, hyphens, or underscores');

const emailField = z.string().email('Invalid email address');

const passwordField = z.string().min(8, 'Password must be at least 8 characters');

export const LoginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const RegisterSchema = z.object({
  username: usernameField,
  email: emailField,
  password: passwordField,
});

export const CreateUserSchema = z.object({
  username: usernameField,
  email: emailField,
  password: passwordField,
  role: z.enum(['admin', 'user']).default('user'),
});

export const CreateApiKeySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
});
