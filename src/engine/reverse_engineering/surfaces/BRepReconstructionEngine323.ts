import { 
  BRepModel323, BRepVertex, BRepEdge, BRepCoEdge, 
  BRepLoop, BRepFace, BRepShell, BRepSolid, BRepEdgeCurve, BRepPoint3D 
} from './BRepReconstructionTypes323';
import { NURBSSurface322, NURBSSurfaceData322 } from './NURBSTypes322';
import { BRepEvaluator323 } from './BRepEvaluator323';

export class BRepReconstructionEngine323 {
  private static readonly TOLERANCE = 1e-5;

  public static reconstructPrimitive(nurbs: NURBSSurface322): BRepModel323 {
    return this.reconstructSolid([nurbs]);
  }

  public static reconstructSolid(nurbsList: NURBSSurface322[]): BRepModel323 {
    const model: BRepModel323 = {
      modelId: `BREP-MODEL-${nurbsList.map(n => n.surfaceId).join('_').substring(0, 20)}`,
      units: 'mm',
      coordinateFrame: 'WORLD',
      vertices: [],
      edges: [],
      coedges: [],
      loops: [],
      faces: [],
      shells: [],
      solids: [],
      provenance: { sourceNurbsIds: nurbsList.map(n => n.surfaceId), timestamp: new Date().toISOString() },
      validationReport: null
    };

    const vertexMap = new Map<string, BRepVertex>();
    const edgeList: BRepEdge[] = [];

    const f = (n: number) => {
      if (Math.abs(n) < 1e-7) return '0';
      return n.toFixed(5);
    };

    const getVertex = (p: BRepPoint3D): string => {
      for (const v of vertexMap.values()) {
        if (BRepEvaluator323.distance3D(v.point, p) <= this.TOLERANCE) {
          return v.vertexId;
        }
      }
      const vId = `V[${f(p.x)},${f(p.y)},${f(p.z)}]`;
      const v: BRepVertex = { vertexId: vId, point: p, toleranceMm: this.TOLERANCE };
      vertexMap.set(vId, v);
      return vId;
    };

    const findMatchingEdge = (vA: string, vB: string, ptMid: BRepPoint3D, edgeCurve: BRepEdgeCurve, edgeData: NURBSSurfaceData322): BRepEdge | null => {
      for (const e of edgeList) {
        if ((e.startVertexId === vA && e.endVertexId === vB) || (e.startVertexId === vB && e.endVertexId === vA)) {
          const nurbs = nurbsList.find(n => n.surfaceId === e.curve.surfaceId)!;
          
          const e25 = BRepEvaluator323.evaluateEdge(e.curve, nurbs.data, 0.25);
          const e75 = BRepEvaluator323.evaluateEdge(e.curve, nurbs.data, 0.75);
          
          let my25 = BRepEvaluator323.evaluateEdge(edgeCurve, edgeData, 0.25);
          let my75 = BRepEvaluator323.evaluateEdge(edgeCurve, edgeData, 0.75);
          
          if (e.startVertexId === vB) {
            my25 = BRepEvaluator323.evaluateEdge(edgeCurve, edgeData, 0.75);
            my75 = BRepEvaluator323.evaluateEdge(edgeCurve, edgeData, 0.25);
          }
          
          if (BRepEvaluator323.distance3D(ptMid, BRepEvaluator323.evaluateEdge(e.curve, nurbs.data, 0.5)) <= this.TOLERANCE &&
              BRepEvaluator323.distance3D(e25, my25) <= this.TOLERANCE && 
              BRepEvaluator323.distance3D(e75, my75) <= this.TOLERANCE) {
            return e;
          }
        }
      }
      return null;
    };

    let coedgeCounter = 0;
    let faceCounter = 0;

    for (const nurbs of nurbsList) {
      const data = nurbs.data;
      const u0 = data.knotsU[0];
      const u1 = data.knotsU[data.knotsU.length - 1];
      const v0 = data.knotsV[0];
      const v1 = data.knotsV[data.knotsV.length - 1];

      // CCW sequence for a face:
      // 1. V_MIN: u goes u0->u1 (canonical FORWARD)
      // 2. U_MAX: v goes v0->v1 (canonical FORWARD)
      // 3. V_MAX: u goes u1->u0 (canonical is u0->u1, so REVERSED)
      // 4. U_MIN: v goes v1->v0 (canonical is v0->v1, so REVERSED)
      
      const bounds = [
        { type: 'V_MIN', isDegenerate: this.isDegenerate(data, 'V_MIN'), canonicalForward: true },
        { type: 'U_MAX', isDegenerate: this.isDegenerate(data, 'U_MAX'), canonicalForward: true },
        { type: 'V_MAX', isDegenerate: this.isDegenerate(data, 'V_MAX'), canonicalForward: false },
        { type: 'U_MIN', isDegenerate: this.isDegenerate(data, 'U_MIN'), canonicalForward: false }
      ];

      const coedgeIds: string[] = [];

      for (const b of bounds) {
        let canStartPt: BRepPoint3D, canEndPt: BRepPoint3D;
        
        const curve: BRepEdgeCurve = { type: b.isDegenerate ? 'DEGENERATE' : 'NURBS_ISO_CURVE', surfaceId: nurbs.surfaceId, boundaryType: b.type as 'U_MIN' | 'U_MAX' | 'V_MIN' | 'V_MAX', tMin: 0, tMax: 1 };
        
        if (b.type === 'V_MIN') { canStartPt = BRepEvaluator323.evaluateFace(data, u0, v0); canEndPt = BRepEvaluator323.evaluateFace(data, u1, v0); }
        else if (b.type === 'U_MAX') { canStartPt = BRepEvaluator323.evaluateFace(data, u1, v0); canEndPt = BRepEvaluator323.evaluateFace(data, u1, v1); }
        else if (b.type === 'V_MAX') { canStartPt = BRepEvaluator323.evaluateFace(data, u0, v1); canEndPt = BRepEvaluator323.evaluateFace(data, u1, v1); }
        else { canStartPt = BRepEvaluator323.evaluateFace(data, u0, v0); canEndPt = BRepEvaluator323.evaluateFace(data, u0, v1); }

        const vStart = getVertex(canStartPt);
        const vEnd = getVertex(canEndPt);
        const midPt = BRepEvaluator323.evaluateEdge(curve, data, 0.5);

        let edge = findMatchingEdge(vStart, vEnd, midPt, curve, data);
        let orientation: 'FORWARD' | 'REVERSED' = b.canonicalForward ? 'FORWARD' : 'REVERSED';

        if (!edge) {
          edge = {
            edgeId: `edge_${edgeList.length}`,
            curve,
            startVertexId: vStart,
            endVertexId: vEnd,
            isDegenerate: b.isDegenerate,
            toleranceMm: this.TOLERANCE
          };
          edgeList.push(edge);
        } else {
          // If the matching edge was stored opposite to this canonical geometry
          // We adjust orientation relative to the matched edge's direction
          if (edge.startVertexId === vEnd && edge.endVertexId === vStart) {
            orientation = orientation === 'FORWARD' ? 'REVERSED' : 'FORWARD';
          }
        }

        const coedgeId = `coedge_${coedgeCounter++}`;
        model.coedges.push({ coedgeId, edgeId: edge.edgeId, orientation });
        coedgeIds.push(coedgeId);
      }

      const loopId = `loop_${faceCounter}`;
      model.loops.push({ loopId, coedgeIds, type: 'OUTER' });

      model.faces.push({
        faceId: `face_${faceCounter++}`,
        surfaceId: nurbs.surfaceId,
        outerLoopId: loopId,
        innerLoopIds: [],
        orientation: 'FORWARD', 
        uvDomain: { uMin: u0, uMax: u1, vMin: v0, vMax: v1 }
      });
    }

    model.vertices = Array.from(vertexMap.values());
    model.edges = edgeList;

    const shellId = 'shell_0';
    model.shells.push({ shellId, faceIds: model.faces.map(f => f.faceId) });

    // Determine incidence internally to decide if we output a Solid.
    // We only output a Solid if it is genuinely closed and manifold.
    const incidence = new Map<string, number>();
    for (const ce of model.coedges) {
      const e = model.edges.find(x => x.edgeId === ce.edgeId)!;
      if (!e.isDegenerate) {
         incidence.set(e.edgeId, (incidence.get(e.edgeId) || 0) + 1);
      }
    }
    
    let isClosed = true;
    let isManifold = true;
    for (const [_, count] of incidence.entries()) {
      if (count === 1) isClosed = false;
      if (count > 2) isManifold = false;
    }
    
    // An empty shell is not a valid solid
    if (model.faces.length === 0) isClosed = false;

    if (isClosed && isManifold) {
      model.solids.push({ solidId: 'solid_0', outerShellId: shellId, innerShellIds: [] });
    }

    return model;
  }

  private static isDegenerate(data: NURBSSurfaceData322, bType: string): boolean {
    const res = 10;
    const u0 = data.knotsU[0], u1 = data.knotsU[data.knotsU.length - 1];
    const v0 = data.knotsV[0], v1 = data.knotsV[data.knotsV.length - 1];
    
    let refPt: BRepPoint3D;
    if (bType === 'V_MIN') refPt = BRepEvaluator323.evaluateFace(data, u0, v0);
    else if (bType === 'U_MAX') refPt = BRepEvaluator323.evaluateFace(data, u1, v0);
    else if (bType === 'V_MAX') refPt = BRepEvaluator323.evaluateFace(data, u0, v1);
    else refPt = BRepEvaluator323.evaluateFace(data, u0, v0); 

    for (let i = 1; i <= res; i++) {
      const t = i / res;
      let p: BRepPoint3D;
      if (bType === 'V_MIN') p = BRepEvaluator323.evaluateFace(data, u0 + t*(u1-u0), v0);
      else if (bType === 'U_MAX') p = BRepEvaluator323.evaluateFace(data, u1, v0 + t*(v1-v0));
      else if (bType === 'V_MAX') p = BRepEvaluator323.evaluateFace(data, u0 + t*(u1-u0), v1);
      else p = BRepEvaluator323.evaluateFace(data, u0, v0 + t*(v1-v0)); 

      if (BRepEvaluator323.distance3D(refPt, p) > this.TOLERANCE) {
        return false;
      }
    }
    return true;
  }
}
