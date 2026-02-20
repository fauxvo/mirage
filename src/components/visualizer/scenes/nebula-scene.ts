import * as THREE from 'three';
import type { VisualizerConfig } from '@/types/visualizer';
import { registerScene } from './scene-registry';
import type { SceneRegistration } from './types';

export class NebulaScene {
  private particles: THREE.Points;
  private material: THREE.ShaderMaterial;
  private clock: THREE.Clock;
  private particleCount: number;

  private static VERTEX = `
    attribute float aSize;
    attribute float aPhase;
    uniform float uTime;
    uniform float uBass;
    uniform float uSpeed;
    uniform float uTextureScale;
    uniform bool uHasTexture;
    varying float vPhase;
    varying float vDist;

    void main() {
      vPhase = aPhase;
      vec3 pos = position;
      float expand = 1.0 + uBass * 0.4;
      pos *= expand;
      pos.x += sin(uTime * uSpeed * 0.3 + aPhase * 6.28) * 0.3;
      pos.y += cos(uTime * uSpeed * 0.2 + aPhase * 3.14) * 0.3;

      vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
      vDist = length(mvPos.xyz);
      float size = aSize;
      // When texture is loaded, textureScale controls point size
      if (uHasTexture) size *= uTextureScale;
      gl_PointSize = size * (200.0 / -mvPos.z);
      gl_Position = projectionMatrix * mvPos;
    }
  `;

  private static FRAGMENT = `
    uniform vec3 uPrimary;
    uniform vec3 uSecondary;
    uniform vec3 uAccent;
    uniform float uTime;
    uniform float uMid;
    uniform float uHigh;
    uniform float uSpeed;
    uniform sampler2D uTexture;
    uniform bool uHasTexture;
    uniform float uTextureScale;
    uniform float uTextureOpacity;
    varying float vPhase;
    varying float vDist;

    void main() {
      float d = length(gl_PointCoord - 0.5);

      float alpha;
      vec4 texColor = vec4(1.0);
      if (uHasTexture) {
        // Texture maps 1:1 onto each point; size is controlled in vertex shader
        texColor = texture2D(uTexture, vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y));
        alpha = texColor.a * uTextureOpacity;
        if (alpha < 0.01) discard;
      } else {
        if (d > 0.5) discard;
        alpha = smoothstep(0.5, 0.0, d) * 0.6;
      }

      float colorMix = sin(vPhase * 6.28 + uTime * uSpeed * 0.2 + uMid * 2.0) * 0.5 + 0.5;
      vec3 color = mix(uPrimary, uSecondary, colorMix);
      color = mix(color, uAccent, sin(vPhase * 12.56) * 0.5 + 0.5) * 0.3 + color * 0.7;

      float brightness = 0.8 + uHigh * 0.6;
      color *= brightness;

      if (uHasTexture) color *= texColor.rgb;

      gl_FragColor = vec4(color, alpha);
    }
  `;

  constructor(
    private scene: THREE.Scene,
    private config: VisualizerConfig
  ) {
    this.clock = new THREE.Clock();
    const palette = config.colorPalette;

    this.particleCount = Math.floor(1500 * config.particleDensity + 500);
    const positions = new Float32Array(this.particleCount * 3);
    const sizes = new Float32Array(this.particleCount);
    const phases = new Float32Array(this.particleCount);

    for (let i = 0; i < this.particleCount; i++) {
      const r = 1 + Math.random() * 5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      sizes[i] = 2 + Math.random() * 6;
      phases[i] = Math.random();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader: NebulaScene.VERTEX,
      fragmentShader: NebulaScene.FRAGMENT,
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
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.particles = new THREE.Points(geometry, this.material);
    this.scene.add(this.particles);
  }

  update(bass: number, mid: number, high: number): void {
    const time = this.clock.getElapsedTime();
    const r = this.config.audioReactivity;
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uBass.value = bass * r;
    this.material.uniforms.uMid.value = mid * r;
    this.material.uniforms.uHigh.value = high * r;

    this.particles.rotation.y += 0.001 * this.config.animationSpeed;
    this.particles.rotation.x = Math.sin(time * 0.05) * 0.1;
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
    this.scene.remove(this.particles);
    this.particles.geometry.dispose();
    this.material.dispose();
  }
}

const METADATA: SceneRegistration = {
  id: 'nebula',
  name: 'Nebula',
  description: 'Volumetric cloud and nebula particles',
  category: 'organic',
  audioDescription: 'Bass expands the cloud, mids cycle colors, highs boost brightness',
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

registerScene('nebula', (scene, config) => new NebulaScene(scene, config), METADATA);
