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

const VERTEX_SHADER = `
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uSpeed;
  varying vec2 vUv;
  varying float vElevation;

  void main() {
    vUv = uv;

    vec3 pos = position;

    float wave1 = sin(pos.x * 2.0 + uTime * uSpeed * 0.8) * 0.3;
    float wave2 = sin(pos.y * 3.0 + uTime * uSpeed * 0.6) * 0.2;
    float wave3 = cos(pos.x * 1.5 + pos.y * 2.0 + uTime * uSpeed * 0.4) * 0.15;

    float bassInfluence = uBass * 1.5;
    pos.z = (wave1 + wave2 + wave3) * (0.5 + bassInfluence);

    vElevation = pos.z;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const FRAGMENT_SHADER =
  TEXTURE_UNIFORMS +
  TEXTURE_SAMPLE_FN +
  `
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform vec3 uAccent;
  uniform float uTime;
  uniform float uMid;
  uniform float uHigh;
  uniform float uSpeed;
  varying vec2 vUv;
  varying float vElevation;

  void main() {
    float mixFactor = smoothstep(-0.3, 0.5, vElevation);
    float midShift = uMid * 0.3;

    vec3 color = mix(uPrimary, uSecondary, mixFactor + midShift);

    float accentMask = sin(vUv.x * 6.28 + uTime * uSpeed) * 0.5 + 0.5;
    accentMask *= sin(vUv.y * 6.28 + uTime * uSpeed * 0.7) * 0.5 + 0.5;
    color = mix(color, uAccent, accentMask * 0.3 * (1.0 + uHigh));

    float glow = smoothstep(0.2, 0.8, vElevation) * 0.4;
    color += glow;

    if (uHasTexture) {
      vec4 tex = sampleTransformedTexture((vUv - 0.5) / uTextureScale + 0.5);
      color = mix(color, tex.rgb, tex.a);
    }

    gl_FragColor = vec4(color, 0.9);
  }
`;

export class AuroraScene {
  private mesh: THREE.Mesh;
  private particles: THREE.Points;
  private material: THREE.ShaderMaterial;
  private particleMaterial: THREE.PointsMaterial;
  private clock: THREE.Clock;

  constructor(
    private scene: THREE.Scene,
    private config: VisualizerConfig
  ) {
    this.clock = new THREE.Clock();
    const palette = config.colorPalette;

    // Main aurora plane
    const geometry = new THREE.PlaneGeometry(12, 12, 128, 128);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
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
      side: THREE.DoubleSide,
      transparent: true,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.rotation.x = -Math.PI * 0.4;
    this.mesh.position.y = -1;
    this.scene.add(this.mesh);

    // Ambient particles
    const particleCount = Math.floor(500 * config.particleDensity + 100);
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 14;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.particleMaterial = new THREE.PointsMaterial({
      color: new THREE.Color(palette.accent),
      size: 0.04,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.particles = new THREE.Points(particleGeometry, this.particleMaterial);
    this.scene.add(this.particles);
  }

  update(bass: number, mid: number, high: number): void {
    const time = this.clock.getElapsedTime();
    const reactivity = this.config.audioReactivity;

    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uBass.value = bass * reactivity;
    this.material.uniforms.uMid.value = mid * reactivity;
    this.material.uniforms.uHigh.value = high * reactivity;

    // Gentle particle drift
    this.particles.rotation.y = time * 0.02 * this.config.animationSpeed;
    this.particles.rotation.x = Math.sin(time * 0.01) * 0.1;
    this.particleMaterial.opacity = 0.4 + high * reactivity * 0.4;
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
      this.particleMaterial.color.set(config.colorPalette.accent);
    }
    if (config.animationSpeed !== undefined) {
      this.material.uniforms.uSpeed.value = config.animationSpeed;
    }
    if (config.audioReactivity !== undefined) {
      this.config = { ...this.config, ...config };
    }
    if (config.particleDensity !== undefined) {
      this.config = { ...this.config, ...config };
    }
    if (config.textureScale !== undefined) {
      this.material.uniforms.uTextureScale.value = config.textureScale;
    }
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.scene.remove(this.particles);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.particles.geometry.dispose();
    this.particleMaterial.dispose();
  }
}

const METADATA: SceneRegistration = {
  id: 'aurora',
  name: 'Aurora',
  description: 'Flowing wave landscape with ambient particles',
  category: 'organic',
  audioDescription: 'Bass controls wave height, mids shift colors, highs add particle sparkle',
  features: ['textureScale', 'textureOpacity', 'textureAnimation', 'textureMotion'],
  params: [
    {
      key: 'particleDensity',
      label: 'Particle Density',
      type: 'slider',
      min: 0,
      max: 1,
      step: 0.05,
      default: 0.5,
    },
  ],
};

registerScene('aurora', (scene, config) => new AuroraScene(scene, config), METADATA);
