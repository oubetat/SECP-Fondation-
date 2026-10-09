/**
 * SECP-260 — Stock vs Target CAD Comparator Engine
 * Calculates signed deviation mapping between the machined stock state and target CAD model.
 * Detects:
 * - Over-cut / Gouges (stock surface inside target CAD, beyond negative tolerance)
 * - Remaining Material / Excess (stock surface outside target CAD, beyond positive tolerance)
 * - In-tolerance regions
 */

import { 
  Vector3D,
  vec3,
  TargetCadGeometry, 
  StockDeviationMap, 
  DeviationPoint, 
  DeviationClassification, 
  StockBounds 
} from './StockTypes';
import { StockModelRepresentation } from './StockRepresentation';

export class StockTargetComparator {
  /**
   * Compares the final simulated stock against the target CAD B-Rep / Mesh model
   */
  public static compareStockToTarget(
    stockRep: StockModelRepresentation,
    targetCad: TargetCadGeometry,
    toleranceMm: number = 0.05,
    sampleResolutionMm: number = 1.0
  ): StockDeviationMap {
    const bounds = targetCad.bounds || stockRep.bounds;
    const samples: DeviationPoint[] = [];

    const spanX = bounds.maxX - bounds.minX;
    const spanY = bounds.maxY - bounds.minY;

    const sampleStep = Math.max(0.5, sampleResolutionMm);
    const nx = Math.max(5, Math.ceil(spanX / sampleStep));
    const ny = Math.max(5, Math.ceil(spanY / sampleStep));

    let inToleranceCount = 0;
    let remainingMaterialCount = 0;
    let overcutCount = 0;
    let gougeCount = 0;

    let maxPositiveDev = 0;
    let maxNegativeDev = 0;
    let sumDev = 0;

    const dx = spanX / nx;
    const dy = spanY / ny;

    for (let iy = 0; iy < ny; iy++) {
      const y = bounds.minY + (iy + 0.5) * dy;
      for (let ix = 0; ix < nx; ix++) {
        const x = bounds.minX + (ix + 0.5) * dx;

        // Query actual machined stock elevation at (x, y)
        const stockZ = stockRep.getTopSurfaceZ(x, y);

        // Query nominal target CAD elevation at (x, y)
        const targetZ = this.getTargetCadElevation(x, y, targetCad);

        const deviation = stockZ - targetZ; // Signed deviation in mm
        sumDev += deviation;

        if (deviation > maxPositiveDev) maxPositiveDev = deviation;
        if (deviation < maxNegativeDev) maxNegativeDev = deviation;

        let classification: DeviationClassification = 'IN_TOLERANCE';
        if (deviation > toleranceMm) {
          classification = 'REMAINING_MATERIAL';
          remainingMaterialCount++;
        } else if (deviation < -toleranceMm) {
          if (deviation < -0.1) {
            classification = 'GOUGE';
            gougeCount++;
          } else {
            classification = 'OVER_CUT';
            overcutCount++;
          }
        } else {
          inToleranceCount++;
        }

        samples.push({
          position: vec3(x, y, stockZ),
          targetDistanceMm: deviation,
          targetNormal: vec3(0, 0, 1),
          classification
        });
      }
    }

    const totalSamples = samples.length;
    const avgDev = totalSamples > 0 ? sumDev / totalSamples : 0;
    const cellArea = dx * dy;
    const unmachinedVol = remainingMaterialCount * cellArea * Math.max(0, avgDev);
    const overcutVol = (overcutCount + gougeCount) * cellArea * Math.abs(Math.min(0, avgDev));

    return {
      comparisonId: `COMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: Date.now(),
      targetCadHash: targetCad.sha256Hash || 'TARGET-HASH-DEFAULT',
      finalStockHash: `STOCK-STATE-${stockRep.getRemainingVolumeMm3().toFixed(2)}`,
      toleranceMm,
      totalSampleCount: totalSamples,
      inToleranceCount,
      remainingMaterialCount,
      overcutCount,
      gougeCount,
      maxPositiveDeviationMm: parseFloat(maxPositiveDev.toFixed(4)),
      maxNegativeDeviationMm: parseFloat(maxNegativeDev.toFixed(4)),
      averageDeviationMm: parseFloat(avgDev.toFixed(4)),
      unmachinedVolumeMm3: parseFloat(unmachinedVol.toFixed(2)),
      overcutVolumeMm3: parseFloat(overcutVol.toFixed(2)),
      samples
    };
  }

  /**
   * Approximates target CAD surface elevation at (x, y) from CAD triangles or geometric bounds
   */
  private static getTargetCadElevation(x: number, y: number, cad: TargetCadGeometry): number {
    if (!cad.triangles || cad.triangles.length === 0) {
      // Default flat nominal floor at bounds minZ
      return cad.bounds ? cad.bounds.minZ : 0;
    }

    let closestZ = cad.bounds.minZ;
    let found = false;

    // Raycast downward from top of bounds along Z
    for (const tri of cad.triangles) {
      const z = this.rayTriangleIntersectZ(x, y, tri);
      if (z !== null) {
        if (!found || z > closestZ) {
          closestZ = z;
          found = true;
        }
      }
    }

    return closestZ;
  }

  private static rayTriangleIntersectZ(
    x: number, 
    y: number, 
    tri: { v0: Vector3D; v1: Vector3D; v2: Vector3D; normal: Vector3D }
  ): number | null {
    // 2D point-in-triangle test on XY projection
    const p = { x, y };
    const a = tri.v0;
    const b = tri.v1;
    const c = tri.v2;

    const v0x = c.x - a.x, v0y = c.y - a.y;
    const v1x = b.x - a.x, v1y = b.y - a.y;
    const v2x = p.x - a.x, v2y = p.y - a.y;

    const dot00 = v0x * v0x + v0y * v0y;
    const dot01 = v0x * v1x + v0y * v1y;
    const dot02 = v0x * v2x + v0y * v2y;
    const dot11 = v1x * v1x + v1y * v1y;
    const dot12 = v1x * v2x + v1y * v2y;

    const denom = dot00 * dot11 - dot01 * dot01;
    if (Math.abs(denom) < 1e-12) return null;

    const u = (dot11 * dot02 - dot01 * dot12) / denom;
    const v = (dot00 * dot12 - dot01 * dot02) / denom;

    if (u >= -0.01 && v >= -0.01 && (u + v) <= 1.01) {
      // Interpolate Z elevation using triangle plane equation
      const norm = tri.normal;
      if (Math.abs(norm.z) > 1e-6) {
        const d = -(norm.x * a.x + norm.y * a.y + norm.z * a.z);
        const z = -(norm.x * x + norm.y * y + d) / norm.z;
        return z;
      }
      return (a.z + b.z + c.z) / 3;
    }

    return null;
  }
}
