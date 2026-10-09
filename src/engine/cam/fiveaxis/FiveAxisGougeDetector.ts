/**
 * SECP Industrial OS v3 — PATCH-179: 5-Axis Gouge & Overcut Detection Engine
 * Validates toolpath against target B-Rep surfaces, computing surface curvature
 * compatibility, tool-tip gouges, edge gouging, and local tolerance compliance.
 */

import { Vector3D } from '../../cadKernel';
import { 
  FiveAxisToolDefinition, 
  GougeClassification, 
  GougeEvent 
} from './FiveAxisTypes';

export interface TargetSurfacePatch {
  surfaceId: string;
  name: string;
  type: 'PLANE' | 'CYLINDER' | 'TORUS' | 'FREEFORM_NURBS' | 'BLADE_AIRFOIL';
  toleranceBandMm: number; // e.g. 0.010 mm
  minConcaveRadiusMm: number; // Minimum radius of curvature on the patch
}

export class FiveAxisGougeDetector {
  /**
   * Evaluates gouge conditions for a cutter location point against target B-Rep geometry
   */
  public static checkPointGouge(
    tool: FiveAxisToolDefinition,
    tcpPosition: Vector3D,
    toolAxis: Vector3D,
    contactPoint: Vector3D,
    surfaceNormal: Vector3D,
    surfacePatch: TargetSurfacePatch,
    pointIndex: number
  ): { isGougeFree: boolean; gougeEvent?: GougeEvent; gougeMarginMm: number } {
    const allowedTol = surfacePatch.toleranceBandMm || 0.015;

    // 1. Curvature Gouge Check: If concave curvature radius < tool effective cutting radius
    const effRadius = tool.type === 'BALL_NOSE' || tool.type === 'TAPER_BALL'
      ? tool.diameterMm / 2
      : (tool.type === 'BULL_NOSE' ? tool.cornerRadMm : tool.diameterMm / 2);

    if (surfacePatch.minConcaveRadiusMm > 0 && effRadius > surfacePatch.minConcaveRadiusMm + 1e-4) {
      const overcutDepth = effRadius - surfacePatch.minConcaveRadiusMm;
      if (overcutDepth > allowedTol) {
        return {
          isGougeFree: false,
          gougeEvent: {
            pointIndex,
            type: 'SURFACE_OVERCUT',
            contactPoint,
            targetPoint: contactPoint,
            gougeDepthMm: Number(overcutDepth.toFixed(4)),
            allowedToleranceMm: allowedTol,
            affectedSurfaceId: surfacePatch.surfaceId
          },
          gougeMarginMm: -overcutDepth
        };
      }
    }

    // 2. Tool-Tip / Flat Cutter Gouge Check (ensuring cutter bottom does not penetrate surface)
    if (tool.type === 'FLAT_ENDMILL') {
      const dot = Math.abs(toolAxis.x * surfaceNormal.x + toolAxis.y * surfaceNormal.y + toolAxis.z * surfaceNormal.z);
      // If flat endmill is tilted, bottom circular perimeter might gouge into surface
      if (dot < 0.999 && dot > 0.0) {
        const tiltAngle = Math.acos(Math.max(-1, Math.min(1, dot)));
        const tipGougeDepth = (tool.diameterMm / 2) * Math.sin(tiltAngle) * (1 - Math.cos(tiltAngle));
        if (tipGougeDepth > allowedTol) {
          return {
            isGougeFree: false,
            gougeEvent: {
              pointIndex,
              type: 'TOOL_TIP_GOUGE',
              contactPoint,
              targetPoint: contactPoint,
              gougeDepthMm: Number(tipGougeDepth.toFixed(4)),
              allowedToleranceMm: allowedTol,
              affectedSurfaceId: surfacePatch.surfaceId
            },
            gougeMarginMm: -tipGougeDepth
          };
        }
      }
    }

    // 3. Contact Point vs TCP Geometric Consistency
    const distToCC = Math.hypot(
      tcpPosition.x - contactPoint.x,
      tcpPosition.y - contactPoint.y,
      tcpPosition.z - contactPoint.z
    );

    // Ballnose TCP to CC distance must equal tool radius
    if (tool.type === 'BALL_NOSE') {
      const expectedRadius = tool.diameterMm / 2;
      const deviation = Math.abs(distToCC - expectedRadius);
      if (deviation > allowedTol * 2) {
        return {
          isGougeFree: false,
          gougeEvent: {
            pointIndex,
            type: 'SURFACE_OVERCUT',
            contactPoint,
            targetPoint: contactPoint,
            gougeDepthMm: Number(deviation.toFixed(4)),
            allowedToleranceMm: allowedTol,
            affectedSurfaceId: surfacePatch.surfaceId
          },
          gougeMarginMm: -deviation
        };
      }
    }

    // Safe margin
    const safeMargin = Math.max(0.05, allowedTol * 3);
    return {
      isGougeFree: true,
      gougeMarginMm: Number(safeMargin.toFixed(4))
    };
  }
}
