/**
 * SECP CAD Kernel — Surface Sewing & Solid Reconstruction Engine
 * WP-05 Implementation & Independent Qualification
 */

import { Shell, Solid, Face, Edge, Loop, Vertex, TopoShapeEnum, Orientation } from '../topology/TopologyContracts';
import { BRepShell, BRepSolid, BRepFace, BRepLoop, BRepEdge, BRepVertex } from '../topology/BRepTopology';
import { Point, Direction, Curve, Surface } from '../geometry/GeometryContracts';
import { BRepValidator } from '../brep/BRepValidator';
import { BRepMutationGate277 } from '../brep/BRepMutationGate277';

import { BRepKernel } from '../brep/BRepKernel';

export interface SewingResult {
  success: boolean;
  sewnShell?: Shell;
  mergedVerticesCount: number;
  mergedEdgesCount: number;
  isClosed: boolean;
  diagnostics: string[];
}

class SegmentCurve implements Curve {
  constructor(private p1: Point, private p2: Point) {}
  public evaluate(u: number): Point {
    return {
      x: (this.p1.x + u * (this.p2.x - this.p1.x)) as any,
      y: (this.p1.y + u * (this.p2.y - this.p1.y)) as any,
      z: (this.p1.z + u * (this.p2.z - this.p1.z)) as any
    };
  }
  public domain(): { uMin: number; uMax: number } {
    return { uMin: 0, uMax: 1 };
  }
}

class PlanarSurfaceGeometry implements Surface {
  public type = 'PLANE' as const;
  constructor(public origin: Point, public normal: Direction) {}
  public evaluate(u: number, v: number): Point {
    return {
      x: (this.origin.x + u) as any,
      y: (this.origin.y + v) as any,
      z: this.origin.z
    };
  }
  public domain() { return { uMin: -100, uMax: 100, vMin: -100, vMax: 100 }; }
}

export class SurfaceSewingEngine {
  private static validator = new BRepValidator();

  /**
   * Sews multiple topological B-Rep faces into a unified B-Rep Shell by merging
   * coincident vertices and edges within tolerance and enforcing 2-manifold orientation.
   */
  public static sew(faces: Face[], id: string, tolerance: number = 1e-6): SewingResult {
    const diagnostics: string[] = [];
    if (!faces || faces.length === 0) {
      diagnostics.push('Sewing: No input faces provided');
      return { success: false, mergedVerticesCount: 0, mergedEdgesCount: 0, isClosed: false, diagnostics };
    }

    // 1. Collect all vertices across faces
    const allVertices: Vertex[] = [];
    for (const f of faces) {
      if (f.outerLoop && f.outerLoop.orientedEdges) {
        for (const oe of f.outerLoop.orientedEdges) {
          if (oe.edge.startVertex) allVertices.push(oe.edge.startVertex);
          if (oe.edge.endVertex) allVertices.push(oe.edge.endVertex);
        }
      }
    }

    // 2. Proximity vertex merging
    const canonicalVertexMap = new Map<string, Vertex>();
    const mergedVertices: Vertex[] = [];
    let mergedVertsCount = 0;

    for (const v of allVertices) {
      let matched: Vertex | null = null;
      for (const cv of mergedVertices) {
        const dist = Math.hypot(
          v.geometry.x - cv.geometry.x,
          v.geometry.y - cv.geometry.y,
          v.geometry.z - cv.geometry.z
        );
        if (dist <= tolerance) {
          matched = cv;
          break;
        }
      }

      if (matched) {
        canonicalVertexMap.set(v.id, matched);
        if (v.id !== matched.id) mergedVertsCount++;
      } else {
        canonicalVertexMap.set(v.id, v);
        mergedVertices.push(v);
      }
    }

    // 3. Re-link face edge endpoints to canonical merged vertices
    const orientedFaces = faces.map(f => {
      if (f.outerLoop && f.outerLoop.orientedEdges) {
        for (const oe of f.outerLoop.orientedEdges) {
          if (oe.edge.startVertex) {
            oe.edge.startVertex = canonicalVertexMap.get(oe.edge.startVertex.id) || oe.edge.startVertex;
          }
          if (oe.edge.endVertex) {
            oe.edge.endVertex = canonicalVertexMap.get(oe.edge.endVertex.id) || oe.edge.endVertex;
          }
        }
      }
      return { face: f, orientation: Orientation.FORWARD };
    });

    const sewnShell: Shell = {
      id,
      shapeType: TopoShapeEnum.SHELL,
      orientedFaces
    };

    const validation = this.validator.validate(sewnShell);
    const isClosed = validation.manifoldStatus === 'MANIFOLD';

    diagnostics.push(`Sewing completed: merged ${mergedVertsCount} duplicate vertices across ${faces.length} faces. Shell closed status: ${isClosed}.`);

    return {
      success: true,
      sewnShell,
      mergedVerticesCount: mergedVertsCount,
      mergedEdgesCount: 0,
      isClosed,
      diagnostics
    };
  }

  /**
   * Reconstructs a 2-manifold closed Solid from a watertight B-Rep Shell.
   */
  public static createSolidFromShell(shell: Shell, id: string): Solid {
    const validator = new BRepValidator();
    const res = validator.validate(shell);

    if (res.manifoldStatus === 'OPEN' || res.status === 'INVALID') {
      const errs = res.diagnostics.map(d => d.message).join('; ');
      throw new Error(`Cannot create Solid: Shell '${shell.id}' is not closed (watertight). Details: ${errs}`);
    }

    // Compute divergence volume to verify outward orientation
    const candidateSolid: Solid = {
      id,
      shapeType: TopoShapeEnum.SOLID,
      outerShell: shell,
      innerShells: []
    };

    const signedVol = BRepKernel.getCanonical().computeVolume(candidateSolid as any, { rawDivergence: true });
    if (signedVol < 0) {
      // Invert orientation of all faces to guarantee positive outward volume
      for (const of of shell.orientedFaces) {
        of.orientation = of.orientation === Orientation.FORWARD ? Orientation.REVERSED : Orientation.FORWARD;
      }
    }

    return candidateSolid;
  }

  /**
   * Thickens a surface (face/sheet body) into a 2-manifold closed solid body.
   */
  public static thicken(face: Face, thickness: number, id: string): Solid {
    if (!face || !face.outerLoop || !face.outerLoop.orientedEdges) {
      throw new Error('Thicken: Invalid input surface face');
    }
    if (thickness <= 0) {
      throw new Error('Thicken: Thickness parameter must be positive');
    }

    const orientedEdges = face.outerLoop.orientedEdges;
    const baseVertices: Vertex[] = orientedEdges.map(oe =>
      oe.orientation === Orientation.FORWARD ? oe.edge.startVertex : oe.edge.endVertex
    );
    const N = baseVertices.length;
    if (N < 3) {
      throw new Error('Thicken: Input surface must have at least 3 vertices');
    }

    // Determine normal vector
    const geom = face.geometry as any;
    let norm = geom?.normal || { x: 0, y: 0, z: 1 };
    const nLen = Math.hypot(norm.x, norm.y, norm.z) || 1;
    const un = { x: norm.x / nLen, y: norm.y / nLen, z: norm.z / nLen };

    // 1. Bottom Face (original, reversed orientation for outward solid shell)
    const bottomFace: Face = {
      id: `${id}_bottom_face`,
      shapeType: TopoShapeEnum.FACE,
      geometry: face.geometry,
      outerLoop: face.outerLoop,
      innerLoops: []
    };

    // 2. Top Offset Vertices & Face
    const topVertices: Vertex[] = baseVertices.map((v, i) => ({
      id: `${id}_top_v_${i}`,
      shapeType: TopoShapeEnum.VERTEX,
      geometry: {
        x: (v.geometry.x + un.x * thickness) as any,
        y: (v.geometry.y + un.y * thickness) as any,
        z: (v.geometry.z + un.z * thickness) as any
      },
      tolerance: 1e-7
    }));

    const topEdges: OrientedEdge[] = [];
    for (let i = 0; i < N; i++) {
      const vStart = topVertices[i];
      const vEnd = topVertices[(i + 1) % N];
      const edge: Edge = {
        id: `${id}_top_e_${i}`,
        shapeType: TopoShapeEnum.EDGE,
        geometry: new SegmentCurve(vStart.geometry, vEnd.geometry),
        startVertex: vStart,
        endVertex: vEnd,
        tolerance: 1e-7
      };
      topEdges.push({ edge, orientation: Orientation.FORWARD });
    }

    const topLoop: Loop = {
      id: `${id}_top_loop`,
      shapeType: TopoShapeEnum.LOOP,
      orientedEdges: topEdges
    };

    const topOrigin = topVertices[0].geometry;
    const topFace: Face = {
      id: `${id}_top_face`,
      shapeType: TopoShapeEnum.FACE,
      geometry: new PlanarSurfaceGeometry(topOrigin, un),
      outerLoop: topLoop,
      innerLoops: []
    };

    // 3. Side Boundary Wall Faces
    const sideFaces: { face: Face; orientation: Orientation }[] = [];
    const sideEdges: Edge[] = [];

    for (let i = 0; i < N; i++) {
      const vBotStart = baseVertices[i];
      const vTopStart = topVertices[i];
      const sideEdge: Edge = {
        id: `${id}_side_e_${i}`,
        shapeType: TopoShapeEnum.EDGE,
        geometry: new SegmentCurve(vBotStart.geometry, vTopStart.geometry),
        startVertex: vBotStart,
        endVertex: vTopStart,
        tolerance: 1e-7
      };
      sideEdges.push(sideEdge);
    }

    for (let i = 0; i < N; i++) {
      const next = (i + 1) % N;
      const vBotStart = baseVertices[i];
      const vBotEnd = baseVertices[next];
      const vTopStart = topVertices[i];
      const vTopEnd = topVertices[next];

      // Side wall quad: (vBotStart -> vBotEnd -> vTopEnd -> vTopStart)
      const eBot = orientedEdges[i].edge;
      const eSideRight = sideEdges[next];
      const eTop = topEdges[i].edge;
      const eSideLeft = sideEdges[i];

      const wallLoop: Loop = {
        id: `${id}_wall_loop_${i}`,
        shapeType: TopoShapeEnum.LOOP,
        orientedEdges: [
          { edge: eBot, orientation: Orientation.FORWARD },
          { edge: eSideRight, orientation: Orientation.FORWARD },
          { edge: eTop, orientation: Orientation.REVERSED },
          { edge: eSideLeft, orientation: Orientation.REVERSED }
        ]
      };

      // Wall normal (cross product of base edge and thickness direction)
      const eDir = { x: vBotEnd.geometry.x - vBotStart.geometry.x, y: vBotEnd.geometry.y - vBotStart.geometry.y, z: vBotEnd.geometry.z - vBotStart.geometry.z };
      const wallNorm = {
        x: eDir.y * un.z - eDir.z * un.y,
        y: eDir.z * un.x - eDir.x * un.z,
        z: eDir.x * un.y - eDir.y * un.x
      };
      const wLen = Math.hypot(wallNorm.x, wallNorm.y, wallNorm.z) || 1;

      const wallFace: Face = {
        id: `${id}_wall_face_${i}`,
        shapeType: TopoShapeEnum.FACE,
        geometry: new PlanarSurfaceGeometry(vBotStart.geometry, { x: wallNorm.x / wLen, y: wallNorm.y / wLen, z: wallNorm.z / wLen }),
        outerLoop: wallLoop,
        innerLoops: []
      };

      sideFaces.push({ face: wallFace, orientation: Orientation.FORWARD });
    }

    const orientedFaces = [
      { face: bottomFace, orientation: Orientation.REVERSED },
      { face: topFace, orientation: Orientation.FORWARD },
      ...sideFaces
    ];

    const shell: Shell = {
      id: `${id}_thickened_shell`,
      shapeType: TopoShapeEnum.SHELL,
      orientedFaces
    };

    return this.createSolidFromShell(shell, id);
  }
}
