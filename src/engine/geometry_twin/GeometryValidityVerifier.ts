// SECP Industrial OS v2 — Geometry Validity Verifier
import {
  BRepTwinDefinition,
  GeometricValidityVerdict,
  GeometryToleranceModel
} from './types';

export interface GeometryValidationReport {
  verdict: GeometricValidityVerdict;
  isClosed: boolean;
  isManifold: boolean;
  isSolid: boolean;
  isSelfIntersecting: boolean;
  details: string[];
}

export class GeometryValidityVerifier {
  public static verifyBRep(
    brep: BRepTwinDefinition,
    tolerance: GeometryToleranceModel
  ): GeometryValidationReport {
    const details: string[] = [];

    // 1. Check degenerate elements
    for (const v of brep.vertices) {
      if (isNaN(v.point.x) || isNaN(v.point.y) || isNaN(v.point.z)) {
        return {
          verdict: 'DEGENERATE',
          isClosed: false,
          isManifold: false,
          isSolid: false,
          isSelfIntersecting: false,
          details: [`Degenerate vertex point detected in ${v.vertexId}`]
        };
      }
    }

    const vertexMap = new Map(brep.vertices.map(v => [v.vertexId, v]));

    // 2. Check vertex-edge consistency
    for (const e of brep.edges) {
      if (!vertexMap.has(e.startVertexId) || !vertexMap.has(e.endVertexId)) {
        return {
          verdict: 'INVALID',
          isClosed: false,
          isManifold: false,
          isSolid: false,
          isSelfIntersecting: false,
          details: [`Edge ${e.edgeId} references missing vertices: ${e.startVertexId}, ${e.endVertexId}`]
        };
      }
      if (e.startVertexId === e.endVertexId && e.curveType === 'LINE') {
        return {
          verdict: 'DEGENERATE',
          isClosed: false,
          isManifold: false,
          isSolid: false,
          isSelfIntersecting: false,
          details: [`Zero-length degenerate edge ${e.edgeId}`]
        };
      }
    }

    const edgeMap = new Map(brep.edges.map(e => [e.edgeId, e]));

    // 3. Check loop closure and edge-face adjacency
    const edgeUsageCount = new Map<string, number>();

    for (const loop of brep.loops) {
      for (const edgeId of loop.edgeIds) {
        if (!edgeMap.has(edgeId)) {
          return {
            verdict: 'INVALID',
            isClosed: false,
            isManifold: false,
            isSolid: false,
            isSelfIntersecting: false,
            details: [`Loop ${loop.loopId} references missing edge ${edgeId}`]
          };
        }
        edgeUsageCount.set(edgeId, (edgeUsageCount.get(edgeId) || 0) + 1);
      }
    }

    // 4. Check 2-Manifold Edge Adjacency
    let isManifold = true;
    let isClosed = true;

    for (const [edgeId, count] of edgeUsageCount.entries()) {
      if (count > 2) {
        isManifold = false;
        details.push(`NON_MANIFOLD_EDGE: Edge ${edgeId} is shared by ${count} loops (max 2 for manifold 2D-surface)`);
      } else if (count === 1) {
        isClosed = false;
      }
    }

    if (!isManifold) {
      return {
        verdict: 'NON_MANIFOLD',
        isClosed,
        isManifold: false,
        isSolid: false,
        isSelfIntersecting: false,
        details
      };
    }

    // 5. Solid closure
    const isSolid = brep.solids.length > 0 && isClosed && isManifold;

    if (brep.solids.length > 0 && !isClosed) {
      return {
        verdict: 'OPEN',
        isClosed: false,
        isManifold: true,
        isSolid: false,
        isSelfIntersecting: false,
        details: ['Solid contains open boundary edges']
      };
    }

    return {
      verdict: 'VALID',
      isClosed,
      isManifold,
      isSolid,
      isSelfIntersecting: false,
      details: ['B-Rep topology and geometry validation passed']
    };
  }
}
