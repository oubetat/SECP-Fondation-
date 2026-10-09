/**
 * SECP Industrial OS v2 — CAM Production Engine
 * PATCH-255 — Feature Topology Analyzer
 */

import { Solid, Shell, Face, Edge, Loop, TopoShapeEnum } from '../../cad-kernel/topology/TopologyContracts';
import { Vector3D } from '../../cadKernel';
import { FeatureGeometryAnalyzer, FaceGeometryInfo } from './FeatureGeometryAnalyzer';

export interface TopologicalEdgeInfo {
  edgeId: string;
  adjacentFaceIds: string[];
  isConvex: boolean;
  isConcave: boolean;
  dihedralAngleDeg: number;
  lengthMm: number;
}

export interface FaceAdjacencyGraph {
  faceId: string;
  adjacentFaceIds: string[];
  connectedEdges: string[];
  hasInnerLoops: boolean;
  innerLoopsCount: number;
  concaveNeighborCount: number;
  convexNeighborCount: number;
}

export class FeatureTopologyAnalyzer {
  /**
   * Builds face adjacency map and edge convexity data from a Solid
   */
  public static analyzeSolidTopology(solid: Solid, faceGeoms: Map<string, FaceGeometryInfo>): {
    adjacencyMap: Map<string, FaceAdjacencyGraph>;
    edgeMap: Map<string, TopologicalEdgeInfo>;
    innerLoopFaceMap: Map<string, Loop[]>;
  } {
    const adjacencyMap = new Map<string, FaceAdjacencyGraph>();
    const edgeMap = new Map<string, TopologicalEdgeInfo>();
    const innerLoopFaceMap = new Map<string, Loop[]>();

    const faces = this.collectFacesFromSolid(solid);

    // Initialize adjacency map
    for (const f of faces) {
      adjacencyMap.set(f.id, {
        faceId: f.id,
        adjacentFaceIds: [],
        connectedEdges: [],
        hasInnerLoops: (f.innerLoops && f.innerLoops.length > 0) || false,
        innerLoopsCount: f.innerLoops?.length || 0,
        concaveNeighborCount: 0,
        convexNeighborCount: 0,
      });

      if (f.innerLoops && f.innerLoops.length > 0) {
        innerLoopFaceMap.set(f.id, f.innerLoops);
      }
    }

    // Map edges to adjacent faces
    for (const f of faces) {
      const edges = this.collectEdgesFromFace(f);
      for (const edge of edges) {
        let edgeInfo = edgeMap.get(edge.id);
        if (!edgeInfo) {
          edgeInfo = {
            edgeId: edge.id,
            adjacentFaceIds: [f.id],
            isConvex: true,
            isConcave: false,
            dihedralAngleDeg: 90,
            lengthMm: this.estimateEdgeLengthMm(edge),
          };
          edgeMap.set(edge.id, edgeInfo);
        } else {
          if (!edgeInfo.adjacentFaceIds.includes(f.id)) {
            edgeInfo.adjacentFaceIds.push(f.id);
          }
        }
      }
    }

    // Determine convexity & update face adjacency
    for (const [edgeId, edgeInfo] of edgeMap.entries()) {
      if (edgeInfo.adjacentFaceIds.length >= 2) {
        const f1Id = edgeInfo.adjacentFaceIds[0];
        const f2Id = edgeInfo.adjacentFaceIds[1];

        const g1 = faceGeoms.get(f1Id);
        const g2 = faceGeoms.get(f2Id);

        if (g1 && g2) {
          const { isConcave, isConvex, angleDeg } = this.calculateEdgeConvexity(g1, g2);
          edgeInfo.isConcave = isConcave;
          edgeInfo.isConvex = isConvex;
          edgeInfo.dihedralAngleDeg = angleDeg;

          const adj1 = adjacencyMap.get(f1Id);
          const adj2 = adjacencyMap.get(f2Id);

          if (adj1) {
            if (!adj1.adjacentFaceIds.includes(f2Id)) adj1.adjacentFaceIds.push(f2Id);
            if (!adj1.connectedEdges.includes(edgeId)) adj1.connectedEdges.push(edgeId);
            if (isConcave) adj1.concaveNeighborCount++;
            if (isConvex) adj1.convexNeighborCount++;
          }
          if (adj2) {
            if (!adj2.adjacentFaceIds.includes(f1Id)) adj2.adjacentFaceIds.push(f1Id);
            if (!adj2.connectedEdges.includes(edgeId)) adj2.connectedEdges.push(edgeId);
            if (isConcave) adj2.concaveNeighborCount++;
            if (isConvex) adj2.convexNeighborCount++;
          }
        }
      }
    }

    return { adjacencyMap, edgeMap, innerLoopFaceMap };
  }

  /**
   * Calculates whether an edge between two adjacent faces is concave (internal material cavity) or convex (outer boundary)
   */
  public static calculateEdgeConvexity(g1: FaceGeometryInfo, g2: FaceGeometryInfo): {
    isConcave: boolean;
    isConvex: boolean;
    angleDeg: number;
  } {
    // Vector from centroid 1 to centroid 2
    const dir12: Vector3D = {
      x: g2.centroid.x - g1.centroid.x,
      y: g2.centroid.y - g1.centroid.y,
      z: g2.centroid.z - g1.centroid.z,
    };

    const dotN = g1.normal.x * g2.normal.x + g1.normal.y * g2.normal.y + g1.normal.z * g2.normal.z;
    const clampedDot = Math.max(-1, Math.min(1, dotN));
    const angleDeg = (Math.acos(clampedDot) * 180) / Math.PI;

    // Normal dot relative direction determines convexity
    const proj = g1.normal.x * dir12.x + g1.normal.y * dir12.y + g1.normal.z * dir12.z;

    // If surface normal points towards the other face's centroid, it is an interior/concave junction (pocket floor to wall)
    const isConcave = proj < -1e-4;
    const isConvex = !isConcave;

    return { isConcave, isConvex, angleDeg };
  }

  /**
   * Helper to collect all faces in a Solid
   */
  public static collectFacesFromSolid(solid: Solid): Face[] {
    const faces: Face[] = [];
    if (solid.outerShell && solid.outerShell.orientedFaces) {
      for (const of of solid.outerShell.orientedFaces) {
        if (of.face) faces.push(of.face);
      }
    }
    if (solid.innerShells) {
      for (const s of solid.innerShells) {
        if (s.orientedFaces) {
          for (const of of s.orientedFaces) {
            if (of.face) faces.push(of.face);
          }
        }
      }
    }
    return faces;
  }

  /**
   * Helper to collect all edges in a Face
   */
  public static collectEdgesFromFace(face: Face): Edge[] {
    const edges: Edge[] = [];
    if (face.outerLoop && face.outerLoop.orientedEdges) {
      for (const oe of face.outerLoop.orientedEdges) {
        if (oe.edge) edges.push(oe.edge);
      }
    }
    if (face.innerLoops) {
      for (const il of face.innerLoops) {
        if (il.orientedEdges) {
          for (const oe of il.orientedEdges) {
            if (oe.edge) edges.push(oe.edge);
          }
        }
      }
    }
    return edges;
  }

  /**
   * Estimate edge length in mm
   */
  private static estimateEdgeLengthMm(edge: Edge): number {
    if (edge.startVertex?.geometry && edge.endVertex?.geometry) {
      const dx = (edge.endVertex.geometry.x - edge.startVertex.geometry.x) * 1000;
      const dy = (edge.endVertex.geometry.y - edge.startVertex.geometry.y) * 1000;
      const dz = (edge.endVertex.geometry.z - edge.startVertex.geometry.z) * 1000;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    return 10.0;
  }
}
