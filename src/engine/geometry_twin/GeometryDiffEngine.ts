// SECP Industrial OS v2 — Geometry Diff & Comparison Engine
import { GeometryTwin, Vector3D } from './types';
import { CanonicalGeometrySerializer } from './CanonicalGeometrySerializer';

export interface GeometryDiffResult {
  isIdentical: boolean;
  geometryHashMatch: boolean;
  topologyHashMatch: boolean;
  changeTypes: string[];
  details: {
    addedFaces: string[];
    removedFaces: string[];
    modifiedFaces: string[];
    addedEdges: string[];
    removedEdges: string[];
    modifiedVertices: string[];
    toleranceChanged: boolean;
    unitChanged: boolean;
  };
}

export interface ToleranceEquivalenceResult {
  equivalent: boolean;
  toleranceUsed: number;
  maxDeviation: number;
  locationOfMaxDeviation: Vector3D | null;
}

export class GeometryDiffEngine {
  public static compareTwins(twinA: GeometryTwin, twinB: GeometryTwin): GeometryDiffResult {
    const changeTypes: string[] = [];
    const geometryHashMatch = twinA.geometryHash === twinB.geometryHash;
    const topologyHashMatch = twinA.topologyHash === twinB.topologyHash;

    const addedFaces: string[] = [];
    const removedFaces: string[] = [];
    const modifiedFaces: string[] = [];
    const addedEdges: string[] = [];
    const removedEdges: string[] = [];
    const modifiedVertices: string[] = [];

    let toleranceChanged = false;
    let unitChanged = false;

    if (twinA.coordinateSystem.units !== twinB.coordinateSystem.units) {
      unitChanged = true;
      changeTypes.push('UNIT_CHANGED');
    }

    if (twinA.toleranceModel.modelTolerance !== twinB.toleranceModel.modelTolerance) {
      toleranceChanged = true;
      changeTypes.push('TOLERANCE_CHANGED');
    }

    if (!topologyHashMatch) {
      changeTypes.push('TOPOLOGY_CHANGED');
    }

    // Inspect B-Rep differences if available
    if (twinA.bRep && twinB.bRep) {
      const facesA = new Map(twinA.bRep.faces.map(f => [f.faceId, f]));
      const facesB = new Map(twinB.bRep.faces.map(f => [f.faceId, f]));

      for (const [id, fA] of facesA.entries()) {
        if (!facesB.has(id)) {
          removedFaces.push(id);
          changeTypes.push('REMOVED_FACE');
        } else {
          const fB = facesB.get(id)!;
          if (fA.surfaceDefinitionHash !== fB.surfaceDefinitionHash || fA.boundaryHash !== fB.boundaryHash) {
            modifiedFaces.push(id);
            changeTypes.push('FACE_MODIFIED');
          }
        }
      }

      for (const [id] of facesB.entries()) {
        if (!facesA.has(id)) {
          addedFaces.push(id);
          changeTypes.push('ADDED_FACE');
        }
      }

      // Check vertices
      const vertsA = new Map(twinA.bRep.vertices.map(v => [v.vertexId, v]));
      const vertsB = new Map(twinB.bRep.vertices.map(v => [v.vertexId, v]));

      for (const [id, vA] of vertsA.entries()) {
        const vB = vertsB.get(id);
        if (vB) {
          const dist = Math.sqrt(
            Math.pow(vA.point.x - vB.point.x, 2) +
            Math.pow(vA.point.y - vB.point.y, 2) +
            Math.pow(vA.point.z - vB.point.z, 2)
          );
          if (dist > 1e-8) {
            modifiedVertices.push(id);
            changeTypes.push('VERTEX_MODIFIED');
          }
        }
      }
    }

    const isIdentical = geometryHashMatch && topologyHashMatch && changeTypes.length === 0;

    return {
      isIdentical,
      geometryHashMatch,
      topologyHashMatch,
      changeTypes: Array.from(new Set(changeTypes)),
      details: {
        addedFaces,
        removedFaces,
        modifiedFaces,
        addedEdges,
        removedEdges,
        modifiedVertices,
        toleranceChanged,
        unitChanged
      }
    };
  }

  public static isGeometryExactlyEqual(twinA: GeometryTwin, twinB: GeometryTwin): boolean {
    return twinA.geometryHash === twinB.geometryHash &&
      twinA.topologyHash === twinB.topologyHash &&
      twinA.coordinateSystem.units === twinB.coordinateSystem.units;
  }

  public static isGeometryEquivalentWithinTolerance(
    twinA: GeometryTwin,
    twinB: GeometryTwin,
    tolerance: number
  ): ToleranceEquivalenceResult {
    let maxDeviation = 0;
    let locationOfMaxDeviation: Vector3D | null = null;

    if (twinA.bRep && twinB.bRep) {
      const vertsA = twinA.bRep.vertices;
      const vertsB = twinB.bRep.vertices;

      if (vertsA.length !== vertsB.length) {
        return {
          equivalent: false,
          toleranceUsed: tolerance,
          maxDeviation: Infinity,
          locationOfMaxDeviation: null
        };
      }

      for (let i = 0; i < vertsA.length; i++) {
        const pA = vertsA[i].point;
        const pB = vertsB[i].point;
        const dist = Math.sqrt(
          Math.pow(pA.x - pB.x, 2) +
          Math.pow(pA.y - pB.y, 2) +
          Math.pow(pA.z - pB.z, 2)
        );

        if (dist > maxDeviation) {
          maxDeviation = dist;
          locationOfMaxDeviation = pA;
        }
      }
    }

    return {
      equivalent: maxDeviation <= tolerance,
      toleranceUsed: tolerance,
      maxDeviation,
      locationOfMaxDeviation
    };
  }
}
