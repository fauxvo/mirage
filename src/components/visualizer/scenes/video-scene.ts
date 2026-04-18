import * as THREE from 'three';
import type { VisualizerConfig } from '@/types/visualizer';
import { registerScene } from './scene-registry';
import type { SceneRegistration } from './types';

export class VideoScene {
  private mesh: THREE.Mesh;
  private material: THREE.MeshBasicMaterial;
  private video: HTMLVideoElement;
  private videoTexture: THREE.VideoTexture | null = null;
  private objectUrl: string | null = null;
  private config: VisualizerConfig;
  private renderer: THREE.WebGLRenderer;
  private _sizeVec = new THREE.Vector2();

  constructor(
    private scene: THREE.Scene,
    config: VisualizerConfig,
    _camera?: THREE.PerspectiveCamera,
    renderer?: THREE.WebGLRenderer
  ) {
    this.config = config;
    this.renderer = renderer!;

    // Create hidden video element
    this.video = document.createElement('video');
    this.video.loop = true;
    this.video.autoplay = true;
    this.video.playsInline = true;
    this.video.muted = !(config.sceneParams?.audioEnabled === true);
    this.video.crossOrigin = 'anonymous';
    this.video.style.display = 'none';
    document.body.appendChild(this.video);

    // Create plane with basic material (no shaders needed — just display the video)
    const geometry = new THREE.PlaneGeometry(12, 12);
    this.material = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.z = -2;
    this.scene.add(this.mesh);

    // Listen for video metadata to adjust plane aspect ratio
    this.video.addEventListener('loadedmetadata', this.handleVideoReady);
    this.video.addEventListener('error', this.handleVideoError);
    window.addEventListener('resize', this.handleResize);

    // Load video if URL is present
    if (config.videoUrl) {
      this.loadVideo(config.videoUrl);
    }
  }

  private loadVideo(url: string): void {
    // Revoke previous object URL if we were tracking one
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
    }
    this.objectUrl = url.startsWith('blob:') ? url : null;

    this.video.src = url;
    this.video.load();
    this.video.play().catch(() => {
      // Autoplay may be blocked — mute and retry
      this.video.muted = true;
      this.video.play().catch(() => {});
    });
  }

  private handleVideoError = (): void => {
    const error = this.video.error;
    console.warn(
      `[mirage] Video failed to load: ${error?.message ?? 'unknown error'} (code ${error?.code})`
    );
  };

  private handleVideoReady = (): void => {
    // Create VideoTexture from the loaded video
    if (this.videoTexture) {
      this.videoTexture.dispose();
    }
    this.videoTexture = new THREE.VideoTexture(this.video);
    this.videoTexture.colorSpace = THREE.SRGBColorSpace;
    this.videoTexture.minFilter = THREE.LinearFilter;
    this.videoTexture.magFilter = THREE.LinearFilter;

    this.material.map = this.videoTexture;
    this.material.color.set(0xffffff);
    this.material.needsUpdate = true;

    this.updatePlaneSize();
  };

  private handleResize = (): void => {
    this.updatePlaneSize();
  };

  /**
   * Scale the plane so the video covers the entire viewport (object-fit: cover).
   * Crops the overflowing dimension rather than letterboxing.
   */
  private updatePlaneSize(): void {
    if (!this.video.videoWidth || !this.video.videoHeight) return;
    if (!this.renderer) return;

    const rendererSize = this.renderer.getSize(this._sizeVec);
    const screenAspect = rendererSize.x / rendererSize.y;
    const videoAspect = this.video.videoWidth / this.video.videoHeight;

    // Base plane is 12x12. Scale axes so video covers the screen.
    // "Cover" means the narrower dimension fills exactly, the wider overflows.
    let scaleX = 1;
    let scaleY = 1;

    if (videoAspect > screenAspect) {
      // Video is wider than screen — match height, overflow width
      scaleY = 1;
      scaleX = videoAspect / screenAspect;
    } else {
      // Video is taller than screen — match width, overflow height
      scaleX = 1;
      scaleY = screenAspect / videoAspect;
    }

    this.mesh.scale.set(scaleX, scaleY, 1);
  }

  update(_bass: number, _mid: number, _high: number): void {
    // No-op — VideoTexture auto-updates from the video element
  }

  updateConfig(config: Partial<VisualizerConfig>): void {
    if (config.videoUrl !== undefined && config.videoUrl !== this.config.videoUrl) {
      if (config.videoUrl) {
        this.loadVideo(config.videoUrl);
      } else {
        this.video.pause();
        this.video.removeAttribute('src');
        this.material.map = null;
        this.material.color.set(0x000000);
        this.material.needsUpdate = true;
        if (this.videoTexture) {
          this.videoTexture.dispose();
          this.videoTexture = null;
        }
      }
    }

    if (config.sceneParams?.audioEnabled !== undefined) {
      this.video.muted = !config.sceneParams.audioEnabled;
    }

    this.config = { ...this.config, ...config };
  }

  dispose(): void {
    window.removeEventListener('resize', this.handleResize);
    this.video.removeEventListener('loadedmetadata', this.handleVideoReady);
    this.video.removeEventListener('error', this.handleVideoError);
    this.video.pause();
    this.video.removeAttribute('src');
    this.video.load(); // Release media resources
    document.body.removeChild(this.video);

    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
    }
    if (this.videoTexture) {
      this.videoTexture.dispose();
    }

    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

const METADATA: SceneRegistration = {
  id: 'video',
  name: 'Video',
  description: 'Play uploaded videos fullscreen on loop',
  category: 'immersive',
  audioDescription: 'No audio reactivity — video plays as-is',
  params: [
    {
      key: 'audioEnabled',
      label: 'Video Audio',
      type: 'toggle',
      default: false,
    },
  ],
  features: [],
  cameraHint: 'small-plane',
};

registerScene(
  'video',
  (scene, config, camera, renderer) => new VideoScene(scene, config, camera, renderer),
  METADATA
);
