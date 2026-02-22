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

export class StarfieldScene {
  private particles: THREE.Points;
  private material: THREE.ShaderMaterial;
  private velocities: Float32Array;
  private clock: THREE.Clock;
  private particleCount: number;

  private static VERTEX = `
    attribute float aVelocity;
    uniform float uTime;
    uniform float uBass;
    uniform float uHigh;
    uniform float uSpeed;
    uniform float uTextureScale;
    uniform bool uHasTexture;
    varying float vVelocity;
    varying float vZ;

    void main() {
      vVelocity = aVelocity;
      vec3 pos = position;

      // Move stars toward camera
      float speed = (1.0 + uBass * 2.0) * uSpeed;
      pos.z = mod(pos.z + uTime * aVelocity * speed, 40.0) - 20.0;
      vZ = pos.z;

      vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
      // Stars get bigger as they approach
      float size = mix(0.5, 4.0, 1.0 - (pos.z + 20.0) / 40.0);
      // High frequencies extend streaks
      size += uHigh * 2.0;
      // When texture is loaded, textureScale controls point size
      if (uHasTexture) size *= uTextureScale;
      gl_PointSize = size * (300.0 / -mvPos.z);
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
    uniform float uHigh;
    varying float vVelocity;
    varying float vZ;

    void main() {
      vec2 center = gl_PointCoord - 0.5;
      float d = length(center);

      float closeness = 1.0 - (vZ + 20.0) / 40.0;

      float alpha;
      vec4 texSample = vec4(1.0);
      if (uHasTexture) {
        texSample = sampleTransformedTexture(vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y));
        alpha = texSample.a * (0.6 + closeness * 0.4);
        if (alpha < 0.01) discard;
      } else {
        alpha = particleShapeAlpha(gl_PointCoord, uParticleShape) * (0.6 + closeness * 0.4);
        if (alpha < 0.01) discard;
      }

      vec3 color = mix(uSecondary, uPrimary, closeness);
      color = mix(color, uAccent, smoothstep(0.7, 1.0, closeness));

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

    this.particleCount = Math.floor(2000 * config.particleDensity + 1000);
    const positions = new Float32Array(this.particleCount * 3);
    this.velocities = new Float32Array(this.particleCount);

    for (let i = 0; i < this.particleCount; i++) {
      // Spread across a tube-like region
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 8;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius;
      positions[i * 3 + 2] = Math.random() * 40 - 20;
      this.velocities[i] = 0.5 + Math.random() * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aVelocity', new THREE.BufferAttribute(this.velocities, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader: StarfieldScene.VERTEX,
      fragmentShader: StarfieldScene.FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
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
    this.material.uniforms.uHigh.value = high * r;
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
  id: 'starfield',
  name: 'Starfield',
  description: 'Warp-speed star tunnel fly-through',
  category: 'cosmic',
  audioDescription: 'Bass boosts speed, mids increase star density, highs extend streak length',
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

registerScene('starfield', (scene, config) => new StarfieldScene(scene, config), METADATA);
