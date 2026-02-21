import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { verifySession } from '@/lib/auth/session';

const FEATURES = [
  '25 Scenes',
  'Audio Reactive',
  'Sets & Cues',
  'Full Customization',
  'Self-Hosted',
  'Pure WebGL',
];

const CATEGORIES = [
  { name: 'Organic', scenes: 'Aurora, Particles, Ocean, Lava, Metaballs' },
  { name: 'Cosmic', scenes: 'Galaxy, Starfield, Nebula, Vortex, Swarm' },
  { name: 'Geometric', scenes: 'Rings, Orb, Kaleidoscope, Voronoi, Grid' },
  { name: 'Abstract', scenes: 'Fractal, Matrix, Waveform, Lattice' },
  { name: 'Immersive', scenes: 'Tunnel, Terrain, Starburst + variants' },
];

export default async function Home() {
  const session = await verifySession();
  const ctaHref = session ? '/dashboard' : '/login';
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero — full viewport */}
      <div className="relative flex flex-col items-center justify-center min-h-screen px-6 overflow-hidden">
        {/* Atmospheric glows — colors pulled from logo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-[#7b2fbe]/[0.07] blur-[160px] animate-landing-pulse" />
        <div className="absolute top-[35%] left-[25%] w-[600px] h-[600px] rounded-full bg-[#0ea5e9]/[0.05] blur-[140px] animate-landing-drift" />
        <div className="absolute bottom-[25%] right-[20%] w-[500px] h-[500px] rounded-full bg-[#db2777]/[0.04] blur-[120px] animate-landing-drift-reverse" />

        <div className="relative z-10 text-center max-w-2xl">
          <Image
            src="/logo.webp"
            alt="Mirage"
            width={200}
            height={200}
            className="mx-auto mb-10"
            priority
          />

          <h1 className="text-6xl sm:text-7xl font-bold tracking-tight mb-4 pb-2 bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
            Mirage
          </h1>

          <p className="text-sm sm:text-base text-white/35 leading-relaxed max-w-sm mx-auto mb-12">
            Real-time 3D music visualizer. Self-hosted, audio-reactive, endlessly customizable.
          </p>

          <Link
            href={ctaHref}
            className="group inline-flex items-center gap-2.5 px-7 py-3 bg-white text-black font-medium rounded-lg hover:bg-white/90 transition-all text-sm"
          >
            Get Started
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      {/* Below fold — features + categories */}
      <div className="max-w-3xl mx-auto px-6 pb-20">
        {/* Features — compact inline */}
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-3 mb-16">
          {FEATURES.map((feature, i) => (
            <span key={feature} className="flex items-center gap-2 text-xs text-white/30">
              {feature}
              {i < FEATURES.length - 1 && (
                <span className="text-white/10" aria-hidden="true">
                  ·
                </span>
              )}
            </span>
          ))}
        </div>

        {/* Scene categories */}
        <div className="mb-20">
          <p className="text-[10px] font-medium tracking-[0.2em] uppercase text-white/15 text-center mb-5">
            Scene Categories
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {CATEGORIES.map((cat) => (
              <span
                key={cat.name}
                className="group relative px-3 py-1.5 text-xs text-white/30 border border-white/[0.06] rounded-lg hover:border-white/[0.1] hover:text-white/45 transition-colors cursor-default"
                title={cat.scenes}
              >
                {cat.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-3xl mx-auto px-6 pb-10">
        <div className="border-t border-white/[0.04] pt-6 flex items-center justify-between">
          <p className="text-xs text-white/15">Mirage</p>
          <div className="flex gap-6">
            <Link
              href="/api/openapi"
              className="text-xs text-white/20 hover:text-white/40 transition-colors"
            >
              API
            </Link>
            <Link
              href="/dashboard"
              className="text-xs text-white/20 hover:text-white/40 transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
