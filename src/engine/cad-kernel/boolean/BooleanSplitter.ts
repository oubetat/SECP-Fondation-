/**
 * SECP CAD Kernel — Topology Splitter & Reconstructor
 * Phase 2 (PATCH-019)
 */
import {
  Solid, Shell, Face, Edge, Loop, Vertex, TopoShapeEnum, Orientation
} from '../topology/TopologyContracts';
import { Point, Curve, Plane } from '../geometry/GeometryContracts';
import { SurfaceIntersectionCurve, BooleanDiagnostic } from './BooleanTypes';
import { BooleanTolerance } from './BooleanTolerance';
import { BooleanDiagnostics } from './BooleanDiagnostics';
import { BooleanClassifier } from './BooleanClassifier';
import { GeometricTolerance, GeometricToleranceModel } from '../predicates/GeometricTolerance';
import { VectorPredicates } from '../predicates/VectorPredicates';
import { ToleranceAwareVertexRegistry, ToleranceAwareEdgeRegistry } from './BooleanRegistries';

export interface SplitFaceRecord {
  id: string;
  originalFaceId: string;
  parentSolidId: string;
  face: Face;
  orientation: Orientation;
}

export class BooleanSplitter {
  /**
   * Splits the faces of solidA and solidB along their intersection curves.
   */
  public static splitSolids(
    solidA: Solid,
    solidB: Solid,
    intersectionCurves: SurfaceIntersectionCurve[],
    model: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): {
    splitFacesA: SplitFaceRecord[];
    splitFacesB: SplitFaceRecord[];
    diagnostics: BooleanDiagnostic[];
  } {
    const diagnostics: BooleanDiagnostic[] = [];
    const splitFacesA: SplitFaceRecord[] = [];
    const splitFacesB: SplitFaceRecord[] = [];

    // Map intersection curves by source face ID
    const curvesByFaceA = new Map<string, SurfaceIntersectionCurve[]>();
    const curvesByFaceB = new Map<string, SurfaceIntersectionCurve[]>();

    for (const ic of intersectionCurves) {
      if (!curvesByFaceA.has(ic.sourceSurfaceAId)) curvesByFaceA.set(ic.sourceSurfaceAId, []);
      curvesByFaceA.get(ic.sourceSurfaceAId)!.push(ic);

      if (!curvesByFaceB.has(ic.sourceSurfaceBId)) curvesByFaceB.set(ic.sourceSurfaceBId, []);
      curvesByFaceB.get(ic.sourceSurfaceBId)!.push(ic);
    }

    const vRegistry = new ToleranceAwareVertexRegistry(model);
    const eRegistry = new ToleranceAwareEdgeRegistry(model);

    // Process Solid A faces
    if (solidA.outerShell) {
      for (const oface of solidA.outerShell.orientedFaces) {
        if (!oface.face) continue;
        const faceCurves = curvesByFaceA.get(oface.face.id) || [];
        const splitResult = this.splitFaceByCurves(oface.face, solidA.id, faceCurves, model, vRegistry, eRegistry, oface.orientation);
        splitFacesA.push(...splitResult.splitFaces);
        diagnostics.push(...splitResult.diagnostics);
      }
    }

    // Process Solid B faces
    if (solidB.outerShell) {
      for (const oface of solidB.outerShell.orientedFaces) {
        if (!oface.face) continue;
        const faceCurves = curvesByFaceB.get(oface.face.id) || [];
        const splitResult = this.splitFaceByCurves(oface.face, solidB.id, faceCurves, model, vRegistry, eRegistry, oface.orientation);
        splitFacesB.push(...splitResult.splitFaces);
        diagnostics.push(...splitResult.diagnostics);
      }
    }

    // Post-process to stitch topology across face boundaries (A and B combined)
    const allSplitFaces = [...splitFacesA, ...splitFacesB];
    BooleanSplitter.stitchSplitFaces(allSplitFaces, model, vRegistry, eRegistry);

    return {
      splitFacesA,
      splitFacesB,
      diagnostics
    };
  }

  private static stitchSplitFaces(
    records: SplitFaceRecord[], 
    model: GeometricToleranceModel,
    vRegistry: ToleranceAwareVertexRegistry,
    eRegistry: ToleranceAwareEdgeRegistry
  ) {
    // First pass: identify and merge vertices across all faces using the canonical registry
    for (const record of records) {
      if (record.face.outerLoop) {
        for (const oe of record.face.outerLoop.orientedEdges) {
          if (oe.edge) {
            if (oe.edge.startVertex) {
              const canonStart = vRegistry.getCanonicalVertex(oe.edge.startVertex.geometry);
              oe.edge.startVertex = canonStart;
            }
            if (oe.edge.endVertex) {
              const canonEnd = vRegistry.getCanonicalVertex(oe.edge.endVertex.geometry);
              oe.edge.endVertex = canonEnd;
            }
            if (oe.edge.startVertex && oe.edge.endVertex) {
              const canonEdge = eRegistry.getCanonicalEdge(oe.edge.startVertex, oe.edge.endVertex);
              oe.edge = canonEdge;
            }
          }
        }
      }
    }

    // Handle Periodic Seams (Spherical/Cylindrical)
    // If a face is periodic, vertices on the U=0 and U=2pi seams must be reconciled
    this.reconcilePeriodicSeams(records, vRegistry, eRegistry, model);

    // Second pass: Vertex insertion (ensuring coincident points from other faces are inserted)
    // We collect all canonical vertices to use as a point cloud for splitting
    const pc = vRegistry.getAllVertices().map(v => v.geometry); 
    
    for (const record of records) {
      if (!record.face.outerLoop) continue;
      
      const pts = BooleanClassifier.getLoopVertices(record.face.outerLoop);
      if (pts.length < 3) continue;

      let modified = false;
      const newPts: Point[] = [];

      for (let i = 0; i < pts.length; i++) {
        const p1 = pts[i];
        const p2 = pts[(i + 1) % pts.length];
        
        newPts.push(p1);

        const collinear: { p: Point; dist: number }[] = [];
        for (const pt of pc) {
          // Check if point pt is already a vertex of this edge (p1 or p2)
          if (BooleanTolerance.arePointsCoincident(pt, p1, model) || BooleanTolerance.arePointsCoincident(pt, p2, model)) continue;

          const vec12 = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };
          const len12Sq = vec12.x * vec12.x + vec12.y * vec12.y + vec12.z * vec12.z;
          
          if (len12Sq < 1e-12) continue;

          const vec1p = { x: pt.x - p1.x, y: pt.y - p1.y, z: pt.z - p1.z };
          const dot = vec1p.x * vec12.x + vec1p.y * vec12.y + vec1p.z * vec12.z;

          if (dot > 1e-8 && dot < len12Sq - 1e-8) {
            const t = dot / len12Sq;
            const proj = {
              x: p1.x + t * vec12.x,
              y: p1.y + t * vec12.y,
              z: p1.z + t * vec12.z
            };
            const dist = Math.hypot(pt.x - proj.x, pt.y - proj.y, pt.z - proj.z);
            if (dist <= model.absoluteLength) {
              collinear.push({ p: pt, dist: t });
            }
          }
        }

        if (collinear.length > 0) {
          collinear.sort((a, b) => a.dist - b.dist);
          
          let lastPt = p1;
          for (const col of collinear) {
            if (!BooleanTolerance.arePointsCoincident(col.p, lastPt, model) && !BooleanTolerance.arePointsCoincident(col.p, p2, model)) {
              newPts.push(col.p);
              lastPt = col.p;
            }
          }
          modified = true;
        }
      }

      if (modified) {
        record.face = this.buildFaceFromVertices(record.face.id, newPts, record.face.geometry, vRegistry, eRegistry, record.face.outerLoop);
      }
    }
  }

  /**
   * Splits a single face using a set of intersection curves.
   */
  public static splitFaceByCurves(
    face: Face,
    parentSolidId: string,
    curves: SurfaceIntersectionCurve[],
    model: GeometricToleranceModel = GeometricTolerance.DEFAULT,
    vRegistry: ToleranceAwareVertexRegistry = new ToleranceAwareVertexRegistry(model),
    eRegistry: ToleranceAwareEdgeRegistry = new ToleranceAwareEdgeRegistry(model),
    orientation: Orientation = Orientation.FORWARD
  ): { splitFaces: SplitFaceRecord[]; diagnostics: BooleanDiagnostic[] } {
    const diagnostics: BooleanDiagnostic[] = [];

    if (curves.length === 0) {
      return {
        splitFaces: [{ id: face.id, originalFaceId: face.id, parentSolidId, face: this.canonicalizeFace(face, vRegistry, eRegistry), orientation }],
        diagnostics: []
      };
    }

    let currentFaces: Face[] = [face];

    for (let cIdx = 0; cIdx < curves.length; cIdx++) {
      const c = curves[cIdx];
      if (c.points3d.length < 2) continue;

      for (let i = 0; i < c.points3d.length - 1; i++) {
        const pStart = c.points3d[i];
        const pEnd = c.points3d[i+1];

        if (BooleanTolerance.isZeroLengthEdge(pStart, pEnd, model)) {
          continue;
        }

        const nextFaces: Face[] = [];
        for (const curFace of currentFaces) {
          const subSplit = this.splitSingleFaceBySegment(curFace, pStart, pEnd, `${face.id}_s${cIdx}_p${i}`, model, vRegistry, eRegistry);
          nextFaces.push(...subSplit);
        }
        currentFaces = nextFaces;
      }
    }

    const splitRecords: SplitFaceRecord[] = currentFaces.map((f) => ({
      id: f.id,
      originalFaceId: face.id,
      parentSolidId,
      face: this.canonicalizeFace(f, vRegistry, eRegistry),
      orientation
    }));

    return { splitFaces: splitRecords, diagnostics };
  }

  private static splitSingleFaceBySegment(
    face: Face,
    pStart: Point,
    pEnd: Point,
    tag: string,
    model: GeometricToleranceModel,
    vRegistry: ToleranceAwareVertexRegistry,
    eRegistry: ToleranceAwareEdgeRegistry
  ): Face[] {
    // For non-planar faces, we currently project to local plane for splitting
    // This is a common CAD kernel approximation for complex intersections
    
    const poly = BooleanClassifier.getLoopVertices(face.outerLoop);
    if (poly.length < 3) return [face];

    let plane: Plane | null = null;
    if (face.geometry.type === 'PLANE') {
      plane = face.geometry as any;
    } else {
      plane = BooleanClassifier.getFacePlane(face);
    }
    
    if (!plane) return [face];

    const cutVec = { x: pEnd.x - pStart.x, y: pEnd.y - pStart.y, z: pEnd.z - pStart.z };
    const cutLenSq = cutVec.x * cutVec.x + cutVec.y * cutVec.y + cutVec.z * cutVec.z;
    if (cutLenSq < model.absoluteLength * model.absoluteLength) return [face];

    // Compute cutting plane normal (perpendicular to both face normal and cut direction)
    const cutNormal = VectorPredicates.crossProduct(cutVec, plane.normal).value;
    if (!cutNormal) return [face];

    const normLen = Math.hypot(cutNormal.x, cutNormal.y, cutNormal.z);
    if (normLen < 1e-12) return [face];
    const nCut = { x: cutNormal.x / normLen, y: cutNormal.y / normLen, z: cutNormal.z / normLen };

    const sideA: Point[] = [];
    const sideB: Point[] = [];

    const eps = model.absoluteLength;
    const n = poly.length;

    for (let i = 0; i < n; i++) {
      const vCurr = poly[i];
      const vNext = poly[(i + 1) % n];

      const dCurr = (vCurr.x - pStart.x) * nCut.x + (vCurr.y - pStart.y) * nCut.y + (vCurr.z - pStart.z) * nCut.z;
      const dNext = (vNext.x - pStart.x) * nCut.x + (vNext.y - pStart.y) * nCut.y + (vNext.z - pStart.z) * nCut.z;

      if (dCurr >= -eps) {
        if (!sideA.some(p => BooleanTolerance.arePointsCoincident(p, vCurr, model))) sideA.push(vCurr);
      }
      if (dCurr <= eps) {
        if (!sideB.some(p => BooleanTolerance.arePointsCoincident(p, vCurr, model))) sideB.push(vCurr);
      }

      if ((dCurr > eps && dNext < -eps) || (dCurr < -eps && dNext > eps)) {
        const t = dCurr / (dCurr - dNext);
        const pInt: Point = {
          x: vCurr.x + t * (vNext.x - vCurr.x),
          y: vCurr.y + t * (vNext.y - vCurr.y),
          z: vCurr.z + t * (vNext.z - vCurr.z)
        };

        if (!sideA.some(p => BooleanTolerance.arePointsCoincident(p, pInt, model))) sideA.push(pInt);
        if (!sideB.some(p => BooleanTolerance.arePointsCoincident(p, pInt, model))) sideB.push(pInt);
      }
    }

    if (sideA.length < 3 || sideB.length < 3) {
      return [face];
    }

    const f1 = this.buildFaceFromVertices(`${face.id}_${tag}_a`, sideA, face.geometry, vRegistry, eRegistry);
    const f2 = this.buildFaceFromVertices(`${face.id}_${tag}_b`, sideB, face.geometry, vRegistry, eRegistry);

    return [f1, f2];
  }

  private static reconcilePeriodicSeams(
    records: SplitFaceRecord[],
    vRegistry: ToleranceAwareVertexRegistry,
    eRegistry: ToleranceAwareEdgeRegistry,
    model: GeometricToleranceModel
  ) {
    // Collect all vertices that lie on periodic boundaries
    // For spheres/cylinders, we check if the UV projection of a vertex maps to a seam.
    // However, the canonical registry already merges based on 3D distance.
    // This method ensures that edges crossing or touching the seam are properly canonicalized.
    
    for (const record of records) {
      const surface = record.face.geometry;
      if (!surface || !surface.isPeriodic) continue;

      // Ensure that any edge that is effectively a 'seam edge' (connecting same geometric points but at 0 and 2pi)
      // is handled as a degenerate or manifold-closed edge.
      // (This is a simplified placeholder for the full periodic reconciliation logic)
    }
  }

  private static buildFaceFromVertices(
    faceId: string, 
    pts: Point[], 
    surface: any, 
    vRegistry: ToleranceAwareVertexRegistry,
    eRegistry: ToleranceAwareEdgeRegistry,
    originalLoop?: Loop
  ): Face {
    const dummyCurve = {
      evaluate: (t: number) => ({ x: t, y: 0, z: 0 }),
      domain: () => ({ uMin: 0, uMax: 1 })
    };

    // Determine if we need to reverse the pts to match originalLoop orientation
    let finalPts = [...pts];
    if (originalLoop && pts.length >= 3) {
      const origPts = BooleanClassifier.getLoopVertices(originalLoop);
      if (origPts.length >= 3) {
        // Project to local plane for robust 2D orientation check
        const plane = BooleanClassifier.getBestFitPlane(origPts);
        const project = (p: Point) => {
          const v = { x: p.x - plane.origin.x, y: p.y - plane.origin.y, z: p.z - plane.origin.z };
          return {
            x: v.x * plane.u.x + v.y * plane.u.y + v.z * plane.u.z,
            y: v.x * plane.v.x + v.y * plane.v.y + v.z * plane.v.z
          };
        };
        const p2dOrig = origPts.map(project);
        const p2dNew = pts.map(project);

        const computeSignedArea = (p2d: { x: number, y: number }[]) => {
          let area = 0;
          for (let i = 0, j = p2d.length - 1; i < p2d.length; j = i++) {
            area += (p2d[j].x + p2d[i].x) * (p2d[j].y - p2d[i].y);
          }
          return area;
        };

        const areaOrig = computeSignedArea(p2dOrig);
        const areaNew = computeSignedArea(p2dNew);

        // If the signed area has a different sign, the orientation is reversed
        if ((areaOrig > 0) !== (areaNew > 0) && Math.abs(areaOrig) > 1e-10 && Math.abs(areaNew) > 1e-10) {
          finalPts.reverse();
        }
      }
    }

    const orientedEdges = [];
    for (let i = 0; i < finalPts.length; i++) {
      const p1 = finalPts[i];
      const p2 = finalPts[(i + 1) % finalPts.length];

      const v1 = vRegistry.getCanonicalVertex(p1);
      const v2 = vRegistry.getCanonicalVertex(p2);

      const edge = eRegistry.getCanonicalEdge(v1, v2);

      orientedEdges.push({ 
        edge, 
        orientation: edge.startVertex === v1 ? Orientation.FORWARD : Orientation.REVERSED 
      });
    }

    const loop: Loop = {
      id: `loop_${faceId}`,
      shapeType: TopoShapeEnum.LOOP,
      orientedEdges
    };

    return {
      id: faceId,
      shapeType: TopoShapeEnum.FACE,
      geometry: surface,
      outerLoop: loop,
      innerLoops: []
    };
  }

  private static findMatchingVertexInLoop(p: Point, loop?: Loop): Vertex | null {
    if (!loop || !loop.orientedEdges) return null;
    for (const oe of loop.orientedEdges) {
      if (!oe.edge) continue;
      if (oe.edge.startVertex && BooleanTolerance.arePointsCoincident(p, oe.edge.startVertex.geometry)) {
        return oe.edge.startVertex;
      }
      if (oe.edge.endVertex && BooleanTolerance.arePointsCoincident(p, oe.edge.endVertex.geometry)) {
        return oe.edge.endVertex;
      }
    }
    return null;
  }

  private static findMatchingEdgeInLoop(p1: Point, p2: Point, loop?: Loop): { edge: Edge; orientation: Orientation } | null {
    if (!loop || !loop.orientedEdges) return null;
    for (const oe of loop.orientedEdges) {
      if (!oe.edge || !oe.edge.startVertex || !oe.edge.endVertex) continue;
      const sv = oe.edge.startVertex.geometry;
      const ev = oe.edge.endVertex.geometry;

      const direct = BooleanTolerance.arePointsCoincident(p1, sv) && BooleanTolerance.arePointsCoincident(p2, ev);
      const rev = BooleanTolerance.arePointsCoincident(p1, ev) && BooleanTolerance.arePointsCoincident(p2, sv);

      if (direct) {
        return { edge: oe.edge, orientation: Orientation.FORWARD };
      }
      if (rev) {
        return { edge: oe.edge, orientation: Orientation.REVERSED };
      }
    }
    return null;
  }

  private static canonicalizeFace(face: Face, vRegistry: ToleranceAwareVertexRegistry, eRegistry: ToleranceAwareEdgeRegistry): Face {
    const pts = BooleanClassifier.getLoopVertices(face.outerLoop);
    if (pts.length < 3) return face;
    return this.buildFaceFromVertices(face.id, pts, face.geometry, vRegistry, eRegistry, face.outerLoop);
  }

  private static getCanonicalVertexId(p: Point): string {
    const rx = p.x.toFixed(10);
    const ry = p.y.toFixed(10);
    const rz = p.z.toFixed(10);
    return `v_canon_${rx}_${ry}_${rz}`;
  }

  private static getCanonicalEdgeId(p1: Point, p2: Point): string {
    const v1Id = this.getCanonicalVertexId(p1);
    const v2Id = this.getCanonicalVertexId(p2);
    return v1Id < v2Id ? `e_canon_${v1Id}_${v2Id}` : `e_canon_${v2Id}_${v1Id}`;
  }
}
