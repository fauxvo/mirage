import * as THREE from 'three';
import type { VisualizerConfig } from '@/types/visualizer';
import { registerScene } from './scene-registry';
import type { SceneRegistration } from './types';
import { computeAnimatedOpacity, computeTextureMotion, applyFixedMotion } from './starburst-utils';

/**
 * Starburst Scene (3D Sphere)
 *
 * A centred custom texture floating in front of radiating starburst rays
 * projected onto a sphere that wraps entirely around the camera. No black
 * edges regardless of camera orbit/drift. The rays are computed from 3D
 * positions using equirectangular mapping for seamless coverage.
 */

// --- Burst background: sphere rendered from inside (BackSide) ---

const BURST_VERTEX = `
  varying vec3 vDir;
  void main() {
    // Compute direction in view space so the pattern is always centered on
    // the camera's forward direction, regardless of camera position/orbit.
    vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
    vDir = viewPos.xyz;
    gl_Position = projectionMatrix * viewPos;
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
  uniform float uRayCount;
  uniform float uOffsetX;
  uniform float uOffsetY;
  varying vec3 vDir;

  void main() {
    // View-space direction: in view space the camera looks along -Z,
    // so atan(x, -z) gives 0 at screen centre. Scale 3.0 maps the
    // 60° FOV half-angle (~0.524 rad) to ±0.5, matching the flat
    // version's UV range so the ray pattern fills the visible screen.
    vec3 dir = normalize(vDir);
    float lon = atan(dir.x, -dir.z);
    float lat = asin(clamp(dir.y, -1.0, 1.0));

    vec2 center = vec2(lon, lat) / 3.14159 * 3.0;
    center -= vec2(uOffsetX * 0.3, uOffsetY * 0.3);

    float angle = atan(center.y, center.x);
    float dist = length(center);

    // Rotating rays
    float rotation = uTime * uSpeed * 0.15;
    float rayAngle = angle + rotation;

    // Ray pattern: multiple overlapping sine waves for complexity
    float rays = 0.0;
    rays += sin(rayAngle * uRayCount) * 0.5 + 0.5;
    rays += sin(rayAngle * uRayCount * 0.5 + uTime * uSpeed * 0.3) * 0.25 + 0.25;
    rays += sin(rayAngle * uRayCount * 2.0 - uTime * uSpeed * 0.2) * 0.15 + 0.15;

    // Audio pulse: bass expands rays, mid brightens, high sharpens
    float bassPulse = 1.0 + uBass * uReactivity * 0.6;
    float midBright = 1.0 + uMid * uReactivity * 0.4;
    float highSharp = 1.0 + uHigh * uReactivity * 0.3;

    // Hollow center only — no outer fade so rays fill the entire sphere
    float innerFade = smoothstep(0.0, 0.12 * bassPulse, dist);
    float falloff = innerFade;

    // Combine rays with falloff
    float rayIntensity = rays * falloff * highSharp * midBright;
    rayIntensity = pow(rayIntensity, 1.5); // sharpen

    // Color gradient: primary at center, secondary at mid, accent at tips
    vec3 rayColor = mix(uPrimary, uSecondary, dist * 2.0);
    rayColor = mix(rayColor, uAccent, rays * 0.3);

    // Background always at full brightness; rays add on top
    gl_FragColor = vec4(uBackground + rayColor * rayIntensity * 0.8, 1.0);
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
  varying vec2 vUv;

  void main() {
    if (uHasTexture) {
      vec4 tex = texture2D(uTexture, vUv);

      // Subtle glow halo around the image
      float edgeDist = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
      float halo = smoothstep(0.0, 0.15, edgeDist);

      // Audio breathing: gentle scale pulse baked into alpha
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

export class StarburstScene {
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

    // Starburst background — sphere rendered from inside so it wraps around
    // the camera completely. No black edges regardless of camera angle.
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
        uRayCount: { value: 12.0 },
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
      config.textureAnimation !== undefined ||
      config.textureMotion !== undefined
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
  id: 'starburst',
  name: 'Starburst',
  description: 'Centred texture over 3D starburst rays — no black edges with any camera mode',
  category: 'immersive',
  audioDescription: 'Bass expands rays, mids brighten the glow, highs sharpen ray edges',
  params: [],
  features: [
    'textureScale',
    'textureOpacity',
    'textureAnimation',
    'textureMotion',
    'patternOffset',
  ],
};

registerScene('starburst', (scene, config) => new StarburstScene(scene, config), METADATA);
