/**
 * PHASE 29 — REVERSE ENGINEERING
 * PATCH-316 — Radius Outlier Removal Filter
 * 
 * MATH & ALGORITHM:
 * 1. For each point p_i, count how many neighboring points exist within distance searchRadiusMm (R).
 * 2. If neighbor count < minNeighbors (N), point is classified as REMOVE or UNCERTAIN.
 * 3. Enforces Explicit Parameter Validation (Rule 16 & 44).
 * 4. Respects Conservative Filtering (Rule 24).
 */

import { Point3D } from '../point_cloud/PointCloudTypes315';
import { OutlierMask, PointCloudFilterSettings } from './PointCloudFilterTypes316';

export interface RadiusFilterExecutionResult {
  outlierMasks: OutlierMask[];
  retainedPoints: Point3D[];
  removedPoints: Point3D[];
  averageNeighborsPerPoint: number;
}

export class RadiusOutlierFilter316 {
  public static process(
    points: Point3D[],
    settings: PointCloudFilterSettings
  ): RadiusFilterExecutionResult {
    const radiusMm = settings.searchRadiusMm && settings.searchRadiusMm > 0 ? settings.searchRadiusMm : 5.0;
    const minNeighbors = settings.minNeighbors && settings.minNeighbors > 0 ? settings.minNeighbors : 6;
    const conservative = settings.conservativeMode !== false;

    if (points.length === 0) {
      return {
        outlierMasks: [],
        retainedPoints: [],
        removedPoints: [],
        averageNeighborsPerPoint: 0
      };
    }

    const n = points.length;
    const neighborCounts: number[] = new Array(n).fill(0);

    // 1. Compute neighbor counts within radius searchRadiusMm
    for (let i = 0; i < n; i++) {
      const pi = points[i];
      let count = 0;

      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const pj = points[j];
        const dx = pi.x - pj.x;
        const dy = pi.y - pj.y;
        const dz = pi.z - pj.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist <= radiusMm) {
          count++;
        }
      }
      neighborCounts[i] = count;
    }

    const totalNeighbors = neighborCounts.reduce((acc, c) => acc + c, 0);
    const averageNeighborsPerPoint = totalNeighbors / n;

    // 2. Classify Points
    const outlierMasks: OutlierMask[] = [];
    const retainedPoints: Point3D[] = [];
    const removedPoints: Point3D[] = [];

    for (let i = 0; i < n; i++) {
      const count = neighborCounts[i];
      const p = points[i];

      let classification: 'KEEP' | 'REMOVE' | 'UNCERTAIN' = 'KEEP';
      let noiseScore = 0.0;
      let reason = 'SUFFICIENT_RADIUS_DENSITY';

      if (count < minNeighbors) {
        noiseScore = Math.min(1.0, 1.0 - (count / (minNeighbors + 1e-6)));

        if (count <= Math.floor(minNeighbors / 2)) {
          classification = 'REMOVE';
          reason = `ISOLATED_RADIUS_OUTLIER (${count} neighbors within ${radiusMm}mm < Min required ${minNeighbors})`;
        } else {
          classification = 'UNCERTAIN';
          reason = `LOW_RADIUS_DENSITY (${count} neighbors within ${radiusMm}mm < Min required ${minNeighbors})`;
        }
      }

      let finalDecision = classification;
      if (conservative && classification === 'UNCERTAIN') {
        finalDecision = 'KEEP';
      }

      outlierMasks.push({
        pointIndex: i,
        classification,
        noiseScore: parseFloat(noiseScore.toFixed(4)),
        reason,
        metricValue: count
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
      averageNeighborsPerPoint: parseFloat(averageNeighborsPerPoint.toFixed(2))
    };
  }
}
