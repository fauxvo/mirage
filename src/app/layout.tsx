import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mirage',
  description: 'Real-time 3D music visualizer',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-white antialiased">{children}</body>
    </html>
  );
}
