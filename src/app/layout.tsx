import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mirage',
  description: 'Real-time 3D music visualizer',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-white antialiased">{children}</body>
    </html>
  );
}
