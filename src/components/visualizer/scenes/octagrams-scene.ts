import * as THREE from 'three';
import type { VisualizerConfig } from '@/types/visualizer';
import { registerScene } from './scene-registry';
import type { SceneRegistration, TextureTransform } from './types';
import {
  TEXTURE_UNIFORMS,
  TEXTURE_SAMPLE_FN,
  createTextureUniforms,
  applyTextureTransform,
} from './shader-chunks';

// ── Octagrams ───────────────────────────────────────────────────────────────
// Raymarched infinite tunnel of pulsating octagram star tiles using SDF boxes,
// CSG intersection, domain repetition, and volumetric glow accumulation.
//
// Inspired by "Octagrams" (ShaderToy tlVGDt) by whisky_shusuky
// https://www.shadertoy.com/view/tlVGDt
// Author: whisky_shusuky — backend engineer / GLSL artist, Tokyo
// GitHub: github.com/whisky-shusuky | Twitter: @Whisky_shusuky
// License: CC BY-NC-SA 3.0 (ShaderToy default)

const VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER =
  TEXTURE_UNIFORMS +
  TEXTURE_SAMPLE_FN +
  `
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uSpeed;
  uniform float uGlowDensity;
  uniform float uTunnelSpeed;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform vec3 uAccent;
  varying vec2 vUv;

  mat2 rot(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, s, -s, c);
  }

  float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
  }

  float box(vec3 pos, float scale) {
    pos *= scale;
    float base = sdBox(pos, vec3(0.4, 0.4, 0.1)) / 1.5;
    pos.xy *= 5.0;
    pos.y -= 3.5;
    pos.xy *= rot(0.75);
    return -base;
  }

  float box_set(vec3 pos, float gTime) {
    vec3 orig = pos;
    // Bass drives the octagram arm spread
    float spread = (1.0 + uBass * 2.0) * 2.5;
    float pulse = sin(gTime * 0.4);
    float absPulse = abs(pulse);
    // Bass modulates scale oscillation
    float scaleAnim = 2.0 - absPulse * (0.5 + uBass * 2.0);

    pos = orig;
    pos.y += pulse * spread;
    pos.xy *= rot(0.8);
    float b1 = box(pos, scaleAnim);

    pos = orig;
    pos.y -= pulse * spread;
    pos.xy *= rot(0.8);
    float b2 = box(pos, scaleAnim);

    pos = orig;
    pos.x += pulse * spread;
    pos.xy *= rot(0.8);
    float b3 = box(pos, scaleAnim);

    pos = orig;
    pos.x -= pulse * spread;
    pos.xy *= rot(0.8);
    float b4 = box(pos, scaleAnim);

    pos = orig;
    pos.xy *= rot(0.8);
    float b5 = box(pos, 0.5) * 6.0;

    pos = orig;
    float b6 = box(pos, 0.5) * 6.0;

    return max(max(max(max(max(b1, b2), b3), b4), b5), b6);
  }

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= 1.777;

    float time = uTime * uSpeed * 0.4;

    // Forward tunnel motion — bass surges accelerate
    float tunnelZ = time * (uTunnelSpeed * 2.0 + uBass * 3.0);
    vec3 ro = vec3(0.0, -0.2, tunnelZ);
    vec3 ray = normalize(vec3(p, 1.5));

    // Camera rotation — mid-reactive
    ray.xy *= rot(sin(time * 0.03 + uMid * 0.5) * 5.0);
    ray.yz *= rot(sin(time * 0.05) * 0.2);

    float t = 0.1;
    float ac = 0.0;

    // Glow falloff — higher density = slower falloff = more glow
    // Original uses fixed 23.0; slider adjusts ±15 around that
    float glowExp = 23.0 + (1.0 - uGlowDensity) * 15.0 + uMid * 15.0;
    // Temporal ripple — high increases shimmer
    float ripple = 0.005 + uHigh * 0.02;

    for (int i = 0; i < 99; i++) {
      vec3 pos = ro + ray * t;
      // Domain repetition — infinite tiling
      pos = mod(pos - 2.0, 4.0) - 2.0;

      float gTime = time - float(i) * ripple;
      float d = box_set(pos, gTime);
      d = max(abs(d), 0.01);
      ac += exp(-d * glowExp);

      t += d * 0.55;
    }

    // Base volumetric color
    vec3 col = vec3(ac * 0.02);

    // Color from palette — time-animated
    vec3 baseColor = mix(uPrimary, uAccent, 0.5);
    col *= 0.3 + baseColor * 2.0;
    col += uSecondary * (0.1 + 0.1 * abs(sin(time * 0.3)));

    // High-frequency flash — sparkle on transients
    col += uAccent * uHigh * 0.2;

    // Overall brightness — bass
    col *= 1.0 + uBass * 0.5;

    if (uHasTexture) {
      vec4 tex = sampleTransformedTexture((vUv - 0.5) / uTextureScale + 0.5);
      col = mix(col, tex.rgb, tex.a);
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ── Scene class ─────────────────────────────────────────────────────────────

export class OctagramsScene {
  private mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private clock: THREE.Clock;

  constructor(
    private scene: THREE.Scene,
    private config: VisualizerConfig
  ) {
    this.clock = new THREE.Clock();
    const palette = config.colorPalette;
    const params = config.sceneParams ?? {};

    const geometry = new THREE.PlaneGeometry(24, 24);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uSpeed: { value: config.animationSpeed },
        uGlowDensity: { value: Number(params.glowDensity ?? 1.0) },
        uTunnelSpeed: { value: Number(params.tunnelSpeed ?? 1.0) },
        uPrimary: { value: new THREE.Color(palette.primary) },
        uSecondary: { value: new THREE.Color(palette.secondary) },
        uAccent: { value: new THREE.Color(palette.accent) },
        ...createTextureUniforms(config),
      },
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.z = -2;
    this.scene.add(this.mesh);
  }

  update(bass: number, mid: number, high: number): void {
    const time = this.clock.getElapsedTime();
    const r = this.config.audioReactivity;
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uBass.value = bass * r;
    this.material.uniforms.uMid.value = mid * r;
    this.material.uniforms.uHigh.value = high * r;
  }

  setTexture(texture: THREE.Texture | null): void {
    this.material.uniforms.uTexture.value = texture;
    this.material.uniforms.uHasTexture.value = texture !== null;
  }

  setTextureTransform(transform: TextureTransform): void {
    applyTextureTransform(this.material, transform);
  }

  updateConfig(config: Partial<VisualizerConfig>): void {
    if (config.colorPalette) {
      this.material.uniforms.uPrimary.value.set(config.colorPalette.primary);
      this.material.uniforms.uSecondary.value.set(config.colorPalette.secondary);
      this.material.uniforms.uAccent.value.set(config.colorPalette.accent);
    }
    if (config.animationSpeed !== undefined) {
      this.material.uniforms.uSpeed.value = config.animationSpeed;
    }
    if (config.textureScale !== undefined) {
      this.material.uniforms.uTextureScale.value = config.textureScale;
    }
    if (config.sceneParams) {
      if (config.sceneParams.glowDensity !== undefined) {
        this.material.uniforms.uGlowDensity.value = Number(config.sceneParams.glowDensity);
      }
      if (config.sceneParams.tunnelSpeed !== undefined) {
        this.material.uniforms.uTunnelSpeed.value = Number(config.sceneParams.tunnelSpeed);
      }
    }
    this.config = { ...this.config, ...config };
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

// ── Registration ────────────────────────────────────────────────────────────

const METADATA: SceneRegistration = {
  id: 'octagrams',
  name: 'Octagrams',
  description:
    'Infinite raymarched tunnel of pulsating octagram star tiles with volumetric glow. Inspired by "Octagrams" by whisky_shusuky (shadertoy.com/view/tlVGDt, github.com/whisky-shusuky). CC BY-NC-SA 3.0.',
  category: 'psychedelic',
  cameraHint: 'low-angle',
  audioDescription:
    'Bass drives arm spread, scale pulse, and tunnel speed; mids control glow sharpness and camera drift; highs add temporal shimmer and flash',
  features: ['textureScale', 'textureOpacity', 'textureAnimation', 'textureMotion'],
  params: [
    {
      key: 'glowDensity',
      label: 'Glow Density',
      type: 'slider',
      min: 0.3,
      max: 2.0,
      step: 0.1,
      default: 1.0,
    },
    {
      key: 'tunnelSpeed',
      label: 'Tunnel Speed',
      type: 'slider',
      min: 0.2,
      max: 2.0,
      step: 0.1,
      default: 1.0,
    },
  ],
};

registerScene('octagrams', (scene, config) => new OctagramsScene(scene, config), METADATA);
