import * as THREE from 'three';
import type { VisualizerConfig } from '@/types/visualizer';
import { registerScene } from './scene-registry';
import type { SceneRegistration } from './types';

export class SwarmScene {
  private mesh: THREE.InstancedMesh;
  private material: THREE.ShaderMaterial;
  private group: THREE.Group;
  private clock: THREE.Clock;
  private instanceCount: number;

  private static VERTEX = `
    varying vec3 vColor;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    uniform float uTime;
    uniform float uSpeed;
    uniform float uBass;

    void main() {
      vUv = uv;
      vColor = instanceColor;

      // Extract base position from instance matrix translation column
      vec3 basePos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);

      // Per-instance phase derived from position
      float phase = basePos.x * 1.7 + basePos.y * 2.3 + basePos.z * 0.9;

      // Gentle floating drift via sine waves
      vec3 drift = vec3(
        sin(uTime * uSpeed * 0.5 + phase) * 0.3,
        cos(uTime * uSpeed * 0.3 + phase * 1.4) * 0.2,
        sin(uTime * uSpeed * 0.4 + phase * 0.7) * 0.3
      );

      // Bass breathing — push outward from center
      vec3 breathDir = normalize(basePos + vec3(0.001));
      vec3 breath = breathDir * uBass * 0.8;

      // Apply drift + breath to world position
      vec4 worldPos = instanceMatrix * vec4(position, 1.0);
      worldPos.xyz += drift + breath;

      vec4 mvPosition = modelViewMatrix * worldPos;
      vViewPosition = -mvPosition.xyz;
      vNormal = normalMatrix * mat3(instanceMatrix) * normal;

      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  private static FRAGMENT = `
    uniform float uTime;
    uniform float uHigh;
    uniform vec3 uAccent;
    uniform sampler2D uTexture;
    uniform bool uHasTexture;
    uniform float uTextureScale;
    uniform float uTextureOpacity;

    varying vec3 vColor;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      // Fresnel rim glow
      vec3 viewDir = normalize(vViewPosition);
      vec3 normal = normalize(vNormal);
      float fresnel = 1.0 - abs(dot(normal, viewDir));
      fresnel = pow(fresnel, 3.0);

      // Base color from instance color attribute
      vec3 color = vColor;

      // Emissive intensity pulse from highs
      float emissive = 0.6 + uHigh * 1.5;
      color *= emissive;

      // Add accent rim glow
      color += uAccent * fresnel * (0.5 + uHigh * 0.5);

      // Texture overlay via model UVs
      if (uHasTexture) {
        vec2 texUv = (vUv - 0.5) / uTextureScale + 0.5;
        vec4 texColor = texture2D(uTexture, texUv);
        float inBounds = step(0.0, texUv.x) * step(texUv.x, 1.0)
                       * step(0.0, texUv.y) * step(texUv.y, 1.0);
        color = mix(color, texColor.rgb, texColor.a * uTextureOpacity * inBounds);
      }

      gl_FragColor = vec4(color, 0.85);
    }
  `;

  constructor(
    private scene: THREE.Scene,
    private config: VisualizerConfig
  ) {
    this.clock = new THREE.Clock();
    const palette = config.colorPalette;

    this.instanceCount = Math.floor(1500 * config.particleDensity + 500);
    const geo = new THREE.IcosahedronGeometry(0.12, 1);

    this.material = new THREE.ShaderMaterial({
      vertexShader: SwarmScene.VERTEX,
      fragmentShader: SwarmScene.FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uHigh: { value: 0 },
        uSpeed: { value: config.animationSpeed },
        uAccent: { value: new THREE.Color(palette.accent) },
        uTexture: { value: null },
        uHasTexture: { value: false },
        uTextureScale: { value: config.textureScale ?? 1.0 },
        uTextureOpacity: { value: config.textureOpacity ?? 1.0 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.mesh = new THREE.InstancedMesh(geo, this.material, this.instanceCount);

    const dummy = new THREE.Object3D();
    const primary = new THREE.Color(palette.primary);
    const secondary = new THREE.Color(palette.secondary);
    const accent = new THREE.Color(palette.accent);
    const color = new THREE.Color();

    for (let i = 0; i < this.instanceCount; i++) {
      // Uniform sphere volume distribution
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = Math.cbrt(Math.random()) * 5;

      dummy.position.set(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
      dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);

      // Distribute colors: primary 40%, secondary 35%, accent 25%
      const roll = Math.random();
      if (roll < 0.4) color.copy(primary);
      else if (roll < 0.75) color.copy(secondary);
      else color.copy(accent);
      this.mesh.setColorAt(i, color);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;

    this.group = new THREE.Group();
    this.group.add(this.mesh);
    this.scene.add(this.group);
  }

  update(bass: number, mid: number, high: number): void {
    const time = this.clock.getElapsedTime();
    const r = this.config.audioReactivity;
    const speed = this.config.animationSpeed;

    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uBass.value = bass * r;
    this.material.uniforms.uHigh.value = high * r;

    // Slow Y rotation boosted by mids
    this.group.rotation.y += 0.002 * speed * (1 + mid * r * 2);
  }

  updateConfig(config: Partial<VisualizerConfig>): void {
    if (config.colorPalette) {
      this.material.uniforms.uAccent.value.set(config.colorPalette.accent);

      const primary = new THREE.Color(config.colorPalette.primary);
      const secondary = new THREE.Color(config.colorPalette.secondary);
      const accent = new THREE.Color(config.colorPalette.accent);
      const color = new THREE.Color();

      for (let i = 0; i < this.instanceCount; i++) {
        const roll = Math.random();
        if (roll < 0.4) color.copy(primary);
        else if (roll < 0.75) color.copy(secondary);
        else color.copy(accent);
        this.mesh.setColorAt(i, color);
      }
      this.mesh.instanceColor!.needsUpdate = true;
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
    this.scene.remove(this.group);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

const METADATA: SceneRegistration = {
  id: 'swarm',
  name: 'Swarm',
  description: 'Bioluminescent cloud of floating icosahedra',
  category: 'cosmic',
  audioDescription:
    'Bass breathes the swarm outward, mids boost rotation, highs pulse emissive glow',
  features: ['textureScale', 'textureOpacity'],
  params: [
    {
      key: 'particleDensity',
      label: 'Particle Density',
      type: 'slider',
      min: 0,
      max: 1,
      step: 0.05,
      default: 0.5,
    },
  ],
};

registerScene('swarm', (scene, config) => new SwarmScene(scene, config), METADATA);
