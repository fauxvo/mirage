import * as THREE from 'three';
import type { VisualizerConfig } from '@/types/visualizer';
import { registerScene } from './scene-registry';
import type { SceneRegistration, TextureTransform } from './types';
import { getParticleShapeTexture, type ParticleShape } from './particle-shapes';

export class ParticleScene {
  private particles: THREE.Points;
  private material: THREE.PointsMaterial;
  private basePositions: Float32Array;
  private velocities: Float32Array;
  private clock: THREE.Clock;
  private particleCount: number;
  private hasCustomTexture = false;
  private currentShape: ParticleShape;

  constructor(
    private scene: THREE.Scene,
    private config: VisualizerConfig
  ) {
    this.clock = new THREE.Clock();
    const palette = config.colorPalette;

    this.particleCount = Math.floor(3000 * config.particleDensity + 2000);
    this.basePositions = new Float32Array(this.particleCount * 3);
    this.velocities = new Float32Array(this.particleCount * 3);

    const colors = new Float32Array(this.particleCount * 3);
    const sizes = new Float32Array(this.particleCount);
    const primaryColor = new THREE.Color(palette.primary);
    const secondaryColor = new THREE.Color(palette.secondary);
    const accentColor = new THREE.Color(palette.accent);

    for (let i = 0; i < this.particleCount; i++) {
      // Distribute in a sphere
      const radius = 2 + Math.random() * 4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      this.basePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      this.basePositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      this.basePositions[i * 3 + 2] = radius * Math.cos(phi);

      // Random orbital velocity
      this.velocities[i * 3] = (Math.random() - 0.5) * 0.02;
      this.velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
      this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;

      // Color variation
      const colorMix = Math.random();
      const color = colorMix < 0.4 ? primaryColor : colorMix < 0.75 ? secondaryColor : accentColor;
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = 0.02 + Math.random() * 0.06;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.basePositions.slice(), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    this.currentShape = (config.sceneParams?.particleShape as ParticleShape) ?? 'circle';
    this.material = new THREE.PointsMaterial({
      size: 0.08,
      map: getParticleShapeTexture(this.currentShape),
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
    });

    this.particles = new THREE.Points(geometry, this.material);
    this.scene.add(this.particles);
  }

  update(bass: number, mid: number, high: number): void {
    const time = this.clock.getElapsedTime();
    const reactivity = this.config.audioReactivity;
    const speed = this.config.animationSpeed;
    const positions = this.particles.geometry.attributes.position.array as Float32Array;

    // BPM-scaled orbit speed
    const bpmFactor = speed;

    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;
      const bx = this.basePositions[i3];
      const by = this.basePositions[i3 + 1];
      const bz = this.basePositions[i3 + 2];

      // Orbital rotation
      const angle = time * bpmFactor * 0.3 + i * 0.001;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Rotate around Y axis
      let x = bx * cosA - bz * sinA;
      const y = by;
      let z = bx * sinA + bz * cosA;

      // Bass pulse: expand outward
      const dist = Math.sqrt(x * x + y * y + z * z);
      const bassExpand = 1 + bass * reactivity * 0.5;
      if (dist > 0) {
        x *= bassExpand;
        z *= bassExpand;
      }

      // Add small oscillation for mid frequencies
      x += Math.sin(time * 2 + i * 0.5) * mid * reactivity * 0.2;

      positions[i3] = x;
      positions[i3 + 1] = y + Math.sin(time * 0.5 + i * 0.1) * 0.1;
      positions[i3 + 2] = z;
    }

    this.particles.geometry.attributes.position.needsUpdate = true;

    // High frequencies boost brightness
    this.material.opacity = 0.6 + high * reactivity * 0.4;

    // Gentle overall rotation
    this.particles.rotation.y += 0.001 * speed;
  }

  updateConfig(config: Partial<VisualizerConfig>): void {
    if (config.sceneParams?.particleShape !== undefined) {
      this.currentShape = config.sceneParams.particleShape as ParticleShape;
      if (!this.hasCustomTexture) {
        this.material.map = getParticleShapeTexture(this.currentShape);
        this.material.needsUpdate = true;
      }
    }
    if (config.animationSpeed !== undefined || config.audioReactivity !== undefined) {
      this.config = { ...this.config, ...config };
    }
    if (config.colorPalette) {
      const colors = this.particles.geometry.attributes.color.array as Float32Array;
      const primaryColor = new THREE.Color(config.colorPalette.primary);
      const secondaryColor = new THREE.Color(config.colorPalette.secondary);
      const accentColor = new THREE.Color(config.colorPalette.accent);

      for (let i = 0; i < this.particleCount; i++) {
        const colorMix = Math.random();
        const color =
          colorMix < 0.4 ? primaryColor : colorMix < 0.75 ? secondaryColor : accentColor;
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }
      this.particles.geometry.attributes.color.needsUpdate = true;
      this.config = { ...this.config, ...config };
    }
    if (config.textureScale !== undefined) {
      this.config = { ...this.config, ...config };
      if (this.material.map) {
        this.material.size = ParticleScene.BASE_POINT_SIZE * config.textureScale;
      }
    }
  }

  private static BASE_POINT_SIZE = 0.08;

  setTexture(texture: THREE.Texture | null): void {
    this.hasCustomTexture = texture !== null;
    if (texture) {
      // For point sprites, textureScale controls particle size (not UV repeat)
      this.material.size = ParticleScene.BASE_POINT_SIZE * (this.config.textureScale ?? 1.0);
      this.material.opacity = this.config.textureOpacity ?? 0.8;
      this.material.transparent = true;
      this.material.map = texture;
    } else {
      this.material.size = ParticleScene.BASE_POINT_SIZE;
      this.material.map = getParticleShapeTexture(this.currentShape);
    }
    this.material.needsUpdate = true;
  }

  setTextureTransform(transform: TextureTransform): void {
    this.material.opacity = transform.opacity;
    this.material.transparent = true;
    const tc = transform.tintColor;
    this.material.color.setRGB(tc.r, tc.g, tc.b);
    if (this.material.map) {
      this.material.map.rotation = transform.rotation;
      this.material.map.center.set(0.5, 0.5);
      this.material.map.offset.set(transform.offsetX, transform.offsetY);
    }
  }

  dispose(): void {
    this.scene.remove(this.particles);
    this.particles.geometry.dispose();
    this.material.dispose();
  }
}

const METADATA: SceneRegistration = {
  id: 'particles',
  name: 'Particles',
  description: 'Dynamic particle field with orbital rotation',
  category: 'cosmic',
  audioDescription: 'Bass pulses expansion, mids control orbit speed, highs boost brightness',
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
    {
      key: 'particleShape',
      label: 'Particle Shape',
      type: 'select',
      default: 'circle',
      options: [
        { label: 'Circle', value: 'circle' },
        { label: 'Star', value: 'star' },
        { label: 'Diamond', value: 'diamond' },
        { label: 'Ring', value: 'ring' },
        { label: 'Sparkle', value: 'sparkle' },
      ],
    },
  ],
};

registerScene('particles', (scene, config) => new ParticleScene(scene, config), METADATA);
