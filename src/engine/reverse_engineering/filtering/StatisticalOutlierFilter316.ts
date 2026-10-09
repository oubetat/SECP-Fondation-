/**
 * PHASE 29 — REVERSE ENGINEERING
 * PATCH-316 — Statistical Outlier Removal (SOR) Filter
 * 
 * MATH & ALGORITHM:
 * 1. For each point p_i, compute the distance to all other points p_j (j != i).
 * 2. Sort the distances and take the mean of the nearest k neighbors (d_i).
 * 3. Compute the global mean (μ) of these average distances:
 *    μ = (1/N) * Σ(d_i)
 * 4. Compute the global standard deviation (σ):
 *    σ = sqrt( (1/N) * Σ(d_i - μ)^2 )
 * 5. Define standard threshold T = μ + α·σ (where α is stdDevMultiplier).
 * 6. Define conservative threshold Tc = μ + (α * 1.5)·σ.
 * 7. Classify points:
 *    - d_i <= T: KEEP
 *    - T < d_i <= Tc: UNCERTAIN
 *    - d_i > Tc: REMOVE
 * 8. If conservativeMode is active, UNCERTAIN points are preserved (KEEP).
 *    Otherwise, they are removed.
 */

import { Point3D } from '../point_cloud/PointCloudTypes315';
import { PointCloudFilterSettings, OutlierMask } from './PointCloudFilterTypes316';

export interface SORFilterExecutionResult {
  outlierMasks: OutlierMask[];
  retainedPoints: Point3D[];
  removedPoints: Point3D[];
  globalMeanDistanceMm: number;
  globalStdDevMm: number;
}

export class StatisticalOutlierFilter316 {
  public static process(
    points: Point3D[],
    settings: PointCloudFilterSettings
  ): SORFilterExecutionResult {
    const kNeighbors = settings.kNeighbors && settings.kNeighbors > 0 ? settings.kNeighbors : 20;
    const alpha = settings.stdDevMultiplier !== undefined && settings.stdDevMultiplier > 0 ? settings.stdDevMultiplier : 2.0;
    const conservative = settings.conservativeMode !== false;

    const n = points.length;

    if (n === 0) {
      return {
        outlierMasks: [],
        retainedPoints: [],
        removedPoints: [],
        globalMeanDistanceMm: 0,
        globalStdDevMm: 0
      };
    }

    if (n === 1) {
      return {
        retainedPoints: [...points],
        removedPoints: [],
        outlierMasks: [{
          pointIndex: 0,
          classification: 'KEEP',
          noiseScore: 0.0,
          reason: 'SINGLE_POINT_DATASET',
          metricValue: 0
        }],
        globalMeanDistanceMm: 0,
        globalStdDevMm: 0
      };
    }

    // Determine the actual number of neighbors to query
    // Official Contract: effectiveK = min(requestedK, N - 1) to bound the density window
    const k = Math.min(kNeighbors, n - 1);

    const meanNeighborDistances: number[] = new Array(n).fill(0);

    // 1. Calculate KNN distances for each point
    for (let i = 0; i < n; i++) {
      const pi = points[i];
      const distances: number[] = [];

      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const pj = points[j];
        const dx = pi.x - pj.x;
        const dy = pi.y - pj.y;
        const dz = pi.z - pj.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        distances.push(dist);
      }

      // Sort distances ascending
      distances.sort((a, b) => a - b);

      // Select top k neighbors and calculate mean distance
      const kDists = distances.slice(0, k);
      const sum = kDists.reduce((acc, d) => acc + d, 0);
      meanNeighborDistances[i] = kDists.length > 0 ? sum / kDists.length : 0;
    }

    // 2. Compute global mean (μ)
    const totalMeanSum = meanNeighborDistances.reduce((acc, d) => acc + d, 0);
    const globalMeanDistanceMm = totalMeanSum / n;

    // 3. Compute global standard deviation (σ)
    let varianceSum = 0;
    for (let i = 0; i < n; i++) {
      const diff = meanNeighborDistances[i] - globalMeanDistanceMm;
      varianceSum += diff * diff;
    }
    const globalStdDevMm = Math.sqrt(varianceSum / n);

    // 4. Calculate Thresholds
    const threshold = globalMeanDistanceMm + alpha * globalStdDevMm;
    const thresholdConservative = globalMeanDistanceMm + (alpha * 1.5) * globalStdDevMm;

    // 5. Classify Points & Assign Noise Scores
    const outlierMasks: OutlierMask[] = [];
    const retainedPoints: Point3D[] = [];
    const removedPoints: Point3D[] = [];

    for (let i = 0; i < n; i++) {
      const di = meanNeighborDistances[i];
      const p = points[i];

      let classification: 'KEEP' | 'REMOVE' | 'UNCERTAIN' = 'KEEP';
      let noiseScore = 0.0;
      let reason = 'INLIER_REGULAR';

      if (di > threshold) {
        if (di <= thresholdConservative) {
          classification = 'UNCERTAIN';
          reason = `BORDERLINE_STATISTICAL_OUTLIER (Mean neighbor distance ${di.toFixed(4)}mm > Threshold ${threshold.toFixed(4)}mm)`;
          const divisor = (thresholdConservative - threshold) || 1e-6;
          noiseScore = 0.5 + 0.3 * ((di - threshold) / divisor);
        } else {
          classification = 'REMOVE';
          reason = `SIGNIFICANT_STATISTICAL_OUTLIER (Mean neighbor distance ${di.toFixed(4)}mm > Conservative Threshold ${thresholdConservative.toFixed(4)}mm)`;
          const divisor = thresholdConservative || 1e-6;
          noiseScore = Math.min(1.0, 0.8 + 0.2 * ((di - thresholdConservative) / divisor));
        }
      } else {
        const divisor = threshold || 1e-6;
        noiseScore = 0.5 * (di / divisor);
      }

      // Respect Conservative Mode
      let finalDecision = classification;
      if (conservative && classification === 'UNCERTAIN') {
        finalDecision = 'KEEP';
        reason = `BORDERLINE_STATISTICAL_OUTLIER_RETAINED (Conservative mode active)`;
      }

      outlierMasks.push({
        pointIndex: i,
        classification,
        noiseScore: parseFloat(noiseScore.toFixed(4)),
        reason,
        metricValue: parseFloat(di.toFixed(4))
      });

      if (finalDecision === 'KEEP') {
        retainedPoints.push(p);
      } else {
        removedPoints.push(p);
      }
    }

    return {
      outlierMasks,
      retainedPoints,
      removedPoints,
      globalMeanDistanceMm: parseFloat(globalMeanDistanceMm.toFixed(4)),
      globalStdDevMm: parseFloat(globalStdDevMm.toFixed(4))
    };
  }
}
