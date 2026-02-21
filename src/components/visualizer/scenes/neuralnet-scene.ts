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

// ── Neural Net ──────────────────────────────────────────────────────────────
// Connected glowing nodes drifting through parallax layers, forming an organic
// neural-network-like mesh. Grid-based spatial hashing with SDF line segments
// and layered compositing.
//
// Inspired by "The Universe Within" (ShaderToy lscczl) by BigWIngs
// https://www.shadertoy.com/view/lscczl
// Author: Martijn Steinrucken — "The Art of Code"
// YouTube: youtube.com/@TheArtOfCodeIsCool | Patreon: patreon.com/TheArtOfCode
// Twitter: @The_ArtOfCode | Email: countfrolic@gmail.com
// License: CC BY-NC-SA 3.0

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
  uniform float uNodeSize;
  uniform float uLineWidth;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform vec3 uAccent;
  varying vec2 vUv;

  #define NUM_LAYERS 4.0
  #define S(a, b, t) smoothstep(a, b, t)

  float N21(vec2 p) {
    vec3 a = fract(vec3(p.xyx) * vec3(213.897, 653.453, 253.098));
    a += dot(a, a.yzx + 79.76);
    return fract((a.x + a.y) * a.z);
  }

  vec2 GetPos(vec2 id, vec2 offs, float t) {
    float n = N21(id + offs);
    float n1 = fract(n * 10.0);
    float n2 = fract(n * 100.0);
    float a = t + n;
    // Bass drives node wobble amplitude
    float amp = 0.4 + uBass * 0.2;
    return offs + vec2(sin(a * n1), cos(a * n2)) * amp;
  }

  float df_line(vec2 a, vec2 b, vec2 p) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
  }

  float line(vec2 a, vec2 b, vec2 uv) {
    float r1 = uLineWidth * 0.04 + uBass * 0.02;
    float r2 = uLineWidth * 0.01 + uHigh * 0.01;
    float d = df_line(a, b, uv);
    float d2 = length(a - b);
    float fade = S(1.5, 0.5, d2);
    fade += S(0.04, 0.02, abs(d2 - 0.75));
    return S(r1, r2, d) * fade;
  }

  float NetLayer(vec2 st, float n, float t) {
    vec2 id = floor(st) + n;
    st = fract(st) - 0.5;
    vec2 p[9];
    int k = 0;
    for (float y = -1.0; y <= 1.0; y++) {
      for (float x = -1.0; x <= 1.0; x++) {
        p[k++] = GetPos(id, vec2(x, y), t);
      }
    }

    float m = 0.0;
    float sparkle = 0.0;

    for (int i = 0; i < 9; i++) {
      m += line(p[4], p[i], st); // connect center to all neighbors
      float d = length(st - p[i]);

      // Glowing dots at nodes
      float nodeR = uNodeSize * (0.04 + uHigh * 0.02);
      float s = S(nodeR, 0.0, d);
      float pulse = sin(t + fract(N21(id + float(i))) * 6.2831) * 0.5 + 0.5;
      sparkle += s * pulse;
    }

    m += sparkle;
    return m;
  }

  void main() {
    vec2 uv = (vUv - 0.5) * 2.0;
    uv.x *= 1.777;

    float t = uTime * uSpeed * 0.3;
    vec3 col = vec3(0.0);

    // Multi-layer parallax compositing
    for (float i = 0.0; i < NUM_LAYERS; i++) {
      float depth = fract(i / NUM_LAYERS + t * 0.05);
      float scale = mix(8.0, 0.5, depth);
      float fade = depth * S(1.0, 0.9, depth);

      // Mid drives layer visibility
      fade *= 0.8 + uMid * 0.4;

      float n = i;
      vec2 st = uv * scale + i * 20.0;
      st += vec2(t * 0.1, 0.0);

      float net = NetLayer(st, n, t);

      // Each layer gets a different color mix
      float hue = fract(i / NUM_LAYERS + t * 0.03);
      vec3 layerColor = mix(
        uPrimary,
        mix(uAccent, uSecondary, hue),
        hue
      );

      col += net * layerColor * fade;
    }

    // Overall brightness — bass-reactive
    col *= 0.6 + uBass * 0.8;

    // Vignette
    float vig = 1.0 - dot(vUv - 0.5, vUv - 0.5) * 2.0;
    col *= vig;

    if (uHasTexture) {
      vec4 tex = sampleTransformedTexture((vUv - 0.5) / uTextureScale + 0.5);
      col = mix(col, tex.rgb, tex.a);
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ── Scene class ─────────────────────────────────────────────────────────────

export class NeuralNetScene {
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

    const geometry = new THREE.PlaneGeometry(12, 12);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uSpeed: { value: config.animationSpeed },
        uNodeSize: { value: Number(params.nodeSize ?? 1.0) },
        uLineWidth: { value: Number(params.lineWidth ?? 1.0) },
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
      if (config.sceneParams.nodeSize !== undefined) {
        this.material.uniforms.uNodeSize.value = Number(config.sceneParams.nodeSize);
      }
      if (config.sceneParams.lineWidth !== undefined) {
        this.material.uniforms.uLineWidth.value = Number(config.sceneParams.lineWidth);
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
  id: 'neuralnet',
  name: 'Neural Net',
  description:
    'Connected glowing nodes in parallax layers forming an organic neural mesh. Inspired by "The Universe Within" by BigWIngs/Martijn Steinrucken (shadertoy.com/view/lscczl, youtube.com/@TheArtOfCodeIsCool). CC BY-NC-SA 3.0.',
  category: 'psychedelic',
  cameraHint: 'small-plane',
  audioDescription:
    'Bass drives node wobble and overall brightness, mids control layer visibility, highs sharpen nodes and sparkle',
  features: ['textureScale', 'textureOpacity', 'textureAnimation', 'textureMotion'],
  params: [
    {
      key: 'nodeSize',
      label: 'Node Size',
      type: 'slider',
      min: 0.3,
      max: 2.0,
      step: 0.1,
      default: 1.0,
    },
    {
      key: 'lineWidth',
      label: 'Line Width',
      type: 'slider',
      min: 0.3,
      max: 2.0,
      step: 0.1,
      default: 1.0,
    },
  ],
};

registerScene('neuralnet', (scene, config) => new NeuralNetScene(scene, config), METADATA);
