/**
 * SECP Industrial OS v2 — CAM Production Engine
 * PATCH-255 — Feature Pattern Recognizer
 */

import { ManufacturingFeature, HolePatternCandidate, Vector3D } from './FeatureTypes';

export class FeaturePatternRecognizer {
  /**
   * Identifies linear arrays and circular bolt hole patterns
   */
  public static recognizePatterns(features: ManufacturingFeature[]): HolePatternCandidate[] {
    const patterns: HolePatternCandidate[] = [];

    // Filter all hole features
    const holeFeatures = features.filter(f => f.type.includes('HOLE') && f.parameters.type === 'HOLE');
    if (holeFeatures.length < 2) return patterns;

    // Group holes by diameter and axis direction
    const groups = new Map<string, ManufacturingFeature[]>();
    for (const h of holeFeatures) {
      if (h.parameters.type === 'HOLE') {
        const dia = h.parameters.params.diameterMm.toFixed(1);
        const axisKey = `${h.parameters.params.axis.x.toFixed(1)}_${h.parameters.params.axis.y.toFixed(1)}_${h.parameters.params.axis.z.toFixed(1)}`;
        const key = `DIA_${dia}_AXIS_${axisKey}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(h);
      }
    }

    for (const [key, groupHoles] of groups.entries()) {
      if (groupHoles.length >= 3) {
        // Test for Circular Bolt Circle (PCD)
        const centers: Vector3D[] = groupHoles.map(h => (h.parameters.type === 'HOLE' ? h.parameters.params.centerTop : { x: 0, y: 0, z: 0 }));
        const pcdPattern = this.detectCircularBoltPattern(groupHoles, centers);
        if (pcdPattern) {
          patterns.push(pcdPattern);
          continue;
        }

        // Test for Linear Array
        const linearPattern = this.detectLinearPattern(groupHoles, centers);
        if (linearPattern) {
          patterns.push(linearPattern);
        }
      } else if (groupHoles.length === 2) {
        // Coaxial or linear pair
        const h0 = groupHoles[0];
        const h1 = groupHoles[1];
        if (h0.parameters.type === 'HOLE' && h1.parameters.type === 'HOLE') {
          const c0 = h0.parameters.params.centerTop;
          const c1 = h1.parameters.params.centerTop;
          const dist = Math.sqrt(Math.pow(c1.x - c0.x, 2) + Math.pow(c1.y - c0.y, 2) + Math.pow(c1.z - c0.z, 2));

          patterns.push({
            id: `PATTERN_PAIR_${Date.now().toString(36)}`,
            patternType: 'LINEAR_ARRAY',
            featureIds: [h0.id, h1.id],
            holeCount: 2,
            holeDiameterMm: h0.parameters.params.diameterMm,
            pitchDistanceMm: dist,
            centerLocation: { x: (c0.x + c1.x) / 2, y: (c0.y + c1.y) / 2, z: (c0.z + c1.z) / 2 },
            normalAxis: h0.parameters.params.axis,
          });
        }
      }
    }

    return patterns;
  }

  private static detectCircularBoltPattern(
    holes: ManufacturingFeature[],
    centers: Vector3D[]
  ): HolePatternCandidate | null {
    // Compute mean center
    let cx = 0, cy = 0, cz = 0;
    for (const c of centers) {
      cx += c.x; cy += c.y; cz += c.z;
    }
    cx /= centers.length;
    cy /= centers.length;
    cz /= centers.length;

    // Check if distances from mean center to each hole are approximately equal (Radius std dev < 1.0mm)
    const radii: number[] = centers.map(c => Math.sqrt(Math.pow(c.x - cx, 2) + Math.pow(c.y - cy, 2)));
    const avgRadius = radii.reduce((a, b) => a + b, 0) / radii.length;
    const maxDev = Math.max(...radii.map(r => Math.abs(r - avgRadius)));

    if (maxDev < 1.5 && avgRadius > 5.0) {
      const dia = holes[0].parameters.type === 'HOLE' ? holes[0].parameters.params.diameterMm : 10;
      return {
        id: `PATTERN_PCD_${holes.length}x_D${dia}_${Date.now().toString(36)}`,
        patternType: 'CIRCULAR_BOLT_CIRCLE',
        featureIds: holes.map(h => h.id),
        holeCount: holes.length,
        holeDiameterMm: dia,
        boltCircleDiameterMm: avgRadius * 2,
        angularSpacingDeg: 360 / holes.length,
        centerLocation: { x: cx, y: cy, z: cz },
        normalAxis: holes[0].parameters.type === 'HOLE' ? holes[0].parameters.params.axis : { x: 0, y: 0, z: 1 },
      };
    }

    return null;
  }

  private static detectLinearPattern(
    holes: ManufacturingFeature[],
    centers: Vector3D[]
  ): HolePatternCandidate | null {
    // Sort centers along major axis
    const sorted = [...centers].sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y));
    const dists: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const d = Math.sqrt(
        Math.pow(sorted[i].x - sorted[i - 1].x, 2) +
        Math.pow(sorted[i].y - sorted[i - 1].y, 2) +
        Math.pow(sorted[i].z - sorted[i - 1].z, 2)
      );
      dists.push(d);
    }

    const avgDist = dists.reduce((a, b) => a + b, 0) / dists.length;
    const maxDev = Math.max(...dists.map(d => Math.abs(d - avgDist)));

    if (maxDev < 1.0 && avgDist > 2.0) {
      const dia = holes[0].parameters.type === 'HOLE' ? holes[0].parameters.params.diameterMm : 10;
      return {
        id: `PATTERN_LINEAR_${holes.length}x_D${dia}_${Date.now().toString(36)}`,
        patternType: 'LINEAR_ARRAY',
        featureIds: holes.map(h => h.id),
        holeCount: holes.length,
        holeDiameterMm: dia,
        pitchDistanceMm: avgDist,
        centerLocation: sorted[0],
        normalAxis: holes[0].parameters.type === 'HOLE' ? holes[0].parameters.params.axis : { x: 0, y: 0, z: 1 },
      };
    }

    return null;
  }
}
