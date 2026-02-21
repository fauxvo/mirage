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

// ── City skyline shader ─────────────────────────────────────────────────────
// Procedural city silhouette with neon windows, volumetric beams, and starfield

const CITY_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CITY_FRAGMENT = `
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uSpeed;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform vec3 uAccent;
  uniform float uDensity;
  varying vec2 vUv;

  float hash(float n) { return fract(sin(n) * 43758.5453); }
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  // Procedural building height for a given column
  float buildingHeight(float col) {
    float h = hash(floor(col) * 17.3) * 0.5 + 0.1;
    // Taller buildings in center, shorter at edges
    float center = 1.0 - abs(col - 0.5) * 1.6;
    h *= 0.4 + center * 0.6;
    return h;
  }

  void main() {
    vec2 uv = vUv;

    // ── Sky gradient + starfield ────────────────────────────────
    float skyGrad = smoothstep(0.3, 0.95, uv.y);
    vec3 skyColor = mix(uSecondary * 0.02, uAccent * 0.06, skyGrad);
    skyColor += uPrimary * 0.02 * (1.0 + uMid * 0.5);

    // Stars
    float stars = 0.0;
    for (float layer = 0.0; layer < 3.0; layer++) {
      float scale = 60.0 + layer * 120.0;
      vec2 st = uv * scale;
      vec2 id = floor(st);
      vec2 f = fract(st) - 0.5;
      float bright = step(0.97, hash2(id + layer * 77.0));
      float twinkle = sin(uTime * uSpeed * (hash2(id + 3.0) * 2.0 + 0.5)) * 0.5 + 0.5;
      twinkle = 0.5 + twinkle * 0.5 * (1.0 + uHigh * 0.5);
      stars += bright * exp(-dot(f, f) * 120.0) * twinkle;
    }
    // Stars only visible above buildings — we'll composite below
    vec3 color = skyColor + vec3(stars * 0.7);

    // ── Buildings ───────────────────────────────────────────────
    float cols = 12.0 + uDensity * 20.0;
    float col = uv.x * cols;
    float colFract = fract(col);
    float colId = floor(col);

    // Building body — gap between buildings
    float gap = 0.08;
    float inBuilding = step(gap, colFract) * step(colFract, 1.0 - gap);

    // Building height
    float bHeight = buildingHeight(colId / cols);
    bHeight += uBass * 0.15;
    float aboveGround = step(1.0 - bHeight, uv.y) * inBuilding;

    // Window grid
    float windowX = fract(colFract * 4.0);
    float windowY = fract(uv.y * cols * 1.5);
    float windowMask = step(0.2, windowX) * step(windowX, 0.8)
                     * step(0.15, windowY) * step(windowY, 0.85);

    // Random window on/off + flicker
    float windowId = hash2(vec2(floor(colFract * 4.0) + colId * 4.0,
                                floor(uv.y * cols * 1.5)));
    float windowOn = step(0.35, windowId);
    float flicker = step(0.97, hash2(vec2(windowId, floor(uTime * uSpeed * 2.0))));
    windowOn = max(windowOn, flicker * uHigh);

    // Window color — mix primary and accent
    float windowHue = hash(floor(colFract * 4.0) + colId * 7.0);
    vec3 windowColor = mix(uPrimary, uAccent, step(0.6, windowHue));
    windowColor *= (0.6 + uHigh * 0.8);

    // Building silhouette — dark with neon edge glow (Tron-style)
    vec3 buildingColor = vec3(0.005);
    float edgeGlow = 1.0 - abs(colFract - 0.5) * 2.0;
    // Neon contour lines on building edges
    float leftEdge = smoothstep(gap, gap + 0.02, colFract);
    float rightEdge = smoothstep(1.0 - gap, 1.0 - gap - 0.02, colFract);
    float topEdge = smoothstep(1.0 - bHeight, 1.0 - bHeight + 0.008, uv.y) *
                    (1.0 - smoothstep(1.0 - bHeight + 0.008, 1.0 - bHeight + 0.016, uv.y));
    float edgeLines = (1.0 - leftEdge) + (1.0 - rightEdge) + topEdge;
    buildingColor += uPrimary * edgeLines * 0.25 * (1.0 + uMid * 0.5);

    // Compose building
    vec3 bldgFinal = mix(buildingColor, windowColor, windowMask * windowOn) * aboveGround;
    color = mix(color, bldgFinal, aboveGround);

    // ── Volumetric light beams from behind buildings ─────────────
    float beamCount = 6.0;
    float beamAngle = (uv.x - 0.5) * beamCount + uTime * uSpeed * 0.02;
    float beam = pow(abs(sin(beamAngle * 3.14159)), 12.0);
    float beamMask = smoothstep(0.3, 0.7, uv.y) * (1.0 - aboveGround);
    beam *= beamMask * 0.08 * (1.0 + uBass * 0.5);
    color += uAccent * beam;

    // ── Horizon glow ────────────────────────────────────────────
    float horizonLine = 1.0 - max(bHeight, 0.15);
    float horizonDist = abs(uv.y - horizonLine);
    float horizonGlow = exp(-horizonDist * 12.0) * 0.25 * (1.0 + uBass * 0.5);
    color += uAccent * horizonGlow * (1.0 - aboveGround);

    // ── Scanline overlay ────────────────────────────────────────
    float scanline = sin(uv.y * 500.0) * 0.5 + 0.5;
    color *= 0.95 + scanline * 0.05;

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ── Ground reflection shader ────────────────────────────────────────────────

const GROUND_VERTEX = `
  varying vec2 vUv;
  varying float vElevation;
  uniform float uTime;
  uniform float uBass;
  uniform float uSpeed;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Subtle ripple on the ground
    float ripple = sin(pos.x * 3.0 + uTime * uSpeed) * cos(pos.y * 2.0 + uTime * uSpeed * 0.7);
    pos.z += ripple * 0.02 * (1.0 + uBass * 0.5);
    vElevation = pos.z;

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
  uniform float uBass;
  uniform float uTime;
  uniform float uSpeed;
  varying vec2 vUv;
  varying float vElevation;

  #define PI 3.14159265359

  // SDF glow line
  float glowLine(float d, float width, float glow) {
    return width / (d * d + width) + glow / (d * d + glow);
  }

  void main() {
    // Scrolling grid on the ground
    float scroll = uTime * uSpeed * 0.2;
    vec2 gridUv = vec2(vUv.x, vUv.y + scroll);
    float density = 24.0;

    // SDF glow grid — Tron-style neon lines
    float dx = abs(fract(gridUv.x * density) - 0.5) / density;
    float dy = abs(fract(gridUv.y * density) - 0.5) / density;
    float gx = glowLine(dx, 0.0002, 0.002);
    float gy = glowLine(dy, 0.0002, 0.002);
    float grid = min(gx + gy, 1.0);

    // Grid fades with distance
    float distFade = 1.0 - smoothstep(0.0, 0.85, vUv.y);
    grid *= distFade;

    float intensity = 0.4 + uHigh * 0.4;
    vec3 color = uPrimary * grid * intensity;

    // Wet-street reflective sheen — fake city reflection
    float reflectionY = 1.0 - vUv.y; // flip Y
    float refl = smoothstep(0.0, 0.3, reflectionY) * 0.08;
    vec3 reflColor = mix(uAccent, uPrimary, reflectionY) * refl;
    reflColor *= (1.0 + uBass * 0.3);
    color += reflColor * distFade;

    // Dark reflective base
    color += uSecondary * 0.015;

    // Ripple highlight on elevation
    float rippleHighlight = smoothstep(0.0, 0.02, vElevation) * 0.15;
    color += uAccent * rippleHighlight * distFade;

    if (uHasTexture) {
      vec4 tex = sampleTransformedTexture((vUv - 0.5) / uTextureScale + 0.5);
      color = mix(color, tex.rgb, tex.a);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ── Scene class ─────────────────────────────────────────────────────────────

export class SynthcityScene {
  private cityPlane: THREE.Mesh;
  private cityMaterial: THREE.ShaderMaterial;
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

    // ── City skyline backdrop ────────────────────────────────────────

    const cityGeo = new THREE.PlaneGeometry(48, 28);
    this.cityMaterial = new THREE.ShaderMaterial({
      vertexShader: CITY_VERTEX,
      fragmentShader: CITY_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uSpeed: { value: config.animationSpeed },
        uPrimary: { value: new THREE.Color(palette.primary) },
        uSecondary: { value: new THREE.Color(palette.secondary) },
        uAccent: { value: new THREE.Color(palette.accent) },
        uDensity: { value: Number(params.buildingDensity ?? 0.5) },
      },
      fog: false,
    });

    this.cityPlane = new THREE.Mesh(cityGeo, this.cityMaterial);
    this.cityPlane.position.set(0, 5, -12);
    this.scene.add(this.cityPlane);

    // ── Reflective ground ────────────────────────────────────────────

    const groundGeo = new THREE.PlaneGeometry(40, 40, 32, 32);
    this.groundMaterial = new THREE.ShaderMaterial({
      vertexShader: GROUND_VERTEX,
      fragmentShader: GROUND_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
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
    this.applyViewAngle(Number(params.viewAngle ?? 0.5));
    this.scene.add(this.ground);
  }

  /** Map viewAngle (0 = top-down, 1 = horizon) to mesh tilt + vertical offset. */
  private applyViewAngle(viewAngle: number): void {
    const tilt = -Math.PI * (0.5 - viewAngle * 0.35);
    const yOffset = -1.5 + viewAngle * 1.0;
    this.ground.rotation.x = tilt;
    this.ground.position.y = yOffset;
  }

  update(bass: number, mid: number, high: number): void {
    const time = this.clock.getElapsedTime();
    const r = this.config.audioReactivity;

    const u = this.cityMaterial.uniforms;
    u.uTime.value = time;
    u.uBass.value = bass * r;
    u.uMid.value = mid * r;
    u.uHigh.value = high * r;

    const g = this.groundMaterial.uniforms;
    g.uTime.value = time;
    g.uBass.value = bass * r;
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
      this.cityMaterial.uniforms.uPrimary.value.set(p.primary);
      this.cityMaterial.uniforms.uSecondary.value.set(p.secondary);
      this.cityMaterial.uniforms.uAccent.value.set(p.accent);
      this.groundMaterial.uniforms.uPrimary.value.set(p.primary);
      this.groundMaterial.uniforms.uSecondary.value.set(p.secondary);
      this.groundMaterial.uniforms.uAccent.value.set(p.accent);
    }
    if (config.animationSpeed !== undefined) {
      this.cityMaterial.uniforms.uSpeed.value = config.animationSpeed;
      this.groundMaterial.uniforms.uSpeed.value = config.animationSpeed;
    }
    if (config.textureScale !== undefined) {
      this.groundMaterial.uniforms.uTextureScale.value = config.textureScale;
    }
    if (config.sceneParams) {
      if (config.sceneParams.viewAngle !== undefined) {
        this.applyViewAngle(Number(config.sceneParams.viewAngle));
      }
      if (config.sceneParams.buildingDensity !== undefined) {
        this.cityMaterial.uniforms.uDensity.value = Number(config.sceneParams.buildingDensity);
      }
    }
    this.config = { ...this.config, ...config };
  }

  dispose(): void {
    this.scene.remove(this.cityPlane);
    this.scene.remove(this.ground);
    this.cityPlane.geometry.dispose();
    this.cityMaterial.dispose();
    this.ground.geometry.dispose();
    this.groundMaterial.dispose();
  }
}

// ── Registration ────────────────────────────────────────────────────────────

const METADATA: SceneRegistration = {
  id: 'synthcity',
  name: 'Synth City',
  description:
    'Neon cityscape with Tron-style edge glow, volumetric beams, wet-street reflections, and starfield',
  category: 'synthwave',
  cameraHint: 'low-angle',
  audioDescription:
    'Bass pulses building heights and light beams, mids warm building edges, highs brighten windows and stars',
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
      key: 'buildingDensity',
      label: 'Building Density',
      type: 'slider',
      min: 0,
      max: 1,
      step: 0.05,
      default: 0.5,
    },
  ],
};

registerScene('synthcity', (scene, config) => new SynthcityScene(scene, config), METADATA);
