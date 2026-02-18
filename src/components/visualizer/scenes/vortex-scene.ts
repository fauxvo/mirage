import * as THREE from 'three';
import type { VisualizerConfig } from '@/types/visualizer';
import { registerScene } from './scene-registry';
import type { SceneRegistration } from './types';

export class VortexScene {
  private particles: THREE.Points;
  private material: THREE.ShaderMaterial;
  private centralGlow: THREE.Mesh;
  private centralMaterial: THREE.MeshBasicMaterial;
  private clock: THREE.Clock;
  private particleCount: number;

  private static VERTEX = `
    attribute float aAngle;
    attribute float aRadius;
    attribute float aSpeed;
    uniform float uTime;
    uniform float uBass;
    uniform float uMid;
    uniform float uHigh;
    uniform float uAnimSpeed;
    varying float vRadius;
    varying float vBrightness;

    void main() {
      float t = uTime * uAnimSpeed;
      // Spiral tightness from bass
      float tightness = 1.0 + uBass * 1.5;
      float angle = aAngle + t * aSpeed * (1.0 + uMid) + log(aRadius + 0.5) * tightness;
      float r = aRadius;

      vec3 pos = vec3(
        cos(angle) * r,
        (aAngle / 6.28 - 0.5) * 4.0 + sin(t * 0.5 + aRadius) * 0.3,
        sin(angle) * r
      );

      vRadius = r;
      vBrightness = 0.5 + uHigh * 1.0;

      vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
      float size = (1.0 - r / 6.0) * 3.0 + 1.0;
      gl_PointSize = size * (200.0 / -mvPos.z);
      gl_Position = projectionMatrix * mvPos;
    }
  `;

  private static FRAGMENT = `
    uniform vec3 uPrimary;
    uniform vec3 uSecondary;
    uniform vec3 uAccent;
    uniform sampler2D uTexture;
    uniform bool uHasTexture;
    varying float vRadius;
    varying float vBrightness;

    void main() {
      float d = length(gl_PointCoord - 0.5);

      float alpha;
      vec4 texColor = vec4(1.0);
      if (uHasTexture) {
        texColor = texture2D(uTexture, vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y));
        alpha = texColor.a * 0.8;
        if (alpha < 0.01) discard;
      } else {
        if (d > 0.5) discard;
        alpha = smoothstep(0.5, 0.0, d) * 0.8;
      }

      float t = vRadius / 6.0;
      vec3 color = mix(uAccent, uPrimary, t);
      color = mix(color, uSecondary, smoothstep(0.3, 0.8, t));
      color *= vBrightness;

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

    this.particleCount = Math.floor(3000 * config.particleDensity + 1000);
    const angles = new Float32Array(this.particleCount);
    const radii = new Float32Array(this.particleCount);
    const speeds = new Float32Array(this.particleCount);
    const positions = new Float32Array(this.particleCount * 3); // placeholder

    for (let i = 0; i < this.particleCount; i++) {
      angles[i] = Math.random() * Math.PI * 2;
      radii[i] = 0.3 + Math.pow(Math.random(), 0.5) * 5.5;
      speeds[i] = 0.3 + Math.random() * 0.7;
      // Initial positions (will be overridden by shader)
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1));
    geometry.setAttribute('aRadius', new THREE.BufferAttribute(radii, 1));
    geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader: VortexScene.VERTEX,
      fragmentShader: VortexScene.FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uAnimSpeed: { value: config.animationSpeed },
        uPrimary: { value: new THREE.Color(palette.primary) },
        uSecondary: { value: new THREE.Color(palette.secondary) },
        uAccent: { value: new THREE.Color(palette.accent) },
        uTexture: { value: null },
        uHasTexture: { value: false },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.particles = new THREE.Points(geometry, this.material);
    this.scene.add(this.particles);

    // Central glow sphere
    const glowGeo = new THREE.SphereGeometry(0.3, 16, 16);
    this.centralMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(palette.accent),
      transparent: true,
      opacity: 0.6,
    });
    this.centralGlow = new THREE.Mesh(glowGeo, this.centralMaterial);
    this.scene.add(this.centralGlow);
  }

  update(bass: number, mid: number, high: number): void {
    const time = this.clock.getElapsedTime();
    const r = this.config.audioReactivity;
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uBass.value = bass * r;
    this.material.uniforms.uMid.value = mid * r;
    this.material.uniforms.uHigh.value = high * r;

    // Central glow pulses
    const glowScale = 0.3 + bass * r * 0.5;
    this.centralGlow.scale.setScalar(glowScale);
    this.centralMaterial.opacity = 0.4 + bass * r * 0.5;
  }

  updateConfig(config: Partial<VisualizerConfig>): void {
    if (config.colorPalette) {
      this.material.uniforms.uPrimary.value.set(config.colorPalette.primary);
      this.material.uniforms.uSecondary.value.set(config.colorPalette.secondary);
      this.material.uniforms.uAccent.value.set(config.colorPalette.accent);
      this.centralMaterial.color.set(config.colorPalette.accent);
    }
    if (config.animationSpeed !== undefined) {
      this.material.uniforms.uAnimSpeed.value = config.animationSpeed;
    }
    this.config = { ...this.config, ...config };
  }

  setTexture(texture: THREE.Texture | null): void {
    this.material.uniforms.uTexture.value = texture;
    this.material.uniforms.uHasTexture.value = texture !== null;
  }

  dispose(): void {
    this.scene.remove(this.particles);
    this.scene.remove(this.centralGlow);
    this.particles.geometry.dispose();
    this.material.dispose();
    this.centralGlow.geometry.dispose();
    this.centralMaterial.dispose();
  }
}

const METADATA: SceneRegistration = {
  id: 'vortex',
  name: 'Vortex',
  description: 'Spiral vortex pull with central glow sphere',
  category: 'immersive',
  audioDescription: 'Bass tightens the spiral, mids control rotation speed, highs glow particles',
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

registerScene('vortex', (scene, config) => new VortexScene(scene, config), METADATA);
