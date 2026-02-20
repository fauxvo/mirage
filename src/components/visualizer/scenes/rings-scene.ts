import * as THREE from 'three';
import type { VisualizerConfig } from '@/types/visualizer';
import { registerScene } from './scene-registry';
import type { SceneRegistration } from './types';

export class RingsScene {
  private rings: THREE.Mesh[];
  private ringMaterials: THREE.MeshBasicMaterial[];
  private group: THREE.Group;
  private clock: THREE.Clock;
  private ringCount: number;

  constructor(
    private scene: THREE.Scene,
    private config: VisualizerConfig
  ) {
    this.clock = new THREE.Clock();
    const palette = config.colorPalette;

    this.group = new THREE.Group();
    this.rings = [];
    this.ringMaterials = [];
    this.ringCount = 12;

    const primaryColor = new THREE.Color(palette.primary);
    const secondaryColor = new THREE.Color(palette.secondary);
    const accentColor = new THREE.Color(palette.accent);

    for (let i = 0; i < this.ringCount; i++) {
      const radius = 0.8 + i * 0.35;
      const tube = 0.02 + (1 - i / this.ringCount) * 0.03;
      const geometry = new THREE.TorusGeometry(radius, tube, 16, 100);

      const t = i / this.ringCount;
      const color = new THREE.Color().lerpColors(
        primaryColor,
        i % 3 === 0 ? accentColor : secondaryColor,
        t
      );

      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.7,
        wireframe: i % 2 === 0,
      });

      const ring = new THREE.Mesh(geometry, material);
      // Varied tilts
      ring.rotation.x = (Math.random() - 0.5) * 0.6;
      ring.rotation.y = (Math.random() - 0.5) * 0.6;

      this.rings.push(ring);
      this.ringMaterials.push(material);
      this.group.add(ring);
    }

    this.scene.add(this.group);
  }

  update(bass: number, mid: number, high: number): void {
    const time = this.clock.getElapsedTime();
    const r = this.config.audioReactivity;
    const speed = this.config.animationSpeed;

    for (let i = 0; i < this.ringCount; i++) {
      const ring = this.rings[i];
      const direction = i % 2 === 0 ? 1 : -1;

      // Mid controls rotation speed
      const rotSpeed = (0.003 + mid * r * 0.01) * speed * direction;
      ring.rotation.z += rotSpeed;
      ring.rotation.x += rotSpeed * 0.3 * (i % 3 === 0 ? -1 : 1);

      // Bass pulsates ring size
      const basePulse = 1 + bass * r * 0.15 * Math.sin(time * 3 + i * 0.5);
      ring.scale.setScalar(basePulse);

      // High frequencies glow
      this.ringMaterials[i].opacity = 0.5 + high * r * 0.4 + Math.sin(time * 2 + i) * 0.1;
    }

    this.group.rotation.y += 0.001 * speed;
  }

  updateConfig(config: Partial<VisualizerConfig>): void {
    if (config.colorPalette) {
      const primary = new THREE.Color(config.colorPalette.primary);
      const secondary = new THREE.Color(config.colorPalette.secondary);
      const accent = new THREE.Color(config.colorPalette.accent);
      for (let i = 0; i < this.ringCount; i++) {
        const t = i / this.ringCount;
        this.ringMaterials[i].color.lerpColors(primary, i % 3 === 0 ? accent : secondary, t);
      }
    }
    if (config.textureScale !== undefined) {
      for (const mat of this.ringMaterials) {
        const texture = mat.map;
        if (texture) {
          const scale = config.textureScale;
          texture.repeat.set(1 / scale, 1 / scale);
          texture.offset.set((1 - 1 / scale) / 2, (1 - 1 / scale) / 2);
          texture.needsUpdate = true;
        }
      }
    }
    if (config.textureOpacity !== undefined) {
      for (const mat of this.ringMaterials) {
        if (mat.map) {
          mat.opacity = config.textureOpacity;
        }
      }
    }
    this.config = { ...this.config, ...config };
  }

  setTexture(texture: THREE.Texture | null): void {
    if (texture) {
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      const scale = this.config.textureScale ?? 1.0;
      texture.repeat.set(1 / scale, 1 / scale);
      texture.offset.set((1 - 1 / scale) / 2, (1 - 1 / scale) / 2);
      texture.needsUpdate = true;
    }
    const opacity = texture ? (this.config.textureOpacity ?? 0.7) : undefined;
    for (const mat of this.ringMaterials) {
      mat.map = texture;
      if (opacity !== undefined) {
        mat.opacity = opacity;
      }
      mat.needsUpdate = true;
    }
  }

  dispose(): void {
    this.scene.remove(this.group);
    for (const ring of this.rings) {
      ring.geometry.dispose();
    }
    for (const mat of this.ringMaterials) {
      mat.dispose();
    }
  }
}

const METADATA: SceneRegistration = {
  id: 'rings',
  name: 'Rings',
  description: 'Concentric ring system with varied tilts',
  category: 'geometric',
  audioDescription: 'Bass pulsates ring size, mids control rotation speeds, highs intensify glow',
  features: ['textureScale', 'textureOpacity'],
  params: [],
};

registerScene('rings', (scene, config) => new RingsScene(scene, config), METADATA);
