import * as THREE from 'three';
import type { TextureAnimation, TextureMotion } from '@/types/visualizer';

/**
 * Compute the animated opacity value based on the selected animation mode.
 * Returns a multiplier (0-1) to apply on top of the base textureOpacity.
 */
export function computeAnimatedOpacity(
  mode: TextureAnimation,
  time: number,
  speed: number,
  bass: number
): number {
  switch (mode) {
    case 'pulse': {
      // Gentle sine wave: 0.3 to 1.0 over ~4 seconds
      return 0.3 + 0.7 * (Math.sin(time * speed * 1.0) * 0.5 + 0.5);
    }
    case 'breathe': {
      // Slow deep breathing: 0.0 to 1.0 over ~6 seconds
      const t = time * speed * 0.5;
      // Ease-in-out using smoothed sine
      const raw = Math.sin(t) * 0.5 + 0.5;
      return raw * raw * (3 - 2 * raw); // smoothstep
    }
    case 'flash': {
      // Periodic flash: mostly transparent, quick burst to full
      const cycle = (time * speed * 0.8) % (Math.PI * 2);
      const flash = Math.max(0, Math.sin(cycle) * 3 - 2); // sharp spike
      const bassBoost = 1.0 + bass * 0.5;
      return Math.min(1.0, 0.1 + flash * 0.9 * bassBoost);
    }
    case 'strobe': {
      // Rapid on/off: ~4 Hz
      const strobe = Math.sin(time * speed * 25) > 0 ? 1.0 : 0.0;
      return strobe;
    }
    case 'none':
    default:
      return 1.0;
  }
}

export interface TextureMotionResult {
  rotationZ: number;
  offsetX: number;
  offsetY: number;
  extraScale: number;
}

/**
 * Compute texture mesh transform based on the selected motion mode.
 * Returns rotation, position offset, and scale adjustments to apply to the logo mesh.
 */
export function computeTextureMotion(
  mode: TextureMotion,
  time: number,
  speed: number,
  bass: number
): TextureMotionResult {
  const none: TextureMotionResult = { rotationZ: 0, offsetX: 0, offsetY: 0, extraScale: 1 };
  switch (mode) {
    case 'spin': {
      // Continuous slow rotation
      return { ...none, rotationZ: time * speed * 0.4 };
    }
    case 'bounce': {
      // Vertical bounce with bass impact
      const bounce = Math.abs(Math.sin(time * speed * 1.5));
      const impact = 1 - bounce * 0.1; // slight squash at bottom
      return { ...none, offsetY: bounce * 0.6 + bass * 0.2, extraScale: impact };
    }
    case 'float': {
      // Gentle figure-8 drift
      return {
        ...none,
        offsetX: Math.sin(time * speed * 0.4) * 0.4,
        offsetY: Math.sin(time * speed * 0.6) * 0.25,
      };
    }
    case 'swing': {
      // Pendulum rock back and forth
      const angle = Math.sin(time * speed * 0.8) * 0.3;
      return { ...none, rotationZ: angle };
    }
    case 'fixed':
    case 'none':
    default:
      return none;
  }
}

// Reusable vectors to avoid per-frame allocations
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();

/**
 * Billboard the logo mesh to always face the camera and apply offsets in
 * camera-local space so the texture stays screen-centred during camera orbit.
 */
export function applyFixedMotion(
  logoMesh: THREE.Mesh,
  camera: THREE.Camera,
  offsetX: number,
  offsetY: number
): void {
  // Billboard: rotate plane to face camera
  logoMesh.lookAt(camera.position);

  // Position with offset in camera-local coordinates
  _right.setFromMatrixColumn(camera.matrixWorld, 0);
  _up.setFromMatrixColumn(camera.matrixWorld, 1);

  logoMesh.position.set(0, 0, 0);
  logoMesh.position.addScaledVector(_right, offsetX * 4.0);
  logoMesh.position.addScaledVector(_up, offsetY * 4.0);
}
