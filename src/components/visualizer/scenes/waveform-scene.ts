import * as THREE from 'three';
import type { VisualizerConfig } from '@/types/visualizer';
import { registerScene } from './scene-registry';
import type { SceneRegistration } from './types';

export class WaveformScene {
  private ring: THREE.Mesh;
  private ringMaterial: THREE.ShaderMaterial;
  private innerGlow: THREE.Mesh;
  private innerMaterial: THREE.MeshBasicMaterial;
  private clock: THREE.Clock;

  private static VERTEX = `
    uniform float uTime;
    uniform float uBass;
    uniform float uMid;
    uniform float uSpeed;
    varying vec2 vUv;
    varying float vDisplacement;

    void main() {
      vUv = uv;
      vec3 pos = position;

      // Audio displacement along normals
      float angle = atan(pos.z, pos.x);
      float wave = sin(angle * 8.0 + uTime * uSpeed * 3.0) * uMid * 0.5;
      wave += sin(angle * 16.0 - uTime * uSpeed * 2.0) * uMid * 0.2;
      wave += sin(angle * 4.0 + uTime * uSpeed) * uBass * 0.3;

      vec3 dir = normalize(vec3(pos.x, 0.0, pos.z));
      pos += dir * wave;

      // Bass ring scale
      float scale = 1.0 + uBass * 0.3;
      pos.xz *= scale;

      vDisplacement = wave;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  private static FRAGMENT = `
    uniform vec3 uPrimary;
    uniform vec3 uSecondary;
    uniform vec3 uAccent;
    uniform float uHigh;
    uniform sampler2D uTexture;
    uniform bool uHasTexture;
    uniform float uTextureScale;
    uniform float uTextureOpacity;
    varying vec2 vUv;
    varying float vDisplacement;

    void main() {
      float d = abs(vDisplacement) * 3.0;
      vec3 color = mix(uPrimary, uSecondary, d);
      color = mix(color, uAccent, smoothstep(0.3, 0.8, d));

      // High frequency intensity boost
      float intensity = 0.8 + uHigh * 0.6;
      color *= intensity;

      if (uHasTexture) {
        vec2 texUv = (vUv - 0.5) / uTextureScale + 0.5;
        vec4 texColor = texture2D(uTexture, texUv);
        float inBounds = step(0.0, texUv.x) * step(texUv.x, 1.0) * step(0.0, texUv.y) * step(texUv.y, 1.0);
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
    const palette = config.colorPalette;

    // Ring tube
    const ringGeo = new THREE.TorusGeometry(2.5, 0.15, 32, 128);
    this.ringMaterial = new THREE.ShaderMaterial({
      vertexShader: WaveformScene.VERTEX,
      fragmentShader: WaveformScene.FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uSpeed: { value: config.animationSpeed },
        uPrimary: { value: new THREE.Color(palette.primary) },
        uSecondary: { value: new THREE.Color(palette.secondary) },
        uAccent: { value: new THREE.Color(palette.accent) },
        uTexture: { value: null },
        uHasTexture: { value: false },
        uTextureScale: { value: config.textureScale ?? 1.0 },
        uTextureOpacity: { value: config.textureOpacity ?? 1.0 },
      },
      side: THREE.DoubleSide,
    });

    this.ring = new THREE.Mesh(ringGeo, this.ringMaterial);
    this.ring.rotation.x = Math.PI * 0.5;
    this.scene.add(this.ring);

    // Inner glow sphere
    const innerGeo = new THREE.SphereGeometry(0.5, 16, 16);
    this.innerMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(palette.accent),
      transparent: true,
      opacity: 0.3,
    });
    this.innerGlow = new THREE.Mesh(innerGeo, this.innerMaterial);
    this.scene.add(this.innerGlow);
  }

  update(bass: number, mid: number, high: number): void {
    const time = this.clock.getElapsedTime();
    const r = this.config.audioReactivity;
    this.ringMaterial.uniforms.uTime.value = time;
    this.ringMaterial.uniforms.uBass.value = bass * r;
    this.ringMaterial.uniforms.uMid.value = mid * r;
    this.ringMaterial.uniforms.uHigh.value = high * r;

    this.ring.rotation.z += 0.002 * this.config.animationSpeed;

    // Inner glow pulses
    const glowScale = 0.5 + bass * r * 0.8;
    this.innerGlow.scale.setScalar(glowScale);
    this.innerMaterial.opacity = 0.2 + bass * r * 0.4;
  }

  updateConfig(config: Partial<VisualizerConfig>): void {
    if (config.colorPalette) {
      this.ringMaterial.uniforms.uPrimary.value.set(config.colorPalette.primary);
      this.ringMaterial.uniforms.uSecondary.value.set(config.colorPalette.secondary);
      this.ringMaterial.uniforms.uAccent.value.set(config.colorPalette.accent);
      this.innerMaterial.color.set(config.colorPalette.accent);
    }
    if (config.animationSpeed !== undefined) {
      this.ringMaterial.uniforms.uSpeed.value = config.animationSpeed;
    }
    if (config.textureScale !== undefined) {
      this.ringMaterial.uniforms.uTextureScale.value = config.textureScale;
    }
    if (config.textureOpacity !== undefined) {
      this.ringMaterial.uniforms.uTextureOpacity.value = config.textureOpacity;
    }
    this.config = { ...this.config, ...config };
  }

  setTexture(texture: THREE.Texture | null): void {
    this.ringMaterial.uniforms.uTexture.value = texture;
    this.ringMaterial.uniforms.uHasTexture.value = texture !== null;
  }

  dispose(): void {
    this.scene.remove(this.ring);
    this.scene.remove(this.innerGlow);
    this.ring.geometry.dispose();
    this.ringMaterial.dispose();
    this.innerGlow.geometry.dispose();
    this.innerMaterial.dispose();
  }
}

const METADATA: SceneRegistration = {
  id: 'waveform',
  name: 'Waveform',
  description: '3D circular waveform ring with audio displacement',
  category: 'abstract',
  audioDescription:
    'Bass scales the ring, mids control wave amplitude, highs boost color intensity',
  features: ['textureScale', 'textureOpacity'],
  params: [],
};

registerScene('waveform', (scene, config) => new WaveformScene(scene, config), METADATA);
