/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-258 — Tool Orientation Solver & Cutter Contact (CC) Offset Engine
 * Computes Exact Tool Vectors from Surface Normals, Feed Tangents, Lead/Tilt Angles,
 * and offsets Cutter Contact Point (CC) -> Tool Center Point (TCP) -> Tool Tip.
 */

import { Vector3D } from '../../cadKernel';
import { SurfaceOrientationControl, ToolCenterPoint, ToolOrientationVector } from './FiveAxisTypes';
import { FiveAxisMathUtils } from './FiveAxisMathUtils';

export type ToolGeometryType = 
  | 'BALL_ENDMILL' 
  | 'BULLNOSE_TOROIDAL' 
  | 'FLAT_ENDMILL' 
  | 'BARREL_TANGENT' 
  | 'LOLLIPOP';

export class ToolOrientationSolver {
  /**
   * Calculates the normalized Tool Axis Vector [Tx, Ty, Tz] from Surface Normal, Feed Direction,
   * Lead Angle (deg), and Tilt Angle (deg).
   */
  public static computeToolAxisVector(control: SurfaceOrientationControl): ToolOrientationVector {
    const N = FiveAxisMathUtils.normalize(control.surfaceNormal);
    let V = FiveAxisMathUtils.normalize(control.feedTangentVector);

    // If tangent is parallel to normal, choose a stable reference
    if (Math.abs(FiveAxisMathUtils.dot(V, N)) > 0.999) {
      const ref = Math.abs(N.x) > 0.5 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
      V = FiveAxisMathUtils.normalize(FiveAxisMathUtils.cross(N, ref));
    }

    // Binormal (Sideways / Cross-feed axis): B = V x N
    const B = FiveAxisMathUtils.normalize(FiveAxisMathUtils.cross(V, N));
    // Re-orthogonalize feed tangent: V_ortho = N x B
    const V_ortho = FiveAxisMathUtils.normalize(FiveAxisMathUtils.cross(B, N));

    const leadRad = control.leadAngleDeg * FiveAxisMathUtils.DEG2RAD;
    const tiltRad = control.tiltAngleDeg * FiveAxisMathUtils.DEG2RAD;

    // 1. Lead rotation: rotate Normal vector N towards feed tangent V_ortho by angle alpha (around B)
    const vecAfterLead = FiveAxisMathUtils.rotateVectorAxis(N, B, -leadRad);

    // 2. Tilt rotation: rotate resultant around V_ortho by tilt angle beta
    const finalToolVec = FiveAxisMathUtils.rotateVectorAxis(vecAfterLead, V_ortho, tiltRad);

    return FiveAxisMathUtils.toOrientationVector(finalToolVec);
  }

  /**
   * Converts Cutter Contact (CC) Point to Tool Center Point (TCP) and Tool Tip
   * based on tool geometry (Ball, Bullnose, Flat, Barrel).
   */
  public static computeToolCenterPoint(
    ccPoint: Vector3D,
    surfaceNormal: Vector3D,
    toolVector: Vector3D | ToolOrientationVector,
    toolType: ToolGeometryType,
    toolRadiusMm: number,
    cornerRadMm: number = 0
  ): ToolCenterPoint {
    const N = FiveAxisMathUtils.normalize(surfaceNormal);
    const T = FiveAxisMathUtils.normalize(toolVector);

    let tcp: Vector3D;
    let toolTip: Vector3D;

    if (toolType === 'BALL_ENDMILL') {
      // For ball endmill: TCP is the sphere center: TCP = CC + R * N
      tcp = FiveAxisMathUtils.add(ccPoint, FiveAxisMathUtils.scale(N, toolRadiusMm));
      // Tool tip is sphere bottom along tool axis: Tip = TCP - R * T
      toolTip = FiveAxisMathUtils.subtract(tcp, FiveAxisMathUtils.scale(T, toolRadiusMm));
    } else if (toolType === 'FLAT_ENDMILL') {
      // For flat endmill: Contact is at the bottom perimeter
      // TCP is bottom center: CC offset towards tool axis
      const cosAngle = FiveAxisMathUtils.dot(N, T);
      const radOffset = toolRadiusMm;
      const normalProjected = FiveAxisMathUtils.normalize(FiveAxisMathUtils.subtract(N, FiveAxisMathUtils.scale(T, cosAngle)));
      tcp = FiveAxisMathUtils.add(ccPoint, FiveAxisMathUtils.scale(normalProjected, radOffset));
      toolTip = tcp;
    } else if (toolType === 'BULLNOSE_TOROIDAL') {
      // Toroidal cutter: offset by corner radius rc along normal, and (R - rc) in radial direction
      const rc = Math.min(cornerRadMm, toolRadiusMm);
      const rMajor = toolRadiusMm - rc;
      const cosAngle = FiveAxisMathUtils.dot(N, T);
      const normalProjected = FiveAxisMathUtils.normalize(FiveAxisMathUtils.subtract(N, FiveAxisMathUtils.scale(T, cosAngle)));
      
      const torusCenter = FiveAxisMathUtils.add(ccPoint, FiveAxisMathUtils.scale(N, rc));
      tcp = FiveAxisMathUtils.add(torusCenter, FiveAxisMathUtils.scale(normalProjected, rMajor));
      toolTip = FiveAxisMathUtils.subtract(tcp, FiveAxisMathUtils.scale(T, rc));
    } else {
      // Generic ball / default
      tcp = FiveAxisMathUtils.add(ccPoint, FiveAxisMathUtils.scale(N, toolRadiusMm));
      toolTip = FiveAxisMathUtils.subtract(tcp, FiveAxisMathUtils.scale(T, toolRadiusMm));
    }

    return {
      position: {
        x: Number(tcp.x.toFixed(5)),
        y: Number(tcp.y.toFixed(5)),
        z: Number(tcp.z.toFixed(5))
      },
      toolTipPosition: {
        x: Number(toolTip.x.toFixed(5)),
        y: Number(toolTip.y.toFixed(5)),
        z: Number(toolTip.z.toFixed(5))
      },
      cutterContactPoint: ccPoint
    };
  }
}
