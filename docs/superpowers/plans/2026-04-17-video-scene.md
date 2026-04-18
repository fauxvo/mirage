# Video Scene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `video` scene that plays user-uploaded videos fullscreen on loop, integrated with the cue system so each cue can have its own video.

**Architecture:** New self-registering scene (`video-scene.ts`) using `THREE.VideoTexture` on a fullscreen plane with `cameraHint: 'small-plane'`. Videos upload to S3 via the existing `/api/upload` route (extended for video MIME types, 250MB limit). The settings panel shows a video-specific upload UI when `scene === 'video'`. A `videoUrl` field is added to `VisualizerConfig`. No audio-reactive effects — the only scene param is an audio toggle.

**Tech Stack:** Three.js (VideoTexture, PlaneGeometry), Next.js API routes, S3 storage, Zod validation, React

---

### Task 1: Add `videoUrl` to Config Schema

**Files:**

- Modify: `src/types/visualizer.ts:16-39`
- Modify: `src/lib/schemas.ts:10-37`
- Modify: `src/constants/visualizer-presets.ts:246-271`

- [ ] **Step 1: Add `videoUrl` to the TypeScript interface**

In `src/types/visualizer.ts`, add after line 29 (`customTextureUrl`):

```typescript
videoUrl: string | null; // URL to video file for video scene
```

- [ ] **Step 2: Add `videoUrl` to the Zod schema**

In `src/lib/schemas.ts`, add after the `customTextureUrl` field (line 22):

```typescript
videoUrl: z.string().nullable().default(null),
```

- [ ] **Step 3: Add `videoUrl` to default config**

In `src/constants/visualizer-presets.ts`, in the `buildDefaultConfig` return object (around line 258), add after `customTextureUrl: null,`:

```typescript
videoUrl: null,
```

- [ ] **Step 4: Verify the build compiles**

Run: `cd /Users/mattread/projects/mirage && bun run build 2>&1 | tail -20`
Expected: Build succeeds (or only unrelated warnings)

- [ ] **Step 5: Commit**

```bash
git add src/types/visualizer.ts src/lib/schemas.ts src/constants/visualizer-presets.ts
git commit -m "feat(video): add videoUrl field to VisualizerConfig schema"
```

---

### Task 2: Extend Upload API for Video Files

**Files:**

- Modify: `src/app/api/upload/route.ts`

- [ ] **Step 1: Update the upload route to accept video files**

Replace the MIME type check and size limit section in `src/app/api/upload/route.ts` (lines 36-44) with logic that handles both images and videos:

```typescript
const isImage = file.type.startsWith('image/');
const isVideo = file.type.startsWith('video/');

if (!isImage && !isVideo) {
  return errorResponse('File must be an image or video', 400);
}

const maxSize = isVideo ? 250 * 1024 * 1024 : 10 * 1024 * 1024;
const maxLabel = isVideo ? '250MB' : '10MB';

if (file.size > maxSize) {
  return errorResponse(`File must be under ${maxLabel}`, 400);
}

const ext = file.type.split('/')[1] || (isVideo ? 'mp4' : 'png');
const prefix = isVideo ? 'videos' : 'textures';
const key = `${prefix}/${setId}/${nanoid(8)}.${ext}`;
```

Remove the old `ext` and `key` lines (44-45) since they're now in the block above.

- [ ] **Step 2: Verify the build compiles**

Run: `cd /Users/mattread/projects/mirage && bun run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/api/upload/route.ts
git commit -m "feat(video): extend upload API for video files (250MB limit)"
```

---

### Task 3: Create the Video Scene

**Files:**

- Create: `src/components/visualizer/scenes/video-scene.ts`

- [ ] **Step 1: Create the video scene file**

Create `src/components/visualizer/scenes/video-scene.ts`:

```typescript
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
    window.addEventListener('resize', this.handleResize);

    // Load video if URL is present
    if (config.videoUrl) {
      this.loadVideo(config.videoUrl);
    }
  }

  private loadVideo(url: string): void {
    this.video.src = url;
    this.video.load();
    this.video.play().catch(() => {
      // Autoplay may be blocked — mute and retry
      this.video.muted = true;
      this.video.play().catch(() => {});
    });
  }

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

    const rendererSize = this.renderer.getSize(new THREE.Vector2());
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
```

- [ ] **Step 2: Check if scene factory receives renderer**

The scene factory signature in `scene-registry.ts` and `visualizer-engine.ts` must pass the renderer to the factory. Check by reading:

Run: `cd /Users/mattread/projects/mirage && grep -n 'createScene\|SceneFactory' src/components/visualizer/scenes/scene-registry.ts src/components/visualizer/scenes/types.ts`

If the factory signature is `(scene: THREE.Scene, config: VisualizerConfig)` (no camera/renderer), you need to extend it. Add optional `camera?: THREE.PerspectiveCamera` and `renderer?: THREE.WebGLRenderer` parameters to `SceneFactory` in `types.ts`, and pass them through in `scene-registry.ts` `createScene()` and `visualizer-engine.ts` `loadScene()`.

In `src/components/visualizer/scenes/scene-registry.ts`, update the `SceneFactory` type (line 5) and `createScene` function to accept and pass through camera and renderer:

```typescript
type SceneFactory = (
  scene: THREE.Scene,
  config: VisualizerConfig,
  camera?: THREE.PerspectiveCamera,
  renderer?: THREE.WebGLRenderer
) => SceneHandler;
```

Update `createScene`:

```typescript
export function createScene(
  id: string,
  scene: THREE.Scene,
  config: VisualizerConfig,
  camera?: THREE.PerspectiveCamera,
  renderer?: THREE.WebGLRenderer
): SceneHandler {
  let factory = registry.get(id);
  if (!factory) {
    console.warn(
      `Scene "${id}" not found in registry. Falling back to "${DEFAULT_SCENE}". Available: ${Array.from(registry.keys()).join(', ')}`
    );
    factory = registry.get(DEFAULT_SCENE)!;
  }
  return factory(scene, config, camera, renderer);
}
```

In `src/components/visualizer/visualizer-engine.ts`, update the `loadScene` call to pass camera and renderer:

```typescript
this.sceneHandler = createScene(sceneType, this.scene, this.config, this.camera, this.renderer);
```

- [ ] **Step 3: Run scene sync**

Run: `cd /Users/mattread/projects/mirage && bun run sync:scenes`
Expected: `scenes/index.ts` regenerated with `import './video-scene';`

- [ ] **Step 4: Verify the build compiles**

Run: `cd /Users/mattread/projects/mirage && bun run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/components/visualizer/scenes/video-scene.ts src/components/visualizer/scenes/index.ts src/components/visualizer/scenes/scene-registry.ts src/components/visualizer/visualizer-engine.ts
git commit -m "feat(video): add video scene with VideoTexture and fullscreen cover"
```

---

### Task 4: Add Video Upload UI to Settings Panel

**Files:**

- Modify: `src/components/visualizer/visualizer-settings-panel.tsx`

- [ ] **Step 1: Add video upload state and handler**

Near the existing `textureUploading` state (line 104), add:

```typescript
const [videoUploading, setVideoUploading] = useState(false);
const [videoError, setVideoError] = useState<string | null>(null);
const videoInputRef = useRef<HTMLInputElement>(null);
```

Add the video upload handler after `handleRemoveTexture` (around line 270):

```typescript
const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  setVideoError(null);

  if (!file.type.startsWith('video/')) {
    setVideoError('Please select a video file');
    return;
  }
  if (file.size > 250 * 1024 * 1024) {
    setVideoError('Video must be under 250MB');
    return;
  }

  try {
    if (storageAvailable && setId) {
      setVideoUploading(true);
      const url = await uploadToStorage(file);
      onQuickChange({ videoUrl: url });
    } else {
      // Local playback via object URL (won't persist across reloads)
      const objectUrl = URL.createObjectURL(file);
      onQuickChange({ videoUrl: objectUrl });
    }
  } catch (err) {
    setVideoError(err instanceof Error ? err.message : 'Failed to upload video');
  } finally {
    setVideoUploading(false);
  }

  e.target.value = '';
};

const handleRemoveVideo = () => {
  onQuickChange({ videoUrl: null });
  setVideoError(null);
};
```

- [ ] **Step 2: Add video upload UI section**

In the JSX, find the `{/* Custom Texture */}` section (around line 925). Wrap it so it only shows when scene is NOT 'video', and add a video upload section that shows when scene IS 'video':

```tsx
{config.scene === 'video' ? (
  <section>
    <label className="block text-white/70 text-xs font-semibold mb-2 uppercase tracking-wider">
      Video
    </label>
    <input
      ref={videoInputRef}
      type="file"
      accept="video/*"
      onChange={handleVideoUpload}
      className="hidden"
    />
    {config.videoUrl ? (
      <div className="space-y-2">
        <div className="flex items-center gap-2 p-2 bg-white/5 rounded-lg border border-white/10">
          <div className="flex-1 text-white/70 text-xs truncate">
            Video loaded
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => videoInputRef.current?.click()}
            disabled={videoUploading}
            className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white/70 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            <Upload className="w-3 h-3" />
            Replace
          </button>
          <button
            onClick={handleRemoveVideo}
            className="flex-1 py-1.5 bg-white/10 hover:bg-red-500/30 rounded-lg text-white/70 hover:text-red-300 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3 h-3" />
            Remove
          </button>
        </div>
      </div>
    ) : (
      <button
        onClick={() => videoInputRef.current?.click()}
        disabled={videoUploading}
        className="w-full py-3 bg-white/5 hover:bg-white/10 border border-dashed border-white/20 hover:border-white/30 rounded-lg text-white/50 hover:text-white/70 text-xs font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {videoUploading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Uploading video...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            Upload Video
          </>
        )}
      </button>
    )}
    {videoError && <p className="mt-1 text-red-400 text-[10px]">{videoError}</p>}
    {!storageAvailable && config.videoUrl && (
      <p className="mt-1 text-yellow-400/70 text-[10px]">
        Local playback only — S3 required for persistent video storage
      </p>
    )}
  </section>
) : (
  /* existing Custom Texture section unchanged */
)}
```

- [ ] **Step 3: Hide texture controls when scene is video**

The texture controls section (around line 989) is wrapped in `{config.customTextureUrl && ( ... )}`. This already won't show for video scenes since they don't use `customTextureUrl`. No change needed — just verify this.

- [ ] **Step 4: Verify the build compiles**

Run: `cd /Users/mattread/projects/mirage && bun run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/components/visualizer/visualizer-settings-panel.tsx
git commit -m "feat(video): add video upload UI in settings panel"
```

---

### Task 5: Handle Video URL in Engine Config Updates

**Files:**

- Modify: `src/components/visualizer/visualizer-engine.ts`

The engine's `updateConfig` method needs to forward `videoUrl` changes to the scene handler. The scene handler's `updateConfig` already handles it, but the engine needs to include `videoUrl` in the config it passes through.

- [ ] **Step 1: Ensure videoUrl is forwarded to scene handler**

In `src/components/visualizer/visualizer-engine.ts`, in the `updateConfig` method, the line `this.sceneHandler?.updateConfig(sceneConfig)` already passes the full config through. Check that `videoUrl` is not being stripped out anywhere. Read lines around the `updateConfig` method (around line 440-480) to verify.

If config changes are filtered before passing to the scene handler, add `videoUrl` to the allowed fields. If they pass the full config object through (which the current code does), no change is needed.

- [ ] **Step 2: Verify by reading the code**

Run: `cd /Users/mattread/projects/mirage && grep -A5 'sceneHandler.*updateConfig' src/components/visualizer/visualizer-engine.ts`

If the scene handler receives the full `newConfig`, this task is done. If not, add `videoUrl` forwarding.

- [ ] **Step 3: Commit (if changes were needed)**

```bash
git add src/components/visualizer/visualizer-engine.ts
git commit -m "feat(video): ensure videoUrl forwarded to scene handler"
```

---

### Task 6: Manual Integration Test

- [ ] **Step 1: Create feature branch and start dev server**

```bash
cd /Users/mattread/projects/mirage
git checkout -b feat/video-scene
bun run dev
```

- [ ] **Step 2: Test video scene selection**

1. Open `http://localhost:4444` and create/open a set
2. Open the settings panel
3. Scroll to scene selection → find "Video" in the Immersive category
4. Select it — screen should go black (no video loaded yet)

- [ ] **Step 3: Test video upload**

1. With the video scene selected, find the "Upload Video" button in settings
2. Select a video file (MP4, <250MB)
3. If S3 is configured: video should upload and start playing fullscreen
4. If S3 is not configured: video should play locally via object URL
5. Video should loop continuously
6. Video should be muted by default

- [ ] **Step 4: Test audio toggle**

1. In scene params, toggle "Video Audio" on
2. Video audio should unmute
3. Toggle off — audio should mute again

- [ ] **Step 5: Test fullscreen cover behavior**

1. Resize the browser window to various aspect ratios
2. Video should always fill the entire viewport with no black bars
3. Cropping from the wider dimension is expected

- [ ] **Step 6: Test cue switching**

1. Create a second cue with a different scene (e.g., particles)
2. Switch between the video cue and the particles cue using keyboard (1, 2) or clicking
3. Video should pause/clean up when switching away
4. Video should reload and play when switching back

- [ ] **Step 7: Test video replacement**

1. On the video cue, click "Replace" and select a different video
2. New video should start playing
3. Click "Remove" — screen should go black

- [ ] **Step 8: Commit all work on the feature branch**

```bash
git add -A
git commit -m "feat: add video scene with upload, cue integration, and audio toggle"
```
