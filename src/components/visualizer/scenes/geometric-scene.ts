import * as THREE from 'three';
import type { VisualizerConfig } from '@/types/visualizer';
import { registerScene } from './scene-registry';
import type { SceneRegistration } from './types';

export class GeometricScene {
  private centralSolid: THREE.Mesh;
  private centralWire: THREE.Mesh;
  private orbiters: THREE.Mesh[];
  private orbiterGroup: THREE.Group;
  private clock: THREE.Clock;
  private centralMaterial: THREE.MeshStandardMaterial;
  private wireMaterial: THREE.MeshBasicMaterial;
  private orbiterMaterials: THREE.MeshStandardMaterial[];
  private baseCentralScale = 1;

  constructor(
    private scene: THREE.Scene,
    private config: VisualizerConfig
  ) {
    this.clock = new THREE.Clock();
    const palette = config.colorPalette;

    // Lighting for standard materials
    const ambientLight = new THREE.AmbientLight(0x222222, 0.5);
    this.scene.add(ambientLight);

    const pointLight = new THREE.PointLight(new THREE.Color(palette.primary), 2, 20);
    pointLight.position.set(0, 3, 3);
    this.scene.add(pointLight);

    // Central icosahedron - solid with emissive glow
    const centralGeo = new THREE.IcosahedronGeometry(1.2, 1);
    this.centralMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette.primary),
      emissive: new THREE.Color(palette.primary),
      emissiveIntensity: 0.4,
      metalness: 0.8,
      roughness: 0.2,
      transparent: true,
      opacity: 0.7,
    });
    this.centralSolid = new THREE.Mesh(centralGeo, this.centralMaterial);
    this.scene.add(this.centralSolid);

    // Central wireframe overlay
    const wireGeo = new THREE.IcosahedronGeometry(1.25, 1);
    this.wireMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(palette.accent),
      wireframe: true,
      transparent: true,
      opacity: 0.6,
    });
    this.centralWire = new THREE.Mesh(wireGeo, this.wireMaterial);
    this.scene.add(this.centralWire);

    // Orbiting polyhedra
    this.orbiterGroup = new THREE.Group();
    this.orbiters = [];
    this.orbiterMaterials = [];
    const orbiterCount = 8;
    const orbitRadius = 3;

    const geometries = [
      new THREE.OctahedronGeometry(0.2, 0),
      new THREE.TetrahedronGeometry(0.2, 0),
      new THREE.IcosahedronGeometry(0.15, 0),
    ];

    for (let i = 0; i < orbiterCount; i++) {
      const angle = (i / orbiterCount) * Math.PI * 2;
      const geo = geometries[i % geometries.length];
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(i % 2 === 0 ? palette.secondary : palette.accent),
        emissive: new THREE.Color(i % 2 === 0 ? palette.secondary : palette.accent),
        emissiveIntensity: 0.3,
        metalness: 0.6,
        roughness: 0.3,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.x = Math.cos(angle) * orbitRadius;
      mesh.position.z = Math.sin(angle) * orbitRadius;
      mesh.position.y = Math.sin(angle * 2) * 0.5;

      this.orbiters.push(mesh);
      this.orbiterMaterials.push(mat);
      this.orbiterGroup.add(mesh);
    }

    this.scene.add(this.orbiterGroup);
  }

  update(bass: number, mid: number, high: number): void {
    const time = this.clock.getElapsedTime();
    const reactivity = this.config.audioReactivity;
    const speed = this.config.animationSpeed;

    // Central shape: bass-driven scale distortion
    const bassScale = this.baseCentralScale + bass * reactivity * 0.4;
    this.centralSolid.scale.setScalar(bassScale);
    this.centralWire.scale.setScalar(bassScale * 1.04);

    // Rotation
    this.centralSolid.rotation.y += 0.005 * speed;
    this.centralSolid.rotation.x += 0.002 * speed;
    this.centralWire.rotation.y -= 0.003 * speed;
    this.centralWire.rotation.z += 0.004 * speed;

    // Emissive intensity responds to audio
    this.centralMaterial.emissiveIntensity = 0.3 + bass * reactivity * 0.5;
    this.wireMaterial.opacity = 0.4 + high * reactivity * 0.4;

    // Outer ring: mid-frequency rotation
    const midRotation = mid * reactivity * 0.02;
    this.orbiterGroup.rotation.y += (0.008 + midRotation) * speed;
    this.orbiterGroup.rotation.x = Math.sin(time * 0.2) * 0.15;

    // Individual orbiter animations
    for (let i = 0; i < this.orbiters.length; i++) {
      const orbiter = this.orbiters[i];
      orbiter.rotation.x += 0.02 * speed;
      orbiter.rotation.z += 0.015 * speed;

      // High frequencies pulse orbiters
      const highScale = 1 + high * reactivity * 0.3 * Math.sin(time * 4 + i * 0.8);
      orbiter.scale.setScalar(highScale);

      this.orbiterMaterials[i].emissiveIntensity = 0.2 + high * reactivity * 0.4;
    }
  }

  setTexture(texture: THREE.Texture | null): void {
    this.centralMaterial.map = texture;
    this.centralMaterial.needsUpdate = true;
  }

  updateConfig(config: Partial<VisualizerConfig>): void {
    if (config.colorPalette) {
      this.centralMaterial.color.set(config.colorPalette.primary);
      this.centralMaterial.emissive.set(config.colorPalette.primary);
      this.wireMaterial.color.set(config.colorPalette.accent);

      for (let i = 0; i < this.orbiterMaterials.length; i++) {
        const color = i % 2 === 0 ? config.colorPalette.secondary : config.colorPalette.accent;
        this.orbiterMaterials[i].color.set(color);
        this.orbiterMaterials[i].emissive.set(color);
      }
    }
    if (config.animationSpeed !== undefined || config.audioReactivity !== undefined) {
      this.config = { ...this.config, ...config };
    }
  }

  dispose(): void {
    this.scene.remove(this.centralSolid);
    this.scene.remove(this.centralWire);
    this.scene.remove(this.orbiterGroup);

    this.centralSolid.geometry.dispose();
    this.centralMaterial.dispose();
    this.centralWire.geometry.dispose();
    this.wireMaterial.dispose();

    for (const orbiter of this.orbiters) {
      orbiter.geometry.dispose();
    }
    for (const mat of this.orbiterMaterials) {
      mat.dispose();
    }
  }
}

const METADATA: SceneRegistration = {
  id: 'geometric',
  name: 'Geometric',
  description: 'Sacred geometry polyhedra with orbiting shapes',
  category: 'geometric',
  audioDescription: 'Bass distorts scale, mids control rotation, highs pulse emissive glow',
  params: [],
};

registerScene('geometric', (scene, config) => new GeometricScene(scene, config), METADATA);
