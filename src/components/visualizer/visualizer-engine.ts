import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { VisualizerConfig } from '@/types/visualizer';
import { createScene, type SceneHandler } from './scenes';
import { getSceneMetadata } from './scenes/scene-registry';
import type { CameraHint } from './scenes/types';
import { computeAnimatedOpacity, computeTextureMotion } from './scenes/starburst-utils';

export class VisualizerEngine {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private sceneHandler: SceneHandler | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> | null = null;
  private audioEnabled = false;
  private animationFrameId: number | null = null;
  private config: VisualizerConfig;
  private cameraAngle = 0;
  private customTexture: THREE.Texture | null = null;
  private customTextureUrl: string | null = null;
  private clock = new THREE.Clock();
  private densityReloadTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(canvas: HTMLCanvasElement, config: VisualizerConfig) {
    this.config = config;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(config.colorPalette.background);
    this.scene.fog = new THREE.FogExp2(
      config.colorPalette.background,
      config.depth !== undefined ? config.depth * 0.1 : 0.05
    );

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 2, 6);
    this.camera.lookAt(0, 0, 0);

    // Post-processing
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      config.bloomIntensity,
      0.4,
      0.85
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    // Initialize scene
    this.loadScene(config.scene);

    // Load custom texture if present
    if (config.customTextureUrl) {
      this.loadCustomTexture(config.customTextureUrl);
    }

    // Handle resize
    window.addEventListener('resize', this.handleResize);
  }

  private handleResize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);

    // Reposition camera so flat-plane scenes still fill the viewport
    this.positionCamera();
  };

  /** Resolve the camera hint for the current scene from the registry. */
  private getCameraHint(): CameraHint {
    const meta = getSceneMetadata(this.config.scene);
    return meta?.cameraHint ?? 'default';
  }

  private positionCamera(): void {
    const hint = this.getCameraHint();

    switch (hint) {
      case 'small-plane': {
        // 12×12 plane at z=-2: move camera so the plane fills the viewport width
        const planeSize = 12;
        const planeZ = -2;
        const fovRad = (this.camera.fov * Math.PI) / 180;
        const aspect = this.camera.aspect;
        const distance = planeSize / (2 * Math.tan(fovRad / 2) * Math.max(aspect, 1));
        this.camera.position.set(0, 0, planeZ + distance);
        break;
      }
      case 'centered':
        // Sphere starbursts — centered head-on
        this.camera.position.set(0, 0, 6);
        break;
      case 'low-angle': {
        // Ground-plane scenes — viewAngle slider controls perspective
        // 0 = ground level, 0.5 = angled, 1 = top-down
        const viewAngle = Number(this.config.sceneParams?.viewAngle ?? 0.3);
        const camY = 0.3 + viewAngle * 11.7; // 0.3 → 12
        const camZ = 10 - viewAngle * 10; // 10 → 0
        this.camera.position.set(0, camY, camZ);
        break;
      }
      default:
        // 3D scenes — elevated angle for depth
        this.camera.position.set(0, 2, 6);
        break;
    }
    this.camera.lookAt(0, 0, 0);
  }

  private loadCustomTexture(dataUrl: string): void {
    // Skip if same URL already loaded
    if (dataUrl === this.customTextureUrl && this.customTexture) return;

    // Dispose previous texture
    if (this.customTexture) {
      this.customTexture.dispose();
      this.customTexture = null;
    }

    this.customTextureUrl = dataUrl;

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      dataUrl,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        // Apply pattern offset from config
        texture.offset.x = this.config.patternOffsetX ?? 0;
        texture.offset.y = this.config.patternOffsetY ?? 0;
        this.customTexture = texture;
        this.sceneHandler?.setTexture?.(texture);
      },
      undefined,
      () => {
        console.warn('Failed to load custom texture');
        this.customTextureUrl = null;
      }
    );
  }

  private clearCustomTexture(): void {
    if (this.customTexture) {
      this.customTexture.dispose();
      this.customTexture = null;
    }
    this.customTextureUrl = null;
    this.sceneHandler?.setTexture?.(null);
  }

  private loadScene(sceneType: string): void {
    // Dispose current scene handler
    if (this.sceneHandler) {
      this.sceneHandler.dispose();
      this.sceneHandler = null;
    }

    // Clear scene objects and dispose GPU resources
    while (this.scene.children.length > 0) {
      const child = this.scene.children[0];
      this.scene.remove(child);
      if (child instanceof THREE.Mesh || child instanceof THREE.InstancedMesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material?.dispose();
        }
      } else if (child instanceof THREE.Points) {
        child.geometry?.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    }

    this.positionCamera();

    // Expose camera to scene handlers (used by 'fixed' texture motion for billboarding)
    this.scene.userData.camera = this.camera;

    this.sceneHandler = createScene(sceneType, this.scene, this.config);

    // Pass cached texture to new scene
    if (this.customTexture && this.sceneHandler) {
      this.sceneHandler.setTexture?.(this.customTexture);
    }
  }

  setAnalyser(analyser: AnalyserNode | null): void {
    this.analyser = analyser;
    this.dataArray = analyser
      ? (new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>)
      : null;
  }

  setAudioEnabled(enabled: boolean): void {
    this.audioEnabled = enabled;
  }

  private getAudioData(): { bass: number; mid: number; high: number } {
    if (!this.audioEnabled || !this.analyser || !this.dataArray) {
      return { bass: 0, mid: 0, high: 0 };
    }

    this.analyser.getByteFrequencyData(this.dataArray);

    // Bass: bins 0-5 (~0-200Hz)
    let bassSum = 0;
    for (let i = 0; i < 6; i++) bassSum += this.dataArray[i];
    const bass = bassSum / (6 * 255);

    // Mid: bins 5-30 (~200Hz-1.2kHz)
    let midSum = 0;
    for (let i = 5; i < 30; i++) midSum += this.dataArray[i];
    const mid = midSum / (25 * 255);

    // High: bins 30-60 (~1.2kHz-2.4kHz)
    let highSum = 0;
    for (let i = 30; i < 60; i++) highSum += this.dataArray[i];
    const high = highSum / (30 * 255);

    return { bass, mid, high };
  }

  private updateCamera(audio: { bass: number; mid: number; high: number }): void {
    const hint = this.getCameraHint();
    // Flat-plane and ground-plane scenes: camera movement would reveal edges
    if (hint === 'small-plane' || hint === 'low-angle') return;

    const speed = this.config.animationSpeed;

    switch (this.config.cameraMovement) {
      case 'orbit': {
        // Oscillate ±50° from front (like a lawn sprinkler)
        this.cameraAngle = (this.cameraAngle + 0.002 * speed) % (Math.PI * 2);
        const swing = Math.sin(this.cameraAngle) * ((50 * Math.PI) / 180);
        this.camera.position.x = Math.sin(swing) * 6;
        this.camera.position.z = Math.cos(swing) * 6;
        this.camera.lookAt(0, 0, 0);
        break;
      }
      case 'drift':
        this.cameraAngle = (this.cameraAngle + 0.001 * speed) % (Math.PI * 2);
        this.camera.position.x = Math.sin(this.cameraAngle * 0.7) * 2;
        this.camera.position.y = 2 + Math.sin(this.cameraAngle * 0.3) * 0.5;
        this.camera.lookAt(0, 0, 0);
        break;
      case 'pulse': {
        const pulseZ = 6 + audio.bass * this.config.audioReactivity * -1.5;
        this.camera.position.z += (pulseZ - this.camera.position.z) * 0.05;
        break;
      }
      case 'static':
      default:
        break;
    }
  }

  private animate = () => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    const audio = this.getAudioData();
    this.sceneHandler?.update(audio.bass, audio.mid, audio.high);
    this.updateCamera(audio);

    // Engine-driven texture animation & motion for scenes that implement setTextureTransform
    if (this.sceneHandler?.setTextureTransform && this.customTexture) {
      const time = this.clock.getElapsedTime();
      const speed = this.config.animationSpeed;
      const baseOpacity = this.config.textureOpacity ?? 1.0;

      const animMode = this.config.textureAnimation ?? 'none';
      const animMul = computeAnimatedOpacity(animMode, time, speed, audio.bass);

      const motionMode = this.config.textureMotion ?? 'none';
      const motion = computeTextureMotion(motionMode, time, speed, audio.bass);

      this.sceneHandler.setTextureTransform({
        opacity: baseOpacity * animMul,
        rotation: motion.rotationZ,
        offsetX: motion.offsetX,
        offsetY: motion.offsetY,
      });
    }

    this.composer.render();
  };

  updateConfig(newConfig: Partial<VisualizerConfig>): void {
    const prevScene = this.config.scene;
    const prevDensity = this.config.particleDensity;
    this.config = { ...this.config, ...newConfig };

    const densityChanged =
      newConfig.particleDensity !== undefined && newConfig.particleDensity !== prevDensity;

    if (newConfig.scene && newConfig.scene !== prevScene) {
      // Scene change — immediate reload, cancel any pending density debounce
      if (this.densityReloadTimeout) {
        clearTimeout(this.densityReloadTimeout);
        this.densityReloadTimeout = null;
      }
      this.loadScene(this.config.scene);
    } else if (densityChanged) {
      // Debounce density changes — geometry rebuild is expensive
      if (this.densityReloadTimeout) clearTimeout(this.densityReloadTimeout);
      this.densityReloadTimeout = setTimeout(() => {
        this.loadScene(this.config.scene);
        this.densityReloadTimeout = null;
      }, 300);
      // Still forward other config changes immediately
      this.sceneHandler?.updateConfig(newConfig);
    } else {
      this.sceneHandler?.updateConfig(newConfig);
    }

    // Update bloom
    if (newConfig.bloomIntensity !== undefined) {
      this.bloomPass.strength = newConfig.bloomIntensity;
    }

    // Update background
    if (newConfig.colorPalette?.background) {
      (this.scene.background as THREE.Color).set(newConfig.colorPalette.background);
      (this.scene.fog as THREE.FogExp2).color.set(newConfig.colorPalette.background);
    }

    // Update depth/fog
    if (newConfig.depth !== undefined) {
      (this.scene.fog as THREE.FogExp2).density = newConfig.depth * 0.1;
    }

    // Re-position camera when scene params change (e.g. Grid viewAngle)
    if (newConfig.sceneParams && this.getCameraHint() === 'low-angle') {
      this.positionCamera();
    }

    // Handle custom texture changes
    if (newConfig.customTextureUrl !== undefined) {
      if (newConfig.customTextureUrl) {
        this.loadCustomTexture(newConfig.customTextureUrl);
      } else {
        this.clearCustomTexture();
      }
    }

    // Update texture offset (universal — works for all scenes via UV offset)
    if (this.customTexture) {
      if (newConfig.patternOffsetX !== undefined) {
        this.customTexture.offset.x = newConfig.patternOffsetX;
      }
      if (newConfig.patternOffsetY !== undefined) {
        this.customTexture.offset.y = newConfig.patternOffsetY;
      }
    }
  }

  loadTexture(url: string): void {
    this.loadCustomTexture(url);
  }

  clearTexture(): void {
    this.clearCustomTexture();
  }

  start(): void {
    if (this.animationFrameId !== null) return;
    this.animate();
  }

  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  dispose(): void {
    this.stop();
    if (this.densityReloadTimeout) {
      clearTimeout(this.densityReloadTimeout);
    }
    window.removeEventListener('resize', this.handleResize);
    this.sceneHandler?.dispose();
    if (this.customTexture) {
      this.customTexture.dispose();
    }
    this.bloomPass.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
