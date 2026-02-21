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

// ── Hexagone ────────────────────────────────────────────────────────────────
// Psychedelic hexagonal tiling with layered infinite-zoom tunnel, procedural
// coloring, 3D camera orbit, and color inversion. Hexagonal SDF with
// concentric wave animation.
//
// Inspired by "Hexagone" (ShaderToy WXyfWh / wsl3WB) by BigWIngs
// https://www.shadertoy.com/view/WXyfWh
// Author: Martijn Steinrucken — "The Art of Code"
// YouTube: youtube.com/@TheArtOfCodeIsCool | Patreon: patreon.com/TheArtOfCode
// Twitter: @The_ArtOfCode | Email: countfrolic@gmail.com
// License: CC BY-NC-SA 3.0

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
  uniform float uHexScale;
  uniform float uZoomSpeed;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform vec3 uAccent;
  varying vec2 vUv;

  #define R3 1.732051
  #define PI 3.14159265359

  float N(float p) {
    return fract(sin(p * 123.34) * 345.456);
  }

  vec4 HexCoords(vec2 uv) {
    vec2 s = vec2(1.0, R3);
    vec2 h = 0.5 * s;
    vec2 gv = s * uv;
    vec2 a = mod(gv, s) - h;
    vec2 b = mod(gv + h, s) - h;
    vec2 ab = dot(a, a) < dot(b, b) ? a : b;
    vec2 id = gv - ab;
    return vec4(ab, id);
  }

  float GetSize(vec2 id, float seed) {
    float d = length(id);
    float t = uTime * uSpeed * 0.2;
    // Bass drives the concentric wave amplitude
    float amp = 1.0 + uBass * 1.5;
    float a = sin(d * seed + t) * amp + sin(d * seed * seed * 10.0 + t * 2.0);
    return a / 2.0 + 0.5;
  }

  mat2 Rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
  }

  float Hexagon(vec2 uv, float r) {
    // Mid adds rotation to individual hexagons
    uv *= Rot(mix(0.0, PI, r) + uMid * 0.5);
    r /= (1.0 / sqrt(2.0));
    uv = vec2(-uv.y, uv.x);
    uv.x *= R3;
    uv = abs(uv);
    vec2 n = normalize(vec2(1.0, 1.0));
    float d = dot(uv, n) - r;
    d = max(d, uv.y - r * 0.707);
    // High controls outline sharpness
    float sharp = 0.06 + uHigh * 0.04;
    d = smoothstep(sharp, 0.02, abs(d));
    d += smoothstep(0.1, 0.09, abs(r - 0.5)) * sin(uTime * uSpeed * 0.5 + uHigh * 5.0);
    return d;
  }

  float Layer(vec2 uv, float s) {
    vec4 hu = HexCoords(uv * 2.0);
    float d = Hexagon(hu.xy, GetSize(hu.zw, s));

    // Sample neighbors for additive blending
    vec2 offs = vec2(1.0, 0.0);
    d += Hexagon(hu.xy - offs, GetSize(hu.zw + offs, s));
    d += Hexagon(hu.xy + offs, GetSize(hu.zw - offs, s));
    offs = vec2(0.5, 0.8725);
    d += Hexagon(hu.xy - offs, GetSize(hu.zw + offs, s));
    d += Hexagon(hu.xy + offs, GetSize(hu.zw - offs, s));
    offs = vec2(-0.5, 0.8725);
    d += Hexagon(hu.xy - offs, GetSize(hu.zw + offs, s));
    d += Hexagon(hu.xy + offs, GetSize(hu.zw - offs, s));

    return d;
  }

  void main() {
    vec2 uv = (vUv - 0.5) * 2.0;
    uv.x *= 1.777;

    vec2 UV = vUv - 0.5;
    float duv = dot(UV, UV);

    float t = uTime * uSpeed * 0.1 + 5.0;

    // 3D camera orbit — swoops above and below virtual plane
    float y = sin(t * 0.5);
    vec3 ro = vec3(0.0, 20.0 * y + uBass * 5.0, -5.0);
    vec3 lookat = vec3(0.0, 0.0, -10.0);

    // Ray direction
    vec3 f = normalize(lookat - ro);
    vec3 r = normalize(cross(vec3(0.0, 1.0, 0.0), f));
    vec3 u = cross(f, r);
    vec3 c = ro + f;
    vec3 i = c + uv.x * r + uv.y * u;
    vec3 rd = normalize(i - ro);

    vec3 col = vec3(0.0);

    // Ray-plane intersection — early-out when ray is nearly parallel to plane
    if (abs(rd.y) < 0.001) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }
    vec3 p = ro + rd * (ro.y / rd.y);
    float dp = length(p.xz);

    if ((ro.y / rd.y) > 0.0) {
      col *= 0.0;
    } else {
      vec2 hexUv = p.xz * 0.1 * uHexScale;
      // Zoom breathing — bass-reactive
      hexUv *= mix(1.0, 5.0, sin(t * 0.5 + uBass * 2.0) * 0.5 + 0.5);
      hexUv *= Rot(t + uMid * 0.5);
      hexUv.x *= R3;

      // 3 overlapping zoom layers — infinite zoom tunnel
      for (float li = 0.0; li < 1.0; li += 1.0 / 3.0) {
        float id = floor(li + t * uZoomSpeed);
        float lt = fract(li + t * uZoomSpeed);
        float z = mix(5.0 + uMid * 3.0, 0.1, lt);
        float fade = smoothstep(0.0, 0.3, lt) * smoothstep(1.0, 0.7, lt);

        // Procedural per-layer color from palette
        float hue = fract(id * 0.2345 + duv);
        vec3 layerColor = mix(
          uPrimary,
          mix(uAccent, uSecondary, sin(hue * 6.28) * 0.5 + 0.5),
          hue
        );

        col += fade * lt * Layer(hexUv * z, N(li + id)) * layerColor;
      }
    }

    col *= 2.0 + uHigh * 2.0;

    // Color inversion when camera below plane
    if (ro.y < 0.0) col = 1.0 - col;

    // Distance fog — pushed out so the plane fills more of the screen
    col *= smoothstep(40.0, 8.0, dp);
    // Subtle vignette — darken edges gently instead of hard circle
    col *= 1.0 - duv * 0.6;

    if (uHasTexture) {
      vec4 tex = sampleTransformedTexture((vUv - 0.5) / uTextureScale + 0.5);
      col = mix(col, tex.rgb, tex.a);
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ── Scene class ─────────────────────────────────────────────────────────────

export class HexagoneScene {
  private mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private clock: THREE.Clock;

  constructor(
    private scene: THREE.Scene,
    private config: VisualizerConfig
  ) {
    this.clock = new THREE.Clock();
    const palette = config.colorPalette;
    const params = config.sceneParams ?? {};

    const geometry = new THREE.PlaneGeometry(24, 24);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uSpeed: { value: config.animationSpeed },
        uHexScale: { value: Number(params.hexScale ?? 1.0) },
        uZoomSpeed: { value: Number(params.zoomSpeed ?? 1.0) },
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

  setTexture(texture: THREE.Texture | null): void {
    this.material.uniforms.uTexture.value = texture;
    this.material.uniforms.uHasTexture.value = texture !== null;
  }

  setTextureTransform(transform: TextureTransform): void {
    applyTextureTransform(this.material, transform);
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
      if (config.sceneParams.hexScale !== undefined) {
        this.material.uniforms.uHexScale.value = Number(config.sceneParams.hexScale);
      }
      if (config.sceneParams.zoomSpeed !== undefined) {
        this.material.uniforms.uZoomSpeed.value = Number(config.sceneParams.zoomSpeed);
      }
    }
    this.config = { ...this.config, ...config };
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

// ── Registration ────────────────────────────────────────────────────────────

const METADATA: SceneRegistration = {
  id: 'hexagone',
  name: 'Hexagone',
  description:
    'Psychedelic hexagonal tiling with infinite zoom tunnel, 3D camera orbit, and color inversion. Inspired by "Hexagone" by BigWIngs/Martijn Steinrucken (shadertoy.com/view/WXyfWh, youtube.com/@TheArtOfCodeIsCool). CC BY-NC-SA 3.0.',
  category: 'psychedelic',
  cameraHint: 'low-angle',
  audioDescription:
    'Bass drives wave amplitude, camera swoop, and zoom; mids add hex rotation and zoom depth; highs sharpen outlines and boost brightness',
  features: ['textureScale', 'textureOpacity', 'textureAnimation', 'textureMotion'],
  params: [
    {
      key: 'hexScale',
      label: 'Hex Scale',
      type: 'slider',
      min: 0.3,
      max: 2.0,
      step: 0.1,
      default: 1.0,
    },
    {
      key: 'zoomSpeed',
      label: 'Zoom Speed',
      type: 'slider',
      min: 0.3,
      max: 2.0,
      step: 0.1,
      default: 1.0,
    },
  ],
};

registerScene('hexagone', (scene, config) => new HexagoneScene(scene, config), METADATA);
