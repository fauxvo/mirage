import * as THREE from 'three';
import type { VisualizerConfig } from '@/types/visualizer';
import { registerScene } from './scene-registry';
import {
  TEXTURE_UNIFORMS,
  TEXTURE_SAMPLE_FN,
  createTextureUniforms,
  applyTextureTransform,
} from './shader-chunks';
import type { SceneRegistration, TextureTransform } from './types';

export class GridScene {
  private points: THREE.Points;
  private material: THREE.ShaderMaterial;
  private clock: THREE.Clock;

  private static VERTEX = `
    attribute vec2 aGridPos;

    uniform float uTime;
    uniform float uSpeed;
    uniform float uBass;
    uniform float uMid;
    uniform float uHigh;
    uniform float uGridSize;
    uniform float uSpacing;
    uniform float uWaveMode;
    uniform float uTextureScale;
    uniform bool uHasTexture;

    varying float vHeight;
    varying float vColorPhase;

    void main() {
      float halfExtent = (uGridSize - 1.0) * uSpacing * 0.5;
      float halfGrid = (uGridSize - 1.0) * 0.5;

      // Phase depends on wave pattern
      float phase;
      if (uWaveMode < 0.5) {
        // diagonal
        phase = (aGridPos.x + aGridPos.y) * 0.3;
      } else if (uWaveMode < 1.5) {
        // radial
        float cx = aGridPos.x - halfGrid;
        float cz = aGridPos.y - halfGrid;
        phase = sqrt(cx * cx + cz * cz) * 0.5;
      } else {
        // rows
        phase = aGridPos.y * 0.4;
      }

      float waveSpeed = uSpeed * (1.0 + uMid * 2.0);
      float bounceAmp = 0.5 + uBass * 3.0;
      float colorSpeed = 0.3 + uHigh * 1.5;

      float height = max(0.0, sin(uTime * waveSpeed + phase)) * bounceAmp;
      vHeight = height;

      // Color phase for fragment shader
      vColorPhase = (sin(uTime * colorSpeed + phase * 0.5) + 1.0) * 0.5;

      vec3 pos = vec3(
        aGridPos.x * uSpacing - halfExtent,
        height * 0.5,
        aGridPos.y * uSpacing - halfExtent
      );

      vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);

      // Size scales with height for a "bar" feel
      float size = mix(2.0, 6.0, clamp(height / bounceAmp, 0.0, 1.0));
      size += uHigh * 1.5;
      if (uHasTexture) size *= uTextureScale;

      gl_PointSize = size * (300.0 / -mvPos.z);
      gl_Position = projectionMatrix * mvPos;
    }
  `;

  private static FRAGMENT = `
    ${TEXTURE_UNIFORMS}
    ${TEXTURE_SAMPLE_FN}
    uniform float uHigh;
    uniform vec3 uPrimary;
    uniform vec3 uSecondary;
    uniform vec3 uAccent;
    uniform float uBrightness;

    varying float vHeight;
    varying float vColorPhase;

    void main() {
      vec2 center = gl_PointCoord - 0.5;
      float d = length(center);

      float alpha;
      vec4 texSample = vec4(1.0);
      if (uHasTexture) {
        texSample = sampleTransformedTexture(vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y));
        alpha = texSample.a;
        if (alpha < 0.01) discard;
      } else {
        if (d > 0.5) discard;
        // Soft square-ish shape for grid feel
        float softEdge = 1.0 - smoothstep(0.3, 0.5, d);
        alpha = softEdge * 0.9;
      }

      // Color sweep: primary -> secondary -> accent -> primary
      vec3 color;
      if (vColorPhase < 0.33) {
        color = mix(uPrimary, uSecondary, vColorPhase / 0.33);
      } else if (vColorPhase < 0.66) {
        color = mix(uSecondary, uAccent, (vColorPhase - 0.33) / 0.33);
      } else {
        color = mix(uAccent, uPrimary, (vColorPhase - 0.66) / 0.34);
      }

      color *= uBrightness;
      if (uHasTexture) color *= texSample.rgb;

      gl_FragColor = vec4(color, alpha);
    }
  `;

  constructor(
    private scene: THREE.Scene,
    private config: VisualizerConfig
  ) {
    this.clock = new THREE.Clock();

    const gridSize = Math.floor(20 + 30 * config.particleDensity);
    const instanceCount = gridSize * gridSize;
    const spacing = 24 / gridSize;
    const palette = config.colorPalette;

    const positions = new Float32Array(instanceCount * 3);
    const gridPositions = new Float32Array(instanceCount * 2);

    const half = (gridSize - 1) * spacing * 0.5;
    for (let z = 0; z < gridSize; z++) {
      for (let x = 0; x < gridSize; x++) {
        const i = z * gridSize + x;
        // Initial flat positions (Y animated in shader)
        positions[i * 3] = x * spacing - half;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = z * spacing - half;
        // Grid coords for shader calculations
        gridPositions[i * 2] = x;
        gridPositions[i * 2 + 1] = z;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aGridPos', new THREE.BufferAttribute(gridPositions, 2));

    const wavePattern = (config.sceneParams?.wavePattern as string) || 'diagonal';

    this.material = new THREE.ShaderMaterial({
      vertexShader: GridScene.VERTEX,
      fragmentShader: GridScene.FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: config.animationSpeed },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uGridSize: { value: gridSize },
        uSpacing: { value: spacing },
        uWaveMode: { value: GridScene.waveModeValue(wavePattern) },
        uBrightness: { value: 1.0 },
        uPrimary: { value: new THREE.Color(palette.primary) },
        uSecondary: { value: new THREE.Color(palette.secondary) },
        uAccent: { value: new THREE.Color(palette.accent) },
        ...createTextureUniforms(config),
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(geometry, this.material);
    this.scene.add(this.points);
  }

  private static waveModeValue(pattern: string): number {
    if (pattern === 'radial') return 1;
    if (pattern === 'rows') return 2;
    return 0; // diagonal
  }

  update(bass: number, mid: number, high: number): void {
    const time = this.clock.getElapsedTime();
    const r = this.config.audioReactivity;

    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uBass.value = bass * r;
    this.material.uniforms.uMid.value = mid * r;
    this.material.uniforms.uHigh.value = high * r;
    this.material.uniforms.uBrightness.value = 0.7 + high * r * 0.8;
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
    if (config.sceneParams?.wavePattern !== undefined) {
      this.material.uniforms.uWaveMode.value = GridScene.waveModeValue(
        config.sceneParams.wavePattern as string
      );
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
    this.scene.remove(this.points);
    this.points.geometry.dispose();
    this.material.dispose();
  }
}

const METADATA: SceneRegistration = {
  id: 'grid',
  name: 'Grid',
  description: 'Neon equalizer floor with reactive bouncing points',
  category: 'geometric',
  audioDescription:
    'Bass drives bounce height, mids control wave speed, highs shift colors and brightness',
  features: ['textureScale', 'textureOpacity', 'textureAnimation', 'textureMotion'],
  cameraHint: 'low-angle',
  params: [
    {
      key: 'particleDensity',
      label: 'Grid Density',
      type: 'slider',
      min: 0,
      max: 1,
      step: 0.05,
      default: 0.5,
    },
    {
      // Consumed by the engine's positionCamera(), not by the Grid scene itself
      key: 'viewAngle',
      label: 'View Angle',
      type: 'slider',
      min: 0,
      max: 1,
      step: 0.05,
      default: 0.3,
    },
    {
      key: 'wavePattern',
      label: 'Wave Pattern',
      type: 'select',
      options: ['diagonal', 'radial', 'rows'],
      default: 'diagonal',
    },
  ],
};

registerScene('grid', (scene, config) => new GridScene(scene, config), METADATA);
