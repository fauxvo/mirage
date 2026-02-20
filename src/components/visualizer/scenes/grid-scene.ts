import * as THREE from 'three';
import type { VisualizerConfig } from '@/types/visualizer';
import { registerScene } from './scene-registry';
import type { SceneRegistration } from './types';

export class GridScene {
  private mesh: THREE.InstancedMesh;
  private material: THREE.ShaderMaterial;
  private clock: THREE.Clock;
  private gridSize: number;
  private instanceCount: number;
  private dummy: THREE.Object3D;
  private spacing: number;
  private tempColor: THREE.Color;

  private static VERTEX = `
    varying vec2 vUv;
    varying vec3 vColor;

    void main() {
      vUv = uv;
      vColor = instanceColor;
      vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  private static FRAGMENT = `
    uniform sampler2D uTexture;
    uniform bool uHasTexture;
    uniform float uTextureScale;
    uniform float uTextureOpacity;
    uniform float uBrightness;

    varying vec2 vUv;
    varying vec3 vColor;

    void main() {
      vec3 color = vColor * uBrightness;

      if (uHasTexture) {
        vec2 texUv = (vUv - 0.5) / uTextureScale + 0.5;
        vec4 texColor = texture2D(uTexture, texUv);
        float inBounds = step(0.0, texUv.x) * step(texUv.x, 1.0)
                       * step(0.0, texUv.y) * step(texUv.y, 1.0);
        color = mix(color, texColor.rgb, texColor.a * uTextureOpacity * inBounds);
      }

      gl_FragColor = vec4(color, 0.9);
    }
  `;

  constructor(
    private scene: THREE.Scene,
    private config: VisualizerConfig
  ) {
    this.clock = new THREE.Clock();
    this.dummy = new THREE.Object3D();
    this.tempColor = new THREE.Color();

    this.gridSize = Math.floor(8 + 16 * config.particleDensity);
    this.instanceCount = this.gridSize * this.gridSize;
    this.spacing = 8 / this.gridSize;

    const geo = new THREE.BoxGeometry(0.4, 0.4, 0.4);

    this.material = new THREE.ShaderMaterial({
      vertexShader: GridScene.VERTEX,
      fragmentShader: GridScene.FRAGMENT,
      uniforms: {
        uTexture: { value: null },
        uHasTexture: { value: false },
        uTextureScale: { value: config.textureScale ?? 1.0 },
        uTextureOpacity: { value: config.textureOpacity ?? 1.0 },
        uBrightness: { value: 1.0 },
      },
      transparent: true,
    });

    this.mesh = new THREE.InstancedMesh(geo, this.material, this.instanceCount);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Initial placement + trigger instanceColor creation
    const half = (this.gridSize - 1) * this.spacing * 0.5;
    const initColor = new THREE.Color(config.colorPalette.primary);

    for (let z = 0; z < this.gridSize; z++) {
      for (let x = 0; x < this.gridSize; x++) {
        const i = z * this.gridSize + x;
        this.dummy.position.set(x * this.spacing - half, 0, z * this.spacing - half);
        this.dummy.scale.set(1, 1, 1);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
        this.mesh.setColorAt(i, initColor);
      }
    }

    // Set dynamic usage on instanceColor after creation
    (this.mesh.instanceColor as THREE.InstancedBufferAttribute).setUsage(THREE.DynamicDrawUsage);

    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;
    this.scene.add(this.mesh);
  }

  update(bass: number, mid: number, high: number): void {
    const time = this.clock.getElapsedTime();
    const r = this.config.audioReactivity;
    const speed = this.config.animationSpeed;
    const palette = this.config.colorPalette;

    const wavePattern = (this.config.sceneParams?.wavePattern as string) || 'diagonal';
    const waveSpeed = speed * (1 + mid * r * 2);
    const bounceAmp = 0.5 + bass * r * 3;
    const colorSpeed = 0.3 + high * r * 1.5;

    const primary = new THREE.Color(palette.primary);
    const secondary = new THREE.Color(palette.secondary);
    const accent = new THREE.Color(palette.accent);

    const half = (this.gridSize - 1) * this.spacing * 0.5;
    const halfGrid = (this.gridSize - 1) / 2;

    for (let z = 0; z < this.gridSize; z++) {
      for (let x = 0; x < this.gridSize; x++) {
        const i = z * this.gridSize + x;

        // Phase depends on wave pattern
        let phase: number;
        if (wavePattern === 'radial') {
          const cx = x - halfGrid;
          const cz = z - halfGrid;
          phase = Math.sqrt(cx * cx + cz * cz) * 0.5;
        } else if (wavePattern === 'rows') {
          phase = z * 0.4;
        } else {
          // diagonal (default)
          phase = (x + z) * 0.3;
        }

        // Bounce height (clamped to positive)
        const height = Math.max(0, Math.sin(time * waveSpeed + phase)) * bounceAmp;

        this.dummy.position.set(x * this.spacing - half, height * 0.5, z * this.spacing - half);
        // Scale Y stretches with height for bar effect
        const scaleY = 1 + height * 0.8;
        this.dummy.scale.set(1, scaleY, 1);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);

        // Color sweep: primary → secondary → accent → primary
        const colorPhase = (Math.sin(time * colorSpeed + phase * 0.5) + 1) * 0.5;
        if (colorPhase < 0.33) {
          this.tempColor.lerpColors(primary, secondary, colorPhase / 0.33);
        } else if (colorPhase < 0.66) {
          this.tempColor.lerpColors(secondary, accent, (colorPhase - 0.33) / 0.33);
        } else {
          this.tempColor.lerpColors(accent, primary, (colorPhase - 0.66) / 0.34);
        }
        this.mesh.setColorAt(i, this.tempColor);
      }
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;

    // Brightness from highs
    this.material.uniforms.uBrightness.value = 0.7 + high * r * 0.8;
  }

  updateConfig(config: Partial<VisualizerConfig>): void {
    if (config.textureScale !== undefined) {
      this.material.uniforms.uTextureScale.value = config.textureScale;
    }
    if (config.textureOpacity !== undefined) {
      this.material.uniforms.uTextureOpacity.value = config.textureOpacity;
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
  id: 'grid',
  name: 'Grid',
  description: 'Neon equalizer floor with reactive cube columns',
  category: 'geometric',
  audioDescription:
    'Bass drives bounce height, mids control wave speed, highs shift colors and brightness',
  features: ['textureScale', 'textureOpacity'],
  params: [
    {
      key: 'particleDensity',
      label: 'Grid Density',
      type: 'slider',
      min: 0,
      max: 1,
      step: 0.05,
      default: 0.5,
    },
    {
      key: 'wavePattern',
      label: 'Wave Pattern',
      type: 'select',
      options: ['diagonal', 'radial', 'rows'],
      default: 'diagonal',
    },
  ],
};

registerScene('grid', (scene, config) => new GridScene(scene, config), METADATA);
