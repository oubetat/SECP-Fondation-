/**
 * SECP CAD Kernel — Continuity Repair Engine
 * PATCH-205: Phase 18 — Professional Modeling
 *
 * Measures and enforces G0 (Position), G1 (Tangency), and G2 (Curvature)
 * continuity between adjacent surfaces.
 */

import { Point, Vector } from '../../../cad-kernel/geometry/GeometryContracts';
import { NURBSSurfaceData } from '../../nurbs/NURBSTypes';
import { NURBSEngine } from '../../nurbs/NURBSEngine';

export interface ContinuityReport {
  g0MaxDistance: number;
  g0Passed: boolean;
  g1MaxAngularDevDeg: number;
  g1Passed: boolean;
  g2MaxCurvatureDelta: number;
  g2Passed: boolean;
  overallContinuity: 'G0' | 'G1' | 'G2' | 'DISCONTINUOUS';
}

export class ContinuityRepairEngine {
  /**
   * Measure G0, G1, and G2 continuity along shared boundary between Surface A and Surface B
   */
  public static measureContinuity(
    surfA: NURBSSurfaceData,
    surfB: NURBSSurfaceData,
    samplesCount: number = 7,
    toleranceG0: number = 1e-3,
    toleranceG1Deg: number = 2.0, // 2 degrees max tangent deviation
    toleranceG2: number = 0.1 // curvature delta
  ): ContinuityReport {
    let maxG0 = 0;
    let maxG1Deg = 0;
    let maxG2 = 0;

    for (let k = 0; k < samplesCount; k++) {
      const u = k / (samplesCount - 1);

      const pA = NURBSEngine.evaluateSurfacePoint(surfA, u, 1.0);
      const pB0 = NURBSEngine.evaluateSurfacePoint(surfB, u, 0.0);
      const pB1 = NURBSEngine.evaluateSurfacePoint(surfB, u, 1.0);

      const dB0 = Math.sqrt((pA.x - pB0.x) ** 2 + (pA.y - pB0.y) ** 2 + (pA.z - pB0.z) ** 2);
      const dB1 = Math.sqrt((pA.x - pB1.x) ** 2 + (pA.y - pB1.y) ** 2 + (pA.z - pB1.z) ** 2);

      const vB = dB0 <= dB1 ? 0.0 : 1.0;
      const pB = dB0 <= dB1 ? pB0 : pB1;

      // G0 distance
      const g0Dist = Math.min(dB0, dB1);
      if (g0Dist > maxG0) maxG0 = g0Dist;

      // G1 tangency
      const normA = NURBSEngine.evaluateNormal(surfA, u, 1.0);
      const normB = NURBSEngine.evaluateNormal(surfB, u, vB);

      const dot = Math.max(-1, Math.min(1, normA.x * normB.x + normA.y * normB.y + normA.z * normB.z));
      const angRad = Math.acos(Math.abs(dot));
      const angDeg = (angRad * 180) / Math.PI;
      if (angDeg > maxG1Deg) maxG1Deg = angDeg;

      // G2 curvature
      const curvA = NURBSEngine.analyzeCurvature(surfA, u, 1.0);
      const curvB = NURBSEngine.analyzeCurvature(surfB, u, vB);
      const deltaK = Math.abs(curvA.meanCurvature - curvB.meanCurvature);
      if (deltaK > maxG2) maxG2 = deltaK;
    }

    const g0Passed = maxG0 <= toleranceG0;
    const g1Passed = g0Passed && maxG1Deg <= toleranceG1Deg;
    const g2Passed = g1Passed && maxG2 <= toleranceG2;

    let overall: 'G0' | 'G1' | 'G2' | 'DISCONTINUOUS' = 'DISCONTINUOUS';
    if (g2Passed) overall = 'G2';
    else if (g1Passed) overall = 'G1';
    else if (g0Passed) overall = 'G0';

    return {
      g0MaxDistance: maxG0,
      g0Passed,
      g1MaxAngularDevDeg: maxG1Deg,
      g1Passed,
      g2MaxCurvatureDelta: maxG2,
      g2Passed,
      overallContinuity: overall
    };
  }

  /**
   * Enforce target continuity (G0, G1, or G2) by adjusting surface B's control points near shared boundary
   */
  public static enforceContinuity(
    surfA: NURBSSurfaceData,
    surfB: NURBSSurfaceData,
    targetContinuity: 'G0' | 'G1' | 'G2',
    tolerance: number = 1e-3
  ): {
    repairedSurfB: NURBSSurfaceData;
    postReport: ContinuityReport;
    success: boolean;
  } {
    const cptsA = surfA.controlPoints;
    const cptsB = surfB.controlPoints.map(row => row.map(p => ({ ...p })));

    const numU = Math.min(cptsA.length, cptsB.length);

    // 1. Enforce G0: Translate Surface B so its v=0 boundary snaps to Surface A's v=1 boundary
    for (let i = 0; i < numU; i++) {
      const ptA = cptsA[i][cptsA[0].length - 1];
      const ptB0 = cptsB[i][0];
      const dx = ptA.x - ptB0.x;
      const dy = ptA.y - ptB0.y;
      const dz = ptA.z - ptB0.z;

      for (let j = 0; j < cptsB[i].length; j++) {
        cptsB[i][j].x += dx;
        cptsB[i][j].y += dy;
        cptsB[i][j].z += dz;
      }
    }

    // 2. Enforce G1: Adjust inner rows of B along tanA extension outward
    if (targetContinuity === 'G1' || targetContinuity === 'G2') {
      for (let i = 0; i < numU; i++) {
        const ptA0 = cptsA[i][cptsA[0].length - 2];
        const ptA1 = cptsA[i][cptsA[0].length - 1];

        // Tangent vector extending out of A
        const tanA = { x: ptA1.x - ptA0.x, y: ptA1.y - ptA0.y, z: ptA1.z - ptA0.z };

        // Align 1st inner row of B
        cptsB[i][1] = {
          x: ptA1.x + tanA.x,
          y: ptA1.y + tanA.y,
          z: ptA1.z + tanA.z
        };

        // Align remaining rows of B outward
        for (let j = 2; j < cptsB[i].length; j++) {
          cptsB[i][j] = {
            x: cptsB[i][1].x + (j - 1) * tanA.x,
            y: cptsB[i][1].y + (j - 1) * tanA.y,
            z: cptsB[i][1].z + (j - 1) * tanA.z
          };
        }
      }
    }

    // 3. Enforce G2: Adjust 2nd inner row of B (v=2) to match second derivative / curvature
    if (targetContinuity === 'G2' && cptsB[0].length >= 3 && cptsA[0].length >= 3) {
      for (let i = 0; i < numU; i++) {
        const ptA0 = cptsA[i][cptsA[0].length - 3];
        const ptA1 = cptsA[i][cptsA[0].length - 2];
        const ptA2 = cptsA[i][cptsA[0].length - 1];

        const d2A = {
          x: ptA2.x - 2 * ptA1.x + ptA0.x,
          y: ptA2.y - 2 * ptA1.y + ptA0.y,
          z: ptA2.z - 2 * ptA1.z + ptA0.z
        };

        const ptB0 = cptsB[i][0];
        const ptB1 = cptsB[i][1];

        cptsB[i][2] = {
          x: 2 * ptB1.x - ptB0.x + d2A.x,
          y: 2 * ptB1.y - ptB0.y + d2A.y,
          z: 2 * ptB1.z - ptB0.z + d2A.z
        };
      }
    }

    const repairedSurfB: NURBSSurfaceData = {
      ...surfB,
      controlPoints: cptsB
    };

    const postReport = this.measureContinuity(surfA, repairedSurfB, 7, tolerance);

    const success =
      targetContinuity === 'G0' ? postReport.g0Passed :
      targetContinuity === 'G1' ? postReport.g1Passed : postReport.g2Passed;

    return {
      repairedSurfB,
      postReport,
      success
    };
  }
}
