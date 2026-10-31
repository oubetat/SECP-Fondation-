/**
 * SECP CAD Kernel — Native Boundary Loop Reconstruction & Geometric Cap Surface Engine
 * SECP-CAD-DIRECT-MODELING-CAP-002 / CAP-003
 */

import { Solid, Shell, Face, Loop, Edge, Vertex, TopoShapeEnum, Orientation, OrientedEdge, OrientedFace } from '../topology/TopologyContracts';
import { Surface, Point, Direction } from '../geometry/GeometryContracts';
import { Meters } from '../core/Units';
import { BRepValidator } from '../brep/BRepValidator';
import { EngineeringHashChain } from '../../evidence/EngineeringHashChain';

export interface CapClosureResult {
  success: boolean;
  cappedSolid?: Solid;
  diagnostics: string[];
}

class PlanarCapSurface implements Surface {
  public type = 'PLANE' as const;
  constructor(
    public origin: Point,
    public normal: Direction
  ) {}

  public evaluate(u: number, v: number): Point {
    return {
      x: (this.origin.x + u) as Meters,
      y: (this.origin.y + v) as Meters,
      z: this.origin.z
    };
  }

  public domain(): { uMin: number; uMax: number; vMin: number; vMax: number } {
    return { uMin: 0, uMax: 1, vMin: 0, vMax: 1 };
  }
}

export class CapClosureEngine {
  private static validator = new BRepValidator();

  /**
   * Executes WP01 through WP06: Boundary Edge Classification, Loop Reconstruction,
   * Geometric Cap Surface Construction, Native Topology Stitching, and Validation.
   */
  public static reconstructAndCap(
    solid: Solid,
    deletedFaceIds: string[],
    tolerance: number = 1e-7
  ): CapClosureResult {
    const diagnostics: string[] = [];

    if (!solid || solid.shapeType !== TopoShapeEnum.SOLID || !solid.outerShell) {
      diagnostics.push('CapClosureEngine: Invalid solid or missing outerShell.');
      return { success: false, diagnostics };
    }

    const targetDeletedSet = new Set(deletedFaceIds);
    const remainingFaces = solid.outerShell.orientedFaces.filter(of => !targetDeletedSet.has(of.face.id));
    const deletedFaces = solid.outerShell.orientedFaces.filter(of => targetDeletedSet.has(of.face.id));

    if (deletedFaces.length === 0) {
      diagnostics.push('CapClosureEngine: No matching deleted faces found.');
      return { success: false, diagnostics };
    }

    // WP01: Boundary Edge Classification
    // Track edge occurrence counts and orientation in remaining faces
    const edgeRemainingCount = new Map<string, number>();
    const edgeRemainingOrientation = new Map<string, Orientation>();
    const edgeMap = new Map<string, Edge>();

    for (const of of remainingFaces) {
      const face = of.face;
      const collectEdges = (loop?: Loop) => {
        if (!loop || !loop.orientedEdges) return;
        for (const oe of loop.orientedEdges) {
          if (!oe.edge) continue;
          const id = oe.edge.id;
          edgeMap.set(id, oe.edge);
          edgeRemainingCount.set(id, (edgeRemainingCount.get(id) || 0) + 1);
          edgeRemainingOrientation.set(id, oe.orientation);
        }
      };
      collectEdges(face.outerLoop);
      if (face.innerLoops) face.innerLoops.forEach(l => collectEdges(l));
    }

    // Identify edges that were incident to deleted faces
    const deletedEdgeIds = new Set<string>();
    for (const of of deletedFaces) {
      const face = of.face;
      const collectDeletedEdges = (loop?: Loop) => {
        if (!loop || !loop.orientedEdges) return;
        for (const oe of loop.orientedEdges) {
          if (!oe.edge) continue;
          deletedEdgeIds.add(oe.edge.id);
          edgeMap.set(oe.edge.id, oe.edge);
        }
      };
      collectDeletedEdges(face.outerLoop);
      if (face.innerLoops) face.innerLoops.forEach(l => collectDeletedEdges(l));
    }

    // In a 2-manifold solid, boundary edges of the opening have count in remaining faces === 1
    const exposedBoundaryEdges: { edge: Edge; orientationInRemaining: Orientation }[] = [];
    for (const edgeId of deletedEdgeIds) {
      const countInRemaining = edgeRemainingCount.get(edgeId) || 0;
      if (countInRemaining === 1) {
        const edge = edgeMap.get(edgeId);
        const orient = edgeRemainingOrientation.get(edgeId)!;
        if (edge && orient) {
          exposedBoundaryEdges.push({ edge, orientationInRemaining: orient });
        }
      }
    }

    if (exposedBoundaryEdges.length === 0) {
      diagnostics.push('CapClosureEngine: No exposed boundary edges found after face deletion.');
      return { success: false, diagnostics };
    }

    // In the capping face, each boundary edge must have the opposite orientation to its orientation in the remaining face
    const capOrientedEdges: OrientedEdge[] = exposedBoundaryEdges.map(({ edge, orientationInRemaining }) => ({
      edge,
      orientation: orientationInRemaining === Orientation.FORWARD ? Orientation.REVERSED : Orientation.FORWARD
    }));

    // WP02: Boundary Loop Reconstruction
    // Build directed graph of outgoing edges from oriented start vertices
    const getOrientedStartVertex = (oe: OrientedEdge): Vertex =>
      oe.orientation === Orientation.FORWARD ? oe.edge.startVertex : oe.edge.endVertex;
    const getOrientedEndVertex = (oe: OrientedEdge): Vertex =>
      oe.orientation === Orientation.FORWARD ? oe.edge.endVertex : oe.edge.startVertex;

    const outgoingEdges = new Map<string, OrientedEdge[]>();
    for (const oe of capOrientedEdges) {
      const startV = getOrientedStartVertex(oe);
      if (!startV) {
        diagnostics.push(`CapClosureEngine: Edge ${oe.edge.id} missing start vertex.`);
        return { success: false, diagnostics };
      }
      if (!outgoingEdges.has(startV.id)) outgoingEdges.set(startV.id, []);
      outgoingEdges.get(startV.id)!.push(oe);
    }

    // Verify manifold loop condition: each vertex in a simple loop has exactly 1 outgoing edge
    for (const [vId, edges] of outgoingEdges.entries()) {
      if (edges.length !== 1) {
        diagnostics.push(`CapClosureEngine: Non-manifold junction at vertex ${vId} with ${edges.length} outgoing edges. Fail-closed.`);
        return { success: false, diagnostics };
      }
    }

    // Trace closed loops
    const visitedEdgeIds = new Set<string>();
    const reconstructedLoops: OrientedEdge[][] = [];

    for (const startOE of capOrientedEdges) {
      if (visitedEdgeIds.has(startOE.edge.id)) continue;

      const currentLoop: OrientedEdge[] = [];
      let currentOE: OrientedEdge | null = startOE;
      const loopStartVertexId = getOrientedStartVertex(startOE).id;
      let loopClosed = false;
      let safetyCounter = 0;

      while (currentOE && safetyCounter < 1000) {
        safetyCounter++;
        visitedEdgeIds.add(currentOE.edge.id);
        currentLoop.push(currentOE);

        const currentEndVertexId = getOrientedEndVertex(currentOE).id;
        if (currentEndVertexId === loopStartVertexId) {
          loopClosed = true;
          break;
        }

        const nextCandidates = outgoingEdges.get(currentEndVertexId) || [];
        const nextOE = nextCandidates.find(oe => !visitedEdgeIds.has(oe.edge.id));
        if (!nextOE) {
          break;
        }
        currentOE = nextOE;
      }

      if (loopClosed && currentLoop.length >= 3) {
        reconstructedLoops.push(currentLoop);
      } else {
        diagnostics.push(`CapClosureEngine: Open or degenerate boundary loop detected (edges count: ${currentLoop.length}). Fail-closed triggered.`);
        return { success: false, diagnostics };
      }
    }

    if (reconstructedLoops.length === 0) {
      diagnostics.push('CapClosureEngine: Failed to reconstruct valid closed boundary loops. Fail-closed triggered.');
      return { success: false, diagnostics };
    }

    // WP03 & WP04: Geometric Cap Surface Construction & Native Topology Stitching
    const newFaces: OrientedFace[] = [...remainingFaces];

    for (let i = 0; i < reconstructedLoops.length; i++) {
      const loopOrientedEdges = reconstructedLoops[i];

      // Collect vertices in loop order
      const loopVertices: Vertex[] = loopOrientedEdges.map(oe => getOrientedStartVertex(oe));
      const N = loopVertices.length;
      if (N < 3) {
        diagnostics.push('CapClosureEngine: Loop has fewer than 3 vertices. Fail-closed.');
        return { success: false, diagnostics };
      }

      // Compute normal using Newell's method for arbitrary 3D polygons
      let nx = 0, ny = 0, nz = 0;
      for (let j = 0; j < N; j++) {
        const next = (j + 1) % N;
        const vj = loopVertices[j].geometry;
        const vnext = loopVertices[next].geometry;

        nx += (vj.y - vnext.y) * (vj.z + vnext.z);
        ny += (vj.z - vnext.z) * (vj.x + vnext.x);
        nz += (vj.x - vnext.x) * (vj.y + vnext.y);
      }

      const len = Math.hypot(nx, ny, nz);
      if (len < 1e-9) {
        diagnostics.push('CapClosureEngine: Degenerate or collinear boundary loop vertices. Fail-closed.');
        return { success: false, diagnostics };
      }

      const normal: Direction = {
        x: (nx / len) as Meters,
        y: (ny / len) as Meters,
        z: (nz / len) as Meters
      };

      const p0 = loopVertices[0].geometry;
      const d = -(normal.x * p0.x + normal.y * p0.y + normal.z * p0.z);

      // Verify coplanarity of all vertices in loop within tolerance
      for (let j = 0; j < N; j++) {
        const p = loopVertices[j].geometry;
        const dist = Math.abs(normal.x * p.x + normal.y * p.y + normal.z * p.z + d);
        if (dist > tolerance) {
          diagnostics.push(`CapClosureEngine: Boundary loop is non-coplanar (vertex ${loopVertices[j].id} deviation ${dist} > tolerance ${tolerance}). Non-planar caps unsupported in Phase 1. Fail-closed.`);
          return { success: false, diagnostics };
        }
      }

      // Deterministic ID generation based on canonical vertex loop coordinate signature
      const coordString = loopVertices
        .map(v => `${Number(v.geometry.x).toFixed(7)},${Number(v.geometry.y).toFixed(7)},${Number(v.geometry.z).toFixed(7)}`)
        .sort()
        .join(';');
      const hash = EngineeringHashChain.computeCanonicalHash({ loopSignature: coordString }).canonicalHash.substring(0, 10);
      const capFaceId = `cap_face_${i}_${hash}`;
      const capLoopId = `cap_loop_${i}_${hash}`;

      const capLoop: Loop = {
        id: capLoopId,
        shapeType: TopoShapeEnum.LOOP,
        orientedEdges: loopOrientedEdges
      };

      const capSurface = new PlanarCapSurface(p0, normal);

      const capFace: Face = {
        id: capFaceId,
        shapeType: TopoShapeEnum.FACE,
        geometry: capSurface,
        outerLoop: capLoop,
        innerLoops: []
      };

      newFaces.push({
        face: capFace,
        orientation: Orientation.FORWARD
      });
    }

    const updatedShell: Shell = {
      id: solid.outerShell.id,
      shapeType: TopoShapeEnum.SHELL,
      orientedFaces: newFaces
    };

    const updatedSolid: Solid = {
      id: solid.id,
      shapeType: TopoShapeEnum.SOLID,
      outerShell: updatedShell,
      innerShells: solid.innerShells ? [...solid.innerShells] : []
    };

    // WP05: Validation
    const validation = this.validator.validate(updatedSolid);
    if (validation.status !== 'VALID') {
      const errorDetails = validation.diagnostics.map(d => d.message).join('; ');
      diagnostics.push(`CapClosureEngine: Resulting solid failed validation: ${errorDetails}`);
      return { success: false, diagnostics };
    }

    diagnostics.push(`CapClosureEngine: Successfully reconstructed boundary loops and capped ${reconstructedLoops.length} opening(s).`);
    return {
      success: true,
      cappedSolid: updatedSolid,
      diagnostics
    };
  }
}
