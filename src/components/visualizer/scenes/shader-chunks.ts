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
    float inBounds = step(0.0, texUv.x) * step(texUv.x, 1.0)
                   * step(0.0, texUv.y) * step(texUv.y, 1.0);
    return vec4(texColor.rgb, texColor.a * uTextureOpacity * inBounds);
  }
`;

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
}
