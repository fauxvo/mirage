import * as THREE from 'three';
import type { VisualizerConfig } from '@/types/visualizer';
import { registerScene } from './scene-registry';
import type { SceneRegistration } from './types';

const VERTEX_SHADER = `
  uniform float uTime;
  uniform float uBass;
  uniform float uSpeed;
  varying vec2 vUv;
  varying vec3 vPosition;

  void main() {
    vUv = uv;
    vec3 pos = position;
    float t = uTime * uSpeed * 0.4;

    // Turbulent displacement
    float turb = sin(pos.x * 2.0 + t) * cos(pos.y * 2.0 + t * 0.7) * (0.3 + uBass * 0.8);
    turb += sin(pos.x * 4.0 - t * 1.3) * sin(pos.y * 3.0 + t * 0.9) * 0.15;
    pos += normal * turb;

    vPosition = pos;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uMid;
  uniform float uHigh;
  uniform float uSpeed;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform vec3 uAccent;
  uniform sampler2D uTexture;
  uniform bool uHasTexture;
  varying vec2 vUv;
  varying vec3 vPosition;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    float t = uTime * uSpeed * 0.3;
    vec2 uv = vUv * 4.0;

    float n = fbm(uv + vec2(t * 0.4, t * 0.3));
    n += fbm(uv * 2.0 - vec2(t * 0.2, t * 0.5)) * 0.5;

    // Heat gradient controlled by mids
    float heat = n + uMid * 0.3;
    vec3 coldColor = uPrimary;
    vec3 warmColor = uSecondary;
    vec3 hotColor = uAccent;

    vec3 color = mix(coldColor, warmColor, smoothstep(0.3, 0.6, heat));
    color = mix(color, hotColor, smoothstep(0.6, 0.9, heat));

    // Surface cracks from highs
    float crack = smoothstep(0.48, 0.5, abs(noise(uv * 8.0 + t * 0.5) - 0.5));
    color += crack * uHigh * hotColor * 2.0;

    // Emissive glow
    color *= 1.2;

    if (uHasTexture) {
      vec4 texColor = texture2D(uTexture, vUv);
      color = mix(color, texColor.rgb, texColor.a * 0.5);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

export class LavaScene {
  private mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private clock: THREE.Clock;

  constructor(
    private scene: THREE.Scene,
    private config: VisualizerConfig
  ) {
    this.clock = new THREE.Clock();
    const palette = config.colorPalette;

    const geometry = new THREE.SphereGeometry(2, 64, 64);
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
    this.scene.add(this.mesh);
  }

  update(bass: number, mid: number, high: number): void {
    const time = this.clock.getElapsedTime();
    const r = this.config.audioReactivity;
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uBass.value = bass * r;
    this.material.uniforms.uMid.value = mid * r;
    this.material.uniforms.uHigh.value = high * r;

    this.mesh.rotation.y += 0.003 * this.config.animationSpeed;
    this.mesh.rotation.x += 0.001 * this.config.animationSpeed;
  }

  setTexture(texture: THREE.Texture | null): void {
    this.material.uniforms.uTexture.value = texture;
    this.material.uniforms.uHasTexture.value = texture !== null;
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

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

const METADATA: SceneRegistration = {
  id: 'lava',
  name: 'Lava',
  description: 'Molten lava flow with turbulent noise',
  category: 'organic',
  audioDescription:
    'Bass drives turbulence intensity, mids shift heat color, highs crack the surface',
  params: [],
};

registerScene('lava', (scene, config) => new LavaScene(scene, config), METADATA);
