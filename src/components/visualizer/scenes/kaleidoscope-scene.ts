import * as THREE from 'three';
import type { VisualizerConfig } from '@/types/visualizer';
import { registerScene } from './scene-registry';
import type { SceneRegistration } from './types';

const VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uSpeed;
  uniform float uSymmetry;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform vec3 uAccent;
  uniform sampler2D uTexture;
  uniform bool uHasTexture;
  varying vec2 vUv;

  #define PI 3.14159265359

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  void main() {
    vec2 uv = vUv - 0.5;
    float t = uTime * uSpeed * 0.3;

    // Polar coordinates
    float angle = atan(uv.y, uv.x);
    float radius = length(uv);

    // Bass controls zoom
    radius *= (1.0 + uBass * 0.5);

    // Symmetry folds
    float folds = max(uSymmetry, 2.0);
    angle = mod(angle, 2.0 * PI / folds);
    angle = abs(angle - PI / folds);

    // Mid controls rotation
    angle += t + uMid * 0.5;

    // Convert back to cartesian for pattern
    vec2 p = vec2(cos(angle), sin(angle)) * radius;

    // Generate pattern
    float n1 = noise(p * 6.0 + t * 0.5);
    float n2 = noise(p * 12.0 - t * 0.3);
    float n3 = noise(p * 3.0 + vec2(t * 0.2, -t * 0.4));

    float pattern = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;

    // Color split from highs
    float split = uHigh * 0.3;
    vec3 c1 = mix(uPrimary, uSecondary, pattern + split);
    vec3 c2 = mix(uSecondary, uAccent, pattern - split);
    vec3 color = mix(c1, c2, sin(radius * 10.0 + t) * 0.5 + 0.5);

    // Vignette
    float vignette = 1.0 - smoothstep(0.3, 0.7, radius);
    color *= vignette;

    if (uHasTexture) {
      vec4 texColor = texture2D(uTexture, vUv);
      color = mix(color, texColor.rgb, texColor.a * 0.5);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

export class KaleidoscopeScene {
  private mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private clock: THREE.Clock;

  constructor(
    private scene: THREE.Scene,
    private config: VisualizerConfig
  ) {
    this.clock = new THREE.Clock();
    const palette = config.colorPalette;

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
        uSymmetry: { value: config.symmetry || 6 },
        uPrimary: { value: new THREE.Color(palette.primary) },
        uSecondary: { value: new THREE.Color(palette.secondary) },
        uAccent: { value: new THREE.Color(palette.accent) },
        uTexture: { value: null },
        uHasTexture: { value: false },
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

  updateConfig(config: Partial<VisualizerConfig>): void {
    if (config.colorPalette) {
      this.material.uniforms.uPrimary.value.set(config.colorPalette.primary);
      this.material.uniforms.uSecondary.value.set(config.colorPalette.secondary);
      this.material.uniforms.uAccent.value.set(config.colorPalette.accent);
    }
    if (config.animationSpeed !== undefined) {
      this.material.uniforms.uSpeed.value = config.animationSpeed;
    }
    if (config.symmetry !== undefined) {
      this.material.uniforms.uSymmetry.value = config.symmetry;
    }
    this.config = { ...this.config, ...config };
  }

  setTexture(texture: THREE.Texture | null): void {
    this.material.uniforms.uTexture.value = texture;
    this.material.uniforms.uHasTexture.value = texture !== null;
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

const METADATA: SceneRegistration = {
  id: 'kaleidoscope',
  name: 'Kaleidoscope',
  description: 'Mirrored geometric patterns with symmetry folds',
  category: 'geometric',
  audioDescription: 'Bass zooms pattern, mids rotate the view, highs split colors',
  params: [
    {
      key: 'symmetry',
      label: 'Symmetry Folds',
      type: 'slider',
      min: 1,
      max: 12,
      step: 1,
      default: 6,
    },
  ],
};

registerScene('kaleidoscope', (scene, config) => new KaleidoscopeScene(scene, config), METADATA);
