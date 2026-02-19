import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Mic, Share2, Palette, Layers, Monitor, Zap } from 'lucide-react';

const FEATURES = [
  {
    icon: Layers,
    title: '26 Scenes',
    desc: 'Five categories of Three.js visualizations — organic, cosmic, geometric, abstract, and immersive.',
  },
  {
    icon: Mic,
    title: 'Audio Reactive',
    desc: 'Microphone input analyzes bass, mid, and high frequencies to drive every scene in real time.',
  },
  {
    icon: Palette,
    title: 'Full Customization',
    desc: 'Color presets, per-scene parameters, custom textures, bloom, wireframe, and camera modes.',
  },
  {
    icon: Share2,
    title: 'Sets & Cues',
    desc: 'Organize your looks into sets with multiple cues. Share a URL and anyone can watch.',
  },
  {
    icon: Monitor,
    title: 'Self-Hosted',
    desc: 'Run it on your own hardware. Docker and Unraid ready. SQLite database, zero external dependencies.',
  },
  {
    icon: Zap,
    title: 'No AI Required',
    desc: 'Pure Three.js and WebGL. Every frame computed locally — no cloud calls, no latency.',
  },
];

const CATEGORIES = [
  { name: 'Organic', scenes: 'Aurora, Particles, Ocean, Lava, Metaballs' },
  { name: 'Cosmic', scenes: 'Galaxy, Starfield, Nebula, Vortex' },
  { name: 'Geometric', scenes: 'Geometric, Rings, Orb, Kaleidoscope, Voronoi' },
  { name: 'Abstract', scenes: 'Fractal, DNA, Matrix, Waveform' },
  { name: 'Immersive', scenes: 'Tunnel, Terrain, Starburst + 5 variants' },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero */}
      <div className="relative flex flex-col items-center justify-center min-h-[80vh] px-6 overflow-hidden">
        {/* Atmospheric glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-fuchsia-500/[0.06] blur-[140px] animate-landing-pulse" />
        <div className="absolute top-[30%] left-[30%] w-[500px] h-[500px] rounded-full bg-cyan-500/[0.04] blur-[120px] animate-landing-drift" />

        <div className="relative z-10 text-center max-w-2xl">
          <Image
            src="/logo.webp"
            alt="Mirage logo"
            width={120}
            height={120}
            className="mx-auto mb-8"
            priority
          />
          <p className="text-xs font-medium tracking-[0.3em] uppercase text-white/30 mb-6">
            Real-time 3D Music Visualizer
          </p>
          <h1 className="text-7xl sm:text-8xl font-bold tracking-tight mb-6 bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
            Mirage
          </h1>
          <p className="text-base sm:text-lg text-white/40 leading-relaxed max-w-md mx-auto mb-12">
            26 Three.js scenes driven by your microphone. Self-hosted, shareable, endlessly
            customizable.
          </p>
          <Link
            href="/v/new"
            className="group inline-flex items-center gap-2.5 px-8 py-3.5 bg-white text-black font-medium rounded-full hover:bg-white/90 transition-all text-sm"
          >
            Launch Visualizer
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="p-5 rounded-xl bg-surface-2/80 border border-white/[0.04] hover:border-white/[0.08] transition-colors"
            >
              <f.icon className="w-4 h-4 text-white/30 mb-3" />
              <h3 className="text-sm font-semibold text-white/90 mb-1">{f.title}</h3>
              <p className="text-[13px] text-white/40 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Scene Categories */}
      <div className="max-w-5xl mx-auto px-6 pb-20">
        <h2 className="text-xs font-medium tracking-[0.2em] uppercase text-white/20 mb-6">
          Scene Categories
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {CATEGORIES.map((cat) => (
            <div key={cat.name} className="p-4 rounded-lg bg-surface-1 border border-white/[0.03]">
              <p className="text-sm font-medium text-white/70 mb-1">{cat.name}</p>
              <p className="text-xs text-white/25 leading-relaxed">{cat.scenes}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-5xl mx-auto px-6 pb-12">
        <div className="border-t border-white/[0.04] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/20">Mirage &mdash; self-hosted music visualizer</p>
          <div className="flex gap-6">
            <Link
              href="/v/new"
              className="text-xs text-white/30 hover:text-white/50 transition-colors"
            >
              Visualizer
            </Link>
            <Link
              href="/dashboard"
              className="text-xs text-white/30 hover:text-white/50 transition-colors"
            >
              My Sets
            </Link>
            <Link
              href="/api/openapi"
              className="text-xs text-white/30 hover:text-white/50 transition-colors"
            >
              API
            </Link>
            <Link
              href="/dashboard"
              className="text-xs text-white/30 hover:text-white/50 transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
