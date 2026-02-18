import type { TextureAnimation } from '@/types/visualizer';

/**
 * Compute the animated opacity value based on the selected animation mode.
 * Returns a multiplier (0-1) to apply on top of the base textureOpacity.
 */
export function computeAnimatedOpacity(
  mode: TextureAnimation,
  time: number,
  speed: number,
  bass: number
): number {
  switch (mode) {
    case 'pulse': {
      // Gentle sine wave: 0.3 to 1.0 over ~4 seconds
      return 0.3 + 0.7 * (Math.sin(time * speed * 1.0) * 0.5 + 0.5);
    }
    case 'breathe': {
      // Slow deep breathing: 0.0 to 1.0 over ~6 seconds
      const t = time * speed * 0.5;
      // Ease-in-out using smoothed sine
      const raw = Math.sin(t) * 0.5 + 0.5;
      return raw * raw * (3 - 2 * raw); // smoothstep
    }
    case 'flash': {
      // Periodic flash: mostly transparent, quick burst to full
      const cycle = (time * speed * 0.8) % (Math.PI * 2);
      const flash = Math.max(0, Math.sin(cycle) * 3 - 2); // sharp spike
      const bassBoost = 1.0 + bass * 0.5;
      return Math.min(1.0, 0.1 + flash * 0.9 * bassBoost);
    }
    case 'strobe': {
      // Rapid on/off: ~4 Hz
      const strobe = Math.sin(time * speed * 25) > 0 ? 1.0 : 0.0;
      return strobe;
    }
    case 'none':
    default:
      return 1.0;
  }
}
