import * as THREE from 'three';
import type { VisualizerConfig } from '@/types/visualizer';
import { registerScene } from './scene-registry';
import type { SceneRegistration } from './types';
import { computeAnimatedOpacity } from './starburst-utils';

/**
 * Starburst Flat Scene
 *
 * Full-screen starburst rays that cover every pixel — no black, ever.
 * The centred texture stays flat (no Y-axis rotation), only the shader
 * rays rotate. Matches the classic "flat background" look where the
 * burst radiates from behind a stationary centred image.
 */

const BURST_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Full-screen rays with NO vignette and NO black edges.
// Rays extend to every corner. Background color fills where rays are weak.
const BURST_FRAGMENT = `
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uSpeed;
  uniform float uReactivity;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform vec3 uAccent;
  uniform vec3 uBackground;
  uniform float uRayCount;
  uniform float uOffsetX;
  varying vec2 vUv;

  void main() {
    vec2 center = vUv - 0.5 - vec2(uOffsetX * 0.3, 0.0);
    float angle = atan(center.y, center.x);
    float dist = length(center);

    // Rotating rays
    float rotation = uTime * uSpeed * 0.15;
    float rayAngle = angle + rotation;

    // Ray pattern: overlapping sine waves for visual complexity
    float rays = 0.0;
    rays += sin(rayAngle * uRayCount) * 0.5 + 0.5;
    rays += sin(rayAngle * uRayCount * 0.5 + uTime * uSpeed * 0.3) * 0.25 + 0.25;
    rays += sin(rayAngle * uRayCount * 2.0 - uTime * uSpeed * 0.2) * 0.15 + 0.15;

    // Audio reactivity
    float bassPulse = 1.0 + uBass * uReactivity * 0.6;
    float midBright = 1.0 + uMid * uReactivity * 0.4;
    float highSharp = 1.0 + uHigh * uReactivity * 0.3;

    // Hollow center so texture is visible, but NO outer falloff — rays go to edges
    float innerFade = smoothstep(0.0, 0.12 * bassPulse, dist);

    // Combine: no outer fade means rays fill the entire screen
    float rayIntensity = rays * innerFade * highSharp * midBright;
    rayIntensity = pow(rayIntensity, 1.5);

    // Color gradient: primary near centre, secondary at mid, accent at tips
    vec3 rayColor = mix(uPrimary, uSecondary, clamp(dist * 1.5, 0.0, 1.0));
    rayColor = mix(rayColor, uAccent, rays * 0.3);

    // Composition: background + rays. Background is ALWAYS the palette background,
    // never black. Rays blend on top with strong presence.
    vec3 color = uBackground;
    color = mix(color, rayColor, rayIntensity * 0.75);

    // Gentle distance-based color enrichment so edges stay vibrant
    vec3 edgeTint = mix(uSecondary, uAccent, sin(angle * 2.0 + uTime * uSpeed * 0.1) * 0.5 + 0.5);
    float edgeBlend = smoothstep(0.2, 0.7, dist) * 0.3;
    color = mix(color, edgeTint, edgeBlend * (1.0 - rayIntensity * 0.5));

    gl_FragColor = vec4(color, 1.0);
  }
`;

const LOGO_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const LOGO_FRAGMENT = `
  uniform sampler2D uTexture;
  uniform bool uHasTexture;
  uniform float uBass;
  uniform float uHigh;
  uniform float uReactivity;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uSpeed;
  uniform vec3 uPrimary;
  uniform vec3 uAccent;
  varying vec2 vUv;

  void main() {
    if (uHasTexture) {
      vec4 tex = texture2D(uTexture, vUv);

      // Soft edge halo so the texture blends smoothly into the rays
      float edgeDist = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
      float halo = smoothstep(0.0, 0.12, edgeDist);

      // Audio breathing
      float breathe = 1.0 + uBass * uReactivity * 0.08;
      float shimmer = 1.0 + uHigh * uReactivity * 0.15;

      tex.rgb *= breathe * shimmer;
      gl_FragColor = vec4(tex.rgb, tex.a * halo * uOpacity);
    } else {
      // Placeholder: glowing orb
      vec2 center = vUv - 0.5;
      float dist = length(center);
      float pulse = 1.0 + uBass * uReactivity * 0.2;

      float orb = 1.0 - smoothstep(0.0, 0.35 * pulse, dist);
      float ring = smoothstep(0.25, 0.3, dist) * (1.0 - smoothstep(0.3, 0.35, dist));

      float shimmer = sin(atan(center.y, center.x) * 8.0 + uTime * uSpeed * 2.0) * 0.5 + 0.5;

      vec3 color = mix(uPrimary, uAccent, shimmer * 0.5);
      float alpha = orb * 0.9 + ring * 0.6;

      gl_FragColor = vec4(color * (orb + ring * 0.5), alpha);
    }
  }
`;

export class StarburstFlatScene {
  private burstMesh: THREE.Mesh;
  private burstMaterial: THREE.ShaderMaterial;
  private logoMesh: THREE.Mesh;
  private logoMaterial: THREE.ShaderMaterial;
  private clock: THREE.Clock;
  private config: VisualizerConfig;

  constructor(
    private scene: THREE.Scene,
    config: VisualizerConfig
  ) {
    this.config = config;
    this.clock = new THREE.Clock();
    const palette = config.colorPalette;

    // Starburst background — oversized plane for full viewport coverage
    const burstGeo = new THREE.PlaneGeometry(40, 40);
    this.burstMaterial = new THREE.ShaderMaterial({
      vertexShader: BURST_VERTEX,
      fragmentShader: BURST_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uSpeed: { value: config.animationSpeed },
        uReactivity: { value: config.audioReactivity },
        uPrimary: { value: new THREE.Color(palette.primary) },
        uSecondary: { value: new THREE.Color(palette.secondary) },
        uAccent: { value: new THREE.Color(palette.accent) },
        uBackground: { value: new THREE.Color(palette.background) },
        uRayCount: { value: 12.0 },
        uOffsetX: { value: config.patternOffsetX ?? 0 },
      },
      depthWrite: false,
    });

    this.burstMesh = new THREE.Mesh(burstGeo, this.burstMaterial);
    this.burstMesh.position.z = -2;
    this.scene.add(this.burstMesh);

    // Centre texture plane — stays flat, no Y-axis rotation
    const logoGeo = new THREE.PlaneGeometry(3, 3);
    this.logoMaterial = new THREE.ShaderMaterial({
      vertexShader: LOGO_VERTEX,
      fragmentShader: LOGO_FRAGMENT,
      uniforms: {
        uTexture: { value: null },
        uHasTexture: { value: false },
        uBass: { value: 0 },
        uHigh: { value: 0 },
        uReactivity: { value: config.audioReactivity },
        uOpacity: { value: config.textureOpacity ?? 1.0 },
        uTime: { value: 0 },
        uSpeed: { value: config.animationSpeed },
        uPrimary: { value: new THREE.Color(palette.primary) },
        uAccent: { value: new THREE.Color(palette.accent) },
      },
      transparent: true,
      depthWrite: false,
    });

    this.logoMesh = new THREE.Mesh(logoGeo, this.logoMaterial);
    this.logoMesh.position.z = 0;
    this.scene.add(this.logoMesh);
  }

  update(bass: number, mid: number, high: number): void {
    const time = this.clock.getElapsedTime();
    const reactivity = this.config.audioReactivity;

    // Starburst uniforms
    this.burstMaterial.uniforms.uTime.value = time;
    this.burstMaterial.uniforms.uBass.value = bass * reactivity;
    this.burstMaterial.uniforms.uMid.value = mid * reactivity;
    this.burstMaterial.uniforms.uHigh.value = high * reactivity;

    // Logo uniforms
    this.logoMaterial.uniforms.uTime.value = time;
    this.logoMaterial.uniforms.uBass.value = bass * reactivity;
    this.logoMaterial.uniforms.uHigh.value = high * reactivity;

    // Animated texture opacity
    const anim = this.config.textureAnimation ?? 'none';
    const baseOpacity = this.config.textureOpacity ?? 1.0;
    const animMul = computeAnimatedOpacity(anim, time, this.config.animationSpeed, bass);
    this.logoMaterial.uniforms.uOpacity.value = baseOpacity * animMul;

    // Gentle breathing scale — texture stays flat, no Y rotation
    const scale = this.config.textureScale ?? 1.0;
    const breathe = scale * (1.0 + bass * reactivity * 0.05);
    this.logoMesh.scale.setScalar(breathe);

    // Horizontal offset
    const offsetX = this.config.patternOffsetX ?? 0;
    this.logoMesh.position.x = offsetX * 4.0;
  }

  setTexture(texture: THREE.Texture | null): void {
    this.logoMaterial.uniforms.uTexture.value = texture;
    this.logoMaterial.uniforms.uHasTexture.value = texture !== null;

    // Resize plane to match actual image aspect ratio
    if (texture?.image) {
      const img = texture.image as HTMLImageElement;
      const aspect = img.width / img.height;
      const maxSize = 3;
      const w = aspect >= 1 ? maxSize : maxSize * aspect;
      const h = aspect >= 1 ? maxSize / aspect : maxSize;
      this.logoMesh.geometry.dispose();
      this.logoMesh.geometry = new THREE.PlaneGeometry(w, h);
    } else {
      this.logoMesh.geometry.dispose();
      this.logoMesh.geometry = new THREE.PlaneGeometry(3, 3);
    }
  }

  updateConfig(config: Partial<VisualizerConfig>): void {
    if (config.colorPalette) {
      this.burstMaterial.uniforms.uPrimary.value.set(config.colorPalette.primary);
      this.burstMaterial.uniforms.uSecondary.value.set(config.colorPalette.secondary);
      this.burstMaterial.uniforms.uAccent.value.set(config.colorPalette.accent);
      this.burstMaterial.uniforms.uBackground.value.set(config.colorPalette.background);
      this.logoMaterial.uniforms.uPrimary.value.set(config.colorPalette.primary);
      this.logoMaterial.uniforms.uAccent.value.set(config.colorPalette.accent);
    }
    if (config.animationSpeed !== undefined) {
      this.burstMaterial.uniforms.uSpeed.value = config.animationSpeed;
      this.logoMaterial.uniforms.uSpeed.value = config.animationSpeed;
    }
    if (config.audioReactivity !== undefined) {
      this.config = { ...this.config, ...config };
      this.burstMaterial.uniforms.uReactivity.value = config.audioReactivity;
      this.logoMaterial.uniforms.uReactivity.value = config.audioReactivity;
    }
    if (
      config.textureScale !== undefined ||
      config.textureOpacity !== undefined ||
      config.textureAnimation !== undefined
    ) {
      this.config = { ...this.config, ...config };
    }
    if (
      config.textureOpacity !== undefined &&
      (this.config.textureAnimation ?? 'none') === 'none'
    ) {
      this.logoMaterial.uniforms.uOpacity.value = config.textureOpacity;
    }
    if (config.patternOffsetX !== undefined) {
      this.config = { ...this.config, ...config };
      this.burstMaterial.uniforms.uOffsetX.value = config.patternOffsetX;
    }
  }

  dispose(): void {
    this.scene.remove(this.burstMesh);
    this.scene.remove(this.logoMesh);
    this.burstMesh.geometry.dispose();
    this.burstMaterial.dispose();
    this.logoMesh.geometry.dispose();
    this.logoMaterial.dispose();
  }
}

const METADATA: SceneRegistration = {
  id: 'starburst-flat',
  name: 'Starburst Flat',
  description: 'Full-screen rays with a stationary flat texture — no black, ever',
  category: 'immersive',
  audioDescription: 'Bass expands rays, mids brighten glow, texture stays flat and centered',
  params: [],
};

registerScene('starburst-flat', (scene, config) => new StarburstFlatScene(scene, config), METADATA);
