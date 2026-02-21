import * as THREE from 'three';
import type { VisualizerConfig } from '@/types/visualizer';
import { registerScene } from './scene-registry';
import type { SceneRegistration, SceneUserData } from './types';
import {
  computeAnimatedOpacity,
  computeTextureMotion,
  applyFixedMotion,
  applyTintToUniform,
} from './starburst-utils';

/**
 * Starburst Classic Scene
 *
 * Vintage/retro starburst — few thick alternating bands, warm glow from
 * center, vignette edges, subtle film-grain flicker. Feels like a carnival
 * spotlight or old projector. Very different from the modern Starburst.
 */

// --- Starburst background (fullscreen quad with ray shader) ---

const BURST_VERTEX = `
  varying vec3 vWorldDir;
  void main() {
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

    // Very slow rotation — vintage poster feel
    float rotation = uTime * uSpeed * 0.03;
    float rayAngle = angle + rotation;

    // 6 thick alternating bands — hard step, not sine waves
    float bandCount = 6.0;
    float stripe = sin(rayAngle * bandCount);
    float band = smoothstep(-0.05, 0.05, stripe); // hard edge

    // Audio: bass pulses the center glow, mids warm the bands
    float bassPulse = 1.0 + uBass * uReactivity * 0.5;
    float midWarm = 1.0 + uMid * uReactivity * 0.3;

    // Hollow center for texture
    float innerFade = smoothstep(0.0, 0.1 * bassPulse, dist);

    // Radial glow — rays brighten from center and fade toward edges
    float glow = 1.0 - smoothstep(0.0, 1.2, dist) * 0.5;

    // Alternating: primary bands vs secondary bands
    vec3 bandColor = mix(uSecondary, uPrimary, band);
    // Warm accent glow near center
    bandColor = mix(uAccent, bandColor, smoothstep(0.0, 0.25, dist));

    float intensity = innerFade * glow * midWarm;

    // Compose over background
    vec3 color = mix(uBackground, bandColor, intensity * 0.8);

    // Vignette — darken edges toward background
    float vignette = 1.0 - smoothstep(0.4, 1.5, dist) * 0.4;
    color *= vignette;

    gl_FragColor = vec4(color, 1.0);
  }
`;

// --- Centred texture sprite (or placeholder orb) ---

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
  uniform vec3 uTintColor;
  varying vec2 vUv;

  void main() {
    if (uHasTexture) {
      vec2 uv = gl_FrontFacing ? vUv : vec2(1.0 - vUv.x, vUv.y);
      vec4 tex = texture2D(uTexture, uv);

      float edgeDist = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
      float halo = smoothstep(0.0, 0.15, edgeDist);

      float breathe = 1.0 + uBass * uReactivity * 0.08;
      float shimmer = 1.0 + uHigh * uReactivity * 0.15;

      tex.rgb *= uTintColor * breathe * shimmer;
      gl_FragColor = vec4(tex.rgb, tex.a * halo * uOpacity);
    } else {
      discard;
    }
  }
`;

export class StarburstClassicScene {
  private burstMesh: THREE.Mesh;
  private burstMaterial: THREE.ShaderMaterial;
  private logoMesh: THREE.Mesh;
  private logoMaterial: THREE.ShaderMaterial;
  private clock: THREE.Clock;
  private config: VisualizerConfig;
  private camera: THREE.Camera;

  constructor(
    private scene: THREE.Scene,
    config: VisualizerConfig
  ) {
    this.config = config;
    this.camera = (scene.userData as SceneUserData).camera;
    this.clock = new THREE.Clock();
    const palette = config.colorPalette;

    // Starburst background — sphere rendered from inside for full coverage
    const burstGeo = new THREE.SphereGeometry(50, 32, 16);
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

    // Centre logo/texture plane — in front of starburst
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
        uTintColor: { value: new THREE.Color(1, 1, 1) },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
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

    // Gentle breathing scale on the logo mesh, respecting textureScale
    const scale = this.config.textureScale ?? 1.0;
    const breathe = scale * (1.0 + bass * reactivity * 0.05);
    this.logoMesh.scale.setScalar(breathe);

    // Pattern offset — shift logo mesh to follow burst centre
    const offsetX = this.config.patternOffsetX ?? 0;
    const offsetY = this.config.patternOffsetY ?? 0;

    // Texture motion
    const motionMode = this.config.textureMotion ?? 'none';
    if (motionMode === 'fixed') {
      applyFixedMotion(this.logoMesh, this.camera, offsetX, offsetY);
    } else {
      this.logoMesh.rotation.x = 0;
      const motion = computeTextureMotion(motionMode, time, this.config.animationSpeed, bass);
      this.logoMesh.rotation.y = motion.rotationY;
      this.logoMesh.position.x = offsetX * 4.0 + motion.offsetX;
      this.logoMesh.position.y = offsetY * 4.0 + motion.offsetY;
      this.logoMesh.rotation.z = motion.rotationZ;
      if (motion.extraScale !== 1) this.logoMesh.scale.multiplyScalar(motion.extraScale);
    }
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
    this.config = { ...this.config, ...config };

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
      this.burstMaterial.uniforms.uReactivity.value = config.audioReactivity;
      this.logoMaterial.uniforms.uReactivity.value = config.audioReactivity;
    }
    if (
      config.textureOpacity !== undefined &&
      (this.config.textureAnimation ?? 'none') === 'none'
    ) {
      this.logoMaterial.uniforms.uOpacity.value = config.textureOpacity;
    }
    if (config.patternOffsetX !== undefined) {
      this.burstMaterial.uniforms.uOffsetX.value = config.patternOffsetX;
    }
    if (config.patternOffsetY !== undefined) {
      this.burstMaterial.uniforms.uOffsetY.value = config.patternOffsetY;
    }
    if (config.textureTint !== undefined || config.colorPalette) {
      applyTintToUniform(
        this.logoMaterial.uniforms.uTintColor,
        this.config.textureTint,
        this.config.colorPalette
      );
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
  id: 'starburst-classic',
  name: 'Starburst Classic',
  description: 'Vintage sunburst — thick alternating bands, warm glow, film-grain flicker',
  category: 'immersive',
  audioDescription: 'Bass pulses the center glow, mids warm the bands, subtle projector flicker',
  params: [],
  features: [
    'textureScale',
    'textureOpacity',
    'textureAnimation',
    'textureMotion',
    'patternOffset',
  ],
  cameraHint: 'centered',
};

registerScene(
  'starburst-classic',
  (scene, config) => new StarburstClassicScene(scene, config),
  METADATA
);
