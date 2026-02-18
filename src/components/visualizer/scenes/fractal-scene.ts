import * as THREE from 'three';
import type { VisualizerConfig } from '@/types/visualizer';
import { registerScene } from './scene-registry';
import type { SceneRegistration } from './types';

const VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uSpeed;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform vec3 uAccent;
  uniform sampler2D uTexture;
  uniform bool uHasTexture;
  varying vec2 vUv;

  vec3 palette(float t, vec3 a, vec3 b) {
    return a + b * cos(6.28318 * t);
  }

  void main() {
    float t = uTime * uSpeed * 0.1;

    // Map UV to complex plane centered on interesting region
    vec2 uv = (vUv - 0.5) * 3.0;

    // Bass controls zoom
    float zoom = 1.0 + uBass * 2.0;
    uv /= zoom;

    // Julia set with drifting parameter controlled by mids
    vec2 c = vec2(
      -0.7 + sin(t * 0.5 + uMid) * 0.15,
      0.27 + cos(t * 0.3 + uMid * 0.5) * 0.1
    );

    vec2 z = uv;
    float iter = 0.0;
    const float maxIter = 100.0;

    for (float i = 0.0; i < maxIter; i++) {
      z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
      if (dot(z, z) > 4.0) break;
      iter = i;
    }

    float f = iter / maxIter;

    // Color cycle speed from highs
    float cycleSpeed = 1.0 + uHigh * 3.0;
    float colorT = f * 3.0 + t * cycleSpeed;

    vec3 color;
    if (iter >= maxIter - 1.0) {
      color = vec3(0.0);
    } else {
      vec3 c1 = uPrimary;
      vec3 c2 = uSecondary;
      vec3 c3 = uAccent;
      float m = fract(colorT);
      float segment = mod(floor(colorT), 3.0);
      if (segment < 1.0) color = mix(c1, c2, m);
      else if (segment < 2.0) color = mix(c2, c3, m);
      else color = mix(c3, c1, m);
    }

    if (uHasTexture) {
      vec4 texColor = texture2D(uTexture, vUv);
      color = mix(color, texColor.rgb, texColor.a * 0.5);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

export class FractalScene {
  private mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private clock: THREE.Clock;

  constructor(
    private scene: THREE.Scene,
    private config: VisualizerConfig
  ) {
    this.clock = new THREE.Clock();
    const palette = config.colorPalette;

    const geometry = new THREE.PlaneGeometry(12, 12);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
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
      },
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.z = -2;
    this.scene.add(this.mesh);
  }

  update(bass: number, mid: number, high: number): void {
    const time = this.clock.getElapsedTime();
    const r = this.config.audioReactivity;
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uBass.value = bass * r;
    this.material.uniforms.uMid.value = mid * r;
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
  id: 'fractal',
  name: 'Fractal',
  description: 'Julia/Mandelbrot set with infinite zoom',
  category: 'geometric',
  audioDescription: 'Bass controls zoom level, mids drift parameters, highs cycle colors',
  params: [],
};

registerScene('fractal', (scene, config) => new FractalScene(scene, config), METADATA);
