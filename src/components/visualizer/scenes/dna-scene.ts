import * as THREE from 'three';
import type { VisualizerConfig } from '@/types/visualizer';
import { registerScene } from './scene-registry';
import type { SceneRegistration } from './types';

export class DnaScene {
  private group: THREE.Group;
  private spheres: THREE.InstancedMesh;
  private connections: THREE.LineSegments;
  private connectionPositions: Float32Array;
  private sphereCount: number;
  private pairsPerStrand: number;
  private clock: THREE.Clock;
  private sphereMaterial: THREE.MeshStandardMaterial;
  private lineMaterial: THREE.LineBasicMaterial;

  constructor(
    private scene: THREE.Scene,
    private config: VisualizerConfig
  ) {
    this.clock = new THREE.Clock();
    const palette = config.colorPalette;

    // Lighting
    const ambient = new THREE.AmbientLight(0x333333, 0.5);
    this.scene.add(ambient);
    const point = new THREE.PointLight(new THREE.Color(palette.accent), 2, 20);
    point.position.set(0, 5, 5);
    this.scene.add(point);

    this.group = new THREE.Group();
    this.pairsPerStrand = 40;
    this.sphereCount = this.pairsPerStrand * 2; // Two strands

    const sphereGeo = new THREE.SphereGeometry(0.12, 8, 8);
    this.sphereMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette.primary),
      emissive: new THREE.Color(palette.primary),
      emissiveIntensity: 0.3,
      metalness: 0.5,
      roughness: 0.3,
    });

    this.spheres = new THREE.InstancedMesh(sphereGeo, this.sphereMaterial, this.sphereCount);
    this.group.add(this.spheres);

    // Connection lines between pairs
    this.connectionPositions = new Float32Array(this.pairsPerStrand * 6); // 2 vertices per line
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(this.connectionPositions, 3));
    this.lineMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color(palette.accent),
      transparent: true,
      opacity: 0.4,
    });
    this.connections = new THREE.LineSegments(lineGeo, this.lineMaterial);
    this.group.add(this.connections);

    this.scene.add(this.group);

    // Initial positions
    this.updateHelixPositions(0, 0, 1);
  }

  private updateHelixPositions(time: number, bass: number, radius: number): void {
    const dummy = new THREE.Object3D();
    const speed = this.config.animationSpeed;
    const twist = time * speed * 0.5;

    for (let i = 0; i < this.pairsPerStrand; i++) {
      const t = (i / this.pairsPerStrand) * Math.PI * 4;
      const y = (i / this.pairsPerStrand) * 8 - 4;

      // Strand A
      const ax = Math.cos(t + twist) * radius;
      const az = Math.sin(t + twist) * radius;
      dummy.position.set(ax, y, az);
      dummy.updateMatrix();
      this.spheres.setMatrixAt(i, dummy.matrix);

      // Strand B (opposite)
      const bx = Math.cos(t + twist + Math.PI) * radius;
      const bz = Math.sin(t + twist + Math.PI) * radius;
      dummy.position.set(bx, y, bz);
      dummy.updateMatrix();
      this.spheres.setMatrixAt(i + this.pairsPerStrand, dummy.matrix);

      // Connection line
      const ci = i * 6;
      this.connectionPositions[ci] = ax;
      this.connectionPositions[ci + 1] = y;
      this.connectionPositions[ci + 2] = az;
      this.connectionPositions[ci + 3] = bx;
      this.connectionPositions[ci + 4] = y;
      this.connectionPositions[ci + 5] = bz;
    }

    this.spheres.instanceMatrix.needsUpdate = true;
    this.connections.geometry.attributes.position.needsUpdate = true;
  }

  update(bass: number, mid: number, high: number): void {
    const time = this.clock.getElapsedTime();
    const r = this.config.audioReactivity;

    // Bass controls helix radius
    const radius = 1.2 + bass * r * 0.8;
    this.updateHelixPositions(time, bass * r, radius);

    // Mid controls twist speed (handled via time in updateHelixPositions)

    // High controls connection glow
    this.lineMaterial.opacity = 0.3 + high * r * 0.6;
    this.sphereMaterial.emissiveIntensity = 0.2 + high * r * 0.5;

    // Gentle overall rotation
    this.group.rotation.y += 0.002 * this.config.animationSpeed;
  }

  setTexture(texture: THREE.Texture | null): void {
    this.sphereMaterial.map = texture;
    this.sphereMaterial.needsUpdate = true;
  }

  updateConfig(config: Partial<VisualizerConfig>): void {
    if (config.colorPalette) {
      this.sphereMaterial.color.set(config.colorPalette.primary);
      this.sphereMaterial.emissive.set(config.colorPalette.primary);
      this.lineMaterial.color.set(config.colorPalette.accent);
    }
    this.config = { ...this.config, ...config };
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.spheres.geometry.dispose();
    this.sphereMaterial.dispose();
    this.connections.geometry.dispose();
    this.lineMaterial.dispose();
  }
}

const METADATA: SceneRegistration = {
  id: 'dna',
  name: 'DNA',
  description: 'Rotating double helix structure',
  category: 'cosmic',
  audioDescription: 'Bass widens helix radius, mids control twist speed, highs glow connections',
  params: [],
};

registerScene('dna', (scene, config) => new DnaScene(scene, config), METADATA);
