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

export class MatrixScene {
  private columns: THREE.InstancedMesh;
  private columnMaterial: THREE.ShaderMaterial;
  private clock: THREE.Clock;
  private columnCount: number;

  private static VERTEX = `
    varying vec2 vUv;
    varying float vInstanceY;

    void main() {
      vUv = uv;
      // Extract Y position from instance matrix
      vInstanceY = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).y;
      vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  private static FRAGMENT = `
${TEXTURE_UNIFORMS}
${TEXTURE_SAMPLE_FN}
    uniform float uTime;
    uniform float uBass;
    uniform float uMid;
    uniform float uHigh;
    uniform float uSpeed;
    uniform vec3 uPrimary;
    uniform vec3 uAccent;
    varying vec2 vUv;
    varying float vInstanceY;

    float hash(float n) { return fract(sin(n) * 43758.5453); }

    void main() {
      float t = uTime * uSpeed;

      // Glyph-like pattern
      float cellY = fract(vUv.y * 4.0 - t * (0.5 + uBass) - hash(vInstanceY * 100.0));
      float glyph = step(0.3, cellY) * step(cellY, 0.9);

      // Random glyph "character" variation
      float charId = hash(floor(vUv.y * 4.0 - t * (0.5 + uBass)) + vInstanceY * 73.0);
      glyph *= step(0.3, charId);

      // Brightness cascade from highs
      float brightness = 0.5 + uHigh * 1.0;
      float headGlow = smoothstep(0.8, 1.0, cellY) * 2.0;

      vec3 color = mix(uPrimary, uAccent, headGlow);
      color *= glyph * brightness;

      // Fade based on depth
      float fadeFromCenter = 1.0 - abs(vInstanceY) / 6.0;
      color *= max(fadeFromCenter, 0.1);

      if (uHasTexture) {
        vec4 tex = sampleTransformedTexture((vUv - 0.5) / uTextureScale + 0.5);
        color = mix(color, tex.rgb, tex.a);
      }

      float alpha = glyph * 0.9;
      gl_FragColor = vec4(color, alpha);
    }
  `;

  constructor(
    private scene: THREE.Scene,
    private config: VisualizerConfig
  ) {
    this.clock = new THREE.Clock();
    const palette = config.colorPalette;

    this.columnCount = Math.floor(200 * config.particleDensity + 100);
    const planeGeo = new THREE.PlaneGeometry(0.15, 8);

    this.columnMaterial = new THREE.ShaderMaterial({
      vertexShader: MatrixScene.VERTEX,
      fragmentShader: MatrixScene.FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uSpeed: { value: config.animationSpeed },
        uPrimary: { value: new THREE.Color(palette.primary) },
        uAccent: { value: new THREE.Color(palette.accent) },
        ...createTextureUniforms(config),
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.columns = new THREE.InstancedMesh(planeGeo, this.columnMaterial, this.columnCount);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < this.columnCount; i++) {
      dummy.position.set(
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 12
      );
      dummy.rotation.y = Math.random() * 0.3 - 0.15;
      dummy.updateMatrix();
      this.columns.setMatrixAt(i, dummy.matrix);
    }

    this.columns.instanceMatrix.needsUpdate = true;
    this.scene.add(this.columns);
  }

  update(bass: number, mid: number, high: number): void {
    const time = this.clock.getElapsedTime();
    const r = this.config.audioReactivity;
    this.columnMaterial.uniforms.uTime.value = time;
    this.columnMaterial.uniforms.uBass.value = bass * r;
    this.columnMaterial.uniforms.uMid.value = mid * r;
    this.columnMaterial.uniforms.uHigh.value = high * r;
  }

  updateConfig(config: Partial<VisualizerConfig>): void {
    if (config.colorPalette) {
      this.columnMaterial.uniforms.uPrimary.value.set(config.colorPalette.primary);
      this.columnMaterial.uniforms.uAccent.value.set(config.colorPalette.accent);
    }
    if (config.animationSpeed !== undefined) {
      this.columnMaterial.uniforms.uSpeed.value = config.animationSpeed;
    }
    if (config.textureScale !== undefined) {
      this.columnMaterial.uniforms.uTextureScale.value = config.textureScale;
    }
    this.config = { ...this.config, ...config };
  }

  setTexture(texture: THREE.Texture | null): void {
    this.columnMaterial.uniforms.uTexture.value = texture;
    this.columnMaterial.uniforms.uHasTexture.value = texture !== null;
  }

  setTextureTransform(transform: TextureTransform): void {
    applyTextureTransform(this.columnMaterial, transform);
  }

  dispose(): void {
    this.scene.remove(this.columns);
    this.columns.geometry.dispose();
    this.columnMaterial.dispose();
  }
}

const METADATA: SceneRegistration = {
  id: 'matrix',
  name: 'Matrix',
  description: 'Falling code rain with cascading glyphs',
  category: 'immersive',
  audioDescription: 'Bass controls fall speed, mids adjust glyph density, highs cascade brightness',
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

registerScene('matrix', (scene, config) => new MatrixScene(scene, config), METADATA);
