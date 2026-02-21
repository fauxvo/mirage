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

// ── Laser Grid ──────────────────────────────────────────────────────────────
// Tron-style infinite laser floor with vertical neon beams at grid intersections
// that respond to audio frequencies. Raymarched perspective grid with SDF glow.

const GRID_VERTEX = `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uBass;
  uniform float uSpeed;

  void main() {
    vUv = uv;
    vec3 pos = position;
    // Subtle bass-driven wave across the floor
    float wave = sin(pos.x * 2.0 + uTime * uSpeed * 0.8) *
                 cos(pos.y * 1.5 + uTime * uSpeed * 0.5) * 0.01 * (1.0 + uBass * 0.5);
    pos.z += wave;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const GRID_FRAGMENT =
  TEXTURE_UNIFORMS +
  TEXTURE_SAMPLE_FN +
  `
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uSpeed;
  uniform float uBeamIntensity;
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

  // SDF glow line — neon light emission
  float glowLine(float d, float core, float halo) {
    return core / (d * d + core) + halo / (d * d + halo);
  }

  void main() {
    // ── Perspective grid ──────────────────────────────────────────
    // Transform UVs into perspective-correct grid space
    float perspY = 1.0 / (vUv.y + 0.01); // perspective division
    float scroll = uTime * uSpeed * 0.3;
    vec2 gridPos;
    gridPos.x = (vUv.x - 0.5) * perspY * 4.0; // wider spread in distance
    gridPos.y = perspY * 2.0 - scroll;

    float density = 1.0;

    // SDF distance to nearest grid line
    float dx = abs(fract(gridPos.x * density) - 0.5) / density;
    float dy = abs(fract(gridPos.y * density) - 0.5) / density;

    // Perspective-adjusted line width — thinner at distance
    float lineScale = min(perspY * 0.1, 1.0);
    float coreWidth = 0.0003 * lineScale;
    float haloWidth = 0.004 * lineScale;

    float gx = glowLine(dx, coreWidth, haloWidth);
    float gy = glowLine(dy, coreWidth, haloWidth);
    float grid = min(gx + gy, 1.0);

    // Distance fade
    float distFade = 1.0 - smoothstep(0.0, 0.9, vUv.y);
    // Near-camera fade (avoid glitch at bottom edge)
    float nearFade = smoothstep(0.0, 0.08, vUv.y);
    grid *= distFade * nearFade;

    // Grid color intensity
    float intensity = 0.4 + uHigh * 0.4;
    vec3 color = uPrimary * grid * intensity;

    // ── Vertical beams at grid intersections ──────────────────────
    // Beam intensity maps to audio frequency
    vec2 cellId = floor(gridPos);
    vec2 cellFract = fract(gridPos) - 0.5;
    float cellDist = length(cellFract);

    // Each intersection gets a frequency band based on its X position
    float freqBand = fract(cellId.x * 0.333 + 0.5);
    float audioLevel;
    if (freqBand < 0.33) {
      audioLevel = uBass;
    } else if (freqBand < 0.66) {
      audioLevel = uMid;
    } else {
      audioLevel = uHigh;
    }

    // Beam — bright point at intersection with upward glow
    float beamCore = 0.001 / (cellDist * cellDist + 0.001);
    beamCore = min(beamCore, 1.0);
    float beamHeight = audioLevel * uBeamIntensity;
    beamCore *= beamHeight;
    beamCore *= distFade * nearFade;

    // Beam color varies with frequency band
    vec3 beamColor;
    if (freqBand < 0.33) {
      beamColor = uAccent;
    } else if (freqBand < 0.66) {
      beamColor = mix(uPrimary, uAccent, 0.5);
    } else {
      beamColor = uPrimary;
    }
    color += beamColor * beamCore;

    // ── Pulse ring — expanding from center on bass ───────────────
    float ringDist = abs(length(gridPos) - fract(uTime * uSpeed * 0.15) * 8.0);
    float ring = (0.01 / (ringDist * ringDist + 0.01)) * uBass * 0.2;
    ring *= distFade * nearFade;
    color += uAccent * ring;

    // ── Speed lines — radial streaks toward viewer ───────────────
    float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
    float streak = pow(abs(sin(angle * 20.0 + uTime * uSpeed * 0.5)), 30.0);
    streak *= smoothstep(0.0, 0.15, vUv.y) * (1.0 - smoothstep(0.3, 0.7, vUv.y));
    streak *= 0.1 * (1.0 + uBass * 0.8);
    color += mix(uPrimary, uAccent, 0.3) * streak;

    // ── Ambient floor tint ───────────────────────────────────────
    color += uSecondary * 0.01 * nearFade;

    if (uHasTexture) {
      vec4 tex = sampleTransformedTexture((vUv - 0.5) / uTextureScale + 0.5);
      color = mix(color, tex.rgb, tex.a);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ── Sky backdrop — dark with edge glow ──────────────────────────────────────

const SKY_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = `
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uSpeed;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform vec3 uAccent;
  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  void main() {
    vec2 uv = vUv;

    // Near-black sky with subtle gradient
    vec3 color = uSecondary * 0.01 * (1.0 + uv.y * 0.5);

    // Starfield — dense, cold
    float stars = 0.0;
    for (float layer = 0.0; layer < 4.0; layer++) {
      float scale = 50.0 + layer * 100.0;
      vec2 st = uv * scale;
      vec2 id = floor(st);
      vec2 f = fract(st) - 0.5;
      float bright = step(0.975, hash21(id + layer * 33.0));
      float twinkle = sin(uTime * uSpeed * (hash21(id + 5.0) * 1.5 + 0.3)) * 0.5 + 0.5;
      twinkle = 0.4 + twinkle * 0.6 * (1.0 + uHigh * 0.3);
      stars += bright * exp(-dot(f, f) * 120.0) * twinkle;
    }
    color += vec3(stars * 0.5);

    // Horizon glow — bottom of sky
    float horizonGlow = exp(-uv.y * 8.0) * 0.15 * (1.0 + uBass * 0.3);
    color += uPrimary * horizonGlow;

    // Vertical beam columns in the distance — subtle
    float beamAngle = (uv.x - 0.5) * 20.0;
    float beam = pow(abs(sin(beamAngle + uTime * uSpeed * 0.03)), 20.0);
    beam *= exp(-uv.y * 3.0) * 0.06 * (1.0 + uMid * 0.5);
    color += uAccent * beam;

    // Scanlines
    float scanline = sin(uv.y * 500.0) * 0.5 + 0.5;
    color *= 0.96 + scanline * 0.04;

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ── Scene class ─────────────────────────────────────────────────────────────

export class LaserGridScene {
  private ground: THREE.Mesh;
  private groundMaterial: THREE.ShaderMaterial;
  private sky: THREE.Mesh;
  private skyMaterial: THREE.ShaderMaterial;
  private clock: THREE.Clock;

  constructor(
    private scene: THREE.Scene,
    private config: VisualizerConfig
  ) {
    this.clock = new THREE.Clock();
    const palette = config.colorPalette;
    const params = config.sceneParams ?? {};

    // ── Sky backdrop ────────────────────────────────────────────────

    const skyGeo = new THREE.PlaneGeometry(48, 28);
    this.skyMaterial = new THREE.ShaderMaterial({
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uSpeed: { value: config.animationSpeed },
        uPrimary: { value: new THREE.Color(palette.primary) },
        uSecondary: { value: new THREE.Color(palette.secondary) },
        uAccent: { value: new THREE.Color(palette.accent) },
      },
      fog: false,
      depthWrite: false,
    });

    this.sky = new THREE.Mesh(skyGeo, this.skyMaterial);
    this.sky.position.set(0, 5, -12);
    this.scene.add(this.sky);

    // ── Laser grid floor ────────────────────────────────────────────

    const groundGeo = new THREE.PlaneGeometry(40, 40, 32, 32);
    this.groundMaterial = new THREE.ShaderMaterial({
      vertexShader: GRID_VERTEX,
      fragmentShader: GRID_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uSpeed: { value: config.animationSpeed },
        uBeamIntensity: { value: 0.3 + Number(params.beamIntensity ?? 0.5) * 0.7 },
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

    const g = this.groundMaterial.uniforms;
    g.uTime.value = time;
    g.uBass.value = bass * r;
    g.uMid.value = mid * r;
    g.uHigh.value = high * r;

    const s = this.skyMaterial.uniforms;
    s.uTime.value = time;
    s.uBass.value = bass * r;
    s.uMid.value = mid * r;
    s.uHigh.value = high * r;
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
      this.groundMaterial.uniforms.uPrimary.value.set(p.primary);
      this.groundMaterial.uniforms.uSecondary.value.set(p.secondary);
      this.groundMaterial.uniforms.uAccent.value.set(p.accent);
      this.skyMaterial.uniforms.uPrimary.value.set(p.primary);
      this.skyMaterial.uniforms.uSecondary.value.set(p.secondary);
      this.skyMaterial.uniforms.uAccent.value.set(p.accent);
    }
    if (config.animationSpeed !== undefined) {
      this.groundMaterial.uniforms.uSpeed.value = config.animationSpeed;
      this.skyMaterial.uniforms.uSpeed.value = config.animationSpeed;
    }
    if (config.textureScale !== undefined) {
      this.groundMaterial.uniforms.uTextureScale.value = config.textureScale;
    }
    if (config.sceneParams) {
      if (config.sceneParams.viewAngle !== undefined) {
        applyViewAngle(this.ground, Number(config.sceneParams.viewAngle));
      }
      if (config.sceneParams.beamIntensity !== undefined) {
        this.groundMaterial.uniforms.uBeamIntensity.value =
          0.3 + Number(config.sceneParams.beamIntensity) * 0.7;
      }
    }
    this.config = { ...this.config, ...config };
  }

  dispose(): void {
    this.scene.remove(this.ground);
    this.scene.remove(this.sky);
    this.ground.geometry.dispose();
    this.groundMaterial.dispose();
    this.sky.geometry.dispose();
    this.skyMaterial.dispose();
  }
}

// ── Registration ────────────────────────────────────────────────────────────

const METADATA: SceneRegistration = {
  id: 'lasergrid',
  name: 'Laser Grid',
  description:
    'Tron-inspired infinite perspective grid with frequency-mapped neon beams at intersections',
  category: 'synthwave',
  cameraHint: 'low-angle',
  audioDescription:
    'Bass/mid/high each light different beam columns, bass drives pulse rings and speed streaks',
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
      key: 'beamIntensity',
      label: 'Beam Intensity',
      type: 'slider',
      min: 0,
      max: 1,
      step: 0.05,
      default: 0.5,
    },
  ],
};

registerScene('lasergrid', (scene, config) => new LaserGridScene(scene, config), METADATA);
