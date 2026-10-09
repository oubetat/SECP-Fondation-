/**
 * SECP Industrial OS v2 — Independent Geometric Oracle
 * Phase 15 (PATCH-172)
 *
 * Provides analytical mathematical evaluation and invariant audits decoupled from kernel internals.
 */

import { TopoShape, Solid, Face, TopoShapeEnum, Orientation } from '../../cad-kernel/topology/TopologyContracts';
import { Point, Vector } from '../../cad-kernel/geometry/GeometryContracts';
import { BoundingBox3D, GeometricInvariantsReport } from './types';
import { BooleanOperation } from '../../cad-kernel/boolean/BooleanTypes';
import { BooleanClassifier } from '../../cad-kernel/boolean/BooleanClassifier';

export class IndependentGeometricOracle {
  public static readonly TOLERANCE = 1e-5;

  /**
   * Computes the exact geometric 3D volume of a B-Rep Solid using Divergence Theorem.
   */
  public static computeVolume(shape: TopoShape | null): number {
    if (!shape) return 0.0;
    if (shape.shapeType === TopoShapeEnum.COMPOUND) {
      const comp = shape as any;
      let total = 0.0;
      for (const s of comp.shapes || []) {
        total += this.computeVolume(s);
      }
      return total;
    }
    if (shape.shapeType !== TopoShapeEnum.SOLID) return 0.0;
    const solid = shape as Solid;
    let totalVolume = 0.0;

    const shells = [solid.outerShell, ...(solid.innerShells || [])].filter(Boolean);

    for (const shell of shells) {
      let shellVol = 0.0;
      for (const oface of shell.orientedFaces) {
        if (!oface.face) continue;
        shellVol += this.computeFaceVolumeContribution(oface.face, oface.orientation || Orientation.FORWARD);
      }

      if (shell === solid.outerShell) {
        totalVolume += Math.abs(shellVol);
      } else {
        totalVolume -= Math.abs(shellVol);
      }
    }

    return Math.max(0.0, totalVolume);
  }

  public static computeFaceVolumeContribution(face: Face, orientation: Orientation): number {
    const verts = this.getFaceVertices(face);
    if (verts.length < 3) return 0.0;

    let areaSumX = 0, areaSumY = 0, areaSumZ = 0;
    const v0 = verts[0];
    for (let i = 1; i < verts.length - 1; i++) {
      const v1 = verts[i];
      const v2 = verts[i + 1];
      const e1 = { x: v1.x - v0.x, y: v1.y - v0.y, z: v1.z - v0.z };
      const e2 = { x: v2.x - v0.x, y: v2.y - v0.y, z: v2.z - v0.z };
      areaSumX += e1.y * e2.z - e1.z * e2.y;
      areaSumY += e1.z * e2.x - e1.x * e2.z;
      areaSumZ += e1.x * e2.y - e1.y * e2.x;
    }
    const areaVector = { x: areaSumX * 0.5, y: areaSumY * 0.5, z: areaSumZ * 0.5 };

    let dot = v0.x * areaVector.x + v0.y * areaVector.y + v0.z * areaVector.z;
    if (orientation === Orientation.REVERSED) {
      dot = -dot;
    }

    return dot / 3.0;
  }

  /**
   * Computes total surface area of a B-Rep shape.
   */
  public static computeSurfaceArea(shape: TopoShape | null): number {
    if (!shape || shape.shapeType !== TopoShapeEnum.SOLID) return 0.0;
    const solid = shape as Solid;
    let totalArea = 0.0;

    const shells = [solid.outerShell, ...(solid.innerShells || [])].filter(Boolean);
    for (const shell of shells) {
      for (const oface of shell.orientedFaces) {
        if (!oface.face) continue;
        const verts = this.getFaceVertices(oface.face);
        if (verts.length < 3) continue;

        const v0 = verts[0];
        for (let i = 1; i < verts.length - 1; i++) {
          const v1 = verts[i];
          const v2 = verts[i + 1];

          // Triangle cross product norm
          const ax = v1.x - v0.x;
          const ay = v1.y - v0.y;
          const az = v1.z - v0.z;

          const bx = v2.x - v0.x;
          const by = v2.y - v0.y;
          const bz = v2.z - v0.z;

          const cx = ay * bz - az * by;
          const cy = az * bx - ax * bz;
          const cz = ax * by - ay * bx;

          const area = 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
          totalArea += area;
        }
      }
    }

    return totalArea;
  }

  /**
   * Computes axis-aligned bounding box of a B-Rep shape.
   */
  public static computeBoundingBox(shape: TopoShape | null): BoundingBox3D {
    if (!shape || shape.shapeType !== TopoShapeEnum.SOLID) {
      return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
    }

    const solid = shape as Solid;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    if (solid.outerShell) {
      for (const oface of solid.outerShell.orientedFaces) {
        if (!oface.face) continue;
        const verts = this.getFaceVertices(oface.face);
        for (const v of verts) {
          if (v.x < minX) minX = v.x;
          if (v.y < minY) minY = v.y;
          if (v.z < minZ) minZ = v.z;
          if (v.x > maxX) maxX = v.x;
          if (v.y > maxY) maxY = v.y;
          if (v.z > maxZ) maxZ = v.z;
        }
      }
    }

    if (!isFinite(minX)) {
      return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
    }

    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ }
    };
  }

  /**
   * Verifies mathematical invariants for Boolean operations.
   */
  public static verifyInvariants(
    op: BooleanOperation,
    shapeA: TopoShape | null,
    shapeB: TopoShape | null,
    resultShape: TopoShape | null,
    expectedVolume?: number
  ): GeometricInvariantsReport {
    const volA = this.computeVolume(shapeA);
    const volB = this.computeVolume(shapeB);
    const actualVol = resultShape ? this.computeVolume(resultShape) : 0.0;
    const actualArea = resultShape ? this.computeSurfaceArea(resultShape) : 0.0;

    const details: string[] = [];
    let satisfiesInclusionExclusion = true;
    let satisfiesDifferenceBounds = true;
    let satisfiesIntersectionBounds = true;
    let invariantsSatisfied = true;

    if (op === 'UNION') {
      // V(A u B) must be in [max(V(A), V(B)), V(A) + V(B)]
      const minBound = Math.max(volA, volB) - this.TOLERANCE;
      const maxBound = volA + volB + this.TOLERANCE;

      if (actualVol < minBound || actualVol > maxBound) {
        satisfiesInclusionExclusion = false;
        invariantsSatisfied = false;
        details.push(`Union volume violation: actual=${actualVol.toFixed(4)} outside bounds [${minBound.toFixed(4)}, ${maxBound.toFixed(4)}]`);
      } else {
        details.push(`Union volume ${actualVol.toFixed(4)} satisfies inclusion-exclusion bounds`);
      }
    } else if (op === 'DIFFERENCE') {
      // 0 <= V(A - B) <= V(A)
      const maxBound = volA + this.TOLERANCE;
      if (actualVol < -this.TOLERANCE || actualVol > maxBound) {
        satisfiesDifferenceBounds = false;
        invariantsSatisfied = false;
        details.push(`Difference volume violation: actual=${actualVol.toFixed(4)} not in [0, ${maxBound.toFixed(4)}]`);
      } else {
        details.push(`Difference volume ${actualVol.toFixed(4)} satisfies difference bounds [0, ${volA.toFixed(4)}]`);
      }
    } else if (op === 'INTERSECTION') {
      // 0 <= V(A n B) <= min(V(A), V(B))
      const maxBound = Math.min(volA, volB) + this.TOLERANCE;
      if (actualVol < -this.TOLERANCE || actualVol > maxBound) {
        satisfiesIntersectionBounds = false;
        invariantsSatisfied = false;
        details.push(`Intersection volume violation: actual=${actualVol.toFixed(4)} not in [0, ${maxBound.toFixed(4)}]`);
      } else {
        details.push(`Intersection volume ${actualVol.toFixed(4)} satisfies intersection upper bound ${maxBound.toFixed(4)}`);
      }
    }

    let volumeError: number | null = null;
    let relativeVolumeError: number | null = null;

    if (expectedVolume !== undefined) {
      volumeError = Math.abs(actualVol - expectedVolume);
      relativeVolumeError = expectedVolume > 1e-9 ? volumeError / expectedVolume : volumeError;
      if (volumeError > this.TOLERANCE * Math.max(1, expectedVolume)) {
        invariantsSatisfied = false;
        details.push(`Target volume mismatch: expected=${expectedVolume.toFixed(4)}, actual=${actualVol.toFixed(4)}, error=${volumeError.toExponential(2)}`);
      }
    }

    return {
      expectedVolume: expectedVolume ?? null,
      actualVolume: actualVol,
      volumeError,
      relativeVolumeError,
      expectedSurfaceArea: null,
      actualSurfaceArea: actualArea,
      invariantsSatisfied,
      satisfiesInclusionExclusion,
      satisfiesDifferenceBounds,
      satisfiesIntersectionBounds,
      details
    };
  }

  private static getFaceVertices(face: Face): Point[] {
    const pts: Point[] = [];
    if (face.outerLoop?.orientedEdges) {
      for (const oedge of face.outerLoop.orientedEdges) {
        const v = oedge.orientation === Orientation.REVERSED ? oedge.edge?.endVertex : oedge.edge?.startVertex;
        if (v?.geometry) {
          pts.push(v.geometry);
        }
      }
    }
    return pts;
  }
}
