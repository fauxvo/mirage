import * as THREE from 'three';
import type { VisualizerConfig } from '@/types/visualizer';
import { registerScene } from './scene-registry';
import type { SceneRegistration, TextureTransform } from './types';
import {
  TEXTURE_UNIFORMS,
  TEXTURE_SAMPLE_FN,
  createTextureUniforms,
  applyTextureTransform,
} from './shader-chunks';

const VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER =
  TEXTURE_UNIFORMS +
  TEXTURE_SAMPLE_FN +
  `
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uSpeed;
  uniform float uGlowDensity;
  uniform float uShapeScale;
  uniform float uEdgeSharpness;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform vec3 uAccent;
  varying vec2 vUv;

  mat2 rot(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
  }

  // Fallback shape: diamond SDF
  float fallbackShape(vec3 pos, float gTime) {
    float pulse = sin(gTime * 0.4);
    pos.xy *= rot(gTime * 0.2);
    // Diamond: |x| + |y| - size
    float d = (abs(pos.x) + abs(pos.y)) - (0.8 + pulse * 0.3);
    return d;
  }

  // Texture-based pseudo-SDF: sample alpha, convert to edge distance
  float textureSDF(vec2 tilePos, float gTime) {
    // Map domain-repeated coords [-2,2] to [0,1] UV space
    vec2 uv = (tilePos + 2.0) / 4.0;

    // Animate: gentle rotation over time, bass-reactive scale
    float angle = gTime * 0.1;
    float sc = 1.0 / (uShapeScale * (1.0 + uBass * 0.3));
    uv -= 0.5;
    float c = cos(angle), s = sin(angle);
    uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y) * sc;
    uv += 0.5;

    // Sample alpha — clamp OOB to 0
    float inB = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    float alpha = texture2D(uTexture, uv).a * inB;

    // Edge distance: 0 at boundary, grows toward interior/exterior
    return abs(alpha - 0.5) * uEdgeSharpness;
  }

  void main() {
    vec2 uv = vUv - 0.5;
    float t = uTime * uSpeed;

    // Ripple offset per step — mid-reactive
    float ripple = 0.08 + uMid * 0.12;

    // Glow exponent — higher = tighter glow lines
    float glowExp = 8.0 * uGlowDensity;

    // Ray origin flies forward
    vec3 ro = vec3(uv, t);
    vec3 ray = normalize(vec3(uv, 1.0));

    float totalT = 0.0;
    float ac = 0.0; // accumulated glow

    for (int i = 0; i < 99; i++) {
      vec3 pos = ro + ray * totalT;
      // Domain repetition — tile space [-2,2]
      pos = mod(pos - 2.0, 4.0) - 2.0;
      float gTime = t - float(i) * ripple;

      float d;
      if (uHasTexture) {
        d = textureSDF(pos.xy, gTime);
      } else {
        d = fallbackShape(pos, gTime);
      }
      d = max(abs(d), 0.01);
      ac += exp(-d * glowExp);
      totalT += d * 0.55;
    }

    // Color from accumulated glow
    float intensity = ac * 0.015;

    // Bass-reactive color mixing
    float colorShift = sin(t * 0.3) * 0.5 + 0.5 + uHigh * 0.5;
    vec3 col1 = mix(uPrimary, uSecondary, colorShift);
    vec3 col2 = mix(uSecondary, uAccent, fract(colorShift + 0.33));

    vec3 color = mix(col1, col2, sin(intensity * 3.14) * 0.5 + 0.5) * intensity;

    // Accent highlights on bright areas
    color += uAccent * pow(intensity, 3.0) * 0.5;

    // Standard texture overlay (separate from SDF sampling)
    if (uHasTexture) {
      vec4 tex = sampleTransformedTexture((vUv - 0.5) / uTextureScale + 0.5);
      color = mix(color, tex.rgb, tex.a * 0.3);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

export class SilhouetteScene {
  private mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private clock: THREE.Clock;

  constructor(
    private scene: THREE.Scene,
    private config: VisualizerConfig
  ) {
    this.clock = new THREE.Clock();
    const palette = config.colorPalette;
    const sp = config.sceneParams ?? {};

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
        uGlowDensity: { value: (sp.glowDensity as number) ?? 1.0 },
        uShapeScale: { value: (sp.shapeScale as number) ?? 1.0 },
        uEdgeSharpness: { value: (sp.edgeSharpness as number) ?? 2.0 },
        uPrimary: { value: new THREE.Color(palette.primary) },
        uSecondary: { value: new THREE.Color(palette.secondary) },
        uAccent: { value: new THREE.Color(palette.accent) },
        ...createTextureUniforms(config),
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
    if (config.sceneParams) {
      const sp = config.sceneParams;
      if (sp.glowDensity !== undefined) this.material.uniforms.uGlowDensity.value = sp.glowDensity;
      if (sp.shapeScale !== undefined) this.material.uniforms.uShapeScale.value = sp.shapeScale;
      if (sp.edgeSharpness !== undefined)
        this.material.uniforms.uEdgeSharpness.value = sp.edgeSharpness;
    }
    this.config = { ...this.config, ...config };
  }

  setTexture(texture: THREE.Texture | null): void {
    this.material.uniforms.uTexture.value = texture;
    this.material.uniforms.uHasTexture.value = texture !== null;
  }

  setTextureTransform(transform: TextureTransform): void {
    applyTextureTransform(this.material, transform);
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

const METADATA: SceneRegistration = {
  id: 'silhouette',
  name: 'Silhouette',
  description: 'Raymarched tunnel using your uploaded texture outline as the repeating shape.',
  category: 'psychedelic',
  audioDescription:
    'Bass scales shape and pulses glow, mids control tunnel ripple, highs shift color',
  features: ['textureScale', 'textureOpacity', 'textureAnimation', 'textureMotion'],
  cameraHint: 'small-plane',
  params: [
    {
      key: 'glowDensity',
      label: 'Glow Density',
      type: 'slider',
      min: 0.3,
      max: 2.0,
      step: 0.1,
      default: 1.0,
    },
    {
      key: 'tunnelSpeed',
      label: 'Tunnel Speed',
      type: 'slider',
      min: 0.2,
      max: 2.0,
      step: 0.1,
      default: 1.0,
    },
    {
      key: 'shapeScale',
      label: 'Shape Scale',
      type: 'slider',
      min: 0.3,
      max: 3.0,
      step: 0.1,
      default: 1.0,
    },
    {
      key: 'edgeSharpness',
      label: 'Edge Width',
      type: 'slider',
      min: 0.5,
      max: 4.0,
      step: 0.1,
      default: 2.0,
    },
  ],
};

registerScene('silhouette', (scene, config) => new SilhouetteScene(scene, config), METADATA);
