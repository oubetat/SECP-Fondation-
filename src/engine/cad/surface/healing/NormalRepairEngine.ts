/**
 * SECP CAD Kernel — Normal Repair Engine
 * PATCH-205: Phase 18 — Professional Modeling
 *
 * Detects normal orientation defects and unifies orientation across faces in a shell.
 */

import { Point, Vector } from '../../../cad-kernel/geometry/GeometryContracts';
import { NURBSSurfaceData } from '../../nurbs/NURBSTypes';
import { NURBSEngine } from '../../nurbs/NURBSEngine';

export class NormalRepairEngine {
  /**
   * Reverse normal orientation of a NURBS surface by swapping control point U grid
   */
  public static reverseNormal(surfaceData: NURBSSurfaceData): NURBSSurfaceData {
    const cpts = surfaceData.controlPoints.map(row => [...row]).reverse();
    const knotsU = [...surfaceData.knotsU].reverse().map(k => 1.0 - k);

    return {
      ...surfaceData,
      controlPoints: cpts,
      knotsU
    };
  }

  /**
   * Unify normal orientations between reference surface A and target surface B
   */
  public static unifyOrientations(
    refSurf: NURBSSurfaceData,
    targetSurf: NURBSSurfaceData
  ): {
    orientedTarget: NURBSSurfaceData;
    wasReversed: boolean;
  } {
    const normRef = NURBSEngine.evaluateNormal(refSurf, 0.5, 0.5);
    const normTarget = NURBSEngine.evaluateNormal(targetSurf, 0.5, 0.5);

    const dot = normRef.x * normTarget.x + normRef.y * normTarget.y + normRef.z * normTarget.z;

    if (dot < 0) {
      // Inverted normal detected -> reverse target surface
      const reversed = this.reverseNormal(targetSurf);
      return {
        orientedTarget: reversed,
        wasReversed: true
      };
    }

    return {
      orientedTarget: targetSurf,
      wasReversed: false
    };
  }

  /**
   * Check if face normals across shell faces are consistent
   */
  public static checkFaceOrientationConsistency(surfaces: NURBSSurfaceData[]): {
    isConsistent: boolean;
    invertedIndices: number[];
  } {
    if (surfaces.length <= 1) {
      return { isConsistent: true, invertedIndices: [] };
    }

    const refNorm = NURBSEngine.evaluateNormal(surfaces[0], 0.5, 0.5);
    const inverted: number[] = [];

    for (let i = 1; i < surfaces.length; i++) {
      const norm = NURBSEngine.evaluateNormal(surfaces[i], 0.5, 0.5);
      const dot = refNorm.x * norm.x + refNorm.y * norm.y + refNorm.z * norm.z;
      if (dot < -0.1) {
        inverted.push(i);
      }
    }

    return {
      isConsistent: inverted.length === 0,
      invertedIndices: inverted
    };
  }
}
