import { describe, it, expect } from 'vitest';
import { VisualizerConfigSchema } from './schemas';

/** Minimal valid config for tests — every required field present. */
const validConfig = {
  scene: 'particles',
  colorPalette: {
    primary: '#ff00ff',
    secondary: '#00ffff',
    accent: '#ffff00',
    background: '#000000',
  },
  particleDensity: 0.5,
  animationSpeed: 1.0,
  bloomIntensity: 1.5,
  audioReactivity: 0.7,
  cameraMovement: 'orbit' as const,
  wireframe: false,
  symmetry: 6,
  depth: 0.5,
  colorCycleSpeed: 0.5,
  customTextureUrl: null,
  textureScale: 1.0,
  textureOpacity: 1.0,
  textureAnimation: 'none' as const,
  patternOffsetX: 0,
  patternOffsetY: 0,
};

describe('VisualizerConfigSchema', () => {
  it('accepts a valid config with all required fields', () => {
    const result = VisualizerConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  describe('audioSensitivity', () => {
    it('defaults to 1.0 when omitted', () => {
      const result = VisualizerConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.audioSensitivity).toBe(1.0);
      }
    });

    it('accepts value at min (0.5)', () => {
      const result = VisualizerConfigSchema.safeParse({ ...validConfig, audioSensitivity: 0.5 });
      expect(result.success).toBe(true);
    });

    it('accepts value at max (3)', () => {
      const result = VisualizerConfigSchema.safeParse({ ...validConfig, audioSensitivity: 3 });
      expect(result.success).toBe(true);
    });

    it('rejects value below min', () => {
      const result = VisualizerConfigSchema.safeParse({ ...validConfig, audioSensitivity: 0.4 });
      expect(result.success).toBe(false);
    });

    it('rejects value above max', () => {
      const result = VisualizerConfigSchema.safeParse({ ...validConfig, audioSensitivity: 3.1 });
      expect(result.success).toBe(false);
    });
  });

  describe('textureTint', () => {
    it('defaults to none when omitted', () => {
      const result = VisualizerConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.textureTint).toBe('none');
      }
    });

    it('accepts all valid values', () => {
      for (const value of ['none', 'primary', 'secondary', 'accent'] as const) {
        const result = VisualizerConfigSchema.safeParse({ ...validConfig, textureTint: value });
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid value', () => {
      const result = VisualizerConfigSchema.safeParse({ ...validConfig, textureTint: 'rainbow' });
      expect(result.success).toBe(false);
    });
  });

  describe('textureMotion', () => {
    it('defaults to none when omitted', () => {
      const result = VisualizerConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.textureMotion).toBe('none');
      }
    });

    it('accepts rotate value', () => {
      const result = VisualizerConfigSchema.safeParse({ ...validConfig, textureMotion: 'rotate' });
      expect(result.success).toBe(true);
    });

    it('accepts all valid values', () => {
      for (const value of ['none', 'fixed', 'spin', 'rotate', 'bounce', 'float', 'swing']) {
        const result = VisualizerConfigSchema.safeParse({ ...validConfig, textureMotion: value });
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid value', () => {
      const result = VisualizerConfigSchema.safeParse({ ...validConfig, textureMotion: 'wobble' });
      expect(result.success).toBe(false);
    });
  });
});
