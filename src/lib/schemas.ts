import { z } from 'zod';

export const VisualizerColorPaletteSchema = z.object({
  primary: z.string(),
  secondary: z.string(),
  accent: z.string(),
  background: z.string(),
});

export const VisualizerConfigSchema = z.object({
  scene: z.string(),
  colorPalette: VisualizerColorPaletteSchema,
  particleDensity: z.number().min(0).max(1),
  animationSpeed: z.number().min(0.5).max(2),
  bloomIntensity: z.number().min(0).max(3),
  audioReactivity: z.number().min(0).max(1),
  cameraMovement: z.enum(['static', 'orbit', 'drift', 'pulse']),
  wireframe: z.boolean(),
  symmetry: z.number().min(1).max(12),
  depth: z.number().min(0).max(1),
  colorCycleSpeed: z.number().min(0).max(2),
  customTextureUrl: z.string().nullable(),
  textureScale: z.number().min(0.2).max(3),
  textureOpacity: z.number().min(0).max(1),
  textureAnimation: z.enum(['none', 'pulse', 'breathe', 'flash', 'strobe']),
  textureMotion: z.enum(['none', 'spin', 'bounce', 'float', 'swing']),
  patternOffsetX: z.number().min(-1).max(1),
  patternOffsetY: z.number().min(-1).max(1).default(0),
  sceneParams: z.record(z.string(), z.union([z.number(), z.boolean(), z.string()])).optional(),
});

// Set schemas
export const CreateSetSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  youtubePlaylistUrl: z.string().url().optional(),
  isPublic: z.boolean().optional().default(true),
});

export const UpdateSetSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  youtubePlaylistUrl: z.string().url().nullable().optional(),
  isPublic: z.boolean().optional(),
});

// Cue schemas
export const CreateCueSchema = z.object({
  name: z.string().min(1).max(100),
  config: VisualizerConfigSchema,
  position: z.number().int().min(1).optional(),
  textureUrl: z.string().nullable().optional(),
});

export const UpdateCueSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config: VisualizerConfigSchema.optional(),
  position: z.number().int().min(1).optional(),
  textureUrl: z.string().nullable().optional(),
});

export const ReorderCuesSchema = z.array(
  z.object({
    id: z.string(),
    position: z.number().int().min(1),
  })
);

// JSON Schema exports for OpenAPI
export const visualizerConfigJsonSchema = z.toJSONSchema(VisualizerConfigSchema, {
  target: 'draft-2020-12',
});
export const createSetJsonSchema = z.toJSONSchema(CreateSetSchema, {
  target: 'draft-2020-12',
});
export const updateSetJsonSchema = z.toJSONSchema(UpdateSetSchema, {
  target: 'draft-2020-12',
});
export const createCueJsonSchema = z.toJSONSchema(CreateCueSchema, {
  target: 'draft-2020-12',
});
export const updateCueJsonSchema = z.toJSONSchema(UpdateCueSchema, {
  target: 'draft-2020-12',
});
