import {
  AABB3D,
  Point3D,
  SweptVolumeConfig,
  SweptVolumeResult,
  SweptVolumeType,
  Vector3D
} from "./types";
import { BroadPhaseCollisionEngine } from "./BroadPhaseCollisionEngine";

export class SweptVolumeEngine {
  /**
   * Generates continuous swept trajectory points and bounding box between two 5-axis tool poses.
   */
  public static computeSweptVolume(
    poseStart: { position: Point3D; toolAxis: Vector3D },
    poseEnd: { position: Point3D; toolAxis: Vector3D },
    toolRadius: number,
    toolLength: number,
    config: SweptVolumeConfig = {
      sweepType: SweptVolumeType.SIX_DOF_SWEEP,
      intermediateSteps: 10,
      envelopeExpansionTol: 0.1
    }
  ): SweptVolumeResult {
    const steps = Math.max(2, config.intermediateSteps);
    const intermediatePoses: Array<{ position: Point3D; toolAxis: Vector3D; t: number }> = [];
    const allEnvelopePoints: Point3D[] = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;

      // 1. Position interpolation C(t)
      const pos: Point3D = {
        x: poseStart.position.x + t * (poseEnd.position.x - poseStart.position.x),
        y: poseStart.position.y + t * (poseEnd.position.y - poseStart.position.y),
        z: poseStart.position.z + t * (poseEnd.position.z - poseStart.position.z)
      };

      // 2. Orientation SLERP / vector interpolation u(t)
      const axis = this.interpolateAxisSLERP(poseStart.toolAxis, poseEnd.toolAxis, t);

      intermediatePoses.push({ position: pos, toolAxis: axis, t });

      // 3. Compute tool tip and tool top for bounding envelope
      const toolTop: Point3D = {
        x: pos.x + axis.x * toolLength,
        y: pos.y + axis.y * toolLength,
        z: pos.z + axis.z * toolLength
      };

      // Expand for radial thickness
      allEnvelopePoints.push(
        { x: pos.x - toolRadius, y: pos.y - toolRadius, z: pos.z - toolRadius },
        { x: pos.x + toolRadius, y: pos.y + toolRadius, z: pos.z + toolRadius },
        { x: toolTop.x - toolRadius, y: toolTop.y - toolRadius, z: toolTop.z - toolRadius },
        { x: toolTop.x + toolRadius, y: toolTop.y + toolRadius, z: toolTop.z + toolRadius }
      );
    }

    const rawAABB = BroadPhaseCollisionEngine.computeAABBFromPoints(allEnvelopePoints);
    const boundingBox = BroadPhaseCollisionEngine.expandAABB(rawAABB, config.envelopeExpansionTol);

    return {
      boundingBox,
      intermediatePoses,
      sweptRadius: toolRadius
    };
  }

  /**
   * Spherical Linear Interpolation (SLERP) for 3D orientation vectors.
   */
  public static interpolateAxisSLERP(v1: Vector3D, v2: Vector3D, t: number): Vector3D {
    const dot = Math.max(-1.0, Math.min(1.0, v1.x * v2.x + v1.y * v2.y + v1.z * v2.z));

    if (Math.abs(dot - 1.0) < 1e-6) {
      return { ...v1 };
    }

    if (Math.abs(dot + 1.0) < 1e-6) {
      // Opposite vectors: find orthogonal vector
      const ortho: Vector3D = Math.abs(v1.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
      const cross = {
        x: v1.y * ortho.z - v1.z * ortho.y,
        y: v1.z * ortho.x - v1.x * ortho.z,
        z: v1.x * ortho.y - v1.y * ortho.x
      };
      const len = Math.sqrt(cross.x * cross.x + cross.y * cross.y + cross.z * cross.z);
      return { x: cross.x / len, y: cross.y / len, z: cross.z / len };
    }

    const theta = Math.acos(dot);
    const sinTheta = Math.sin(theta);

    const s1 = Math.sin((1.0 - t) * theta) / sinTheta;
    const s2 = Math.sin(t * theta) / sinTheta;

    const res = {
      x: s1 * v1.x + s2 * v2.x,
      y: s1 * v1.y + s2 * v2.y,
      z: s1 * v1.z + s2 * v2.z
    };
    const len = Math.sqrt(res.x * res.x + res.y * res.y + res.z * res.z);
    return { x: res.x / len, y: res.y / len, z: res.z / len };
  }
}
