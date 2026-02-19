'use client';

import { useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface CueToastProps {
  message: string | null;
  onDismiss: () => void;
}

export function CueToast({ message, onDismiss }: CueToastProps) {
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastRef = useRef<HTMLDivElement>(null);

  const cleanup = useCallback(() => {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
  }, []);

  useEffect(() => {
    if (!message) return;

    cleanup();

    // Force opacity to 1 immediately
    if (toastRef.current) {
      toastRef.current.style.opacity = '1';
    }

    // Start fade out after 1.5s
    fadeTimerRef.current = setTimeout(() => {
      if (toastRef.current) {
        toastRef.current.style.opacity = '0';
      }
      // Dismiss after fade animation
      dismissTimerRef.current = setTimeout(onDismiss, 300);
    }, 1500);

    return cleanup;
  }, [message, onDismiss, cleanup]);

  if (!message) return null;

  return (
    <div
      ref={toastRef}
      className={cn(
        'fixed top-8 left-1/2 -translate-x-1/2 z-40',
        'px-4 py-2 rounded-full',
        'bg-black/70 backdrop-blur-xl border border-white/15',
        'text-white text-sm font-medium',
        'transition-opacity duration-300'
      )}
    >
      {message}
    </div>
  );
}
