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

const FRAGMENT_SHADER =
  TEXTURE_UNIFORMS +
  TEXTURE_SAMPLE_FN +
  `
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uSpeed;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform vec3 uAccent;
  varying vec2 vUv;

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
    float t = uTime * uSpeed;

    // Polar to tunnel
    float angle = atan(uv.y, uv.x);
    float radius = length(uv);

    // Fly speed controlled by mids
    float flySpeed = (1.0 + uMid * 2.0) * t;

    // Tunnel coordinates
    float tunnelU = angle / 3.14159 * 0.5 + 0.5;
    float tunnelV = 0.5 / radius + flySpeed;

    // Bass distortion
    tunnelU += sin(tunnelV * 4.0 + t) * uBass * 0.1;

    // Wall pattern
    float pattern = noise(vec2(tunnelU * 8.0, tunnelV * 4.0));
    pattern += noise(vec2(tunnelU * 16.0, tunnelV * 8.0)) * 0.5;

    // Texture shift from highs
    float shift = uHigh * 0.3;
    vec3 color = mix(uPrimary, uSecondary, pattern + shift);

    // Grid lines
    float gridU = abs(fract(tunnelU * 12.0) - 0.5);
    float gridV = abs(fract(tunnelV * 6.0) - 0.5);
    float grid = smoothstep(0.02, 0.03, min(gridU, gridV));
    color = mix(uAccent * 1.5, color, grid);

    // Distance fade
    float fade = smoothstep(0.0, 0.2, radius) * smoothstep(0.6, 0.3, radius);
    color *= fade;

    // Center glow
    float centerGlow = smoothstep(0.15, 0.0, radius) * (0.5 + uBass * 0.8);
    color += uAccent * centerGlow;

    if (uHasTexture) {
      vec4 tex = sampleTransformedTexture((vUv - 0.5) / uTextureScale + 0.5);
      color = mix(color, tex.rgb, tex.a);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

export class TunnelScene {
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
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: FRAGMENT_SHADER,
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
    if (config.textureScale !== undefined) {
      this.material.uniforms.uTextureScale.value = config.textureScale;
    }
    this.config = { ...this.config, ...config };
  }

  setTexture(texture: THREE.Texture | null): void {
    this.material.uniforms.uTexture.value = texture;
    this.material.uniforms.uHasTexture.value = texture !== null;
  }

  setTextureTransform(transform: TextureTransform): void {
    applyTextureTransform(this.material, transform);
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

const METADATA: SceneRegistration = {
  id: 'tunnel',
  name: 'Tunnel',
  description: 'Infinite fly-through tunnel along a spline',
  category: 'immersive',
  audioDescription: 'Bass distorts tunnel walls, mids control fly speed, highs shift wall texture',
  features: ['textureScale', 'textureOpacity', 'textureAnimation', 'textureMotion'],
  cameraHint: 'small-plane',
  params: [],
};

registerScene('tunnel', (scene, config) => new TunnelScene(scene, config), METADATA);
