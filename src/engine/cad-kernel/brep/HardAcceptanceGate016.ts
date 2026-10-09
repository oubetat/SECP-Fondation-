import { BRepValidator } from './BRepValidator';
import { 
  TopoShapeEnum, Vertex, Edge, Loop, Face, Shell, Solid, Orientation 
} from '../topology/TopologyContracts';
import { Point } from '../geometry/GeometryContracts';

export interface GateResult016 {
  verdict: 'PASS' | 'FAIL' | 'UNPROVEN' | 'INCONCLUSIVE';
  reason: string;
  checks: Record<string, boolean>;
}

export class HardAcceptanceGate016 {
  public static evaluate(): GateResult016 {
    try {
      const validator = new BRepValidator();
      const createPt = (x:number, y:number, z:number): Point => ({ x, y, z });
      const dummyGeom: any = { type: 'dummy' };

      // 1. Manifold Check
      const v1: Vertex = { id: 'v1', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(0,0,0), tolerance: 1e-7 };
      const v2: Vertex = { id: 'v2', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(1,0,0), tolerance: 1e-7 };
      const e12: Edge = { id: 'e12', shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: v1, endVertex: v2, tolerance: 1e-7 };
      
      const makeFace = (id: string, e: Edge) => {
        const e21: Edge = { id: `${id}_e21`, shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: v2, endVertex: v1, tolerance: 1e-7 };
        const loop: Loop = { id: `${id}_l`, shapeType: TopoShapeEnum.LOOP, orientedEdges: [
          { edge: e, orientation: Orientation.FORWARD },
          { edge: e21, orientation: Orientation.FORWARD }
        ]};
        return { id, shapeType: TopoShapeEnum.FACE, geometry: dummyGeom, outerLoop: loop, innerLoops: [] } as Face;
      };

      const shell: Shell = { id: 'sh1', shapeType: TopoShapeEnum.SHELL, orientedFaces: [
        { face: makeFace('fA', e12), orientation: Orientation.FORWARD },
        { face: makeFace('fB', e12), orientation: Orientation.FORWARD },
        { face: makeFace('fC', e12), orientation: Orientation.FORWARD }
      ]};
      const solid: Solid = { id: 's1', shapeType: TopoShapeEnum.SOLID, outerShell: shell, innerShells: [] };
      const manifoldRes = validator.validate(solid);

      // 2. Open Shell solid rejection check
      const shellOpen: Shell = { id: 'sh2', shapeType: TopoShapeEnum.SHELL, orientedFaces: [
        { face: makeFace('fD', e12), orientation: Orientation.FORWARD }
      ]};
      const solidOpen: Solid = { id: 's2', shapeType: TopoShapeEnum.SOLID, outerShell: shellOpen, innerShells: [] };
      const solidOpenRes = validator.validate(solidOpen);

      // 3. Duplicate ID check
      const v2_dup: Vertex = { id: 'v1', shapeType: TopoShapeEnum.VERTEX, geometry: createPt(1,0,0), tolerance: 1e-7 }; 
      const eDup: Edge = { id: 'eDup', shapeType: TopoShapeEnum.EDGE, geometry: dummyGeom, startVertex: v1, endVertex: v2_dup, tolerance: 1e-7 };
      const dupRes = validator.validate(eDup);

      const checks = {
        detectsNonManifold: manifoldRes.status === 'INVALID' && manifoldRes.manifoldStatus === 'NON_MANIFOLD',
        rejectsOpenSolid: solidOpenRes.status === 'INVALID' && solidOpenRes.manifoldStatus === 'OPEN',
        rejectsDuplicateVertexIds: dupRes.status === 'INVALID' && dupRes.diagnostics.some(d => d.code === 'DUPLICATE_ID')
      };

      const allPassed = Object.values(checks).every(v => v === true);

      return {
        verdict: allPassed ? 'PASS' : 'FAIL',
        reason: allPassed ? 'All B-Rep structural checks enforced.' : 'One or more structural checks failed.',
        checks
      };
    } catch (e) {
      return { verdict: 'INCONCLUSIVE', reason: `Exception during evaluation: ${e}`, checks: {} };
    }
  }
}
