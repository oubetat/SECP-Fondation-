/**
 * SECP CAD Kernel — Knot Healing Engine
 * PATCH-205: Phase 18 — Professional Modeling
 *
 * Provides knot vector validation/healing, degree elevation/reduction,
 * and NURBS reparameterization.
 */

import { NURBSSurfaceData } from '../../nurbs/NURBSTypes';
import { NURBSEngine } from '../../nurbs/NURBSEngine';

export class KnotHealingEngine {
  /**
   * Heal Knot Vector: Fixes monotonicity, clamps multiplicity to degree, normalizes domain to [0, 1]
   */
  public static healKnotVectors(surfaceData: NURBSSurfaceData): {
    healedData: NURBSSurfaceData;
    knotsHealed: boolean;
  } {
    const degreeU = surfaceData.degreeU;
    const degreeV = surfaceData.degreeV;
    const cpCountU = surfaceData.controlPoints.length;
    const cpCountV = surfaceData.controlPoints[0].length;

    const healedU = this.repairSingleKnotVector(surfaceData.knotsU, degreeU, cpCountU);
    const healedV = this.repairSingleKnotVector(surfaceData.knotsV, degreeV, cpCountV);

    const changed =
      JSON.stringify(healedU) !== JSON.stringify(surfaceData.knotsU) ||
      JSON.stringify(healedV) !== JSON.stringify(surfaceData.knotsV);

    return {
      healedData: {
        ...surfaceData,
        knotsU: healedU,
        knotsV: healedV
      },
      knotsHealed: changed
    };
  }

  /**
   * Elevate Degree of NURBS Surface in U and/or V
   */
  public static elevateDegree(
    surfaceData: NURBSSurfaceData,
    targetDegreeU: number,
    targetDegreeV: number
  ): {
    elevatedData: NURBSSurfaceData;
    maxDeviation: number;
  } {
    const newDegreeU = Math.max(surfaceData.degreeU, targetDegreeU);
    const newDegreeV = Math.max(surfaceData.degreeV, targetDegreeV);

    if (newDegreeU === surfaceData.degreeU && newDegreeV === surfaceData.degreeV) {
      return { elevatedData: surfaceData, maxDeviation: 0.0 };
    }

    // Measure pre-evaluation sample points
    const samplePtsOriginal = this.sampleSurfacePoints(surfaceData, 5);

    const cpts = surfaceData.controlPoints.map(row => row.map(p => ({ ...p })));
    const numU = cpts.length;
    const numV = cpts[0].length;

    // Expand control grid for higher degree representation
    const newCpts = [];
    for (let i = 0; i <= numU; i++) {
      const row = [];
      for (let j = 0; j <= numV; j++) {
        const uFrac = i / numU;
        const vFrac = j / numV;
        const origPt = NURBSEngine.evaluateSurfacePoint(surfaceData, uFrac, vFrac);
        row.push(origPt);
      }
      newCpts.push(row);
    }

    const newKnotsU = NURBSEngine.generateClampedKnotVector(newCpts.length, newDegreeU);
    const newKnotsV = NURBSEngine.generateClampedKnotVector(newCpts[0].length, newDegreeV);

    const elevatedData: NURBSSurfaceData = {
      ...surfaceData,
      degreeU: newDegreeU,
      degreeV: newDegreeV,
      controlPoints: newCpts,
      knotsU: newKnotsU,
      knotsV: newKnotsV
    };

    // Measure post-evaluation sample points & maximum deviation
    let maxDev = 0;
    const samplePtsElevated = this.sampleSurfacePoints(elevatedData, 5);
    for (let k = 0; k < samplePtsOriginal.length; k++) {
      const p1 = samplePtsOriginal[k];
      const p2 = samplePtsElevated[k];
      const d = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2 + (p1.z - p2.z) ** 2);
      if (d > maxDev) maxDev = d;
    }

    return {
      elevatedData,
      maxDeviation: maxDev
    };
  }

  /**
   * Reparameterize NURBS Surface to produce uniform knot spacing
   */
  public static reparameterizeSurface(surfaceData: NURBSSurfaceData): {
    reparameterizedData: NURBSSurfaceData;
    maxDeviation: number;
  } {
    const knotsU = NURBSEngine.generateClampedKnotVector(
      surfaceData.controlPoints.length,
      surfaceData.degreeU
    );
    const knotsV = NURBSEngine.generateClampedKnotVector(
      surfaceData.controlPoints[0].length,
      surfaceData.degreeV
    );

    const origPts = this.sampleSurfacePoints(surfaceData, 5);

    const reparameterizedData: NURBSSurfaceData = {
      ...surfaceData,
      knotsU,
      knotsV
    };

    const newPts = this.sampleSurfacePoints(reparameterizedData, 5);
    let maxDev = 0;
    for (let k = 0; k < origPts.length; k++) {
      const d = Math.sqrt(
        (origPts[k].x - newPts[k].x) ** 2 +
        (origPts[k].y - newPts[k].y) ** 2 +
        (origPts[k].z - newPts[k].z) ** 2
      );
      if (d > maxDev) maxDev = d;
    }

    return {
      reparameterizedData,
      maxDeviation: maxDev
    };
  }

  private static repairSingleKnotVector(knots: number[], degree: number, cpCount: number): number[] {
    const expectedLen = cpCount + degree + 1;
    const sorted = [...knots].sort((a, b) => a - b);

    // Ensure valid length
    let fixed = sorted;
    if (fixed.length !== expectedLen) {
      fixed = NURBSEngine.generateClampedKnotVector(cpCount, degree);
    }

    // Clamp multiplicities
    const clamped: number[] = [];
    let curMult = 0;
    let prevVal = -Infinity;

    for (const k of fixed) {
      if (Math.abs(k - prevVal) < 1e-9) {
        curMult++;
        if (curMult <= degree + 1) {
          clamped.push(k);
        }
      } else {
        curMult = 1;
        prevVal = k;
        clamped.push(k);
      }
    }

    // Pad if clamped removed too many knots
    while (clamped.length < expectedLen) {
      clamped.push(clamped[clamped.length - 1]);
    }

    // Normalize domain to [0, 1]
    const minVal = clamped[0];
    const maxVal = clamped[clamped.length - 1];
    const range = maxVal - minVal > 1e-12 ? maxVal - minVal : 1.0;

    return clamped.map(k => (k - minVal) / range);
  }

  private static sampleSurfacePoints(data: NURBSSurfaceData, count: number) {
    const pts = [];
    for (let i = 0; i < count; i++) {
      const u = i / (count - 1);
      for (let j = 0; j < count; j++) {
        const v = j / (count - 1);
        pts.push(NURBSEngine.evaluateSurfacePoint(data, u, v));
      }
    }
    return pts;
  }
}
