'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HelpModalProps {
  onClose: () => void;
  hasYoutubePlaylist?: boolean;
}

export function HelpModal({ onClose, hasYoutubePlaylist }: HelpModalProps) {
  const [section, setSection] = useState<string>('overview');

  const sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'scenes', label: 'Scenes' },
    { id: 'colors', label: 'Colors' },
    { id: 'sliders', label: 'Sliders' },
    { id: 'texture', label: 'Texture' },
    { id: 'audio', label: 'Audio' },
    { id: 'sets', label: 'Sets & Cues' },
    { id: 'keyboard', label: 'Shortcuts' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-zinc-900 border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h4 className="text-white font-semibold text-lg">Mirage Guide</h4>
          <button
            onClick={onClose}
            className="p-1.5 text-white/50 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex flex-wrap gap-1 px-5 pt-3 pb-1">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
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
        <div className="px-6 py-5">
          {section === 'overview' && (
            <HelpContent>
              <HelpParagraph>
                Mirage is a real-time 3D music visualizer that reacts to audio from your microphone.
                Every setting can be adjusted while the visualizer is running.
              </HelpParagraph>
              <HelpParagraph>
                Changes are saved automatically. You can share sets via URL — viewers see the same
                visuals but only the owner can change settings.
              </HelpParagraph>
              <HelpItem title="Getting Started">
                Pick a scene, choose a color preset (or make your own), then adjust sliders to
                taste. Upload a custom image for scenes that support textures.
              </HelpItem>
            </HelpContent>
          )}

          {section === 'scenes' && (
            <HelpContent>
              <HelpParagraph>
                25 scenes grouped into five categories. Each has unique visual characteristics and
                responds to audio differently.
              </HelpParagraph>
              <HelpItem title="Organic">
                Natural, flowing visuals: auroras, particles, oceans, lava, metaballs.
              </HelpItem>
              <HelpItem title="Cosmic">
                Space-themed: galaxies, starfields, nebula, vortex, swarm.
              </HelpItem>
              <HelpItem title="Geometric">
                Mathematical precision: rings, orb, kaleidoscopes, voronoi, grid.
              </HelpItem>
              <HelpItem title="Abstract">
                Artistic shapes: fractals, waveforms, matrix, lattice.
              </HelpItem>
              <HelpItem title="Immersive">Full-environment: tunnels, terrain, starbursts.</HelpItem>
              <HelpItem title="Starburst Family">
                Four starburst variants centre your custom texture over radiating rays.
                <strong> Starburst</strong> is the standard,
                <strong> Soft</strong> has wide dreamy rays,
                <strong> Sharp</strong> has thin retro sunburst bands,
                <strong> Classic</strong> has ray centre that moves with camera orbit. Best paired
                with a custom texture (logo, artwork, photo).
              </HelpItem>
              <HelpItem title="New: Grid">
                Neon equalizer floor with bouncing points. Use the View Angle slider to switch
                between ground-level and top-down perspectives. Wave Pattern selector controls the
                animation style.
              </HelpItem>
              <HelpItem title="New: Swarm">
                Bioluminescent cloud of floating particles distributed in a sphere. Bass breathes
                the swarm outward, mids boost rotation.
              </HelpItem>
              <HelpItem title="New: Lattice">
                Crystal constellation of glowing orbs on a 3D grid. Bass swells point sizes
                dramatically with bloom, highs shift hue.
              </HelpItem>
            </HelpContent>
          )}

          {section === 'colors' && (
            <HelpContent>
              <HelpItem title="Presets">
                23 curated palettes organized by mood (vibrant, warm, cool, purple, dark/moody).
                Click any preset to apply instantly.
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
              <HelpItem title="Camera Mode">
                Choose from Static, Orbit (sprinkler-style swing), Drift (gentle floating), or Pulse
                (bass-reactive zoom). Flat-plane scenes auto-lock to Static.
              </HelpItem>
              <HelpItem title="Per-Scene Controls">
                Some scenes have additional controls (particle density, symmetry folds, wireframe,
                view angle, wave pattern) that appear automatically when that scene is selected.
              </HelpItem>
            </HelpContent>
          )}

          {section === 'texture' && (
            <HelpContent>
              <HelpParagraph>
                Upload a custom image (logo, artwork, photo) to be applied as a texture across all
                scenes. Images over 512KB are automatically optimized.
              </HelpParagraph>
              <HelpItem title="Texture Size &amp; Opacity">
                Adjust scale and transparency of the texture within the scene.
              </HelpItem>
              <HelpItem title="Texture Animation">
                Five modes available on all scenes: None, Pulse, Breathe, Flash, Strobe. Controls
                how the texture opacity animates over time.
              </HelpItem>
              <HelpItem title="Texture Motion">
                Motion modes available on all scenes: None, Spin, Bounce, Float, Swing, Fixed.
                Controls how the texture moves within the scene. Starburst scenes also support
                Pattern Offset sliders for precise positioning.
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

          {section === 'sets' && (
            <HelpContent>
              <HelpParagraph>
                Sets let you organize and share visualizer configurations. Each set contains one or
                more cues — individual looks you can switch between.
              </HelpParagraph>
              <HelpItem title="Creating Sets">
                Create a set from your dashboard. Each new set starts with one default cue that you
                can customize.
              </HelpItem>
              <HelpItem title="Cues">
                A cue is a specific configuration: scene, colors, textures, and settings. Add
                multiple cues to a set to prepare different looks.
              </HelpItem>
              <HelpItem title="Sharing">
                Share the URL /v/[set-id] with anyone. Viewers see the same visuals but only the
                owner can change settings.
              </HelpItem>
              <HelpItem title="Local Mode">
                Visit /v/new for a local-only mode that uses localStorage without creating a
                server-side set.
              </HelpItem>
            </HelpContent>
          )}

          {section === 'keyboard' && (
            <HelpContent>
              <HelpList
                items={[
                  ['F', 'Toggle fullscreen'],
                  ['S', 'Toggle settings panel'],
                  ['H', 'Toggle help guide'],
                  ['Esc', 'Close settings / help or exit fullscreen'],
                  ['M', 'Toggle mic audio on/off'],
                  ['1-9', 'Switch to cue by position (when viewing a set)'],
                  ...(hasYoutubePlaylist
                    ? ([
                        ['Space', 'Play / Pause YouTube'],
                        ['Shift + Right', 'Next track'],
                        ['Shift + Left', 'Previous track'],
                      ] as [string, string][])
                    : []),
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
  return <div className="space-y-4">{children}</div>;
}

function HelpParagraph({ children }: { children: React.ReactNode }) {
  return <p className="text-white/50 text-sm leading-relaxed">{children}</p>;
}

function HelpItem({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h5 className="text-white/80 text-sm font-semibold mb-1">{title}</h5>
      <p className="text-white/45 text-[13px] leading-relaxed">{children}</p>
    </div>
  );
}

function HelpList({ items }: { items: [string, string][] }) {
  return (
    <div className="space-y-2 ml-1">
      {items.map(([key, desc]) => (
        <div key={key} className="flex gap-3 text-sm">
          <span className="text-white/70 font-mono font-medium shrink-0 min-w-[80px]">{key}</span>
          <span className="text-white/40">{desc}</span>
        </div>
      ))}
    </div>
  );
}
