import * as THREE from 'three';
import type { VisualizerConfig } from '@/types/visualizer';
import { registerScene } from './scene-registry';
import type { SceneRegistration } from './types';

export class LatticeScene {
  private points: THREE.Points;
  private material: THREE.ShaderMaterial;
  private clock: THREE.Clock;

  private static BASE_POINT_SIZE = 4.0;

  private static VERTEX = `
    attribute float aPhase;

    uniform float uTime;
    uniform float uSpeed;
    uniform float uBass;
    uniform float uPointSize;

    varying float vDist;
    varying float vPhase;

    void main() {
      vPhase = aPhase;

      // Distance from center for size pulse
      vDist = length(position);

      // Size pulsing from center outward — dramatic with bloom
      float pulse = 1.0 + uBass * 0.8 * sin(uTime * uSpeed + vDist * 0.8);
      float size = uPointSize * max(pulse, 0.3);

      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * (300.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  private static FRAGMENT = `
    uniform float uTime;
    uniform float uSpeed;
    uniform float uHigh;
    uniform vec3 uPrimary;
    uniform vec3 uSecondary;
    uniform vec3 uAccent;
    uniform sampler2D uTexture;
    uniform bool uHasTexture;
    uniform float uTextureOpacity;

    varying float vDist;
    varying float vPhase;

    vec3 hsl2rgb(float h, float s, float l) {
      vec3 rgb = clamp(
        abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0,
        0.0, 1.0
      );
      return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
    }

    void main() {
      // Circular point sprite with soft glow edges
      vec2 center = gl_PointCoord - 0.5;
      float dist = length(center);
      if (dist > 0.5) discard;

      float softEdge = 1.0 - smoothstep(0.2, 0.5, dist);
      float glow = exp(-dist * 4.0);

      // HSL hue cycling based on lattice position + time
      float hue = vPhase + uTime * uSpeed * (0.05 + uHigh * 0.2);
      hue = fract(hue);

      // Map through palette tints
      vec3 hslColor = hsl2rgb(hue, 0.7, 0.5 + uHigh * 0.2);
      vec3 color = mix(hslColor, uPrimary, 0.3);

      // Bright accent center
      color = mix(color, uAccent, glow * 0.6);

      // Brightness from highs
      float brightness = 0.7 + uHigh * 0.8;
      color *= brightness;

      // Texture overlay at point coord
      if (uHasTexture) {
        vec4 texColor = texture2D(uTexture, gl_PointCoord);
        color = mix(color, texColor.rgb, texColor.a * uTextureOpacity);
      }

      float alpha = softEdge * 0.85;
      gl_FragColor = vec4(color, alpha);
    }
  `;

  constructor(
    private scene: THREE.Scene,
    private config: VisualizerConfig
  ) {
    this.clock = new THREE.Clock();
    const palette = config.colorPalette;

    const gridRes = Math.floor(6 + 10 * config.particleDensity);
    const pointCount = gridRes * gridRes * gridRes;

    const positions = new Float32Array(pointCount * 3);
    const phases = new Float32Array(pointCount);

    const extent = 6;
    const step = extent / (gridRes - 1 || 1);
    const offset = extent / 2;
    let idx = 0;

    for (let x = 0; x < gridRes; x++) {
      for (let y = 0; y < gridRes; y++) {
        for (let z = 0; z < gridRes; z++) {
          positions[idx * 3] = x * step - offset;
          positions[idx * 3 + 1] = y * step - offset;
          positions[idx * 3 + 2] = z * step - offset;
          // Phase based on position for hue variation
          phases[idx] = (x + y * 0.7 + z * 0.3) / gridRes;
          idx++;
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader: LatticeScene.VERTEX,
      fragmentShader: LatticeScene.FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: config.animationSpeed },
        uBass: { value: 0 },
        uHigh: { value: 0 },
        uPointSize: { value: LatticeScene.BASE_POINT_SIZE },
        uPrimary: { value: new THREE.Color(palette.primary) },
        uSecondary: { value: new THREE.Color(palette.secondary) },
        uAccent: { value: new THREE.Color(palette.accent) },
        uTexture: { value: null },
        uHasTexture: { value: false },
        uTextureOpacity: { value: config.textureOpacity ?? 1.0 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(geometry, this.material);
    this.scene.add(this.points);
  }

  update(bass: number, mid: number, high: number): void {
    const time = this.clock.getElapsedTime();
    const r = this.config.audioReactivity;
    const speed = this.config.animationSpeed;

    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uBass.value = bass * r;
    this.material.uniforms.uHigh.value = high * r;

    // Slow rotation boosted by mids
    this.points.rotation.y += speed * (0.003 + mid * r * 0.01);
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
      this.material.uniforms.uPointSize.value = LatticeScene.BASE_POINT_SIZE * config.textureScale;
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
    this.scene.remove(this.points);
    this.points.geometry.dispose();
    this.material.dispose();
  }
}

const METADATA: SceneRegistration = {
  id: 'lattice',
  name: 'Lattice',
  description: 'Crystal constellation of glowing orbs on a 3D grid',
  category: 'abstract',
  audioDescription:
    'Bass swells point sizes dramatically, mids control rotation, highs shift hue and brightness',
  features: ['textureScale', 'textureOpacity'],
  params: [
    {
      key: 'particleDensity',
      label: 'Grid Resolution',
      type: 'slider',
      min: 0,
      max: 1,
      step: 0.05,
      default: 0.5,
    },
  ],
};

registerScene('lattice', (scene, config) => new LatticeScene(scene, config), METADATA);
