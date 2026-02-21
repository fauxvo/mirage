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

const GRID_DENSITY_MAP: Record<string, number> = { sparse: 12, normal: 24, dense: 48 };

// ── Simplex noise ────────────────────────────────────────────────────────────

const NOISE_GLSL = `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                        -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
`;

// ── Terrain shaders ─────────────────────────────────────────────────────────

const TERRAIN_VERTEX = `
  ${NOISE_GLSL}
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uSpeed;
  uniform float uPeakHeight;
  uniform float uScrollSpeed;
  varying vec2 vUv;
  varying vec2 vGridUv;
  varying float vElevation;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Scroll UVs for infinite terrain movement
    float scroll = uTime * uScrollSpeed * uSpeed * 0.15;
    vGridUv = vec2(uv.x, uv.y + scroll);

    // Edge mask: flat center "road", peaks rise at sides
    float edgeMask = smoothstep(0.15, 0.45, abs(uv.x - 0.5) * 2.0);

    // Multi-octave noise displacement using scrolled coordinates
    vec2 nc = vec2(pos.x * 1.5, pos.y * 1.0 + scroll * 8.0);
    float n = snoise(nc) * 0.6
            + snoise(nc * 2.5 + 5.0) * 0.3
            + snoise(nc * 5.0 + 10.0) * 0.1;

    // Bass drives peak height
    float disp = n * edgeMask * uPeakHeight * (1.0 + uBass * 3.0);
    pos.z += disp;
    vElevation = disp;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const TERRAIN_FRAGMENT =
  TEXTURE_UNIFORMS +
  TEXTURE_SAMPLE_FN +
  `
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform vec3 uAccent;
  uniform float uHigh;
  uniform float uMid;
  uniform float uBass;
  uniform float uGridDensity;
  uniform float uTime;
  uniform float uSpeed;
  varying vec2 vUv;
  varying vec2 vGridUv;
  varying float vElevation;

  #define PI 3.14159265359

  // SDF glow line — creates neon-like soft glow instead of hard edges
  float glowLine(float d, float width, float glow) {
    return width / (d * d + width) + glow / (d * d + glow);
  }

  void main() {
    float freq = uGridDensity * 2.0 * PI;

    // SDF distance to nearest grid line — creates real neon glow
    float dx = abs(fract(vGridUv.x * uGridDensity) - 0.5) / uGridDensity;
    float dy = abs(fract(vGridUv.y * uGridDensity) - 0.5) / uGridDensity;

    // Glow with two radii: sharp core + soft halo
    float lineCore = 0.0003;
    float lineHalo = 0.003;
    float gx = glowLine(dx, lineCore, lineHalo);
    float gy = glowLine(dy, lineCore, lineHalo);
    float grid = min(gx + gy, 1.0);

    // Grid color — highs boost intensity
    float intensity = 0.5 + uHigh * 0.5;
    vec3 gridColor = uPrimary * intensity;

    // Bass shockwave ring — expands from center on bass hits
    float shockDist = abs(length(vGridUv - vec2(0.5, 0.5)) - fract(uTime * uSpeed * 0.3) * 0.8);
    float shockwave = (0.003 / (shockDist * shockDist + 0.003)) * uBass * 0.3;
    gridColor += uAccent * shockwave;

    // Peak glow with accent color — mids add warmth
    float peakGlow = smoothstep(0.05, 0.5, vElevation);
    vec3 peakColor = uAccent * peakGlow * (0.4 + uMid * 0.5);

    // Terrain edge glow — neon contour light along elevated ridges
    float edgeLight = smoothstep(0.0, 0.15, vElevation) * (1.0 - smoothstep(0.15, 0.5, vElevation));
    vec3 edgeColor = mix(uPrimary, uAccent, 0.5) * edgeLight * 0.6;

    // Compose
    vec3 color = gridColor * grid + peakColor + edgeColor;

    // Depth fade toward horizon with color shift
    float depth = smoothstep(0.0, 1.0, vUv.y);
    color = mix(color, uSecondary * 0.05, depth * 0.5);

    // Heat haze — subtle UV distortion near ground
    float haze = sin(vGridUv.x * 40.0 + uTime * uSpeed * 2.0) *
                 sin(vGridUv.y * 30.0 + uTime * uSpeed * 1.5) * 0.02 * (1.0 - vUv.y);
    color *= 1.0 + haze;

    if (uHasTexture) {
      vec4 tex = sampleTransformedTexture((vUv - 0.5) / uTextureScale + 0.5);
      color = mix(color, tex.rgb, tex.a);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ── Sky backdrop with starfield + mountains ─────────────────────────────────

const SKY_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = `
  uniform vec3 uSunTop;
  uniform vec3 uSunBottom;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform vec3 uAccent;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uTime;
  uniform float uSpeed;
  uniform bool uShowSun;
  varying vec2 vUv;

  #define PI 3.14159265359

  // Hash for starfield
  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  // Procedural mountain ridge silhouette
  float ridge(float x, float freq, float seed) {
    float h = 0.0;
    h += sin(x * freq + seed) * 0.5;
    h += sin(x * freq * 2.3 + seed * 1.7) * 0.25;
    h += sin(x * freq * 4.1 + seed * 3.1) * 0.125;
    h += sin(x * freq * 7.7 + seed * 5.3) * 0.0625;
    return h * 0.5 + 0.5;
  }

  void main() {
    vec2 uv = vUv;

    // ── Sky gradient ──────────────────────────────────────────────
    float skyGrad = smoothstep(0.0, 0.8, uv.y);
    vec3 skyBottom = uSecondary * 0.03;
    vec3 skyTop = mix(uPrimary * 0.08, uAccent * 0.04, 0.5);
    vec3 color = mix(skyBottom, skyTop, skyGrad);

    // ── Starfield ─────────────────────────────────────────────────
    float stars = 0.0;
    for (float layer = 0.0; layer < 3.0; layer++) {
      float scale = 80.0 + layer * 150.0;
      vec2 st = uv * scale;
      vec2 id = floor(st);
      vec2 f = fract(st) - 0.5;
      float brightness = step(0.97, hash21(id + layer * 100.0));
      float twinkle = sin(uTime * uSpeed * (hash21(id + 7.0) * 2.0 + 0.5) + hash21(id) * 6.28) * 0.5 + 0.5;
      twinkle = 0.5 + twinkle * 0.5 * (1.0 + uHigh * 0.5);
      float star = brightness * exp(-dot(f, f) * 100.0) * twinkle;
      stars += star;
    }
    color += vec3(stars) * 0.8;

    // ── Sun ───────────────────────────────────────────────────────
    if (uShowSun) {
      vec2 sunCenter = vec2(0.5, 0.35);
      vec2 c = uv - sunCenter;
      float dist = length(c);
      float radius = 0.18 + uBass * 0.005; // subtle bass breathing

      // Sun disc
      float sun = 1.0 - smoothstep(radius - 0.003, radius + 0.003, dist);

      // Vertical gradient within disc
      float grad = (c.y + radius) / (2.0 * radius);
      vec3 sunColor = mix(uSunBottom, uSunTop, clamp(grad, 0.0, 1.0));

      // Scanlines in bottom half — progressively wider, with subtle jitter
      if (c.y < 0.0 && dist < radius) {
        float t = -c.y / radius;
        float warped = pow(t, 0.6);
        float scanJitter = sin(uTime * uSpeed * 0.5 + t * 10.0) * 0.02;
        sun *= step(0.0, sin((warped + scanJitter) * 50.0));
      }

      // God rays — radial light streaks from sun
      float angle = atan(c.y, c.x);
      float rays = pow(abs(sin(angle * 8.0 + uTime * uSpeed * 0.1)), 8.0);
      float rayFade = exp(-dist * 4.0) * 0.15 * (1.0 + uBass * 0.3);
      vec3 rayColor = uSunTop * rays * rayFade;

      // Wide ambient halo
      float halo = exp(-dist * 3.0) * 0.25 * (1.0 + uBass * 0.3);
      vec3 haloColor = mix(uSunBottom, uSunTop, 0.5) * halo;

      // Inner glow ring at edge of disc
      float edgeGlow = exp(-abs(dist - radius) * 80.0) * 0.4;
      vec3 edgeColor = uSunTop * edgeGlow;

      color += sunColor * sun + rayColor + haloColor + edgeColor;
    }

    // ── Mountain silhouettes (3 parallax layers) ──────────────────
    // Back layer — distant, low, slow drift
    float m3 = ridge(uv.x, 3.0, 42.0 + uTime * uSpeed * 0.003) * 0.15 + 0.08;
    float mountainBack = step(uv.y, m3);
    color = mix(color, uSecondary * 0.03, mountainBack);

    // Mid layer
    float m2 = ridge(uv.x, 4.5, 17.0 + uTime * uSpeed * 0.006) * 0.12 + 0.04;
    float mountainMid = step(uv.y, m2);
    color = mix(color, uSecondary * 0.02, mountainMid);

    // Front layer — nearest, tallest
    float m1 = ridge(uv.x, 6.0, 73.0 + uTime * uSpeed * 0.01) * 0.08 + 0.01;
    float mountainFront = step(uv.y, m1);
    // Front mountains get a subtle neon edge glow
    float mEdge = smoothstep(m1, m1 + 0.005, uv.y);
    color = mix(color, vec3(0.0), mountainFront);
    color += uPrimary * 0.15 * (1.0 - mEdge) * step(uv.y, m1 + 0.005) * (1.0 + uMid * 0.3);

    // ── Scanline overlay ──────────────────────────────────────────
    float scanline = sin(uv.y * 400.0) * 0.5 + 0.5;
    color *= 0.95 + scanline * 0.05;

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ── Scene class ─────────────────────────────────────────────────────────────

export class VaporwaveScene {
  private terrain: THREE.Mesh;
  private terrainMaterial: THREE.ShaderMaterial;
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

    // ── Sky backdrop (starfield + sun + mountains) ──────────────────

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
        uShowSun: { value: (params.showSun ?? true) !== false },
        uSunTop: { value: new THREE.Color(palette.accent) },
        uSunBottom: { value: new THREE.Color(palette.primary) },
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

    // ── Terrain ──────────────────────────────────────────────────────

    const geometry = new THREE.PlaneGeometry(40, 40, 48, 64);
    this.terrainMaterial = new THREE.ShaderMaterial({
      vertexShader: TERRAIN_VERTEX,
      fragmentShader: TERRAIN_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uSpeed: { value: config.animationSpeed },
        uPeakHeight: { value: 0.1 + Number(params.peakHeight ?? 0.5) * 0.9 },
        uScrollSpeed: { value: 0.5 + Number(params.scrollSpeed ?? 0.5) * 2.5 },
        uGridDensity: { value: GRID_DENSITY_MAP[String(params.gridDensity ?? 'normal')] ?? 24 },
        uPrimary: { value: new THREE.Color(palette.primary) },
        uSecondary: { value: new THREE.Color(palette.secondary) },
        uAccent: { value: new THREE.Color(palette.accent) },
        ...createTextureUniforms(config),
      },
      side: THREE.DoubleSide,
    });

    this.terrain = new THREE.Mesh(geometry, this.terrainMaterial);
    applyViewAngle(this.terrain, Number(params.viewAngle ?? 0.5));
    this.scene.add(this.terrain);
  }

  update(bass: number, mid: number, high: number): void {
    const time = this.clock.getElapsedTime();
    const r = this.config.audioReactivity;

    const t = this.terrainMaterial.uniforms;
    t.uTime.value = time;
    t.uBass.value = bass * r;
    t.uMid.value = mid * r;
    t.uHigh.value = high * r;

    const s = this.skyMaterial.uniforms;
    s.uTime.value = time;
    s.uBass.value = bass * r;
    s.uMid.value = mid * r;
    s.uHigh.value = high * r;
  }

  setTexture(texture: THREE.Texture | null): void {
    this.terrainMaterial.uniforms.uTexture.value = texture;
    this.terrainMaterial.uniforms.uHasTexture.value = texture !== null;
  }

  setTextureTransform(transform: TextureTransform): void {
    applyTextureTransform(this.terrainMaterial, transform);
  }

  updateConfig(config: Partial<VisualizerConfig>): void {
    if (config.colorPalette) {
      const p = config.colorPalette;
      this.terrainMaterial.uniforms.uPrimary.value.set(p.primary);
      this.terrainMaterial.uniforms.uSecondary.value.set(p.secondary);
      this.terrainMaterial.uniforms.uAccent.value.set(p.accent);
      this.skyMaterial.uniforms.uSunTop.value.set(p.accent);
      this.skyMaterial.uniforms.uSunBottom.value.set(p.primary);
      this.skyMaterial.uniforms.uPrimary.value.set(p.primary);
      this.skyMaterial.uniforms.uSecondary.value.set(p.secondary);
      this.skyMaterial.uniforms.uAccent.value.set(p.accent);
    }
    if (config.animationSpeed !== undefined) {
      this.terrainMaterial.uniforms.uSpeed.value = config.animationSpeed;
      this.skyMaterial.uniforms.uSpeed.value = config.animationSpeed;
    }
    if (config.textureScale !== undefined) {
      this.terrainMaterial.uniforms.uTextureScale.value = config.textureScale;
    }
    if (config.sceneParams) {
      if (config.sceneParams.viewAngle !== undefined) {
        applyViewAngle(this.terrain, Number(config.sceneParams.viewAngle));
      }
      if (config.sceneParams.peakHeight !== undefined) {
        this.terrainMaterial.uniforms.uPeakHeight.value =
          0.1 + Number(config.sceneParams.peakHeight) * 0.9;
      }
      if (config.sceneParams.scrollSpeed !== undefined) {
        this.terrainMaterial.uniforms.uScrollSpeed.value =
          0.5 + Number(config.sceneParams.scrollSpeed) * 2.5;
      }
      if (config.sceneParams.gridDensity !== undefined) {
        this.terrainMaterial.uniforms.uGridDensity.value =
          GRID_DENSITY_MAP[String(config.sceneParams.gridDensity)] ?? 24;
      }
      if (config.sceneParams.showSun !== undefined) {
        this.skyMaterial.uniforms.uShowSun.value = config.sceneParams.showSun !== false;
      }
    }
    this.config = { ...this.config, ...config };
  }

  dispose(): void {
    this.scene.remove(this.terrain);
    this.scene.remove(this.sky);
    this.terrain.geometry.dispose();
    this.terrainMaterial.dispose();
    this.sky.geometry.dispose();
    this.skyMaterial.dispose();
  }
}

// ── Registration ────────────────────────────────────────────────────────────

const METADATA: SceneRegistration = {
  id: 'vaporwave',
  name: 'Vaporwave',
  description:
    'Retro synthwave terrain with neon grid, parallax mountains, starfield, and setting sun. Inspired by Maxime Heckel (github.com/MaximeHeckel/linear-vaporwave-react-three-fiber).',
  category: 'synthwave',
  cameraHint: 'low-angle',
  audioDescription:
    'Bass drives terrain peaks and sun pulse, mids glow ridges and mountain edges, highs intensify grid and stars',
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
      key: 'peakHeight',
      label: 'Peak Height',
      type: 'slider',
      min: 0,
      max: 1,
      step: 0.05,
      default: 0.5,
    },
    {
      key: 'scrollSpeed',
      label: 'Scroll Speed',
      type: 'slider',
      min: 0,
      max: 1,
      step: 0.05,
      default: 0.5,
    },
    {
      key: 'gridDensity',
      label: 'Grid Density',
      type: 'select',
      options: [
        { label: 'Sparse', value: 'sparse' },
        { label: 'Normal', value: 'normal' },
        { label: 'Dense', value: 'dense' },
      ],
      default: 'normal',
    },
    {
      key: 'showSun',
      label: 'Retro Sun',
      type: 'toggle',
      default: true,
    },
  ],
};

registerScene('vaporwave', (scene, config) => new VaporwaveScene(scene, config), METADATA);
