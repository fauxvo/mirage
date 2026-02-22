import * as THREE from 'three';
import type { VisualizerConfig } from '@/types/visualizer';
import { registerScene } from './scene-registry';
import {
  TEXTURE_UNIFORMS,
  TEXTURE_SAMPLE_FN,
  PARTICLE_SHAPE_UNIFORM,
  PARTICLE_SHAPE_FN,
  PARTICLE_SHAPE_INDEX,
  PARTICLE_SHAPE_PARAM,
  createTextureUniforms,
  applyTextureTransform,
} from './shader-chunks';
import type { SceneRegistration, TextureTransform } from './types';

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
    ${TEXTURE_UNIFORMS}
    ${TEXTURE_SAMPLE_FN}
    ${PARTICLE_SHAPE_UNIFORM}
    ${PARTICLE_SHAPE_FN}
    uniform vec3 uPrimary;
    uniform vec3 uSecondary;
    uniform vec3 uAccent;
    uniform float uTime;
    uniform float uMid;
    uniform float uHigh;
    uniform float uSpeed;
    varying float vPhase;
    varying float vDist;

    void main() {
      float d = length(gl_PointCoord - 0.5);

      float alpha;
      vec4 texSample = vec4(1.0);
      if (uHasTexture) {
        texSample = sampleTransformedTexture(vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y));
        alpha = texSample.a;
        if (alpha < 0.01) discard;
      } else {
        alpha = particleShapeAlpha(gl_PointCoord, uParticleShape) * 0.6;
        if (alpha < 0.01) discard;
      }

      float colorMix = sin(vPhase * 6.28 + uTime * uSpeed * 0.2 + uMid * 2.0) * 0.5 + 0.5;
      vec3 color = mix(uPrimary, uSecondary, colorMix);
      color = mix(color, uAccent, sin(vPhase * 12.56) * 0.5 + 0.5) * 0.3 + color * 0.7;

      float brightness = 0.8 + uHigh * 0.6;
      color *= brightness;

      if (uHasTexture) color *= texSample.rgb;

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
        uParticleShape: {
          value:
            PARTICLE_SHAPE_INDEX[(config.sceneParams?.particleShape as string) ?? 'circle'] ?? 0,
        },
        ...createTextureUniforms(config),
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
    if (config.sceneParams?.particleShape !== undefined) {
      this.material.uniforms.uParticleShape.value =
        PARTICLE_SHAPE_INDEX[config.sceneParams.particleShape as string] ?? 0;
    }
    this.config = { ...this.config, ...config };
  }

  setTexture(texture: THREE.Texture | null): void {
    this.material.uniforms.uTexture.value = texture;
    this.material.uniforms.uHasTexture.value = texture !== null;
  }

  setTextureTransform(transform: TextureTransform): void {
    applyTextureTransform(this.material, transform);
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
    PARTICLE_SHAPE_PARAM,
  ],
};

registerScene('nebula', (scene, config) => new NebulaScene(scene, config), METADATA);
