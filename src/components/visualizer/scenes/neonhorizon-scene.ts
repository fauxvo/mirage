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
import { applyViewAngle } from './starburst-utils';

// ── Neon Horizon ────────────────────────────────────────────────────────────
// Tron-style concentric arcs radiating from a vanishing point with
// speed streaks, radial beams, focal diamond, and starfield.

const HORIZON_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const HORIZON_FRAGMENT = `
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uSpeed;
  uniform float uArcCount;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform vec3 uAccent;
  varying vec2 vUv;

  #define PI 3.14159265359

  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  // SDF glow
  float glowLine(float d, float core, float halo) {
    return core / (d * d + core) + halo / (d * d + halo);
  }

  void main() {
    // Vanishing point at bottom-center
    vec2 origin = vec2(0.5, 0.15);
    vec2 delta = vUv - origin;
    float dist = length(delta);
    float angle = atan(delta.y, delta.x);

    // ── Sky gradient + starfield ──────────────────────────────────
    float skyGrad = smoothstep(0.0, 0.8, vUv.y);
    vec3 color = mix(uSecondary * 0.02, uAccent * 0.04, skyGrad);

    // Stars
    float stars = 0.0;
    for (float layer = 0.0; layer < 3.0; layer++) {
      float scale = 70.0 + layer * 140.0;
      vec2 st = vUv * scale;
      vec2 id = floor(st);
      vec2 f = fract(st) - 0.5;
      float bright = step(0.97, hash21(id + layer * 55.0));
      float twinkle = sin(uTime * uSpeed * (hash21(id + 9.0) * 2.0 + 0.5)) * 0.5 + 0.5;
      twinkle = 0.5 + twinkle * 0.5 * (1.0 + uHigh * 0.3);
      stars += bright * exp(-dot(f, f) * 100.0) * twinkle;
    }
    color += vec3(stars * 0.6);

    // ── Expanding arcs — SDF glow for neon look ──────────────────
    float scroll = uTime * uSpeed * 0.4;
    float arcPhase = dist * uArcCount - scroll;
    float arcDist = abs(fract(arcPhase) - 0.5) / uArcCount;
    float arc = glowLine(arcDist, 0.00005, 0.0008);
    arc = min(arc, 1.0);

    // Audio: bass pulses arc intensity
    float bassBoost = 1.0 + uBass * 1.5;
    arc *= bassBoost;

    // Chromatic shift — each arc ring gets a different hue
    float hueShift = fract(arcPhase * 0.1 + uTime * uSpeed * 0.05);
    vec3 arcColor = mix(uPrimary, uAccent, hueShift);
    arcColor = mix(arcColor, uSecondary, sin(hueShift * PI) * 0.3);

    // Intensity fades near origin and at edges
    float distFade = smoothstep(0.02, 0.15, dist) * (1.0 - smoothstep(0.5, 0.9, dist));
    arc *= distFade;

    color += arcColor * arc;

    // ── Radial beams — Tron light-cycle trails ───────────────────
    float beamCount = 12.0;
    float beamDist = abs(fract(angle * beamCount / (2.0 * PI) + 0.5) - 0.5);
    beamDist /= beamCount;
    float beam = glowLine(beamDist, 0.00002, 0.0003);
    beam = min(beam, 1.0) * 0.3 * (1.0 + uMid);
    beam *= smoothstep(0.05, 0.2, dist);
    // Beams fade in the upper portion
    beam *= smoothstep(0.9, 0.4, dist);
    color += uSecondary * beam;

    // ── Speed streaks — radial lines that accelerate on bass ─────
    float streakAngle = angle + uTime * uSpeed * 0.1;
    float streak = pow(abs(sin(streakAngle * 30.0)), 40.0);
    float streakDist = smoothstep(0.1, 0.3, dist) * (1.0 - smoothstep(0.5, 0.8, dist));
    streak *= streakDist * 0.15 * (1.0 + uBass * 1.0);
    color += mix(uPrimary, uAccent, 0.5) * streak;

    // ── Focal diamond at vanishing point ─────────────────────────
    // Rotating diamond shape using max(|x|,|y|) SDF
    float rot = uTime * uSpeed * 0.3;
    float cr = cos(rot); float sr = sin(rot);
    vec2 rd = vec2(cr * delta.x - sr * delta.y, sr * delta.x + cr * delta.y);
    float diamond = max(abs(rd.x), abs(rd.y));
    float diamondSize = 0.025 + uBass * 0.008;
    // Neon outline glow
    float diamondEdge = abs(diamond - diamondSize);
    float diamondGlow = 0.0005 / (diamondEdge * diamondEdge + 0.0005);
    diamondGlow = min(diamondGlow, 1.0);
    // Inner fill
    float diamondFill = 1.0 - smoothstep(diamondSize * 0.3, diamondSize * 0.6, diamond);
    color += uAccent * diamondGlow * 0.6;
    color += mix(uPrimary, uAccent, 0.5) * diamondFill * 0.3;

    // ── Horizon glow at origin ───────────────────────────────────
    float glow = exp(-dist * 4.0) * 0.3 * (1.0 + uBass * 0.5);
    color += uAccent * glow;

    // ── Vignette ─────────────────────────────────────────────────
    float vignette = 1.0 - smoothstep(0.4, 0.95, length(vUv - 0.5));
    color *= vignette;

    // ── Scanline overlay ─────────────────────────────────────────
    float scanline = sin(vUv.y * 400.0) * 0.5 + 0.5;
    color *= 0.95 + scanline * 0.05;

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ── Ground grid ─────────────────────────────────────────────────────────────

const GROUND_VERTEX = `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uBass;
  uniform float uSpeed;

  void main() {
    vUv = uv;
    vec3 pos = position;
    float ripple = sin(pos.x * 4.0 + uTime * uSpeed * 1.5)
                 * cos(pos.y * 3.0 + uTime * uSpeed) * 0.015 * (1.0 + uBass * 0.5);
    pos.z += ripple;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const GROUND_FRAGMENT =
  TEXTURE_UNIFORMS +
  TEXTURE_SAMPLE_FN +
  `
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform vec3 uAccent;
  uniform float uHigh;
  uniform float uMid;
  uniform float uBass;
  uniform float uTime;
  uniform float uSpeed;
  varying vec2 vUv;

  #define PI 3.14159265359

  // SDF glow line — inverse-square falloff
  float glowLine(float d, float core, float halo) {
    return core / (d * d + core) + halo / (d * d + halo);
  }

  void main() {
    float t = uTime * uSpeed;
    float scroll = t * 0.25;

    // ── Perspective-aware grid ──────────────────────────────────
    // perspY grows near the viewer (bottom), shrinks toward horizon
    float perspY = max(1.0 - vUv.y, 0.01);
    float perspScale = 1.0 / perspY;

    vec2 gridUv = vec2(vUv.x, vUv.y + scroll);
    float density = 16.0;

    // Perspective-scaled line widths — thinner at distance
    float lineScale = min(perspY * 2.0, 1.0);
    float coreW = 0.0002 * lineScale;
    float haloW = 0.003 * lineScale;

    // Primary grid
    float dx = abs(fract(gridUv.x * density) - 0.5) / density;
    float dy = abs(fract(gridUv.y * density) - 0.5) / density;
    float gx = glowLine(dx, coreW, haloW);
    float gy = glowLine(dy, coreW, haloW);
    float grid = min(gx + gy, 1.0);

    // ── Diagonal cross-hatch overlay ────────────────────────────
    float diagDensity = density * 0.5;
    vec2 diagUv = vec2(gridUv.x + gridUv.y, gridUv.x - gridUv.y);
    float dd1 = abs(fract(diagUv.x * diagDensity) - 0.5) / diagDensity;
    float dd2 = abs(fract(diagUv.y * diagDensity) - 0.5) / diagDensity;
    float diag = glowLine(dd1, coreW * 0.3, haloW * 0.4)
               + glowLine(dd2, coreW * 0.3, haloW * 0.4);
    diag = min(diag, 1.0) * 0.25;

    // ── Distance fade ───────────────────────────────────────────
    float distFade = 1.0 - smoothstep(0.0, 0.85, vUv.y);
    float nearFade = smoothstep(0.0, 0.05, vUv.y);
    float fade = distFade * nearFade;

    // ── Primary grid color ──────────────────────────────────────
    float intensity = 0.4 + uHigh * 0.4;
    // Gradient: accent near viewer → primary at distance
    vec3 gridColor = mix(uAccent, uPrimary, vUv.y * 1.5);
    vec3 color = gridColor * grid * intensity * fade;

    // Diagonal overlay — subtle secondary color
    color += uSecondary * diag * 0.5 * intensity * fade;

    // ── Intersection node glow ──────────────────────────────────
    // Bright points at grid intersections
    vec2 cellId = floor(gridUv * density);
    vec2 cellFract = fract(gridUv * density) - 0.5;
    float nodeDist = length(cellFract);

    // Each node gets a frequency band based on position
    float freqSeed = fract(dot(cellId, vec2(0.333, 0.577)));
    float audioLevel;
    if (freqSeed < 0.33) audioLevel = uBass;
    else if (freqSeed < 0.66) audioLevel = uMid;
    else audioLevel = uHigh;

    float nodeGlow = 0.0008 / (nodeDist * nodeDist + 0.0008);
    nodeGlow = min(nodeGlow, 1.0) * audioLevel * fade;
    vec3 nodeColor = freqSeed < 0.33 ? uAccent
                   : freqSeed < 0.66 ? mix(uPrimary, uAccent, 0.5)
                   : uPrimary;
    color += nodeColor * nodeGlow * 0.6;

    // ── Traveling energy pulses along X lines ───────────────────
    float pulseX = fract(gridUv.y * density);
    float travelX = fract(gridUv.x * 3.0 - t * 0.8);
    float energyX = exp(-pulseX * pulseX * 80.0)  // on a Y-line
                  * exp(-travelX * travelX * 20.0) // traveling dot
                  * (0.5 + uMid * 1.0);
    color += uAccent * energyX * fade * 0.4;

    // ── Traveling energy pulses along Y lines ───────────────────
    float pulseY = fract(gridUv.x * density);
    float travelY = fract(gridUv.y * 3.0 + t * 0.6);
    float energyY = exp(-pulseY * pulseY * 80.0)
                  * exp(-travelY * travelY * 20.0)
                  * (0.5 + uMid * 1.0);
    color += uPrimary * energyY * fade * 0.3;

    // ── Bass pulse rings — expanding from center ────────────────
    float ringDist = abs(length(gridUv - vec2(0.5, 0.5)) - fract(t * 0.15) * 0.8);
    float ring = (0.002 / (ringDist * ringDist + 0.002)) * uBass * 0.2;
    color += uAccent * ring * fade;

    // Second ring offset for more energy
    float ringDist2 = abs(length(gridUv - vec2(0.5, 0.5)) - fract(t * 0.15 + 0.5) * 0.8);
    float ring2 = (0.001 / (ringDist2 * ringDist2 + 0.001)) * uBass * 0.12;
    color += mix(uPrimary, uAccent, 0.5) * ring2 * fade;

    // ── Horizon glow ────────────────────────────────────────────
    float horizonGlow = exp(-(1.0 - vUv.y) * 0.5) * 0.08 * (1.0 + uBass * 0.4);
    color += uAccent * horizonGlow * distFade;

    // ── Ambient floor tint ──────────────────────────────────────
    color += uSecondary * 0.008 * nearFade;

    if (uHasTexture) {
      vec4 tex = sampleTransformedTexture((vUv - 0.5) / uTextureScale + 0.5);
      color = mix(color, tex.rgb, tex.a);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ── Scene class ─────────────────────────────────────────────────────────────

export class NeonHorizonScene {
  private backdrop: THREE.Mesh;
  private backdropMaterial: THREE.ShaderMaterial;
  private ground: THREE.Mesh;
  private groundMaterial: THREE.ShaderMaterial;
  private clock: THREE.Clock;

  constructor(
    private scene: THREE.Scene,
    private config: VisualizerConfig
  ) {
    this.clock = new THREE.Clock();
    const palette = config.colorPalette;
    const params = config.sceneParams ?? {};

    // ── Horizon backdrop ─────────────────────────────────────────────

    const backdropGeo = new THREE.PlaneGeometry(48, 28);
    this.backdropMaterial = new THREE.ShaderMaterial({
      vertexShader: HORIZON_VERTEX,
      fragmentShader: HORIZON_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uSpeed: { value: config.animationSpeed },
        uArcCount: { value: 6 + Number(params.arcDensity ?? 0.5) * 14 },
        uPrimary: { value: new THREE.Color(palette.primary) },
        uSecondary: { value: new THREE.Color(palette.secondary) },
        uAccent: { value: new THREE.Color(palette.accent) },
      },
      fog: false,
    });

    this.backdrop = new THREE.Mesh(backdropGeo, this.backdropMaterial);
    this.backdrop.position.set(0, 5, -12);
    this.scene.add(this.backdrop);

    // ── Ground grid ──────────────────────────────────────────────────

    const groundGeo = new THREE.PlaneGeometry(40, 40, 24, 24);
    this.groundMaterial = new THREE.ShaderMaterial({
      vertexShader: GROUND_VERTEX,
      fragmentShader: GROUND_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uSpeed: { value: config.animationSpeed },
        uPrimary: { value: new THREE.Color(palette.primary) },
        uSecondary: { value: new THREE.Color(palette.secondary) },
        uAccent: { value: new THREE.Color(palette.accent) },
        ...createTextureUniforms(config),
      },
      side: THREE.DoubleSide,
    });

    this.ground = new THREE.Mesh(groundGeo, this.groundMaterial);
    applyViewAngle(this.ground, Number(params.viewAngle ?? 0.5));
    this.scene.add(this.ground);
  }

  update(bass: number, mid: number, high: number): void {
    const time = this.clock.getElapsedTime();
    const r = this.config.audioReactivity;

    const b = this.backdropMaterial.uniforms;
    b.uTime.value = time;
    b.uBass.value = bass * r;
    b.uMid.value = mid * r;
    b.uHigh.value = high * r;

    const g = this.groundMaterial.uniforms;
    g.uTime.value = time;
    g.uBass.value = bass * r;
    g.uMid.value = mid * r;
    g.uHigh.value = high * r;
  }

  setTexture(texture: THREE.Texture | null): void {
    this.groundMaterial.uniforms.uTexture.value = texture;
    this.groundMaterial.uniforms.uHasTexture.value = texture !== null;
  }

  setTextureTransform(transform: TextureTransform): void {
    applyTextureTransform(this.groundMaterial, transform);
  }

  updateConfig(config: Partial<VisualizerConfig>): void {
    if (config.colorPalette) {
      const p = config.colorPalette;
      this.backdropMaterial.uniforms.uPrimary.value.set(p.primary);
      this.backdropMaterial.uniforms.uSecondary.value.set(p.secondary);
      this.backdropMaterial.uniforms.uAccent.value.set(p.accent);
      this.groundMaterial.uniforms.uPrimary.value.set(p.primary);
      this.groundMaterial.uniforms.uSecondary.value.set(p.secondary);
      this.groundMaterial.uniforms.uAccent.value.set(p.accent);
    }
    if (config.animationSpeed !== undefined) {
      this.backdropMaterial.uniforms.uSpeed.value = config.animationSpeed;
      this.groundMaterial.uniforms.uSpeed.value = config.animationSpeed;
    }
    if (config.textureScale !== undefined) {
      this.groundMaterial.uniforms.uTextureScale.value = config.textureScale;
    }
    if (config.sceneParams) {
      if (config.sceneParams.viewAngle !== undefined) {
        applyViewAngle(this.ground, Number(config.sceneParams.viewAngle));
      }
      if (config.sceneParams.arcDensity !== undefined) {
        this.backdropMaterial.uniforms.uArcCount.value =
          6 + Number(config.sceneParams.arcDensity) * 14;
      }
    }
    this.config = { ...this.config, ...config };
  }

  dispose(): void {
    this.scene.remove(this.backdrop);
    this.scene.remove(this.ground);
    this.backdrop.geometry.dispose();
    this.backdropMaterial.dispose();
    this.ground.geometry.dispose();
    this.groundMaterial.dispose();
  }
}

// ── Registration ────────────────────────────────────────────────────────────

const METADATA: SceneRegistration = {
  id: 'neonhorizon',
  name: 'Neon Horizon',
  description:
    'Tron-style concentric arcs with speed streaks, focal diamond, radial beams, and starfield',
  category: 'synthwave',
  cameraHint: 'low-angle',
  audioDescription:
    'Bass pulses arcs and speed streaks, mids light radial beams, highs sharpen grid and twinkle stars',
  features: ['textureScale', 'textureOpacity', 'textureAnimation', 'textureMotion'],
  params: [
    {
      key: 'viewAngle',
      label: 'View Angle',
      type: 'slider',
      min: 0,
      max: 1,
      step: 0.05,
      default: 0.5,
    },
    {
      key: 'arcDensity',
      label: 'Arc Density',
      type: 'slider',
      min: 0,
      max: 1,
      step: 0.05,
      default: 0.5,
    },
  ],
};

registerScene('neonhorizon', (scene, config) => new NeonHorizonScene(scene, config), METADATA);
