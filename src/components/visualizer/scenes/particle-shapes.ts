import * as THREE from 'three';

// ── Particle Shape Textures ──────────────────────────────────────────────────
// Canvas-generated point-sprite textures for particle-based scenes.
// Used as the default particle appearance when no custom texture is set.

export type ParticleShape = 'circle' | 'star' | 'diamond' | 'ring' | 'sparkle';

const SHAPE_SIZE = 64;
const HALF = SHAPE_SIZE / 2;

/** Cache so we don't regenerate the same shape repeatedly. */
const cache = new Map<ParticleShape, THREE.CanvasTexture>();

/** Generate (or return cached) a CanvasTexture for the given particle shape. */
export function getParticleShapeTexture(shape: ParticleShape): THREE.CanvasTexture {
  const cached = cache.get(shape);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = SHAPE_SIZE;
  canvas.height = SHAPE_SIZE;
  const ctx = canvas.getContext('2d')!;

  switch (shape) {
    case 'circle':
      drawCircle(ctx);
      break;
    case 'star':
      drawStar(ctx);
      break;
    case 'diamond':
      drawDiamond(ctx);
      break;
    case 'ring':
      drawRing(ctx);
      break;
    case 'sparkle':
      drawSparkle(ctx);
      break;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  cache.set(shape, texture);
  return texture;
}

/** Dispose all cached shape textures (call on app teardown). */
export function disposeParticleShapeCache(): void {
  for (const tex of cache.values()) tex.dispose();
  cache.clear();
}

// ── Drawing helpers ──────────────────────────────────────────────────────────

function drawCircle(ctx: CanvasRenderingContext2D): void {
  // Soft glow circle with radial gradient
  const grad = ctx.createRadialGradient(HALF, HALF, 0, HALF, HALF, HALF);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
  grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.2)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SHAPE_SIZE, SHAPE_SIZE);
}

function drawStar(ctx: CanvasRenderingContext2D): void {
  // 5-pointed star with glow
  const spikes = 5;
  const outerR = HALF * 0.85;
  const innerR = outerR * 0.4;

  ctx.save();
  ctx.translate(HALF, HALF);

  // Glow background
  const grad = ctx.createRadialGradient(0, 0, innerR * 0.5, 0, 0, outerR);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(-HALF, -HALF, SHAPE_SIZE, SHAPE_SIZE);

  // Star shape
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / spikes - Math.PI / 2;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 255, 255, 1)';
  ctx.fill();
  ctx.restore();
}

function drawDiamond(ctx: CanvasRenderingContext2D): void {
  // Diamond (rotated square) with glow
  const size = HALF * 0.8;

  ctx.save();
  ctx.translate(HALF, HALF);

  // Glow
  const grad = ctx.createRadialGradient(0, 0, size * 0.3, 0, 0, size * 1.2);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(-HALF, -HALF, SHAPE_SIZE, SHAPE_SIZE);

  // Diamond
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size, 0);
  ctx.lineTo(0, size);
  ctx.lineTo(-size, 0);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 255, 255, 1)';
  ctx.fill();
  ctx.restore();
}

function drawRing(ctx: CanvasRenderingContext2D): void {
  // Hollow circle with glow
  const outerR = HALF * 0.85;
  const innerR = outerR * 0.6;

  ctx.save();
  ctx.translate(HALF, HALF);

  // Outer glow
  const grad = ctx.createRadialGradient(0, 0, innerR, 0, 0, outerR * 1.1);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
  grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
  grad.addColorStop(0.7, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.85, 'rgba(255, 255, 255, 0.6)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, outerR * 1.1, 0, Math.PI * 2);
  ctx.fill();

  // Punch out center
  ctx.globalCompositeOperation = 'destination-out';
  const innerGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, innerR);
  innerGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
  innerGrad.addColorStop(0.8, 'rgba(0, 0, 0, 1)');
  innerGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = innerGrad;
  ctx.beginPath();
  ctx.arc(0, 0, innerR, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawSparkle(ctx: CanvasRenderingContext2D): void {
  // 4-pointed sparkle/cross-star
  const longR = HALF * 0.9;
  const shortR = HALF * 0.15;

  ctx.save();
  ctx.translate(HALF, HALF);

  // Glow
  const grad = ctx.createRadialGradient(0, 0, shortR, 0, 0, longR);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(-HALF, -HALF, SHAPE_SIZE, SHAPE_SIZE);

  // 4 elongated points
  ctx.fillStyle = 'rgba(255, 255, 255, 1)';
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const nextAngle = ((i + 1) * Math.PI) / 2;

    const px = Math.cos(angle) * longR;
    const py = Math.sin(angle) * longR;
    const mx = Math.cos((angle + nextAngle) / 2) * shortR;
    const my = Math.sin((angle + nextAngle) / 2) * shortR;

    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
    ctx.lineTo(mx, my);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
