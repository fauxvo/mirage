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

// ── Sacred Geometry ──────────────────────────────────────────────────────────
// Fractal inversion with morphing sacred patterns. Iterated abs/inversion
// creates kaleidoscopic organic fractals with orbit trap coloring.
//
// Inspired by "Ayahuasca" (ShaderToy tsfyzn) by sleeplessmonk
// https://www.shadertoy.com/view/tsfyzn
// Author: sleeplessmonk — VJ/shader artist based in Goa, India
// Profiles: https://linktr.ee/sleeplessmonk | https://github.com/sleeplessmonk
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
  uniform float uInversionDepth;
  uniform float uMorphAmount;
  uniform float uDetailFreq;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform vec3 uAccent;
  varying vec2 vUv;

  void main() {
    vec2 uv = (vUv - 0.5) * 2.0;
    // Aspect ratio correction (assume roughly 16:9)
    uv.x *= 1.777;

    float time = uTime * uSpeed * 0.3;

    // Audio-reactive parameters
    float invDepth = uInversionDepth + uBass * 0.15;
    float morph = uMorphAmount + uMid * 0.2;
    float detFreq = uDetailFreq + uHigh * 2.0;

    vec3 color = vec3(0.0);

    // Iterated fractal inversion — abs folding + sphere inversion
    for (float i = 0.0; i < 10.0; i++) {
      uv = abs(uv) / dot(uv, uv) - invDepth + morph * sin(uv.yx * detFreq + time);
      float d = length(uv);

      // Orbit trap coloring with palette colors
      vec3 iterColor = mix(
        uPrimary,
        mix(uSecondary, uAccent, sin(i * 0.5 + time * 0.3) * 0.5 + 0.5),
        sin(i * 0.7 + time * 0.2) * 0.5 + 0.5
      );

      color += iterColor * exp(-d * (4.0 + uBass * 4.0));
    }

    // Global brightness pulsation — bass-reactive
    color *= 1.4 + 0.5 * sin(uTime * uSpeed * 0.15) + uBass * 0.6;

    // High-frequency shimmer
    color += uAccent * uHigh * 0.15 * sin(uTime * 20.0 + length(vUv - 0.5) * 40.0);

    if (uHasTexture) {
      vec4 tex = sampleTransformedTexture((vUv - 0.5) / uTextureScale + 0.5);
      color = mix(color, tex.rgb, tex.a);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ── Scene class ─────────────────────────────────────────────────────────────

export class SacredGeoScene {
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
        uInversionDepth: { value: Number(params.inversionDepth ?? 0.6) },
        uMorphAmount: { value: Number(params.morphAmount ?? 0.3) },
        uDetailFreq: { value: Number(params.detailFreq ?? 4.0) },
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
      if (config.sceneParams.inversionDepth !== undefined) {
        this.material.uniforms.uInversionDepth.value = Number(config.sceneParams.inversionDepth);
      }
      if (config.sceneParams.morphAmount !== undefined) {
        this.material.uniforms.uMorphAmount.value = Number(config.sceneParams.morphAmount);
      }
      if (config.sceneParams.detailFreq !== undefined) {
        this.material.uniforms.uDetailFreq.value = Number(config.sceneParams.detailFreq);
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
  id: 'sacredgeo',
  name: 'Sacred Geometry',
  description:
    'Morphing fractal inversion with kaleidoscopic sacred patterns. Inspired by "Ayahuasca" by sleeplessmonk (shadertoy.com/view/tsfyzn, linktr.ee/sleeplessmonk). CC BY-NC-SA 3.0.',
  category: 'psychedelic',
  cameraHint: 'low-angle',
  audioDescription:
    'Bass deepens inversion and brightens glow, mids morph the fractal shape, highs add detail frequency and shimmer',
  features: ['textureScale', 'textureOpacity', 'textureAnimation', 'textureMotion'],
  params: [
    {
      key: 'inversionDepth',
      label: 'Inversion Depth',
      type: 'slider',
      min: 0.2,
      max: 1.0,
      step: 0.01,
      default: 0.6,
    },
    {
      key: 'morphAmount',
      label: 'Morph Amount',
      type: 'slider',
      min: 0.0,
      max: 0.8,
      step: 0.01,
      default: 0.3,
    },
    {
      key: 'detailFreq',
      label: 'Detail Frequency',
      type: 'slider',
      min: 1.0,
      max: 8.0,
      step: 0.1,
      default: 4.0,
    },
  ],
};

registerScene('sacredgeo', (scene, config) => new SacredGeoScene(scene, config), METADATA);
