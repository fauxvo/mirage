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

function isDebug(): boolean {
  const debug = process.env.DEBUG;
  return (
    process.env.NODE_ENV !== 'production' ||
    (debug !== undefined && debug !== '' && debug.toLowerCase() !== 'false')
  );
}

export const Logger = {
  log: (...args: unknown[]) => {
    if (isDebug()) console.log('[Mirage]', ...args);
  },
  warn: (...args: unknown[]) => {
    if (isDebug()) console.warn('[Mirage]', ...args);
  },
  error: (...args: unknown[]) => {
    console.error('[Mirage]', ...args);
  },
};
