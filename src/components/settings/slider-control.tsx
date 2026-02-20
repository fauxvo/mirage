'use client';

import { cn } from '@/lib/utils';

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

export function SliderControl({ label, value, min, max, step, onChange }: SliderControlProps) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <label className="text-white/70 text-xs font-medium uppercase tracking-wider">
          {label}
        </label>
        <span className="text-white/40 text-xs font-mono">{value.toFixed(step < 1 ? 1 : 0)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 appearance-none bg-white/10 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg"
      />
    </section>
  );
}

export type TextureAnimation = 'none' | 'pulse' | 'breathe' | 'flash' | 'strobe';
export type TextureMotion = 'none' | 'spin' | 'bounce' | 'float' | 'swing';

const TEXTURE_ANIMATIONS: { value: TextureAnimation; label: string; description: string }[] = [
  { value: 'none', label: 'None', description: 'Static opacity' },
  { value: 'pulse', label: 'Pulse', description: 'Gentle fade in/out' },
  { value: 'breathe', label: 'Breathe', description: 'Slow deep breathing' },
  { value: 'flash', label: 'Flash', description: 'Periodic burst to full' },
  { value: 'strobe', label: 'Strobe', description: 'Rapid on/off' },
];

export function TextureAnimationPicker({
  value,
  onChange,
}: {
  value: TextureAnimation;
  onChange: (v: TextureAnimation) => void;
}) {
  return (
    <section>
      <label className="block text-white/70 text-xs font-medium mb-2 uppercase tracking-wider">
        Texture Animation
      </label>
      <div className="flex flex-wrap gap-1">
        {TEXTURE_ANIMATIONS.map((anim) => (
          <button
            key={anim.value}
            onClick={() => onChange(anim.value)}
            title={anim.description}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all',
              value === anim.value
                ? 'bg-white/20 text-white border border-white/30'
                : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 border border-transparent'
            )}
          >
            {anim.label}
          </button>
        ))}
      </div>
      <p className="mt-1 text-white/30 text-[10px]">
        {TEXTURE_ANIMATIONS.find((a) => a.value === value)?.description}
      </p>
    </section>
  );
}

const TEXTURE_MOTIONS: { value: TextureMotion; label: string; description: string }[] = [
  { value: 'none', label: 'None', description: 'No movement' },
  { value: 'spin', label: 'Spin', description: 'Continuous rotation' },
  { value: 'bounce', label: 'Bounce', description: 'Vertical bounce with squash' },
  { value: 'float', label: 'Float', description: 'Gentle figure-8 drift' },
  { value: 'swing', label: 'Swing', description: 'Pendulum rock back and forth' },
];

export function TextureMotionPicker({
  value,
  onChange,
}: {
  value: TextureMotion;
  onChange: (v: TextureMotion) => void;
}) {
  return (
    <section>
      <label className="block text-white/70 text-xs font-medium mb-2 uppercase tracking-wider">
        Texture Motion
      </label>
      <div className="flex flex-wrap gap-1">
        {TEXTURE_MOTIONS.map((m) => (
          <button
            key={m.value}
            onClick={() => onChange(m.value)}
            title={m.description}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all',
              value === m.value
                ? 'bg-white/20 text-white border border-white/30'
                : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 border border-transparent'
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="mt-1 text-white/30 text-[10px]">
        {TEXTURE_MOTIONS.find((m) => m.value === value)?.description}
      </p>
    </section>
  );
}
