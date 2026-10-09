/**
 * SECP Industrial OS v3 — PATCH-179: 5-Axis Swept Volume Engine
 * Generates swept cylindrical/conical capsules between tool poses for cutter flutes,
 * shank, and multi-stage holder geometries, computing continuous distance fields.
 */

import { Vector3D } from '../../cadKernel';
import { FiveAxisToolDefinition, FiveAxisHolderDefinition } from './FiveAxisTypes';

export interface SweptCapsule {
  p0_bottom: Vector3D;
  p0_top: Vector3D;
  p1_bottom: Vector3D;
  p1_top: Vector3D;
  radiusBottom: number;
  radiusTop: number;
  component: 'CUTTER' | 'SHANK' | 'HOLDER_STAGE' | 'SPINDLE';
  stageIndex?: number;
}

export interface DistanceQueryResult {
  minDistanceMm: number;
  closestPointTool: Vector3D;
  closestPointObstacle: Vector3D;
  isIntersecting: boolean;
  penetrationDepthMm: number;
}

export class ToolSweptVolumeEngine {
  /**
   * Constructs the discrete swept capsules for a tool motion between Pose 0 and Pose 1
   */
  public static buildSweptCapsules(
    tool: FiveAxisToolDefinition,
    p0: Vector3D,
    axis0: Vector3D,
    p1: Vector3D,
    axis1: Vector3D
  ): SweptCapsule[] {
    const capsules: SweptCapsule[] = [];

    // 1. Cutter active flutes capsule
    const fluteLen = tool.fluteLengthMm;
    const cutterTop0 = this.addScaledVector(p0, axis0, fluteLen);
    const cutterTop1 = this.addScaledVector(p1, axis1, fluteLen);

    capsules.push({
      p0_bottom: p0,
      p0_top: cutterTop0,
      p1_bottom: p1,
      p1_top: cutterTop1,
      radiusBottom: tool.diameterMm / 2,
      radiusTop: tool.diameterMm / 2,
      component: 'CUTTER'
    });

    // 2. Shank un-fluted neck capsule
    const shankLen = Math.max(0, tool.shoulderLengthMm - fluteLen);
    if (shankLen > 0) {
      const shankTop0 = this.addScaledVector(cutterTop0, axis0, shankLen);
      const shankTop1 = this.addScaledVector(cutterTop1, axis1, shankLen);

      capsules.push({
        p0_bottom: cutterTop0,
        p0_top: shankTop0,
        p1_bottom: cutterTop1,
        p1_top: shankTop1,
        radiusBottom: tool.shankDiameterMm / 2,
        radiusTop: tool.shankDiameterMm / 2,
        component: 'SHANK'
      });
    }

    // 3. Multi-stage Holder capsules
    let currentHolderBase0 = this.addScaledVector(p0, axis0, tool.shoulderLengthMm);
    let currentHolderBase1 = this.addScaledVector(p1, axis1, tool.shoulderLengthMm);

    for (let s = 0; s < tool.holder.stages.length; s++) {
      const stage = tool.holder.stages[s];
      const stageTop0 = this.addScaledVector(currentHolderBase0, axis0, stage.lengthMm);
      const stageTop1 = this.addScaledVector(currentHolderBase1, axis1, stage.lengthMm);

      capsules.push({
        p0_bottom: currentHolderBase0,
        p0_top: stageTop0,
        p1_bottom: currentHolderBase1,
        p1_top: stageTop1,
        radiusBottom: stage.bottomDiameterMm / 2,
        radiusTop: stage.topDiameterMm / 2,
        component: 'HOLDER_STAGE',
        stageIndex: s
      });

      currentHolderBase0 = stageTop0;
      currentHolderBase1 = stageTop1;
    }

    // 4. Spindle nose cylinder
    const spindleTop0 = this.addScaledVector(currentHolderBase0, axis0, 80);
    const spindleTop1 = this.addScaledVector(currentHolderBase1, axis1, 80);
    capsules.push({
      p0_bottom: currentHolderBase0,
      p0_top: spindleTop0,
      p1_bottom: currentHolderBase1,
      p1_top: spindleTop1,
      radiusBottom: tool.holder.flangeDiameterMm / 2 + 10,
      radiusTop: tool.holder.flangeDiameterMm / 2 + 15,
      component: 'SPINDLE'
    });

    return capsules;
  }

  /**
   * Computes shortest Euclidean distance from a line segment (capsule core) to an obstacle point
   */
  public static distancePointToSegment(
    p: Vector3D,
    segStart: Vector3D,
    segEnd: Vector3D
  ): { distance: number; closestPoint: Vector3D } {
    const vx = segEnd.x - segStart.x;
    const vy = segEnd.y - segStart.y;
    const vz = segEnd.z - segStart.z;
    const lenSq = vx * vx + vy * vy + vz * vz;

    if (lenSq < 1e-8) {
      const d = Math.hypot(p.x - segStart.x, p.y - segStart.y, p.z - segStart.z);
      return { distance: d, closestPoint: segStart };
    }

    const wx = p.x - segStart.x;
    const wy = p.y - segStart.y;
    const wz = p.z - segStart.z;
    const dot = wx * vx + wy * vy + wz * vz;
    const t = Math.max(0, Math.min(1, dot / lenSq));

    const cp: Vector3D = {
      x: segStart.x + t * vx,
      y: segStart.y + t * vy,
      z: segStart.z + t * vz
    };

    const dist = Math.hypot(p.x - cp.x, p.y - cp.y, p.z - cp.z);
    return { distance: dist, closestPoint: cp };
  }

  /**
   * Adds scaled vector to a point
   */
  private static addScaledVector(p: Vector3D, dir: Vector3D, scale: number): Vector3D {
    const mag = Math.hypot(dir.x, dir.y, dir.z) || 1.0;
    return {
      x: p.x + (dir.x / mag) * scale,
      y: p.y + (dir.y / mag) * scale,
      z: p.z + (dir.z / mag) * scale
    };
  }
}
