/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-259 — Gouge & Overcut Detection on Protected Geometries
 */

import { Vector3D } from '../../cadKernel';
import {
  CollisionTolerance,
  ProtectedGeometryModel,
  ToolGeometry,
  ToolPose,
  Triangle3D
} from './CollisionTypes';
import { CollisionMathUtils } from './CollisionMathUtils';

export interface GougeResult {
  isGouge: boolean;
  overcutDepthMm: number;
  surfaceId: string;
  faceId?: string;
  contactPoint: Vector3D;
  surfaceNormal: Vector3D;
  description: string;
}

export class GougeDetector {
  public static checkGouge(
    pose: ToolPose,
    tool: ToolGeometry,
    protectedModel: ProtectedGeometryModel,
    triangles: Triangle3D[],
    tolerances: CollisionTolerance
  ): GougeResult | null {
    if (!protectedModel.protectedSurfaces || protectedModel.protectedSurfaces.length === 0) {
      return null;
    }

    const cutterPt = pose.tcp;

    for (const surface of protectedModel.protectedSurfaces) {
      if (surface.isMachinable) continue;

      const reqClearance = surface.requiredClearanceMm || 0;
      const matchingTris = triangles.filter(
        t => t.faceId === surface.faceId || t.faceId === surface.surfaceId || (surface.faceId === undefined)
      );

      for (const tri of matchingTris) {
        const res = CollisionMathUtils.closestPointOnTriangle(cutterPt, tri);
        const clearance = res.distance;

        if (clearance < reqClearance) {
          const overcut = reqClearance - clearance;
          return {
            isGouge: true,
            overcutDepthMm: overcut,
            surfaceId: surface.surfaceId,
            faceId: surface.faceId,
            contactPoint: res.point,
            surfaceNormal: tri.normal,
            description: `Gouge violation on non-machinable protected surface ${surface.surfaceName || surface.surfaceId}: clearance ${clearance.toFixed(3)}mm < required ${reqClearance.toFixed(3)}mm (overcut ${overcut.toFixed(3)}mm)`
          };
        }
      }
    }

    return null;
  }
}
