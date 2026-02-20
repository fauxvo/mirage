import * as THREE from 'three';
import type { VisualizerConfig } from '@/types/visualizer';
import { registerScene } from './scene-registry';
import type { SceneRegistration } from './types';

export class GalaxyScene {
  private particles: THREE.Points;
  private material: THREE.PointsMaterial;
  private coreGlow: THREE.Mesh;
  private coreMaterial: THREE.MeshBasicMaterial;
  private basePositions: Float32Array;
  private clock: THREE.Clock;
  private particleCount: number;

  constructor(
    private scene: THREE.Scene,
    private config: VisualizerConfig
  ) {
    this.clock = new THREE.Clock();
    const palette = config.colorPalette;
    this.particleCount = Math.floor(4000 * config.particleDensity + 2000);

    const positions = new Float32Array(this.particleCount * 3);
    const colors = new Float32Array(this.particleCount * 3);
    const sizes = new Float32Array(this.particleCount);

    const primaryColor = new THREE.Color(palette.primary);
    const secondaryColor = new THREE.Color(palette.secondary);
    const accentColor = new THREE.Color(palette.accent);

    const arms = 4;

    for (let i = 0; i < this.particleCount; i++) {
      // Log-spiral distribution
      const armIndex = i % arms;
      const baseAngle = (armIndex / arms) * Math.PI * 2;
      const radius = 0.5 + Math.pow(Math.random(), 0.5) * 5;
      const spiralAngle = baseAngle + Math.log(radius + 1) * 1.5;

      // Add scatter
      const scatter = (1 - radius / 6) * 0.8 + 0.1;
      const x = Math.cos(spiralAngle) * radius + (Math.random() - 0.5) * scatter;
      const z = Math.sin(spiralAngle) * radius + (Math.random() - 0.5) * scatter;
      const y = (Math.random() - 0.5) * scatter * 0.3;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Colors: core = accent, mid = primary, outer = secondary
      const t = radius / 6;
      const color = new THREE.Color().lerpColors(
        accentColor,
        t < 0.5 ? primaryColor : secondaryColor,
        Math.min(t * 2, 1)
      );
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = (1 - t) * 0.08 + 0.01;
    }

    this.basePositions = positions.slice();

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.material = new THREE.PointsMaterial({
      size: 0.05,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
    });

    this.particles = new THREE.Points(geometry, this.material);
    this.scene.add(this.particles);

    // Core glow
    const coreGeo = new THREE.SphereGeometry(0.4, 16, 16);
    this.coreMaterial = new THREE.MeshBasicMaterial({
      color: accentColor,
      transparent: true,
      opacity: 0.6,
    });
    this.coreGlow = new THREE.Mesh(coreGeo, this.coreMaterial);
    this.scene.add(this.coreGlow);
  }

  update(bass: number, mid: number, high: number): void {
    const time = this.clock.getElapsedTime();
    const r = this.config.audioReactivity;
    const speed = this.config.animationSpeed;

    // Rotation controlled by mids
    const rotSpeed = (0.005 + mid * r * 0.015) * speed;
    this.particles.rotation.y += rotSpeed;

    // Bass spreads arms
    const positions = this.particles.geometry.attributes.position.array as Float32Array;
    const spread = 1 + bass * r * 0.3;
    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;
      positions[i3] = this.basePositions[i3] * spread;
      positions[i3 + 1] = this.basePositions[i3 + 1];
      positions[i3 + 2] = this.basePositions[i3 + 2] * spread;
    }
    this.particles.geometry.attributes.position.needsUpdate = true;

    // High frequencies boost brightness
    this.material.opacity = 0.6 + high * r * 0.4;

    // Core glow pulses with bass
    const coreScale = 1 + bass * r * 0.5;
    this.coreGlow.scale.setScalar(coreScale);
    this.coreMaterial.opacity = 0.4 + bass * r * 0.4;
    this.coreGlow.rotation.y = time * 0.1;
  }

  updateConfig(config: Partial<VisualizerConfig>): void {
    if (config.colorPalette) {
      const colors = this.particles.geometry.attributes.color.array as Float32Array;
      const primary = new THREE.Color(config.colorPalette.primary);
      const secondary = new THREE.Color(config.colorPalette.secondary);
      const accent = new THREE.Color(config.colorPalette.accent);

      for (let i = 0; i < this.particleCount; i++) {
        const dist = Math.sqrt(this.basePositions[i * 3] ** 2 + this.basePositions[i * 3 + 2] ** 2);
        const t = dist / 6;
        const color = new THREE.Color().lerpColors(
          accent,
          t < 0.5 ? primary : secondary,
          Math.min(t * 2, 1)
        );
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }
      this.particles.geometry.attributes.color.needsUpdate = true;
      this.coreMaterial.color.set(config.colorPalette.accent);
    }
    if (config.textureScale !== undefined) {
      if (this.material.map) {
        this.material.size = GalaxyScene.BASE_POINT_SIZE * config.textureScale;
      }
    }
    if (config.textureOpacity !== undefined) {
      this.material.opacity = config.textureOpacity;
      this.material.transparent = true;
    }
    this.config = { ...this.config, ...config };
  }

  private static BASE_POINT_SIZE = 0.05;

  setTexture(texture: THREE.Texture | null): void {
    if (texture) {
      // For point sprites, textureScale controls particle size (not UV repeat)
      this.material.size = GalaxyScene.BASE_POINT_SIZE * (this.config.textureScale ?? 1.0);
      this.material.opacity = this.config.textureOpacity ?? 0.85;
      this.material.transparent = true;
    } else {
      this.material.size = GalaxyScene.BASE_POINT_SIZE;
    }
    this.material.map = texture;
    this.material.needsUpdate = true;
  }

  dispose(): void {
    this.scene.remove(this.particles);
    this.scene.remove(this.coreGlow);
    this.particles.geometry.dispose();
    this.material.dispose();
    this.coreGlow.geometry.dispose();
    this.coreMaterial.dispose();
  }
}

const METADATA: SceneRegistration = {
  id: 'galaxy',
  name: 'Galaxy',
  description: 'Spiral galaxy with dust lanes',
  category: 'cosmic',
  audioDescription: 'Bass spreads spiral arms, mids control rotation speed, highs brighten stars',
  features: ['textureScale', 'textureOpacity'],
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

registerScene('galaxy', (scene, config) => new GalaxyScene(scene, config), METADATA);
