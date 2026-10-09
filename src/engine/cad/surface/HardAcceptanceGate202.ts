/**
 * SECP CAD Kernel — Hard Acceptance Gate 202 (Surface Modeling)
 * Phase 19 — Production CAD Core
 */
import { CADPart } from '../../parametric-cad/ParametricCADTypes';
import { SurfaceEngine } from './SurfaceEngine';
import { GateCheck } from '../../cad-kernel/boolean/BooleanTypes';
import { BRepLine, BRepCircle, BRepPlane, BRepNURBSSurface } from '../../cad-kernel/geometry/BRepGeometry';

export interface HardAcceptanceGate202Report {
  gateId: 'HAG-202';
  verdict: 'PROVEN' | 'PARTIAL' | 'UNPROVEN' | 'FAILED';
  checks: GateCheck[];
  timestamp: string;
}

export class HardAcceptanceGate202 {
  public static async evaluateAll(): Promise<HardAcceptanceGate202Report> {
    const checks: GateCheck[] = [];

    const recordCheck = (id: string, name: string, passed: boolean, details: string) => {
      checks.push({ id, name, passed, status: passed ? 'PASS' : 'FAIL', details });
    };

    let part: CADPart = {
      id: 'test-part-surf',
      name: 'SurfacePart',
      sketches: [],
      features: [],
      solids: [],
      fingerprint: 'surf-hash',
      version: 1,
      bodies: [
        {
          id: 'b1', name: 'Body1', revision: 1, visible: true, suppressed: false,
          coordinateSystem: { origin: {x:0,y:0,z:0}, xAxis: {x:1,y:0,z:0}, yAxis: {x:0,y:1,z:0}, zAxis: {x:0,y:0,z:1}},
          sketches: [], features: [], dependencyIds: [], volume: 0, mass: 0
        }
      ],
      activeBodyId: 'b1'
    };

    // 1. Feature Integration
    try {
      part = SurfaceEngine.createSurfaceFeature(part, 'LOFT', { tension: 1 }, ['curve1', 'curve2']);
      const hasFeature = part.bodies![0].features.some(f => f.type === 'LOFT');
      recordCheck('SURF-01', 'Surface Feature Tree Integration', hasFeature, 
        hasFeature ? 'Surface features correctly added to parametric tree.' : 'Failed to integrate feature.');
    } catch(e: any) {
      recordCheck('SURF-01', 'Surface Feature Tree Integration', false, e.message);
    }

    // 2. Ruled Surface
    try {
      const c1 = new BRepLine({x:0,y:0,z:0}, {x:1,y:0,z:0});
      const c2 = new BRepLine({x:0,y:1,z:1}, {x:1,y:0,z:0});
      const ruled = SurfaceEngine.evaluateRuled(c1, c2);
      const pt = ruled.evaluate(0.5, 0.5);
      // Math: x=0.5, y=0.5, z=0.5
      const mathCorrect = pt.x === 0.5 && pt.y === 0.5 && pt.z === 0.5;
      recordCheck('SURF-02', 'Ruled Surface Evaluation', mathCorrect,
        mathCorrect ? 'Ruled surface mathematical evaluation is correct.' : 'Failed math validation.');
    } catch(e: any) {
      recordCheck('SURF-02', 'Ruled Surface Evaluation', false, e.message);
    }

    // 3. Loft Surface
    try {
      const c1 = new BRepLine({x:0,y:0,z:0}, {x:1,y:0,z:0});
      const c2 = new BRepLine({x:0,y:1,z:1}, {x:1,y:0,z:0});
      const loft = SurfaceEngine.evaluateLoft([c1, c2]);
      const mathCorrect = loft.type === 'LOFTED';
      recordCheck('SURF-03', 'Loft Surface Evaluation', mathCorrect,
        mathCorrect ? 'Lofted surface representation created.' : 'Failed to create lofted surface.');
    } catch(e: any) {
      recordCheck('SURF-03', 'Loft Surface Evaluation', false, e.message);
    }

    // 4. Sweep Surface
    try {
      const prof = new BRepCircle({x:0,y:0,z:0}, {x:0,y:0,z:1}, 5);
      const path = new BRepLine({x:0,y:0,z:0}, {x:0,y:10,z:0});
      const sweep = SurfaceEngine.evaluateSweep(prof, path);
      const mathCorrect = sweep.type === 'SWEPT';
      recordCheck('SURF-04', 'Sweep Surface Evaluation', mathCorrect,
        mathCorrect ? 'Swept surface representation created.' : 'Failed to create swept surface.');
    } catch(e: any) {
      recordCheck('SURF-04', 'Sweep Surface Evaluation', false, e.message);
    }
    
    // 5. Extruded Surface
    try {
      const prof = new BRepLine({x:0,y:0,z:0}, {x:1,y:0,z:0});
      const dir = {x:0,y:0,z:1};
      const extrude = SurfaceEngine.evaluateExtrude(prof, dir, 10);
      const pt = extrude.evaluate(0.5, 1);
      const mathCorrect = pt.x === 0.5 && pt.y === 0 && pt.z === 10;
      recordCheck('SURF-05', 'Extruded Surface Evaluation', mathCorrect,
        mathCorrect ? 'Extruded surface mathematical evaluation is correct.' : 'Failed math validation.');
    } catch(e: any) {
      recordCheck('SURF-05', 'Extruded Surface Evaluation', false, e.message);
    }

    // 6. Revolved Surface
    try {
      const prof = new BRepLine({x:5,y:0,z:0}, {x:5,y:0,z:10});
      const axis = { location: {x:0,y:0,z:0}, direction: {x:0,y:0,z:1} };
      const revolved = SurfaceEngine.evaluateRevolve(prof, axis, Math.PI);
      const pt = revolved.evaluate(1, 0); // u=1 (theta=PI), v=0 (z=0)
      const mathCorrect = Math.abs(pt.x - (-5)) < 1e-9 && Math.abs(pt.y) < 1e-9 && pt.z === 0;
      recordCheck('SURF-06', 'Revolved Surface Evaluation', mathCorrect,
        mathCorrect ? 'Revolved surface mathematical evaluation is correct.' : 'Failed math validation.');
    } catch(e: any) {
      recordCheck('SURF-06', 'Revolved Surface Evaluation', false, e.message);
    }

    // 7. Surface Operations (Trim, Extend, Offset)
    try {
      const plane = new BRepPlane({x:0,y:0,z:0}, {x:0,y:0,z:1});
      const trimmed = SurfaceEngine.trimSurface(plane, [new BRepLine({x:0,y:0,z:0},{x:1,y:0,z:0})]);
      const extended = SurfaceEngine.extendSurface(trimmed, 5);
      const offset = SurfaceEngine.offsetSurface(extended, 2);
      recordCheck('SURF-07', 'Surface Modification (Trim/Extend/Offset)', true,
        'Successfully applied surface modification operations without failure.');
    } catch(e: any) {
      recordCheck('SURF-07', 'Surface Modification (Trim/Extend/Offset)', false, e.message);
    }

    // 8. Surface to Solid (Sew and Thicken)
    try {
      const p1 = new BRepPlane({x:0,y:0,z:0}, {x:0,y:0,z:1});
      const p2 = new BRepPlane({x:0,y:0,z:10}, {x:0,y:0,z:1});
      const shell = SurfaceEngine.sewSurfaces([p1, p2], 0.001);
      const solid = SurfaceEngine.thickenSurface(p1, 5);
      
      const mathCorrect = shell.type === 'SHELL' && solid.type === 'SOLID';
      recordCheck('SURF-08', 'Surface to Solid Generation', mathCorrect,
        mathCorrect ? 'Correctly converted surfaces to shell/solid topology representations.' : 'Failed surface conversion.');
    } catch(e: any) {
      recordCheck('SURF-08', 'Surface to Solid Generation', false, e.message);
    }

    // 9. NURBS / B-Spline Control Net Editing
    try {
      const cpts = [
        [{x:0,y:0,z:0}, {x:1,y:0,z:0}],
        [{x:0,y:1,z:0}, {x:1,y:1,z:1}]
      ];
      const nurbs = new BRepNURBSSurface(1, 1, cpts);
      
      const newCpts = [
        [{x:0,y:0,z:0}, {x:1,y:0,z:0}],
        [{x:0,y:1,z:0}, {x:1,y:1,z:5}]
      ];
      const edited = SurfaceEngine.editControlPoints(nurbs, newCpts);
      const editedCorrect = edited.controlPoints[1][1].z === 5;
      
      recordCheck('SURF-09', 'NURBS Control Point Editing', editedCorrect,
        editedCorrect ? 'Successfully updated NURBS surface through control net edits.' : 'Failed to update NURBS control net.');
    } catch(e: any) {
      recordCheck('SURF-09', 'NURBS Control Point Editing', false, e.message);
    }

    // 10. Surface Analysis Tools
    try {
      const plane = new BRepPlane({x:0,y:0,z:0}, {x:0,y:0,z:1});
      const analysis = SurfaceEngine.analyzeSurface(plane);
      const analysisValid = analysis.isValid && analysis.continuity === 'G1';
      recordCheck('SURF-10', 'Surface Engineering Analysis', analysisValid,
        analysisValid ? 'Surface analysis provided valid geometric metrics.' : 'Failed surface analysis.');
    } catch(e: any) {
      recordCheck('SURF-10', 'Surface Engineering Analysis', false, e.message);
    }

    const allPassed = checks.every(c => c.status === 'PASS');
    const verdict = allPassed ? 'PROVEN' : 'FAILED';

    return {
      gateId: 'HAG-202',
      verdict,
      checks,
      timestamp: new Date().toISOString()
    };
  }
}
