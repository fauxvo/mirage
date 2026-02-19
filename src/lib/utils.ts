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

const debugEnabled = (() => {
  const debug = process.env.DEBUG?.toLowerCase();
  return (
    process.env.NODE_ENV !== 'production' ||
    (debug !== undefined && debug !== '' && debug !== 'false' && debug !== '0' && debug !== 'no')
  );
})();

export const Logger = {
  log: (...args: unknown[]) => {
    if (debugEnabled) console.log('[Mirage]', ...args);
  },
  warn: (...args: unknown[]) => {
    if (debugEnabled) console.warn('[Mirage]', ...args);
  },
  error: (...args: unknown[]) => {
    console.error('[Mirage]', ...args);
  },
};
