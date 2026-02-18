'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HelpModalProps {
  onClose: () => void;
}

export function HelpModal({ onClose }: HelpModalProps) {
  const [section, setSection] = useState<string>('overview');

  const sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'scenes', label: 'Scenes' },
    { id: 'colors', label: 'Colors' },
    { id: 'sliders', label: 'Sliders' },
    { id: 'texture', label: 'Texture' },
    { id: 'audio', label: 'Audio' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'keyboard', label: 'Shortcuts' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[85vh] bg-zinc-900 border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h4 className="text-white font-semibold text-base">Mirage Guide</h4>
          <button
            onClick={onClose}
            className="p-1.5 text-white/50 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-0.5 px-4 pt-3 pb-1 overflow-x-auto scrollbar-none">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all shrink-0',
                section === s.id
                  ? 'bg-white/15 text-white'
                  : 'text-white/40 hover:text-white/60 hover:bg-white/5'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {section === 'overview' && (
            <HelpContent>
              <HelpParagraph>
                Mirage is a real-time 3D music visualizer that reacts to audio from your
                microphone. Every setting can be adjusted while the visualizer is running.
              </HelpParagraph>
              <HelpParagraph>
                Changes are saved automatically. You can share sessions via URL — viewers see
                the same visuals but only the creator can change settings.
              </HelpParagraph>
              <HelpItem title="Getting Started">
                Pick a scene, choose a color preset (or make your own), then adjust sliders
                to taste. Upload a custom image for scenes that support textures.
              </HelpItem>
            </HelpContent>
          )}

          {section === 'scenes' && (
            <HelpContent>
              <HelpParagraph>
                23 scenes grouped into five categories. Each has unique visual characteristics
                and responds to audio differently.
              </HelpParagraph>
              <HelpItem title="Organic">
                Natural, flowing visuals: auroras, oceans, nebulae, lava.
              </HelpItem>
              <HelpItem title="Cosmic">
                Space-themed: particles, galaxies, starfields, DNA helixes.
              </HelpItem>
              <HelpItem title="Geometric">
                Mathematical precision: sacred geometry, rings, kaleidoscopes, fractals.
              </HelpItem>
              <HelpItem title="Abstract">
                Artistic shapes: orbs, metaballs, waveforms, voronoi, starbursts.
              </HelpItem>
              <HelpItem title="Immersive">
                Full-environment: tunnels, terrain, matrix rain, vortexes.
              </HelpItem>
              <HelpItem title="Starburst Family">
                Three starburst variants centre your custom texture over radiating rays.
                Best paired with a custom texture (logo, artwork, photo).
              </HelpItem>
            </HelpContent>
          )}

          {section === 'colors' && (
            <HelpContent>
              <HelpItem title="Presets">
                Eight curated palettes. Click any preset to apply instantly.
              </HelpItem>
              <HelpItem title="Custom Colors">
                Click &quot;Custom&quot; to reveal four color pickers for primary, secondary,
                accent, and background channels.
              </HelpItem>
              <HelpItem title="Auto-Cycle">
                Enable color cycling to automatically rotate through all presets with smooth
                transitions.
              </HelpItem>
            </HelpContent>
          )}

          {section === 'sliders' && (
            <HelpContent>
              <HelpItem title="Bloom Intensity (0 - 3)">
                Controls the glow post-processing effect. Higher = dreamy, lower = sharp.
              </HelpItem>
              <HelpItem title="Audio Reactivity (0 - 1)">
                How strongly visuals respond to audio. Only visible when audio is on.
              </HelpItem>
              <HelpItem title="Animation Speed (0.5 - 2)">
                Controls overall speed of all animations and camera movement.
              </HelpItem>
              <HelpItem title="Per-Scene Controls">
                Some scenes have additional controls (particle density, symmetry folds,
                wireframe) that appear automatically when that scene is selected.
              </HelpItem>
            </HelpContent>
          )}

          {section === 'texture' && (
            <HelpContent>
              <HelpParagraph>
                Upload a custom image (logo, artwork, photo) to be applied as a texture.
                Images over 512KB are automatically optimized.
              </HelpParagraph>
              <HelpItem title="Texture Size &amp; Opacity">
                Adjust scale and transparency of the texture within the scene.
              </HelpItem>
              <HelpItem title="Texture Animation (Starburst only)">
                Five modes: None, Pulse, Breathe, Flash, Strobe.
              </HelpItem>
            </HelpContent>
          )}

          {section === 'audio' && (
            <HelpContent>
              <HelpParagraph>
                Mirage uses your microphone to capture audio. The audio is analyzed but never
                recorded or sent anywhere — it stays entirely in your browser.
              </HelpParagraph>
              <HelpItem title="How It Works">
                Audio is split into bass, mid, and high frequency bands. Each scene reacts
                differently to these bands (see scene descriptions).
              </HelpItem>
              <HelpItem title="No Audio Mode">
                Toggle audio off for calm ambient animations that don&apos;t react to sound.
              </HelpItem>
              <HelpItem title="Browser Permission">
                Your browser will ask for microphone permission. This is required for audio
                reactivity but can be denied for ambient-only mode.
              </HelpItem>
            </HelpContent>
          )}

          {section === 'sessions' && (
            <HelpContent>
              <HelpParagraph>
                Sessions let you save and share visualizer configurations.
              </HelpParagraph>
              <HelpItem title="Creating Sessions">
                Sessions are created via the API (POST /api/sessions). The response includes
                a session ID and admin token.
              </HelpItem>
              <HelpItem title="Sharing">
                Share the URL /v/[session-id] with anyone. They can view but not modify the
                session settings.
              </HelpItem>
              <HelpItem title="Admin Token">
                The admin token is stored in your browser&apos;s localStorage. Only the token
                holder can update or delete a session.
              </HelpItem>
              <HelpItem title="Local Mode">
                Visit /v/new for a local-only session that uses localStorage without creating
                a server-side session.
              </HelpItem>
            </HelpContent>
          )}

          {section === 'keyboard' && (
            <HelpContent>
              <HelpList
                items={[
                  ['F', 'Toggle fullscreen'],
                  ['S', 'Toggle settings panel'],
                  ['Esc', 'Close settings or exit fullscreen'],
                  ['M', 'Toggle mic audio on/off'],
                ]}
              />
            </HelpContent>
          )}
        </div>
      </div>
    </div>
  );
}

function HelpContent({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3">{children}</div>;
}

function HelpParagraph({ children }: { children: React.ReactNode }) {
  return <p className="text-white/50 text-xs leading-relaxed">{children}</p>;
}

function HelpItem({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h5 className="text-white/80 text-xs font-semibold mb-0.5">{title}</h5>
      <p className="text-white/45 text-[11px] leading-relaxed">{children}</p>
    </div>
  );
}

function HelpList({ items }: { items: [string, string][] }) {
  return (
    <div className="space-y-1 ml-1">
      {items.map(([key, desc]) => (
        <div key={key} className="flex gap-2 text-[11px]">
          <span className="text-white/70 font-mono font-medium shrink-0 min-w-[70px]">{key}</span>
          <span className="text-white/40">{desc}</span>
        </div>
      ))}
    </div>
  );
}
