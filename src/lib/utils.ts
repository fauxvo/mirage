import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const __DEV__ = process.env.NODE_ENV !== 'production';

export const Logger = {
  log: (...args: unknown[]) => {
    if (__DEV__) console.log('[Mirage]', ...args);
  },
  warn: (...args: unknown[]) => {
    if (__DEV__) console.warn('[Mirage]', ...args);
  },
  error: (...args: unknown[]) => {
    console.error('[Mirage]', ...args);
  },
};
