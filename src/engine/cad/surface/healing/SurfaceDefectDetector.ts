/**
 * SECP CAD Kernel — Surface Defect Detector
 * PATCH-205: Phase 18 — Professional Modeling
 *
 * Performs multi-layered geometric, topological, and parametric defect analysis
 * without modifying the original surface.
 */

import { Point, Vector, Curve } from '../../../cad-kernel/geometry/GeometryContracts';
import { BRepNURBSSurface } from '../../../cad-kernel/geometry/BRepGeometry';
import { NURBSEngine } from '../../nurbs/NURBSEngine';
import { NURBSSurfaceData } from '../../nurbs/NURBSTypes';
import {
  DefectReport,
  DefectType,
  DefectCategory,
  DefectSeverity,
  DefectStatus,
  GapClassification
} from './types';

export class SurfaceDefectDetector {
  /**
   * Main defect detection entry point
   */
  public static detectDefects(
    surfaceInput: BRepNURBSSurface | NURBSSurfaceData,
    tolerance: number = 1e-4,
    neighborSurfaces?: (BRepNURBSSurface | NURBSSurfaceData)[]
  ): DefectReport[] {
    const data = NURBSEngine.toNURBSSurfaceData(surfaceInput);
    const defects: DefectReport[] = [];

    // 1. Parametric Checks
    this.checkParametricDefects(data, defects, tolerance);

    // 2. Geometric Checks
    this.checkGeometricDefects(data, defects, tolerance);

    // 3. Topological Checks
    this.checkTopologicalDefects(data, neighborSurfaces, defects, tolerance);

    return defects;
  }

  /**
   * Classify Gap Distance into explicit categories
   */
  public static classifyGap(dist: number, tolerance: number = 1e-4): GapClassification {
    if (dist < tolerance) return 'MICRO_GAP';
    if (dist < tolerance * 100) return 'SMALL_GAP'; // e.g. < 0.01
    if (dist < 1.0) return 'LARGE_GAP';
    return 'INVALID_GAP';
  }

  private static checkParametricDefects(
    data: NURBSSurfaceData,
    defects: DefectReport[],
    tolerance: number
  ) {
    const { degreeU, degreeV, knotsU, knotsV, controlPoints, weights, surfaceId } = data;

    // Check Degree
    if (degreeU < 1 || degreeV < 1 || degreeU > 7 || degreeV > 7) {
      defects.push({
        defectId: `DEF_PARAM_${Math.random().toString(36).substring(2, 8)}`,
        defectType: 'INVALID_DEGREE',
        category: 'PARAMETRIC',
        severity: 'CRITICAL',
        status: 'REPAIRABLE',
        location: controlPoints[0][0],
        affectedGeometry: surfaceId,
        tolerance,
        measuredDeviation: Math.max(degreeU, degreeV),
        recommendedRepair: 'Elevate degree to standard cubic (3)',
        confidence: 'HIGH',
        details: `Invalid surface degree U=${degreeU}, V=${degreeV}`
      });
    }

    // Check Knot Vectors Order & Multiplicity
    this.validateKnotVector(knotsU, degreeU, controlPoints.length, 'U', surfaceId, controlPoints[0][0], defects, tolerance);
    this.validateKnotVector(knotsV, degreeV, controlPoints[0].length, 'V', surfaceId, controlPoints[0][0], defects, tolerance);

    // Check Weights
    if (weights) {
      for (let i = 0; i < weights.length; i++) {
        for (let j = 0; j < weights[i].length; j++) {
          const w = weights[i][j];
          if (!isFinite(w) || w <= 0) {
            defects.push({
              defectId: `DEF_PARAM_${Math.random().toString(36).substring(2, 8)}`,
              defectType: 'INVALID_WEIGHT',
              category: 'PARAMETRIC',
              severity: 'CRITICAL',
              status: 'REPAIRABLE',
              location: controlPoints[i][j],
              affectedGeometry: `${surfaceId}_CP_${i}_${j}`,
              tolerance,
              measuredDeviation: Math.abs(w),
              recommendedRepair: 'Normalize weight to 1.0',
              confidence: 'HIGH',
              details: `Invalid control point weight w=${w} at (${i}, ${j})`
            });
          }
        }
      }
    }
  }

  private static validateKnotVector(
    knots: number[],
    degree: number,
    cpCount: number,
    dir: 'U' | 'V',
    surfaceId: string,
    location: Point,
    defects: DefectReport[],
    tolerance: number
  ) {
    const expectedLen = cpCount + degree + 1;
    if (knots.length !== expectedLen) {
      defects.push({
        defectId: `DEF_KNOT_${Math.random().toString(36).substring(2, 8)}`,
        defectType: 'INVALID_KNOT_VECTOR',
        category: 'PARAMETRIC',
        severity: 'CRITICAL',
        status: 'REPAIRABLE',
        location,
        affectedGeometry: `${surfaceId}_KNOT_${dir}`,
        tolerance,
        measuredDeviation: Math.abs(knots.length - expectedLen),
        recommendedRepair: 'Reconstruct uniform clamped knot vector',
        confidence: 'HIGH',
        details: `Knot vector ${dir} length ${knots.length} mismatch expected ${expectedLen}`
      });
      return;
    }

    // Monotonicity check & Excessive Multiplicity
    let currentMult = 1;
    for (let k = 1; k < knots.length; k++) {
      if (knots[k] < knots[k - 1]) {
        defects.push({
          defectId: `DEF_KNOT_${Math.random().toString(36).substring(2, 8)}`,
          defectType: 'INVALID_KNOT_VECTOR',
          category: 'PARAMETRIC',
          severity: 'CRITICAL',
          status: 'REPAIRABLE',
          location,
          affectedGeometry: `${surfaceId}_KNOT_${dir}`,
          tolerance,
          measuredDeviation: knots[k - 1] - knots[k],
          recommendedRepair: 'Sort and normalize knot vector',
          confidence: 'HIGH',
          details: `Knot vector ${dir} non-monotonic at index ${k}`
        });
        break;
      }

      if (Math.abs(knots[k] - knots[k - 1]) < 1e-9) {
        currentMult++;
        if (currentMult > degree + 1) {
          defects.push({
            defectId: `DEF_KNOT_${Math.random().toString(36).substring(2, 8)}`,
            defectType: 'DUPLICATE_KNOT',
            category: 'PARAMETRIC',
            severity: 'MAJOR',
            status: 'REPAIRABLE',
            location,
            affectedGeometry: `${surfaceId}_KNOT_${dir}`,
            tolerance,
            measuredDeviation: currentMult,
            recommendedRepair: 'Clamp knot multiplicity to degree',
            confidence: 'HIGH',
            details: `Knot multiplicity ${currentMult} exceeds degree ${degree} at knot ${knots[k]}`
          });
        }
      } else {
        currentMult = 1;
      }
    }
  }

  private static checkGeometricDefects(
    data: NURBSSurfaceData,
    defects: DefectReport[],
    tolerance: number
  ) {
    const cpts = data.controlPoints;
    const numU = cpts.length;
    const numV = cpts[0].length;

    // 1. Degenerate Regions & Singular Poles
    for (let i = 0; i < numU - 1; i++) {
      for (let j = 0; j < numV - 1; j++) {
        const p1 = cpts[i][j];
        const p2 = cpts[i + 1][j];
        const p3 = cpts[i][j + 1];

        const du = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };
        const dv = { x: p3.x - p1.x, y: p3.y - p1.y, z: p3.z - p1.z };

        const nx = du.y * dv.z - du.z * dv.y;
        const ny = du.z * dv.x - du.x * dv.z;
        const nz = du.x * dv.y - du.y * dv.x;
        const areaSq = nx * nx + ny * ny + nz * nz;

        if (areaSq < 1e-12) {
          defects.push({
            defectId: `DEF_GEO_${Math.random().toString(36).substring(2, 8)}`,
            defectType: 'DEGENERATE_REGION',
            category: 'GEOMETRIC',
            severity: 'MAJOR',
            status: 'REPAIRABLE',
            location: p1,
            affectedGeometry: `${data.surfaceId}_GRID_${i}_${j}`,
            tolerance,
            measuredDeviation: Math.sqrt(areaSq),
            recommendedRepair: 'Regularize control net or rebuild singular pole',
            confidence: 'HIGH',
            details: `Zero area or degenerate region at mesh cell (${i}, ${j})`
          });
        }
      }
    }

    // 2. Curvature Spikes
    const samples = 6;
    for (let i = 0; i < samples; i++) {
      const u = i / (samples - 1);
      for (let j = 0; j < samples; j++) {
        const v = j / (samples - 1);
        const curv = NURBSEngine.analyzeCurvature(data, u, v);
        if (Math.abs(curv.meanCurvature) > 1000) {
          defects.push({
            defectId: `DEF_GEO_${Math.random().toString(36).substring(2, 8)}`,
            defectType: 'CURVATURE_SPIKE',
            category: 'GEOMETRIC',
            severity: 'MINOR',
            status: 'REPAIRABLE',
            location: NURBSEngine.evaluateSurfacePoint(data, u, v),
            affectedGeometry: `${data.surfaceId}_UV_${u.toFixed(2)}_${v.toFixed(2)}`,
            tolerance,
            measuredDeviation: Math.abs(curv.meanCurvature),
            recommendedRepair: 'Apply surface fairing / Laplacian smoothing',
            confidence: 'HIGH',
            details: `Extreme curvature spike (${curv.meanCurvature.toFixed(2)}) detected at u=${u}, v=${v}`
          });
        }
      }
    }
  }

  private static checkTopologicalDefects(
    data: NURBSSurfaceData,
    neighbors: (BRepNURBSSurface | NURBSSurfaceData)[] | undefined,
    defects: DefectReport[],
    tolerance: number
  ) {
    if (!neighbors || neighbors.length === 0) return;

    const cptsA = data.controlPoints;
    const numU = cptsA.length;
    const numV = cptsA[0].length;

    const boundariesA = [
      cptsA[0], // u=0
      cptsA[numU - 1], // u=1
      cptsA.map(r => r[0]), // v=0
      cptsA.map(r => r[numV - 1]) // v=1
    ];

    for (const neighbor of neighbors) {
      const dataB = NURBSEngine.toNURBSSurfaceData(neighbor);
      const cptsB = dataB.controlPoints;
      const numUB = cptsB.length;
      const numVB = cptsB[0].length;

      const boundariesB = [
        cptsB[0],
        cptsB[numUB - 1],
        cptsB.map(r => r[0]),
        cptsB.map(r => r[numVB - 1])
      ];

      // Measure minimum distance between boundaries
      let minGap = Infinity;
      let gapPtA: Point = cptsA[0][0];

      for (const bA of boundariesA) {
        for (const bB of boundariesB) {
          for (const ptA of bA) {
            for (const ptB of bB) {
              const d = Math.sqrt((ptA.x - ptB.x) ** 2 + (ptA.y - ptB.y) ** 2 + (ptA.z - ptB.z) ** 2);
              if (d < minGap) {
                minGap = d;
                gapPtA = ptA;
              }
            }
          }
        }
      }

      if (minGap > tolerance && minGap < 5.0) {
        const gapClass = this.classifyGap(minGap, tolerance);
        const isAutoRepairable = gapClass === 'MICRO_GAP' || gapClass === 'SMALL_GAP';

        defects.push({
          defectId: `DEF_TOP_${Math.random().toString(36).substring(2, 8)}`,
          defectType: 'GAP',
          category: 'TOPOLOGICAL',
          severity: minGap > 0.5 ? 'MAJOR' : 'MINOR',
          status: isAutoRepairable ? 'REPAIRABLE' : 'UNREPAIRABLE',
          location: gapPtA,
          affectedGeometry: `${data.surfaceId}_VS_${dataB.surfaceId}`,
          tolerance,
          measuredDeviation: minGap,
          recommendedRepair: isAutoRepairable ? 'Extend boundary and perform knot snapping' : 'Requires engineering review / patch insertion',
          confidence: 'HIGH',
          details: `Boundary gap of ${minGap.toFixed(4)}mm (${gapClass}) between surfaces`
        });
      }
    }
  }
}
