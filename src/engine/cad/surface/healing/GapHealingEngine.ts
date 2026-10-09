/**
 * SECP CAD Kernel — Gap Healing Engine
 * PATCH-205: Phase 18 — Professional Modeling
 *
 * Implements gap measurement, classification, and auto-healing strategies.
 */

import { Point, Vector } from '../../../cad-kernel/geometry/GeometryContracts';
import { BRepNURBSSurface } from '../../../cad-kernel/geometry/BRepGeometry';
import { NURBSSurfaceData } from '../../nurbs/NURBSTypes';
import { NURBSEngine } from '../../nurbs/NURBSEngine';
import { SurfaceDefectDetector } from './SurfaceDefectDetector';
import { BoundaryRepairEngine } from './BoundaryRepairEngine';
import { GapClassification } from './types';

export interface GapMeasurement {
  distance: number;
  classification: GapClassification;
  locationA: Point;
  locationB: Point;
  boundaryIndexA: number;
  boundaryIndexB: number;
}

export class GapHealingEngine {
  /**
   * Measure precise gap between two surfaces
   */
  public static measureGap(
    surfA: BRepNURBSSurface | NURBSSurfaceData,
    surfB: BRepNURBSSurface | NURBSSurfaceData,
    tolerance: number = 1e-4
  ): GapMeasurement {
    const dataA = NURBSEngine.toNURBSSurfaceData(surfA);
    const dataB = NURBSEngine.toNURBSSurfaceData(surfB);

    const cptsA = dataA.controlPoints;
    const cptsB = dataB.controlPoints;

    const bndA = [
      cptsA[0],
      cptsA[cptsA.length - 1],
      cptsA.map(r => r[0]),
      cptsA.map(r => r[r.length - 1])
    ];

    const bndB = [
      cptsB[0],
      cptsB[cptsB.length - 1],
      cptsB.map(r => r[0]),
      cptsB.map(r => r[r.length - 1])
    ];

    let minDist = Infinity;
    let locA = cptsA[0][0];
    let locB = cptsB[0][0];
    let idxA = 0;
    let idxB = 0;

    for (let i = 0; i < bndA.length; i++) {
      for (let j = 0; j < bndB.length; j++) {
        for (const pA of bndA[i]) {
          for (const pB of bndB[j]) {
            const d = Math.sqrt((pA.x - pB.x) ** 2 + (pA.y - pB.y) ** 2 + (pA.z - pB.z) ** 2);
            if (d < minDist) {
              minDist = d;
              locA = pA;
              locB = pB;
              idxA = i;
              idxB = j;
            }
          }
        }
      }
    }

    const classification = SurfaceDefectDetector.classifyGap(minDist, tolerance);

    return {
      distance: minDist,
      classification,
      locationA: locA,
      locationB: locB,
      boundaryIndexA: idxA,
      boundaryIndexB: idxB
    };
  }

  /**
   * Auto Heal Gap if gap is micro/small and within allowable tolerance
   */
  public static healGap(
    surfA: NURBSSurfaceData,
    surfB: NURBSSurfaceData,
    tolerance: number = 1e-4,
    maxAutoHealGap: number = 0.1
  ): {
    healedSurfA: NURBSSurfaceData;
    healedSurfB: NURBSSurfaceData;
    healedDistance: number;
    requiresReview: boolean;
    strategy: string;
  } {
    const gap = this.measureGap(surfA, surfB, tolerance);

    if (gap.distance > maxAutoHealGap || gap.classification === 'LARGE_GAP' || gap.classification === 'INVALID_GAP') {
      return {
        healedSurfA: surfA,
        healedSurfB: surfB,
        healedDistance: gap.distance,
        requiresReview: true,
        strategy: 'GAP_TOO_LARGE_REQUIRES_REVIEW'
      };
    }

    // Midpoint snapping for micro/small gaps
    const midPoint: Point = {
      x: (gap.locationA.x + gap.locationB.x) * 0.5,
      y: (gap.locationA.y + gap.locationB.y) * 0.5,
      z: (gap.locationA.z + gap.locationB.z) * 0.5
    };

    const newSurfA = BoundaryRepairEngine.snapBoundaryEndpoints(surfA, [midPoint], tolerance * 100 + 1.0);
    const newSurfB = BoundaryRepairEngine.snapBoundaryEndpoints(surfB, [midPoint], tolerance * 100 + 1.0);

    const postGap = this.measureGap(newSurfA, newSurfB, tolerance);

    return {
      healedSurfA: newSurfA,
      healedSurfB: newSurfB,
      healedDistance: postGap.distance,
      requiresReview: false,
      strategy: 'BOUNDARY_ENDPOINT_MIDPOINT_SNAPPING'
    };
  }
}
