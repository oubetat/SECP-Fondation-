/**
 * SECP CAD Kernel — B-Rep Canonical Hashing (PATCH-012)
 *
 * ARCHITECTURAL CONTRACT:
 * 1. Computes deterministic hashes from actual B-Rep artifacts (Topology & Geometry).
 * 2. Topology Hash: Represents connectivity and structural arrangement.
 * 3. Geometry Hash: Represents numerical parameters and spatial coordinates.
 * 4. Independent of transient IDs (solid_1, face_2).
 * 5. Uses SHA-256 via EngineeringHashChain for cryptographic proof.
 */

import { EngineeringHashChain } from '../../evidence/EngineeringHashChain';
import { 
  Solid, Shell, Face, Loop, OrientedEdge, OrientedFace, Vertex, Edge, TopoShapeEnum, Orientation 
} from './TopologyContracts';
import { Point, Vector, Curve, Surface } from '../geometry/GeometryContracts';

export interface BRepEvidence {
  topologyHash: string;
  geometryHash: string;
  entityCounts: {
    vertices: number;
    edges: number;
    faces: number;
    shells: number;
  };
}

export class BRepHasher {
  /**
   * Computes the dual evidence hashes for a B-Rep Solid.
   */
  public static computeEvidence(shape: any): BRepEvidence {
    if (shape.shapeType === 'COMPOUND' || shape.shapeType === 'WIRE') {
      let combinedTopology = '';
      let combinedGeometry = '';
      let totalVertices = 0;
      let totalEdges = 0;
      let totalFaces = 0;
      let totalShells = 0;
      for (const s of (shape.shapes || [])) {
        const subEvidence = this.computeEvidence(s);
        combinedTopology += subEvidence.topologyHash;
        combinedGeometry += subEvidence.geometryHash;
        totalVertices += subEvidence.entityCounts.vertices;
        totalEdges += subEvidence.entityCounts.edges;
        totalFaces += subEvidence.entityCounts.faces;
        totalShells += subEvidence.entityCounts.shells;
      }
      const { canonicalHash: topologyHash } = EngineeringHashChain.computeCanonicalHash({ combinedTopology });
      const { canonicalHash: geometryHash } = EngineeringHashChain.computeCanonicalHash({ combinedGeometry });
      return {
        topologyHash,
        geometryHash,
        entityCounts: {
          vertices: totalVertices,
          edges: totalEdges,
          faces: totalFaces,
          shells: totalShells
        }
      };
    }
    const topologyCanonical = this.getTopologyCanonical(shape);
    const geometryCanonical = this.getGeometryCanonical(shape);

    const { canonicalHash: topologyHash } = EngineeringHashChain.computeCanonicalHash(topologyCanonical);
    const { canonicalHash: geometryHash } = EngineeringHashChain.computeCanonicalHash(geometryCanonical);

    const counts = this.collectCounts(shape);

    return {
      topologyHash,
      geometryHash,
      entityCounts: counts
    };
  }

  /**
   * Generates a canonical representation of the topology (connectivity only).
   */
  private static getTopologyCanonical(solid: Solid): any {
    // We need to traverse without relying on volatile IDs.
    // 1. Collect all vertices and sort them by geometry to establish a stable indexing.
    const allVertices = this.collectVertices(solid);
    const sortedVertices = [...allVertices].sort((a, b) => this.comparePoints(a.geometry, b.geometry));
    const vertexToIndex = new Map<Vertex, number>();
    sortedVertices.forEach((v, i) => vertexToIndex.set(v, i));

    // 2. Collect and normalize edges
    const allEdges = this.collectEdges(solid);
    const normalizedEdges = allEdges.map(edge => {
      return {
        vStart: vertexToIndex.get(edge.startVertex),
        vEnd: vertexToIndex.get(edge.endVertex),
        curveType: (edge.geometry as any).type || 'UNKNOWN'
      };
    }).sort((a, b) => {
      if (a.vStart !== b.vStart) return a.vStart! - b.vStart!;
      if (a.vEnd !== b.vEnd) return a.vEnd! - b.vEnd!;
      return a.curveType.localeCompare(b.curveType);
    });

    const edgeToNormalizedIndex = new Map<Edge, number>();
    // Note: We need a stable way to map back. This is tricky because multiple edges might have same vStart/vEnd/type.
    // For now, let's just use the index in the sorted list.
    // In a real kernel, we would use more descriptors.
    
    // 3. Build face structure using normalized indices
    const shells = [solid.outerShell, ...(solid.innerShells || [])].filter(Boolean);
    const normalizedShells = shells.map(shell => {
      const faces = (shell.orientedFaces || []).filter(of => of && of.face).map(of => {
        return {
          orientation: of.orientation,
          surfaceType: of.face.geometry?.type || 'UNKNOWN',
          outerLoop: this.normalizeLoop(of.face.outerLoop, vertexToIndex),
          innerLoops: (Array.isArray(of.face?.innerLoops) ? of.face.innerLoops : []).map(l => this.normalizeLoop(l, vertexToIndex))
        };
      }).sort((a, b) => {
        // Sort faces by some deterministic property (e.g. outer loop complexity or vertex indices)
        return JSON.stringify(a).localeCompare(JSON.stringify(b));
      });
      return { faces };
    }).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

    return {
      type: 'SOLID_TOPOLOGY',
      shells: normalizedShells
    };
  }

  /**
   * Generates a canonical representation of the geometry (numerical parameters).
   */
  private static getGeometryCanonical(solid: Solid): any {
    const allVertices = this.collectVertices(solid);
    const sortedVertices = [...allVertices].sort((a, b) => this.comparePoints(a.geometry, b.geometry));

    const verticesGeometry = sortedVertices.map(v => ({
      x: v.geometry.x,
      y: v.geometry.y,
      z: v.geometry.z
    }));

    const allFaces = this.collectFaces(solid);
    const surfacesGeometry = allFaces.map(f => {
      const g = f.geometry as any;
      if (!g) return { type: 'NONE' };
      
      const payload: any = { type: g.type };
      if (g.origin) payload.origin = { x: g.origin.x, y: g.origin.y, z: g.origin.z };
      if (g.normal) payload.normal = { x: g.normal.x, y: g.normal.y, z: g.normal.z };
      if (g.radius) payload.radius = g.radius;
      if (g.majorRadius) payload.majorRadius = g.majorRadius;
      if (g.minorRadius) payload.minorRadius = g.minorRadius;
      
      return payload;
    }).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

    return {
      type: 'SOLID_GEOMETRY',
      vertices: verticesGeometry,
      surfaces: surfacesGeometry
    };
  }

  private static normalizeLoop(loop: Loop, vertexToIndex: Map<Vertex, number>): any {
    if (!loop || !Array.isArray(loop.orientedEdges)) {
      return { edges: [] };
    }
    const rawEdges = loop.orientedEdges.map(oe => {
      if (!oe || !oe.edge) {
        return { orientation: 'FORWARD', vStart: -1, vEnd: -1, curveType: 'UNKNOWN' };
      }
      const startV = oe.orientation === Orientation.FORWARD ? oe.edge.startVertex : oe.edge.endVertex;
      const endV = oe.orientation === Orientation.FORWARD ? oe.edge.endVertex : oe.edge.startVertex;
      return {
        orientation: oe.orientation,
        vStart: (startV ? vertexToIndex.get(startV) : -1) ?? -1,
        vEnd: (endV ? vertexToIndex.get(endV) : -1) ?? -1,
        curveType: (oe.edge.geometry as any)?.type || 'UNKNOWN'
      };
    });

    if (rawEdges.length === 0) return { edges: [] };

    // Find the edge with the minimum vStart
    let minIdx = 0;
    let minVal = Infinity;
    for (let i = 0; i < rawEdges.length; i++) {
      if (rawEdges[i].vStart < minVal) {
        minVal = rawEdges[i].vStart;
        minIdx = i;
      }
    }

    // Cyclically shift rawEdges so it starts at minIdx
    const shiftedEdges = [
      ...rawEdges.slice(minIdx),
      ...rawEdges.slice(0, minIdx)
    ];

    return {
      edges: shiftedEdges
    };
  }

  private static collectVertices(solid: Solid): Set<Vertex> {
    const vertices = new Set<Vertex>();
    this.traverse(solid, (shape) => {
      if (shape.shapeType === TopoShapeEnum.VERTEX) {
        vertices.add(shape as Vertex);
      }
    });
    return vertices;
  }

  private static collectEdges(solid: Solid): Edge[] {
    const edges = new Set<Edge>();
    this.traverse(solid, (shape) => {
      if (shape.shapeType === TopoShapeEnum.EDGE) {
        edges.add(shape as Edge);
      }
    });
    return Array.from(edges);
  }

  private static collectFaces(solid: Solid): Face[] {
    const faces = new Set<Face>();
    this.traverse(solid, (shape) => {
      if (shape.shapeType === TopoShapeEnum.FACE) {
        faces.add(shape as Face);
      }
    });
    return Array.from(faces);
  }

  private static collectCounts(solid: Solid): any {
    const vertices = new Set<string>();
    const edges = new Set<string>();
    const faces = new Set<string>();
    const shells = new Set<string>();

    this.traverse(solid, (shape) => {
      switch (shape.shapeType) {
        case TopoShapeEnum.VERTEX: vertices.add(shape.id); break;
        case TopoShapeEnum.EDGE: edges.add(shape.id); break;
        case TopoShapeEnum.FACE: faces.add(shape.id); break;
        case TopoShapeEnum.SHELL: shells.add(shape.id); break;
      }
    });

    return {
      vertices: vertices.size,
      edges: edges.size,
      faces: faces.size,
      shells: shells.size
    };
  }

  /**
   * Computes a deterministic hash for a single face based on its geometry and boundary.
   */
  public static computeFaceHash(face: Face): string {
    const allVertices = new Set<Vertex>();
    const loops = [face.outerLoop, ...(Array.isArray(face.innerLoops) ? face.innerLoops : [])].filter(Boolean);
    for (const loop of loops) {
      if (!loop || !Array.isArray(loop.orientedEdges)) continue;
      for (const oe of loop.orientedEdges) {
        if (oe?.edge?.startVertex) allVertices.add(oe.edge.startVertex);
        if (oe?.edge?.endVertex) allVertices.add(oe.edge.endVertex);
      }
    }
    const sortedVertices = Array.from(allVertices).sort((a, b) => this.comparePoints(a.geometry, b.geometry));
    const vertexToIndex = new Map<Vertex, number>();
    sortedVertices.forEach((v, i) => vertexToIndex.set(v, i));

    const normalizedFace = {
      surfaceType: face.geometry?.type || 'UNKNOWN',
      outerLoop: this.normalizeLoop(face.outerLoop, vertexToIndex),
      innerLoops: (Array.isArray(face.innerLoops) ? face.innerLoops : []).map(l => this.normalizeLoop(l, vertexToIndex)),
      surfaceGeometry: (face.geometry as any)?.origin ? {
        origin: (face.geometry as any).origin,
        normal: (face.geometry as any).normal
      } : undefined
    };

    const { canonicalHash } = EngineeringHashChain.computeCanonicalHash(normalizedFace);
    return canonicalHash;
  }

  private static traverse(solid: Solid, callback: (shape: any) => void): void {
    if (!solid) return;
    const shells = [solid.outerShell, ...(Array.isArray(solid.innerShells) ? solid.innerShells : [])].filter(Boolean);
    for (const shell of shells) {
      if (!shell) continue;
      callback(shell);
      if (!shell.orientedFaces) continue;
      for (const oface of shell.orientedFaces) {
        if (!oface || !oface.face) continue;
        const face = oface.face;
        callback(face);
        const loops = [face.outerLoop, ...(Array.isArray(face.innerLoops) ? face.innerLoops : [])].filter(Boolean);
        for (const loop of loops) {
          if (!loop) continue;
          callback(loop);
          if (!loop.orientedEdges) continue;
          for (const oe of loop.orientedEdges) {
            if (!oe || !oe.edge) continue;
            callback(oe.edge);
            if (oe.edge.startVertex) callback(oe.edge.startVertex);
            if (oe.edge.endVertex) callback(oe.edge.endVertex);
          }
        }
      }
    }
  }

  private static comparePoints(a: Point, b: Point): number {
    const eps = 1e-9;
    if (Math.abs(a.x - b.x) > eps) return a.x - b.x;
    if (Math.abs(a.y - b.y) > eps) return a.y - b.y;
    if (Math.abs(a.z - b.z) > eps) return a.z - b.z;
    return 0;
  }
}
