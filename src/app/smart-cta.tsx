'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function SmartCta() {
  const [href, setHref] = useState('/login');

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (res.ok) setHref('/dashboard');
      })
      .catch(() => {});
  }, []);

  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2.5 px-7 py-3 bg-white text-black font-medium rounded-lg hover:bg-white/90 transition-all text-sm"
    >
      Get Started
      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
