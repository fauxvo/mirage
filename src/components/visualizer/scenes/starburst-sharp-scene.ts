import * as THREE from 'three';
import type { VisualizerConfig } from '@/types/visualizer';
import { registerScene } from './scene-registry';
import type { SceneRegistration } from './types';
import { computeAnimatedOpacity, computeTextureMotion, applyFixedMotion } from './starburst-utils';

/**
 * Starburst Sharp Scene
 *
 * Many thin, crisp, defined rays radiating outward — retro sunburst feel.
 * Rays alternate between primary/secondary colors with hard edges.
 * Custom texture floats centred; placeholder orb shown without one.
 */

const BURST_VERTEX = `
  varying vec3 vWorldDir;
  void main() {
    // World-space direction: pattern center is fixed in world space so it
    // slides on-screen when the camera orbits (unlike view-space locking).
    vWorldDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

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
  uniform float uOffsetX;
  uniform float uOffsetY;
  varying vec3 vWorldDir;

  void main() {
    vec3 dir = normalize(vWorldDir);
    float lon = atan(dir.x, -dir.z);
    float lat = asin(clamp(dir.y, -1.0, 1.0));

    vec2 center = vec2(lon, lat) / 3.14159 * 3.0;
    center -= vec2(uOffsetX * 0.3, uOffsetY * 0.3);
    float angle = atan(center.y, center.x);
    float dist = length(center);

    // Very slow rotation
    float rotation = uTime * uSpeed * 0.05;
    float rayAngle = angle + rotation;

    // Many sharp rays — step function for hard alternating bands
    float rayCount = 24.0;
    float stripe = sin(rayAngle * rayCount);
    float sharpRay = smoothstep(-0.1, 0.1, stripe);

    // Secondary layer: thinner accent rays between main bands
    float accentStripe = sin(rayAngle * rayCount + 3.14159);
    float accentRay = smoothstep(0.3, 0.5, accentStripe) * (1.0 - smoothstep(0.5, 0.7, accentStripe));

    // Audio influence
    float bassPulse = 1.0 + uBass * uReactivity * 0.5;
    float highEdge = 1.0 + uHigh * uReactivity * 0.4;

    // Hollow center only — no outer fade so rays fill the entire sphere
    float innerFade = smoothstep(0.0, 0.1 * bassPulse, dist);
    float falloff = innerFade;

    // Color: alternate between primary and secondary in bands
    vec3 bandColor = mix(uSecondary, uPrimary, sharpRay);
    vec3 accentColor = uAccent * accentRay * 0.3;

    // Hollow center dimming — applied only to ray contribution
    float centerDim = smoothstep(0.0, 0.08, dist);

    // Combine ray contribution (vignette + centerDim only affect rays, never background)
    float rayIntensity = falloff * highEdge * centerDim;
    vec3 rays = bandColor * rayIntensity * 0.7 + accentColor * falloff * centerDim;

    // Background always at full brightness; rays add on top
    gl_FragColor = vec4(uBackground + rays, 1.0);
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
      float edgeDist = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
      float halo = smoothstep(0.0, 0.15, edgeDist);
      float breathe = 1.0 + uBass * uReactivity * 0.06;
      float shimmer = 1.0 + uHigh * uReactivity * 0.12;
      tex.rgb *= breathe * shimmer;
      gl_FragColor = vec4(tex.rgb, tex.a * halo * uOpacity);
    } else {
      vec2 center = vUv - 0.5;
      float dist = length(center);
      float pulse = 1.0 + uBass * uReactivity * 0.15;
      float orb = 1.0 - smoothstep(0.0, 0.3 * pulse, dist);
      float ring = smoothstep(0.2, 0.25, dist) * (1.0 - smoothstep(0.25, 0.3, dist));
      float shimmer = sin(atan(center.y, center.x) * 12.0 + uTime * uSpeed * 2.5) * 0.5 + 0.5;
      vec3 color = mix(uPrimary, uAccent, shimmer * 0.5);
      float alpha = orb * 0.9 + ring * 0.6;
      gl_FragColor = vec4(color * (orb + ring * 0.5), alpha);
    }
  }
`;

export class StarburstSharpScene {
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

    const burstGeo = new THREE.SphereGeometry(50, 64, 32);
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
        uOffsetX: { value: config.patternOffsetX ?? 0 },
        uOffsetY: { value: config.patternOffsetY ?? 0 },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });

    this.burstMesh = new THREE.Mesh(burstGeo, this.burstMaterial);
    this.scene.add(this.burstMesh);

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

    this.burstMaterial.uniforms.uTime.value = time;
    this.burstMaterial.uniforms.uBass.value = bass * reactivity;
    this.burstMaterial.uniforms.uMid.value = mid * reactivity;
    this.burstMaterial.uniforms.uHigh.value = high * reactivity;

    this.logoMaterial.uniforms.uTime.value = time;
    this.logoMaterial.uniforms.uBass.value = bass * reactivity;
    this.logoMaterial.uniforms.uHigh.value = high * reactivity;

    // Animated texture opacity
    const anim = this.config.textureAnimation ?? 'none';
    const baseOpacity = this.config.textureOpacity ?? 1.0;
    const animMul = computeAnimatedOpacity(anim, time, this.config.animationSpeed, bass);
    this.logoMaterial.uniforms.uOpacity.value = baseOpacity * animMul;

    const scale = this.config.textureScale ?? 1.0;
    const breathe = scale * (1.0 + bass * reactivity * 0.04);
    this.logoMesh.scale.setScalar(breathe);

    const offsetX = this.config.patternOffsetX ?? 0;
    const offsetY = this.config.patternOffsetY ?? 0;

    // Texture motion
    const motionMode = this.config.textureMotion ?? 'none';
    if (motionMode === 'fixed') {
      applyFixedMotion(this.logoMesh, this.scene, offsetX, offsetY);
    } else {
      this.logoMesh.rotation.x = 0;
      this.logoMesh.rotation.y = 0;
      const motion = computeTextureMotion(motionMode, time, this.config.animationSpeed, bass);
      this.logoMesh.position.x = offsetX * 4.0 + motion.offsetX;
      this.logoMesh.position.y = offsetY * 4.0 + motion.offsetY;
      this.logoMesh.rotation.z = motion.rotationZ;
      if (motion.extraScale !== 1) this.logoMesh.scale.multiplyScalar(motion.extraScale);
    }
  }

  setTexture(texture: THREE.Texture | null): void {
    this.logoMaterial.uniforms.uTexture.value = texture;
    this.logoMaterial.uniforms.uHasTexture.value = texture !== null;

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
    if (config.patternOffsetY !== undefined) {
      this.config = { ...this.config, ...config };
      this.burstMaterial.uniforms.uOffsetY.value = config.patternOffsetY;
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
  id: 'starburst-sharp',
  name: 'Starburst Sharp',
  description: 'Many thin, crisp alternating rays — retro sunburst',
  category: 'immersive',
  audioDescription: 'Bass extends ray reach, highs sharpen band edges',
  params: [],
  features: [
    'textureScale',
    'textureOpacity',
    'textureAnimation',
    'textureMotion',
    'patternOffset',
  ],
};

registerScene(
  'starburst-sharp',
  (scene, config) => new StarburstSharpScene(scene, config),
  METADATA
);
