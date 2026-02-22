import * as THREE from 'three';
import type { VisualizerConfig } from '@/types/visualizer';
import { registerScene } from './scene-registry';
import {
  TEXTURE_UNIFORMS,
  TEXTURE_SAMPLE_FN,
  PARTICLE_SHAPE_UNIFORM,
  PARTICLE_SHAPE_FN,
  PARTICLE_SHAPE_PARAM,
  createTextureUniforms,
  createParticleShapeUniform,
  updateParticleShape,
  applyTextureTransform,
} from './shader-chunks';
import type { SceneRegistration, TextureTransform } from './types';

export class SwarmScene {
  private points: THREE.Points;
  private material: THREE.ShaderMaterial;
  private group: THREE.Group;
  private clock: THREE.Clock;

  private static VERTEX = `
    attribute float aPhase;
    attribute float aColorMix;

    uniform float uTime;
    uniform float uSpeed;
    uniform float uBass;
    uniform float uHigh;
    uniform float uTextureScale;
    uniform bool uHasTexture;

    varying float vPhase;
    varying float vColorMix;
    varying float vDist;

    void main() {
      vPhase = aPhase;
      vColorMix = aColorMix;

      vec3 basePos = position;
      float dist = length(basePos);
      vDist = dist;

      // Gentle floating drift via sine waves with per-particle phase
      vec3 drift = vec3(
        sin(uTime * uSpeed * 0.5 + aPhase) * 0.3,
        cos(uTime * uSpeed * 0.3 + aPhase * 1.4) * 0.2,
        sin(uTime * uSpeed * 0.4 + aPhase * 0.7) * 0.3
      );

      // Bass breathing — push outward from center
      vec3 breathDir = normalize(basePos + vec3(0.001));
      vec3 breath = breathDir * uBass * 0.8;

      vec3 pos = basePos + drift + breath;

      vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);

      // Size: closer to center = slightly bigger, highs boost size
      float size = mix(1.5, 4.0, 1.0 - clamp(dist / 5.0, 0.0, 1.0));
      size += uHigh * 2.0;
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
    uniform float uHigh;
    uniform vec3 uPrimary;
    uniform vec3 uSecondary;
    uniform vec3 uAccent;

    varying float vPhase;
    varying float vColorMix;
    varying float vDist;

    void main() {
      vec2 center = gl_PointCoord - 0.5;
      float d = length(center);

      float closeness = 1.0 - clamp(vDist / 5.0, 0.0, 1.0);

      float alpha;
      vec4 texSample = vec4(1.0);
      if (uHasTexture) {
        texSample = sampleTransformedTexture(vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y));
        alpha = texSample.a * (0.5 + closeness * 0.5);
        if (alpha < 0.01) discard;
      } else {
        alpha = particleShapeAlpha(gl_PointCoord, uParticleShape) * (0.5 + closeness * 0.5);
        if (alpha < 0.01) discard;
      }

      // Color distributed by per-particle attribute
      vec3 color;
      if (vColorMix < 0.4) {
        color = uPrimary;
      } else if (vColorMix < 0.75) {
        color = uSecondary;
      } else {
        color = uAccent;
      }

      // Emissive intensity from highs
      float emissive = 0.6 + uHigh * 1.5;
      color *= emissive;

      // Accent glow for particles near center
      color = mix(color, uAccent, closeness * 0.3);

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

    const particleCount = Math.floor(1500 * config.particleDensity + 500);
    const positions = new Float32Array(particleCount * 3);
    const phases = new Float32Array(particleCount);
    const colorMixes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      // Uniform sphere volume distribution
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = Math.cbrt(Math.random()) * 5;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      // Per-particle phase for drift animation
      phases[i] = Math.random() * Math.PI * 2;
      // Color bucket: random value used in fragment shader to pick primary/secondary/accent
      colorMixes[i] = Math.random();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aColorMix', new THREE.BufferAttribute(colorMixes, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader: SwarmScene.VERTEX,
      fragmentShader: SwarmScene.FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uHigh: { value: 0 },
        uSpeed: { value: config.animationSpeed },
        uPrimary: { value: new THREE.Color(palette.primary) },
        uSecondary: { value: new THREE.Color(palette.secondary) },
        uAccent: { value: new THREE.Color(palette.accent) },
        ...createParticleShapeUniform(config),
        ...createTextureUniforms(config),
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(geometry, this.material);
    this.group = new THREE.Group();
    this.group.add(this.points);
    this.scene.add(this.group);
  }

  update(bass: number, mid: number, high: number): void {
    const time = this.clock.getElapsedTime();
    const r = this.config.audioReactivity;
    const speed = this.config.animationSpeed;

    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uBass.value = bass * r;
    this.material.uniforms.uHigh.value = high * r;

    // Slow Y rotation boosted by mids
    this.group.rotation.y += 0.002 * speed * (1 + mid * r * 2);
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
    if (config.sceneParams) updateParticleShape(this.material, config.sceneParams);
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
    this.scene.remove(this.group);
    this.points.geometry.dispose();
    this.material.dispose();
  }
}

const METADATA: SceneRegistration = {
  id: 'swarm',
  name: 'Swarm',
  description: 'Bioluminescent cloud of floating particles',
  category: 'cosmic',
  audioDescription:
    'Bass breathes the swarm outward, mids boost rotation, highs pulse emissive glow',
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

registerScene('swarm', (scene, config) => new SwarmScene(scene, config), METADATA);
