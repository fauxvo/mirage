import * as THREE from 'three';
import type { TextureTransform } from './types';

/**
 * Shared GLSL and JS helpers for texture transforms across all scenes.
 * Centralises the UV rotation/offset logic so bug fixes apply everywhere.
 */

/** Common texture-related uniform declarations for fragment shaders. */
export const TEXTURE_UNIFORMS = `
  uniform sampler2D uTexture;
  uniform bool uHasTexture;
  uniform float uTextureScale;
  uniform float uTextureOpacity;
  uniform float uTexRotation;
  uniform float uTexOffsetX;
  uniform float uTexOffsetY;
  uniform vec3 uTexTintColor;
`;

/**
 * GLSL function that applies rotation + offset to a UV and samples the texture.
 * Returns vec4 with pre-multiplied opacity and inBounds masking.
 *
 * Call with pre-scaled UVs:
 * - vUv scenes: `sampleTransformedTexture((vUv - 0.5) / uTextureScale + 0.5)`
 * - gl_PointCoord scenes: `sampleTransformedTexture(vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y))`
 */
export const TEXTURE_SAMPLE_FN = `
  vec4 sampleTransformedTexture(vec2 rawUv) {
    vec2 texUv = rawUv - 0.5;
    float cr = cos(uTexRotation); float sr = sin(uTexRotation);
    texUv = vec2(cr * texUv.x - sr * texUv.y, sr * texUv.x + cr * texUv.y);
    texUv += vec2(uTexOffsetX, uTexOffsetY);
    texUv += 0.5;
    vec4 texColor = texture2D(uTexture, texUv);
    texColor.rgb *= uTexTintColor;
    float inBounds = step(0.0, texUv.x) * step(texUv.x, 1.0)
                   * step(0.0, texUv.y) * step(texUv.y, 1.0);
    return vec4(texColor.rgb, texColor.a * uTextureOpacity * inBounds);
  }
`;

// ── Particle shape GLSL ─────────────────────────────────────────────────────

/** Uniform declaration for particle shape (int: 0=circle,1=star,2=diamond,3=ring,4=sparkle). */
export const PARTICLE_SHAPE_UNIFORM = `
  uniform int uParticleShape;
`;

/**
 * GLSL function returning alpha for the current gl_PointCoord given a shape index.
 * Shapes: 0=circle (soft glow), 1=star, 2=diamond, 3=ring, 4=sparkle.
 */
export const PARTICLE_SHAPE_FN = `
  float particleShapeAlpha(vec2 coord, int shape) {
    vec2 c = coord - 0.5;
    float d = length(c);
    if (shape == 1) {
      // Star — cos(angle * 5/2) gives 5 peaks over [0, 2pi]
      float angle = atan(c.y, c.x);
      float star = cos(angle * 2.5);
      float edge = 0.25 + star * 0.18;
      return smoothstep(edge + 0.04, edge - 0.04, d);
    }
    if (shape == 2) {
      // Diamond — L1 norm
      float dd = abs(c.x) + abs(c.y);
      return smoothstep(0.5, 0.3, dd);
    }
    if (shape == 3) {
      // Ring — hollow circle
      float ring = abs(d - 0.3);
      return smoothstep(0.12, 0.0, ring);
    }
    if (shape == 4) {
      // Sparkle — 4-pointed cross-star
      float angle = atan(c.y, c.x);
      float spike = pow(abs(cos(angle * 2.0)), 8.0);
      float edge = mix(0.08, 0.45, spike);
      return smoothstep(edge + 0.03, edge - 0.03, d);
    }
    // 0 = Circle — soft radial glow (default)
    return smoothstep(0.5, 0.0, d);
  }
`;

/** Map ParticleShape string → int for the uParticleShape uniform. */
export const PARTICLE_SHAPE_INDEX: Record<string, number> = {
  circle: 0,
  star: 1,
  diamond: 2,
  ring: 3,
  sparkle: 4,
};

/** The particleShape SceneParamDef shared across all particle scenes. */
export const PARTICLE_SHAPE_PARAM = {
  key: 'particleShape',
  label: 'Particle Shape',
  type: 'select' as const,
  default: 'circle',
  options: [
    { label: 'Circle', value: 'circle' },
    { label: 'Star', value: 'star' },
    { label: 'Diamond', value: 'diamond' },
    { label: 'Ring', value: 'ring' },
    { label: 'Sparkle', value: 'sparkle' },
  ],
};

/** Create uParticleShape uniform value from config. */
export function createParticleShapeUniform(config: { sceneParams?: Record<string, unknown> }) {
  return {
    uParticleShape: {
      value: PARTICLE_SHAPE_INDEX[(config.sceneParams?.particleShape as string) ?? 'circle'] ?? 0,
    },
  };
}

/** Update uParticleShape uniform on a ShaderMaterial from sceneParams. */
export function updateParticleShape(
  material: THREE.ShaderMaterial,
  sceneParams: Record<string, unknown>
): void {
  if (sceneParams.particleShape !== undefined) {
    material.uniforms.uParticleShape.value =
      PARTICLE_SHAPE_INDEX[sceneParams.particleShape as string] ?? 0;
  }
}

// ── Texture uniforms ────────────────────────────────────────────────────────

/** Standard texture uniform initial values for ShaderMaterial constructors. */
export function createTextureUniforms(config: { textureScale?: number; textureOpacity?: number }) {
  return {
    uTexture: { value: null },
    uHasTexture: { value: false },
    uTextureScale: { value: config.textureScale ?? 1.0 },
    uTextureOpacity: { value: config.textureOpacity ?? 1.0 },
    uTexRotation: { value: 0 },
    uTexOffsetX: { value: 0 },
    uTexOffsetY: { value: 0 },
    uTexTintColor: { value: new THREE.Color(1, 1, 1) },
  };
}

/**
 * Apply engine-driven texture transform to a ShaderMaterial's uniforms.
 *
 * Note: `transform.scale` (e.g. bounce squash) is intentionally NOT applied here
 * because it represents a mesh-level squash, not a UV zoom. Scenes with separate
 * texture meshes (galaxy, starburst) apply it to the mesh scale directly.
 */
export function applyTextureTransform(
  material: THREE.ShaderMaterial,
  transform: TextureTransform
): void {
  material.uniforms.uTextureOpacity.value = transform.opacity;
  material.uniforms.uTexRotation.value = transform.rotation;
  material.uniforms.uTexOffsetX.value = transform.offsetX;
  material.uniforms.uTexOffsetY.value = transform.offsetY;
  const tc = transform.tintColor;
  material.uniforms.uTexTintColor.value.setRGB(tc.r, tc.g, tc.b);
}
