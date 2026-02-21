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
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uSpeed;
  varying vec2 vUv;
  varying float vElevation;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                        -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Scrolling terrain
    float scroll = uTime * uSpeed * 0.3 + uMid * 0.5;
    vec2 noiseCoord = pos.xy * 0.5 + vec2(0.0, scroll);

    // Layered noise
    float amp = 1.0 + uBass * 2.0;
    float freq = 1.0 + uHigh * 1.5;
    float elevation = snoise(noiseCoord * freq) * amp;
    elevation += snoise(noiseCoord * freq * 2.0 + 5.0) * amp * 0.5;
    elevation += snoise(noiseCoord * freq * 4.0 + 10.0) * amp * 0.25;

    pos.z = elevation * 0.8;
    vElevation = elevation;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const FRAGMENT_SHADER = `
${TEXTURE_UNIFORMS}
${TEXTURE_SAMPLE_FN}
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform vec3 uAccent;
  uniform float uHigh;
  varying vec2 vUv;
  varying float vElevation;

  void main() {
    // Height-based coloring
    float h = (vElevation + 2.0) / 4.0;
    vec3 color = mix(uPrimary, uSecondary, smoothstep(0.2, 0.6, h));
    color = mix(color, uAccent, smoothstep(0.6, 0.9, h));

    // Snow/peak highlights
    color += vec3(0.2) * smoothstep(0.8, 1.0, h) * (0.5 + uHigh);

    // Depth fog
    float fog = smoothstep(0.0, 1.0, vUv.y);
    color = mix(color, uPrimary * 0.3, fog * 0.5);

    if (uHasTexture) {
      vec4 tex = sampleTransformedTexture((vUv - 0.5) / uTextureScale + 0.5);
      color = mix(color, tex.rgb, tex.a);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

export class TerrainScene {
  private mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private clock: THREE.Clock;

  constructor(
    private scene: THREE.Scene,
    private config: VisualizerConfig
  ) {
    this.clock = new THREE.Clock();
    const palette = config.colorPalette;

    const geometry = new THREE.PlaneGeometry(16, 16, 200, 200);
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
        ...createTextureUniforms(config),
      },
      side: THREE.DoubleSide,
      wireframe: config.wireframe || false,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.applyViewAngle(Number(config.sceneParams?.viewAngle ?? 0.5));
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

  /** Map viewAngle (0 = top-down, 1 = horizon) to mesh tilt + vertical offset. */
  private applyViewAngle(viewAngle: number): void {
    const tilt = -Math.PI * (0.5 - viewAngle * 0.35);
    const yOffset = -1.5 + viewAngle * 1.0;
    this.mesh.rotation.x = tilt;
    this.mesh.position.y = yOffset;
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
    if (config.wireframe !== undefined) {
      this.material.wireframe = config.wireframe;
    }
    if (config.textureScale !== undefined) {
      this.material.uniforms.uTextureScale.value = config.textureScale;
    }
    if (config.sceneParams?.viewAngle !== undefined) {
      this.applyViewAngle(Number(config.sceneParams.viewAngle));
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
  id: 'terrain',
  name: 'Terrain',
  description: 'Procedural landscape with layered noise heightmap',
  category: 'immersive',
  audioDescription:
    'Bass controls terrain amplitude, mids scroll the landscape, highs add detail frequency',
  features: ['textureScale', 'textureOpacity', 'textureAnimation', 'textureMotion'],
  params: [
    { key: 'wireframe', label: 'Wireframe', type: 'toggle', default: false },
    {
      key: 'viewAngle',
      label: 'View Angle',
      type: 'slider',
      min: 0,
      max: 1,
      step: 0.05,
      default: 0.5,
    },
  ],
};

registerScene('terrain', (scene, config) => new TerrainScene(scene, config), METADATA);
