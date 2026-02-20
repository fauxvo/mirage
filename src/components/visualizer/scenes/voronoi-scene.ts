import * as THREE from 'three';
import type { VisualizerConfig } from '@/types/visualizer';
import { registerScene } from './scene-registry';
import type { SceneRegistration } from './types';

const VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
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
  uniform float uTextureScale;
  uniform float uTextureOpacity;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;

  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }

  void main() {
    // Map UVs to spherical voronoi
    vec2 uv = vUv * (4.0 + uBass * 2.0);
    float t = uTime * uSpeed * 0.3;

    // Voronoi
    vec2 n = floor(uv);
    vec2 f = fract(uv);

    float minDist = 1.0;
    float secondDist = 1.0;
    vec2 closestPoint;

    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 o = hash2(n + g);
        o = 0.5 + 0.5 * sin(t + 6.2831 * o);
        vec2 r = g + o - f;
        float d = dot(r, r);
        if (d < minDist) {
          secondDist = minDist;
          minDist = d;
          closestPoint = o;
        } else if (d < secondDist) {
          secondDist = d;
        }
      }
    }

    minDist = sqrt(minDist);
    secondDist = sqrt(secondDist);

    // Border glow controlled by mids
    float border = smoothstep(0.0, 0.05 + uMid * 0.1, secondDist - minDist);

    // Cell color variation from highs
    float cellColor = closestPoint.x + closestPoint.y + uHigh * 0.5;
    vec3 color = mix(uPrimary, uSecondary, fract(cellColor));
    color = mix(color, uAccent, 1.0 - border);

    // Fresnel edge
    vec3 viewDir = normalize(-vPosition);
    float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 2.0);
    color += uAccent * fresnel * 0.3;

    if (uHasTexture) {
      vec2 texUv = (vUv - 0.5) / uTextureScale + 0.5;
      vec4 texColor = texture2D(uTexture, texUv);
      float inBounds = step(0.0, texUv.x) * step(texUv.x, 1.0) * step(0.0, texUv.y) * step(texUv.y, 1.0);
      color = mix(color, texColor.rgb, texColor.a * uTextureOpacity * inBounds);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

export class VoronoiScene {
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
        uTextureScale: { value: config.textureScale ?? 1.0 },
        uTextureOpacity: { value: config.textureOpacity ?? 1.0 },
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
    if (config.textureScale !== undefined) {
      this.material.uniforms.uTextureScale.value = config.textureScale;
    }
    if (config.textureOpacity !== undefined) {
      this.material.uniforms.uTextureOpacity.value = config.textureOpacity;
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
  id: 'voronoi',
  name: 'Voronoi',
  description: 'Voronoi cell pattern on a sphere',
  category: 'abstract',
  audioDescription: 'Bass scales cells, mids control border glow, highs add color variation',
  features: ['textureScale', 'textureOpacity'],
  params: [],
};

registerScene('voronoi', (scene, config) => new VoronoiScene(scene, config), METADATA);
