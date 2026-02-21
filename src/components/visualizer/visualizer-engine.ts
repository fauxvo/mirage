import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { VisualizerConfig } from '@/types/visualizer';
import { createScene, type SceneHandler } from './scenes';
import { getSceneMetadata } from './scenes/scene-registry';
import type { CameraHint, SceneUserData } from './scenes/types';
import { computeAnimatedOpacity, computeTextureMotion } from './scenes/starburst-utils';
import { disposeParticleShapeCache } from './scenes/particle-shapes';

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
  private baseCameraY = 2; // cached initial Y to prevent cumulative drift in low-angle modes
  private baseCameraZ = 6;
  private customTexture: THREE.Texture | null = null;
  private customTextureUrl: string | null = null;
  private clock = new THREE.Clock();
  private densityReloadTimeout: ReturnType<typeof setTimeout> | null = null;
  // Smoothed audio values — exponential moving average kills single-frame spikes
  private smoothBass = 0;
  private smoothMid = 0;
  private smoothHigh = 0;
  // Cached tint color — avoids per-frame THREE.Color + object allocation
  private _tintScratch = new THREE.Color();
  private _tintResult = { r: 1, g: 1, b: 1 };
  private _tintDirty = true;
  // Separate timestamp for frame-rate independent audio smoothing
  // (can't use this.clock.getDelta() — it conflicts with getElapsedTime())
  private _lastFrameTime = 0;
  private _hasFrameTime = false;

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
        // Cache base position for camera movement modes (prevents cumulative drift)
        this.baseCameraY = camY;
        this.baseCameraZ = camZ;
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

    // IMPORTANT: Set camera before createScene — scenes read it from userData in their constructor
    (this.scene.userData as SceneUserData).camera = this.camera;

    // Pass effective speed (base * multiplier) to scene constructor
    const mul = this.config.intensityMultiplier ?? 1;
    const effectiveConfig =
      mul !== 1
        ? { ...this.config, animationSpeed: this.config.animationSpeed * mul }
        : this.config;
    this.sceneHandler = createScene(sceneType, this.scene, effectiveConfig);

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

  /**
   * Resolves the current texture tint to an RGB triplet.
   * Returns a **mutable cached reference** (`this._tintResult`) — callers must
   * consume the values before the next call. This avoids per-frame allocation.
   */
  private resolveTintColor(): { r: number; g: number; b: number } {
    if (!this._tintDirty) return this._tintResult;
    this._tintDirty = false;
    const tint = this.config.textureTint ?? 'none';
    if (tint === 'none') {
      this._tintResult.r = this._tintResult.g = this._tintResult.b = 1;
    } else {
      const palette = this.config.colorPalette;
      const hex =
        tint === 'primary'
          ? palette.primary
          : tint === 'secondary'
            ? palette.secondary
            : palette.accent;
      this._tintScratch.set(hex);
      this._tintResult.r = this._tintScratch.r;
      this._tintResult.g = this._tintScratch.g;
      this._tintResult.b = this._tintScratch.b;
    }
    return this._tintResult;
  }

  private getAudioData(): { bass: number; mid: number; high: number } {
    // Frame-rate independent smoothing: scale coefficients by delta time
    // so behavior is consistent across 30fps, 60fps, and 144Hz displays
    const now = performance.now() / 1000;
    const dt = Math.min(this._hasFrameTime ? now - this._lastFrameTime : 1 / 60, 0.1);
    this._lastFrameTime = now;
    this._hasFrameTime = true;
    const dtScale = dt * 60; // normalize to 60fps baseline

    if (!this.audioEnabled || !this.analyser || !this.dataArray) {
      // Decay smoothed values toward zero when audio is off
      const decay = 1 - Math.pow(0.3, dtScale);
      this.smoothBass -= this.smoothBass * decay;
      this.smoothMid -= this.smoothMid * decay;
      this.smoothHigh -= this.smoothHigh * decay;
      return { bass: this.smoothBass, mid: this.smoothMid, high: this.smoothHigh };
    }

    this.analyser.getByteFrequencyData(this.dataArray);

    const sensitivity = this.config.audioSensitivity ?? 1.0;

    // Bass: bins 0-5 (~0-200Hz)
    let bassSum = 0;
    for (let i = 0; i < 6; i++) bassSum += this.dataArray[i];
    const rawBass = Math.min(1, (bassSum / (6 * 255)) * sensitivity);

    // Mid: bins 5-30 (~200Hz-1.2kHz)
    let midSum = 0;
    for (let i = 5; i < 30; i++) midSum += this.dataArray[i];
    const rawMid = Math.min(1, (midSum / (25 * 255)) * sensitivity);

    // High: bins 30-60 (~1.2kHz-2.4kHz)
    let highSum = 0;
    for (let i = 30; i < 60; i++) highSum += this.dataArray[i];
    const rawHigh = Math.min(1, (highSum / (30 * 255)) * sensitivity);

    // Exponential smoothing — fast attack so beats land, slow release so it doesn't jitter
    // Coefficients are frame-rate independent via dtScale
    const attack = 1 - Math.pow(1 - 0.4, dtScale);
    const release = 1 - Math.pow(1 - 0.15, dtScale);
    this.smoothBass += (rawBass - this.smoothBass) * (rawBass > this.smoothBass ? attack : release);
    this.smoothMid += (rawMid - this.smoothMid) * (rawMid > this.smoothMid ? attack : release);
    this.smoothHigh += (rawHigh - this.smoothHigh) * (rawHigh > this.smoothHigh ? attack : release);

    return { bass: this.smoothBass, mid: this.smoothMid, high: this.smoothHigh };
  }

  private updateCamera(audio: { bass: number; mid: number; high: number }): void {
    const hint = this.getCameraHint();
    // Flat fullscreen-quad scenes: any camera movement would break framing
    if (hint === 'small-plane') return;

    const speed = this.config.animationSpeed;

    // Low-angle (ground-plane) scenes: allow constrained camera movement
    // that stays within the backdrop coverage area
    if (hint === 'low-angle') {
      switch (this.config.cameraMovement) {
        case 'orbit': {
          this.cameraAngle = (this.cameraAngle + 0.0015 * speed) % (Math.PI * 2);
          // Gentle horizontal sway ±15° (vs ±50° for 3D scenes)
          const swing = Math.sin(this.cameraAngle) * ((15 * Math.PI) / 180);
          this.camera.position.x = Math.sin(swing) * this.baseCameraZ * 0.25;
          this.camera.position.y = this.baseCameraY + Math.sin(this.cameraAngle * 0.5) * 0.3;
          this.camera.lookAt(0, 0, 0);
          break;
        }
        case 'drift': {
          this.cameraAngle = (this.cameraAngle + 0.001 * speed) % (Math.PI * 2);
          this.camera.position.x = Math.sin(this.cameraAngle * 0.5) * 1.2;
          this.camera.position.y = this.baseCameraY + Math.sin(this.cameraAngle * 0.3) * 0.3;
          this.camera.lookAt(0, 0, 0);
          break;
        }
        case 'pulse': {
          const pulseZ = this.baseCameraZ + audio.bass * this.config.audioReactivity * -0.8;
          this.camera.position.z += (pulseZ - this.camera.position.z) * 0.05;
          break;
        }
        case 'static':
        default:
          break;
      }
      return;
    }

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

    const mul = this.config.intensityMultiplier ?? 1;
    const audio = this.getAudioData();
    const bass = Math.min(1, audio.bass * mul);
    const mid = Math.min(1, audio.mid * mul);
    const high = Math.min(1, audio.high * mul);
    this.sceneHandler?.update(bass, mid, high);
    this.updateCamera({ bass, mid, high });

    // Engine-driven texture animation & motion for scenes that implement setTextureTransform
    if (this.sceneHandler?.setTextureTransform && this.customTexture) {
      const time = this.clock.getElapsedTime();
      const speed = this.config.animationSpeed * mul;
      const baseOpacity = this.config.textureOpacity ?? 1.0;

      const animMode = this.config.textureAnimation ?? 'none';
      const animMul = computeAnimatedOpacity(animMode, time, speed, bass);

      const motionMode = this.config.textureMotion ?? 'none';
      const motion = computeTextureMotion(motionMode, time, speed, bass);

      this.sceneHandler.setTextureTransform({
        opacity: baseOpacity * animMul,
        rotation: motion.rotationZ,
        rotationY: motion.rotationY,
        offsetX: motion.offsetX,
        offsetY: motion.offsetY,
        scale: motion.extraScale,
        tintColor: { ...this.resolveTintColor() },
      });
    }

    // Dynamic bloom: base intensity * multiplier, capped to avoid whiteout
    this.bloomPass.strength = Math.min((this.config.bloomIntensity ?? 1.5) * mul, 8);

    this.composer.render();
  };

  updateConfig(newConfig: Partial<VisualizerConfig>): void {
    const prevScene = this.config.scene;
    const prevDensity = this.config.particleDensity;
    const prevCameraMovement = this.config.cameraMovement;

    // Merge first so all downstream reads see the new values
    this.config = { ...this.config, ...newConfig };

    // Invalidate tint cache when relevant config changes
    if (newConfig.textureTint !== undefined || newConfig.colorPalette) {
      this._tintDirty = true;
    }

    const densityChanged =
      newConfig.particleDensity !== undefined && newConfig.particleDensity !== prevDensity;

    // Always forward effective speed (base * multiplier) to scenes so the raw
    // animationSpeed in newConfig never clobbers the multiplied value, and so
    // switching multiplier back to 1x correctly resets the scene speed.
    const mul = this.config.intensityMultiplier ?? 1;
    const speedOrMulChanged =
      newConfig.animationSpeed !== undefined || newConfig.intensityMultiplier !== undefined;
    const sceneConfig: Partial<VisualizerConfig> = speedOrMulChanged
      ? { ...newConfig, animationSpeed: this.config.animationSpeed * mul }
      : newConfig;

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
      this.sceneHandler?.updateConfig(sceneConfig);
    } else {
      this.sceneHandler?.updateConfig(sceneConfig);
    }

    // Update bloom (animate loop handles multiplier dynamically)
    if (newConfig.bloomIntensity !== undefined) {
      this.bloomPass.strength = this.config.bloomIntensity * mul;
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

    // Reset camera only when SWITCHING TO static (not when already static)
    if (newConfig.cameraMovement === 'static' && prevCameraMovement !== 'static') {
      this.cameraAngle = 0;
      this.positionCamera();
    }
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
    disposeParticleShapeCache();
    this.bloomPass.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
