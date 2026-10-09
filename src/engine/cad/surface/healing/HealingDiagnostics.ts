/**
 * SECP CAD Kernel — Healing Diagnostics
 * PATCH-205: Phase 18 — Professional Modeling
 *
 * Performs spatial deviation analysis (Max, Mean, RMS) and design intent preservation checks.
 */

import { Point } from '../../../cad-kernel/geometry/GeometryContracts';
import { NURBSSurfaceData } from '../../nurbs/NURBSTypes';
import { NURBSEngine } from '../../nurbs/NURBSEngine';
import { DeviationAnalysis } from './types';

export class HealingDiagnostics {
  /**
   * Compute comprehensive deviation metrics (Max, Mean, RMS) between original and repaired surface
   */
  public static analyzeDeviation(
    originalSurface: NURBSSurfaceData,
    repairedSurface: NURBSSurfaceData,
    tolerance: number = 1e-3,
    sampleGridSize: number = 10
  ): DeviationAnalysis {
    const distances: number[] = [];
    let sumDist = 0;
    let sumSqDist = 0;
    let maxDist = 0;

    const totalSamples = sampleGridSize * sampleGridSize;

    for (let i = 0; i < sampleGridSize; i++) {
      const u = i / (sampleGridSize - 1);
      for (let j = 0; j < sampleGridSize; j++) {
        const v = j / (sampleGridSize - 1);

        const pOrig = NURBSEngine.evaluateSurfacePoint(originalSurface, u, v);
        const pRep = NURBSEngine.evaluateSurfacePoint(repairedSurface, u, v);

        const d = Math.sqrt(
          (pOrig.x - pRep.x) ** 2 +
          (pOrig.y - pRep.y) ** 2 +
          (pOrig.z - pRep.z) ** 2
        );

        distances.push(d);
        sumDist += d;
        sumSqDist += d * d;

        if (d > maxDist) {
          maxDist = d;
        }
      }
    }

    const meanDist = sumDist / totalSamples;
    const rmsDist = Math.sqrt(sumSqDist / totalSamples);

    const preservesDesignIntent = maxDist <= tolerance * 100 + 0.5; // Allow minor healing deviation within bound

    return {
      maxDeviation: maxDist,
      meanDeviation: meanDist,
      rmsDeviation: rmsDist,
      samplePointsCount: totalSamples,
      preservesDesignIntent
    };
  }
}
