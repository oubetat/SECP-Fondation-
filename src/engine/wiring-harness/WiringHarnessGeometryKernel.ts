/**
 * SECP Wiring Harness 3D Geometry Kernel (Phase 3)
 * Handles route waypoint calculations, path lengths, bend radius validation,
 * spatial clearances, and chassis/component clash detection.
 */

import { WiringHarnessCanonicalModel, RouteWaypoint, Vector3d } from './WiringHarnessCanonicalModel';

export interface ClearanceViolation {
  routeId: string;
  distanceMm: number;
  minRequiredMm: number;
  description: string;
}

export interface BendRadiusViolation {
  routeId: string;
  actualRadiusMm: number;
  minAllowedRadiusMm: number;
  description: string;
}

export interface ClashViolation {
  routeId: string;
  obstacleId: string;
  description: string;
}

export class WiringHarnessGeometryKernel {
  /**
  * Calculates total length of a waypoint path in 3D Euclidean space
  */
  public static calculatePathLengthMm(waypoints: RouteWaypoint[]): number {
    if (waypoints.length < 2) return 0.0;
    let totalLength = 0.0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const p1 = waypoints[i];
      const p2 = waypoints[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dz = p2.z - p1.z;
      totalLength += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    return Math.round(totalLength * 100) / 100;
  }

  /**
  * Estimates bend radius at corners in a route waypoint path
  */
  public static evaluateBendRadius(
    waypoints: RouteWaypoint[],
    minAllowedRadiusMm: number
  ): { valid: boolean; violations: BendRadiusViolation[] } {
    const violations: BendRadiusViolation[] = [];
    if (waypoints.length < 3) return { valid: true, violations: [] };

    for (let i = 1; i < waypoints.length - 1; i++) {
      const pPrev = waypoints[i - 1];
      const pCurr = waypoints[i];
      const pNext = waypoints[i + 1];

      // Approximate corner radius via segment vector dot product or angle
      const v1x = pCurr.x - pPrev.x;
      const v1y = pCurr.y - pPrev.y;
      const v1z = pCurr.z - pPrev.z;
      const v2x = pNext.x - pCurr.x;
      const v2y = pNext.y - pCurr.y;
      const v2z = pNext.z - pCurr.z;

      const len1 = Math.sqrt(v1x * v1x + v1y * v1y + v1z * v1z);
      const len2 = Math.sqrt(v2x * v2x + v2y * v2y + v2z * v2z);

      if (len1 === 0 || len2 === 0) continue;

      const dot = (v1x * v2x + v1y * v2y + v1z * v2z) / (len1 * len2);
      const angleRad = Math.acos(Math.max(-1, Math.min(1, dot)));
      // If angle is sharp, estimate effective bend radius
      const estRadius = angleRad > 0.5 ? Math.min(len1, len2) * 0.25 : minAllowedRadiusMm * 2;

      if (estRadius < minAllowedRadiusMm) {
        violations.push({
          routeId: `route_at_waypoint_${i}`,
          actualRadiusMm: Math.round(estRadius * 100) / 100,
          minAllowedRadiusMm,
          description: `Sharp bend at waypoint ${i} has estimated radius ${estRadius}mm which is below minimum ${minAllowedRadiusMm}mm`
        });
      }
    }

    return {
      valid: violations.length === 0,
      violations
    };
  }

  /**
  * Detects clashes between harness routes and obstacles / chassis bounding boxes
  */
  public static detectCllashes(
    model: WiringHarnessCanonicalModel,
    obstacles: Array<{ id: string; min: Vector3d; max: Vector3d }>
  ): { valid: boolean; clashes: ClashViolation[] } {
    const clashes: ClashViolation[] = [];

    for (const route of model.routes) {
      for (const wp of route.waypoints) {
        for (const obs of obstacles) {
          if (
            wp.x >= obs.min.x && wp.x <= obs.max.x &&
            wp.y >= obs.min.y && wp.y <= obs.max.y &&
            wp.z >= obs.min.z && wp.z <= obs.max.z
          ) {
            clashes.push({
              routeId: route.id,
              obstacleId: obs.id,
              description: `Route ${route.id} waypoint (${wp.x}, ${wp.y}, ${wp.z}) clashes with obstacle ${obs.id}`
            });
          }
        }
      }
    }

    return {
      valid: clashes.length === 0,
      clashes
    };
  }
}
