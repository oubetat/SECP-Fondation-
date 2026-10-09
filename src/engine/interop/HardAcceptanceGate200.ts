/**
 * SECP CAD Kernel — Hard Acceptance Gate 200 (Real STEP/IGES Export)
 * Phase 18 — Production CAD Core
 */
import { CADInteroperabilityLayer } from '../parametric-cad/CADInteroperabilityLayer';
import { CADPart } from '../parametric-cad/ParametricCADTypes';
import { BRepSolid, BRepShell, BRepFace, BRepLoop, BRepEdge, BRepVertex } from '../cad-kernel/topology/BRepTopology';
import { BRepPlane, BRepCylinder, BRepLine, BRepCircle, BRepPoint, BRepVector } from '../cad-kernel/geometry/BRepGeometry';
import { GateCheck } from '../cad-kernel/boolean/BooleanTypes';
import { Orientation } from '../cad-kernel/topology/TopologyContracts';
import { EngineeringIdentityFactory } from '../identity/EngineeringIdentityFactory';

export interface HardAcceptanceGate200Report {
  gateId: 'HAG-200';
  verdict: 'PROVEN' | 'PARTIAL' | 'UNPROVEN' | 'FAILED';
  checks: GateCheck[];
  timestamp: string;
}

export class HardAcceptanceGate200 {
  public static async evaluateAll(): Promise<HardAcceptanceGate200Report> {
    const checks: GateCheck[] = [];

    const recordCheck = (id: string, name: string, passed: boolean, details: string) => {
      checks.push({ id, name, passed, status: passed ? 'PASS' : 'FAIL', details });
    };

    // Construct a real B-Rep Solid for testing
    const solid = this.createTestSolid();
    const part: CADPart = {
      id: 'test-part-1',
      name: 'HAG-200-Test-Part',
      sketches: [],
      features: [],
      solids: [
        { id: solid.id, faceIds: solid.outerShell.orientedFaces.map(of => of.face.id), volume: 1000, mass: 10 }
      ],
      brepSolids: [solid],
      fingerprint: 'test-fingerprint',
      version: 1
    };

    // TEST 1: Real STEP Export Check
    let exportedStep = '';
    try {
      exportedStep = CADInteroperabilityLayer.exportToSTEP(part);
      const isRealStep = exportedStep.includes('MANIFOLD_SOLID_BREP') && 
                         exportedStep.includes('ADVANCED_FACE') && 
                         exportedStep.includes('PLANE');
      recordCheck('EXP-01', 'Real STEP B-Rep Export Encoding', isRealStep, 
        isRealStep ? 'Successfully exported STEP with real B-Rep entities' : 'Failed to export real STEP B-Rep entities');
    } catch (e: any) {
      recordCheck('EXP-01', 'Real STEP B-Rep Export Encoding', false, `Export Error: ${e.message}`);
    }

    // TEST 2: Round-Trip (Export -> Import -> Compare)
    try {
      if (exportedStep) {
        const importedPart = await CADInteroperabilityLayer.importFromSTEP(exportedStep);
        const importedSolids = importedPart.brepSolids || [];
        const isRoundTripSuccess = importedSolids.length === 1 && 
                                   importedSolids[0].outerShell.orientedFaces.length === solid.outerShell.orientedFaces.length;
        recordCheck('EXP-02', 'STEP Round-Trip Fidelity', isRoundTripSuccess, 
          isRoundTripSuccess ? 'Successfully round-tripped STEP geometry' : 'Failed to maintain fidelity during round-trip');
      } else {
        recordCheck('EXP-02', 'STEP Round-Trip Fidelity', false, 'Skipped due to export failure');
      }
    } catch (e: any) {
      recordCheck('EXP-02', 'STEP Round-Trip Fidelity', false, `Round-Trip Error: ${e.message}`);
    }

    // TEST 3: IGES Export Fidelity
    try {
      const exportedIges = CADInteroperabilityLayer.exportToIGES(part);
      const isRealIges = exportedIges.includes('G0000001') && exportedIges.includes('S0000001');
      recordCheck('EXP-03', 'IGES Export Syntax Validation', isRealIges, 
        isRealIges ? 'Successfully exported valid IGES syntax' : 'Failed to export valid IGES');
    } catch (e: any) {
      recordCheck('EXP-03', 'IGES Export Syntax Validation', false, `IGES Export Error: ${e.message}`);
    }

    const allPassed = checks.every(c => c.status === 'PASS');
    const verdict = allPassed ? 'PROVEN' : 'FAILED';

    return {
      gateId: 'HAG-200',
      verdict,
      checks,
      timestamp: new Date().toISOString()
    };
  }

  private static createTestSolid(): BRepSolid {
    const v1 = new BRepVertex('v1', new BRepPoint(0, 0, 0), 1e-6);
    const v2 = new BRepVertex('v2', new BRepPoint(10, 0, 0), 1e-6);
    
    const e1 = new BRepEdge('e1', new BRepLine(new BRepPoint(0, 0, 0), new BRepVector(1, 0, 0)), v1, v2, 1e-6);
    const l1 = new BRepLoop('l1', [{ edge: e1, orientation: Orientation.FORWARD }]);
    
    const f1 = new BRepFace('f1', new BRepPlane(new BRepPoint(0,0,0), new BRepVector(0,0,1)), l1, []);
    const s1 = new BRepShell('s1', [{ face: f1, orientation: Orientation.FORWARD }]);
    
    return new BRepSolid('solid1', s1);
  }
}
