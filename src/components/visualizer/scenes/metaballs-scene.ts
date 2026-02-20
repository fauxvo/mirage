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
  uniform vec2 uResolution;
  uniform sampler2D uTexture;
  uniform bool uHasTexture;
  uniform float uTextureScale;
  uniform float uTextureOpacity;
  varying vec2 vUv;

  float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0);
    return mix(b, a, h) - k*h*(1.0-h);
  }

  float sdSphere(vec3 p, float r) {
    return length(p) - r;
  }

  float map(vec3 p) {
    float t = uTime * uSpeed * 0.5;
    float blobSize = 0.4 + uBass * 0.3;
    float moveSpeed = 1.0 + uMid * 2.0;

    float d = sdSphere(p - vec3(sin(t * moveSpeed) * 1.2, cos(t * moveSpeed * 0.7) * 0.8, sin(t * 0.5) * 0.5), blobSize);
    d = smin(d, sdSphere(p - vec3(cos(t * moveSpeed * 0.8) * 1.0, sin(t * moveSpeed * 0.6) * 1.0, cos(t * 0.4) * 0.6), blobSize), 0.5);
    d = smin(d, sdSphere(p - vec3(sin(t * moveSpeed * 0.6 + 2.0) * 0.8, cos(t * moveSpeed * 0.9 + 1.0) * 0.6, sin(t * 0.7 + 1.5) * 0.8), blobSize * 0.8), 0.5);
    d = smin(d, sdSphere(p - vec3(cos(t * moveSpeed * 0.5 + 3.0) * 1.5, sin(t * moveSpeed * 0.4 + 2.0) * 0.5, cos(t * 0.6 + 2.0) * 0.4), blobSize * 0.7), 0.5);

    return d;
  }

  vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
      map(p + e.xyy) - map(p - e.xyy),
      map(p + e.yxy) - map(p - e.yxy),
      map(p + e.yyx) - map(p - e.yyx)
    ));
  }

  void main() {
    vec2 uv = (vUv - 0.5) * 2.0;
    uv.x *= uResolution.x / uResolution.y;

    vec3 ro = vec3(0.0, 0.0, 4.0);
    vec3 rd = normalize(vec3(uv, -1.5));

    float t = 0.0;
    float d;
    vec3 p;

    for (int i = 0; i < 64; i++) {
      p = ro + rd * t;
      d = map(p);
      if (d < 0.001 || t > 20.0) break;
      t += d;
    }

    vec3 color = vec3(0.0);

    if (d < 0.01) {
      vec3 n = calcNormal(p);
      vec3 light = normalize(vec3(1.0, 1.0, 1.0));

      float diff = max(dot(n, light), 0.0);
      float spec = pow(max(dot(reflect(-light, n), normalize(-rd)), 0.0), 32.0);

      // Surface detail from highs
      float detail = 1.0 + uHigh * 0.5;

      color = uPrimary * diff * 0.6;
      color += uSecondary * spec * 0.4 * detail;
      color += uAccent * pow(1.0 - max(dot(normalize(-rd), n), 0.0), 3.0) * 0.5;

      // Subtle subsurface scattering look
      color += uPrimary * 0.1;
    }

    if (uHasTexture) {
      vec2 texUv = (vUv - 0.5) / uTextureScale + 0.5;
      vec4 texColor = texture2D(uTexture, texUv);
      float inBounds = step(0.0, texUv.x) * step(texUv.x, 1.0) * step(0.0, texUv.y) * step(texUv.y, 1.0);
      color = mix(color, texColor.rgb, texColor.a * uTextureOpacity * inBounds);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

export class MetaballsScene {
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
        uResolution: {
          value: new THREE.Vector2(window.innerWidth, window.innerHeight),
        },
        uPrimary: { value: new THREE.Color(palette.primary) },
        uSecondary: { value: new THREE.Color(palette.secondary) },
        uAccent: { value: new THREE.Color(palette.accent) },
        uTexture: { value: null },
        uHasTexture: { value: false },
        uTextureScale: { value: config.textureScale ?? 1.0 },
        uTextureOpacity: { value: config.textureOpacity ?? 1.0 },
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
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

const METADATA: SceneRegistration = {
  id: 'metaballs',
  name: 'Metaballs',
  description: 'Merging liquid blobs via raymarched SDF',
  category: 'abstract',
  audioDescription: 'Bass enlarges blobs, mids control movement speed, highs add surface detail',
  features: ['textureScale', 'textureOpacity'],
  params: [],
};

registerScene('metaballs', (scene, config) => new MetaballsScene(scene, config), METADATA);
