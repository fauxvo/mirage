# Video Scene Design Spec

**Date:** 2026-04-17
**Status:** Draft

## Summary

Add a `video` scene to Mirage that plays user-uploaded videos fullscreen on loop. Video cues are regular cues with `scene: 'video'` and a `videoUrl` in the config. The only scene-specific setting is an audio toggle. Upload supports S3 (primary) with local file fallback.

## Requirements

- User uploads a video file; it plays fullscreen, looping, muted by default
- Video fills the entire viewport edge-to-edge (`object-fit: cover` behavior — crops to fill, no letterboxing)
- Single scene param: audio toggle (muted/unmuted)
- Works with the cue system — each cue can be a video cue with its own video
- S3 upload for videos up to 250MB; local object URL fallback when S3 is not configured
- No audio-reactive visual effects on the video
- No playback controls — auto-play and loop only

## Architecture

### Video Scene (`src/components/visualizer/scenes/video-scene.ts`)

Self-registering scene following the standard pattern.

**Registration metadata:**

```typescript
{
  id: 'video',
  name: 'Video',
  description: 'Play uploaded videos fullscreen on loop',
  category: 'immersive',
  cameraHint: 'small-plane',
  features: [],  // no texture features
  params: [
    { key: 'audioEnabled', label: 'Video Audio', type: 'toggle', default: false }
  ]
}
```

**Implementation:**

- Creates a hidden `<video>` HTML element: `loop`, `autoplay`, `playsinline`, `muted` (default), `crossOrigin: 'anonymous'`
- Wraps in `THREE.VideoTexture` mapped to a `PlaneGeometry`
- Plane sized dynamically to cover the viewport based on video aspect ratio vs screen aspect ratio (cover mode)
- On window resize or video metadata load: recalculate plane dimensions to maintain full coverage

**Lifecycle:**

- `constructor(scene, config)`: create video element, create VideoTexture, create plane, set initial videoUrl from config
- `updateConfig(config)`: if `videoUrl` changes, update `video.src` and play. If `sceneParams.audioEnabled` changes, toggle `video.muted`
- `update(bass, mid, high)`: no-op (VideoTexture auto-refreshes from the video element each frame)
- `dispose()`: pause video, revoke any object URLs, remove video element from DOM, dispose texture/geometry/material

**Fullscreen cover behavior:**

- On `loadedmetadata` event: read `video.videoWidth` / `video.videoHeight`
- Compare video aspect ratio to renderer aspect ratio
- Scale plane so the shorter dimension fills the viewport, cropping the longer dimension
- Recalculate on window `resize` events

### Config Changes (`src/types/visualizer.ts` + `src/lib/schemas.ts`)

Add to `VisualizerConfig`:

```typescript
videoUrl?: string | null;
```

Add to `VisualizerConfigSchema`:

```typescript
videoUrl: z.string().nullable().optional();
```

Default: `null` in `buildDefaultConfig()`.

### Upload API Changes (`src/app/api/upload/route.ts`)

Extend to accept video files:

- Accept `video/*` MIME types in addition to `image/*`
- Video size limit: 250MB (images remain 10MB)
- S3 key pattern for videos: `videos/{setId}/{nanoid(8)}.{ext}`
- Return `{ url }` as before

No base64 fallback for videos (too large). When S3 is not configured, the upload API rejects video uploads with an error message indicating S3 is required for video storage.

### Settings Panel Changes (`src/components/visualizer/visualizer-settings-panel.tsx`)

When `config.scene === 'video'`:

- Hide the image texture upload section
- Show a video upload input: `<input type="file" accept="video/*">`
- Display the current video filename or "No video uploaded" status
- Upload flow: select file -> upload to `/api/upload` -> store returned URL in `config.videoUrl`
- Loading/error states during upload (videos are large, may take time)

When S3 is not configured:

- Use `URL.createObjectURL(file)` for local-only playback
- Store the object URL in `config.videoUrl`
- Show a note that video won't persist across page reloads without S3

### Cue Integration

No changes to the cue system. A video cue is:

```json
{
  "name": "My Video Cue",
  "config": {
    "scene": "video",
    "videoUrl": "https://s3.example.com/videos/setId/abc123.mp4",
    "sceneParams": { "audioEnabled": false },
    ...rest of VisualizerConfig defaults
  }
}
```

Switching cues triggers the normal `switchCue` flow -> engine detects scene change -> creates VideoScene -> scene reads `videoUrl` from config and starts playback.

## Files to Create/Modify

| File                                                      | Action   | Description                           |
| --------------------------------------------------------- | -------- | ------------------------------------- |
| `src/components/visualizer/scenes/video-scene.ts`         | Create   | New video scene implementation        |
| `src/components/visualizer/scenes/index.ts`               | Auto-gen | Will be updated by `sync:scenes`      |
| `src/types/visualizer.ts`                                 | Modify   | Add `videoUrl` to VisualizerConfig    |
| `src/lib/schemas.ts`                                      | Modify   | Add `videoUrl` to Zod schema          |
| `src/constants/visualizer-presets.ts`                     | Modify   | Add `videoUrl: null` to defaults      |
| `src/app/api/upload/route.ts`                             | Modify   | Accept video MIME types, 250MB limit  |
| `src/components/visualizer/visualizer-settings-panel.tsx` | Modify   | Video upload UI when scene is 'video' |

## Edge Cases

- **No video uploaded:** Scene shows black plane. User sees "No video uploaded" in settings.
- **Video fails to load:** Log warning, show black. No crash.
- **S3 not configured + video:** Local object URL for current session; note that it won't persist.
- **Switching away from video cue:** VideoScene.dispose() cleans up video element and texture.
- **Switching back to video cue:** New VideoScene created, video reloads from URL and auto-plays.
- **Browser autoplay policy:** Video is muted by default, which satisfies autoplay policies. If user enables audio, playback may pause on some browsers until user interaction — acceptable.

## Out of Scope

- Video playback controls (play/pause, seek, speed)
- Audio-reactive visual effects on the video
- Video transcoding or format conversion
- Thumbnail generation for video cues
- Video streaming / adaptive bitrate (HLS/DASH)
