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
  patternOffsetX: z.number().min(-1).max(1),
  sceneParams: z.record(z.string(), z.union([z.number(), z.boolean(), z.string()])).optional(),
});

export const CreateSessionSchema = z.object({
  config: VisualizerConfigSchema.optional(),
  textureUrl: z.string().nullable().optional(),
});

export const UpdateSessionSchema = z.object({
  config: VisualizerConfigSchema.optional(),
  textureUrl: z.string().nullable().optional(),
});

// JSON Schema exports for OpenAPI
export const visualizerConfigJsonSchema = z.toJSONSchema(VisualizerConfigSchema, {
  target: 'draft-2020-12',
});
export const createSessionJsonSchema = z.toJSONSchema(CreateSessionSchema, {
  target: 'draft-2020-12',
});
export const updateSessionJsonSchema = z.toJSONSchema(UpdateSessionSchema, {
  target: 'draft-2020-12',
});
