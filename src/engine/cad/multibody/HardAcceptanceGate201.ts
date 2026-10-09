/**
 * SECP CAD Kernel — Hard Acceptance Gate 201 (Multi-Body Modeling)
 * Phase 18 — Production CAD Core
 */
import { CADPart, CADBody } from '../../parametric-cad/ParametricCADTypes';
import { BRepSolid, BRepShell, BRepFace, BRepLoop, BRepEdge, BRepVertex } from '../../cad-kernel/topology/BRepTopology';
import { BRepPlane, BRepPoint, BRepVector, BRepLine } from '../../cad-kernel/geometry/BRepGeometry';
import { Orientation } from '../../cad-kernel/topology/TopologyContracts';
import { GateCheck } from '../../cad-kernel/boolean/BooleanTypes';
import { MultiBodyEngine } from './MultiBodyEngine';

export interface HardAcceptanceGate201Report {
  gateId: 'HAG-201';
  verdict: 'PROVEN' | 'PARTIAL' | 'UNPROVEN' | 'FAILED';
  checks: GateCheck[];
  timestamp: string;
}

export class HardAcceptanceGate201 {
  public static async evaluateAll(): Promise<HardAcceptanceGate201Report> {
    const checks: GateCheck[] = [];

    const recordCheck = (id: string, name: string, passed: boolean, details: string) => {
      checks.push({ id, name, passed, status: passed ? 'PASS' : 'FAIL', details });
    };

    // 1. Create a Part and some bodies
    let part: CADPart = {
      id: 'test-part-mb',
      name: 'MultiBodyPart',
      sketches: [],
      features: [],
      solids: [],
      brepSolids: [],
      fingerprint: 'mb-hash',
      version: 1,
      bodies: []
    };

    try {
      part = MultiBodyEngine.createBody(part, 'Body A');
      part = MultiBodyEngine.createBody(part, 'Body B');
      
      const hasTwoBodies = part.bodies && part.bodies.length === 2;
      recordCheck('MB-01', 'Create Multiple Bodies', hasTwoBodies,
        hasTwoBodies ? 'Successfully created multiple distinct bodies in one part.' : 'Failed to create multiple bodies.');
      
      part = MultiBodyEngine.setActiveBody(part, part.bodies![0].id);
      const activeIsA = part.activeBodyId === part.bodies![0].id;
      recordCheck('MB-02', 'Set Active Body', activeIsA,
        activeIsA ? 'Active body logic works.' : 'Active body logic failed.');

    } catch(e: any) {
      recordCheck('MB-01', 'Create Multiple Bodies', false, `Error: ${e.message}`);
      recordCheck('MB-02', 'Set Active Body', false, 'Skipped');
    }

    try {
      // 2. Body Visibility and Suppression
      part = MultiBodyEngine.setBodyVisibility(part, part.bodies![1].id, false);
      const isHidden = part.bodies![1].visible === false;
      recordCheck('MB-03', 'Body Visibility Control', isHidden,
        isHidden ? 'Body successfully hidden.' : 'Body visibility toggle failed.');

      part = MultiBodyEngine.setBodySuppression(part, part.bodies![0].id, true);
      const isSuppressed = part.bodies![0].suppressed === true;
      recordCheck('MB-04', 'Body Suppression Control', isSuppressed,
        isSuppressed ? 'Body successfully suppressed.' : 'Body suppression toggle failed.');
      
      // Cleanup for next tests
      part = MultiBodyEngine.setBodySuppression(part, part.bodies![0].id, false);
      part = MultiBodyEngine.setBodyVisibility(part, part.bodies![1].id, true);
    } catch(e: any) {
      recordCheck('MB-03', 'Body Visibility Control', false, `Error: ${e.message}`);
      recordCheck('MB-04', 'Body Suppression Control', false, 'Skipped');
    }

    try {
      // 3. Independent B-Reps and Mass Properties
      const solidA = this.createMockSolid('solid-A');
      const solidB = this.createMockSolid('solid-B');

      part = MultiBodyEngine.updateBodyBRep(part, part.bodies![0].id, solidA, 1000, 10);
      part = MultiBodyEngine.updateBodyBRep(part, part.bodies![1].id, solidB, 2000, 20);

      const independentBReps = part.bodies![0].brepSolid !== undefined && part.bodies![1].brepSolid !== undefined &&
                               part.bodies![0].brepSolid?.id !== part.bodies![1].brepSolid?.id;
      
      recordCheck('MB-05', 'Independent B-Reps per Body', independentBReps,
        independentBReps ? 'Each body maintains an independent B-Rep.' : 'B-Rep independence failed.');

      const aggMass = MultiBodyEngine.calculateAggregateMass(part);
      recordCheck('MB-06', 'Aggregate Mass Properties', aggMass === 30,
        aggMass === 30 ? 'Aggregate mass correctly calculated across active/unsuppressed bodies.' : `Aggregate mass failed. Got ${aggMass}`);
    } catch(e: any) {
      recordCheck('MB-05', 'Independent B-Reps per Body', false, `Error: ${e.message}`);
      recordCheck('MB-06', 'Aggregate Mass Properties', false, 'Skipped');
    }

    try {
      // 4. Circular Dependency Detection
      part = MultiBodyEngine.addDependency(part, part.bodies![0].id, part.bodies![1].id);
      
      let circularDetected = false;
      try {
        part = MultiBodyEngine.addDependency(part, part.bodies![1].id, part.bodies![0].id);
      } catch (e: any) {
        if (e.message.includes('Circular dependency')) {
          circularDetected = true;
        }
      }
      
      recordCheck('MB-07', 'Circular Dependency Detection', circularDetected,
        circularDetected ? 'Successfully prevented circular body references.' : 'Failed to prevent circular dependency.');
    } catch(e: any) {
      recordCheck('MB-07', 'Circular Dependency Detection', false, `Error: ${e.message}`);
    }

    try {
      // 5. Derived Body / Body Copy
      part = MultiBodyEngine.createDerivedBody(part, part.bodies![0].id, 'Derived Body');
      const derived = part.bodies!.find(b => b.name === 'Derived Body');
      const isDerived = derived !== undefined && derived.dependencyIds.includes(part.bodies![0].id) && derived.brepSolid !== undefined;
      
      recordCheck('MB-08', 'Derived Body Creation', isDerived,
        isDerived ? 'Successfully created a derived body with dependency link.' : 'Failed to create derived body.');
    } catch(e: any) {
      recordCheck('MB-08', 'Derived Body Creation', false, `Error: ${e.message}`);
    }

    try {
      // 6. Body Naming and Identity Event
      const initialRev = part.bodies![0].revision;
      part = MultiBodyEngine.renameBody(part, part.bodies![0].id, 'Body A Renamed');
      const renamed = part.bodies!.find(b => b.id === part.bodies![0].id);
      const revIncremented = renamed !== undefined && renamed.name === 'Body A Renamed' && renamed.revision > initialRev;
      
      recordCheck('MB-09', 'Body Naming and Revision', revIncremented,
        revIncremented ? 'Body successfully renamed and revision incremented.' : 'Failed body rename/revision.');
    } catch(e: any) {
      recordCheck('MB-09', 'Body Naming and Revision', false, `Error: ${e.message}`);
    }

    try {
      // 7. Body Transformation
      const matrix = [1, 0, 0, 10, 0, 1, 0, 20, 0, 0, 1, 30, 0, 0, 0, 1];
      part = MultiBodyEngine.transformBody(part, part.bodies![0].id, matrix);
      const isTransformed = part.bodies![0].transformMatrix === matrix;
      recordCheck('MB-10', 'Body Transformation', isTransformed, isTransformed ? 'Successfully applied rigid body transformation matrix.' : 'Failed to apply transformation.');

      // 8. Material Assignment
      part = MultiBodyEngine.assignMaterial(part, part.bodies![0].id, 'MAT-STEEL');
      const hasMaterial = part.bodies![0].materialId === 'MAT-STEEL';
      recordCheck('MB-11', 'Material Assignment', hasMaterial, hasMaterial ? 'Successfully assigned distinct material to body.' : 'Failed to assign material.');

      // 9. Multi-Body Boolean (Destructive vs Non-Destructive)
      part = MultiBodyEngine.createBody(part, 'Tool Body');
      const toolId = part.bodies![part.bodies!.length - 1].id;
      
      // Non-destructive boolean
      part = MultiBodyEngine.booleanOperation(part, 'CUT', part.bodies![0].id, [toolId], false);
      const nonDestructive = part.bodies!.some(b => b.id === toolId) && part.bodies![0].dependencyIds.includes(toolId);
      recordCheck('MB-12', 'Non-Destructive Boolean Dependency', nonDestructive, nonDestructive ? 'Tool body preserved and dependency established.' : 'Failed non-destructive boolean.');

      // Destructive boolean
      part = MultiBodyEngine.booleanOperation(part, 'FUSE', part.bodies![0].id, [toolId], true);
      const destructive = !part.bodies!.some(b => b.id === toolId);
      recordCheck('MB-13', 'Destructive Boolean Operation', destructive, destructive ? 'Tool body successfully consumed by boolean operation.' : 'Failed destructive boolean.');
      
    } catch (e: any) {
      recordCheck('MB-10', 'Body Transformation', false, `Error: ${e.message}`);
      recordCheck('MB-11', 'Material Assignment', false, 'Skipped');
      recordCheck('MB-12', 'Non-Destructive Boolean Dependency', false, 'Skipped');
      recordCheck('MB-13', 'Destructive Boolean Operation', false, 'Skipped');
    }

    const allPassed = checks.every(c => c.status === 'PASS');
    const verdict = allPassed ? 'PROVEN' : 'FAILED';

    return {
      gateId: 'HAG-201',
      verdict,
      checks,
      timestamp: new Date().toISOString()
    };
  }

  private static createMockSolid(id: string): BRepSolid {
    const v1 = new BRepVertex('v1', new BRepPoint(0, 0, 0));
    const v2 = new BRepVertex('v2', new BRepPoint(10, 0, 0));
    
    const e1 = new BRepEdge('e1', new BRepLine(new BRepPoint(0, 0, 0), new BRepVector(1, 0, 0)), v1, v2);
    const l1 = new BRepLoop('l1', [{ edge: e1, orientation: Orientation.FORWARD }]);
    
    const f1 = new BRepFace('f1', new BRepPlane(new BRepPoint(0,0,0), new BRepVector(0,0,1)), l1, []);
    const s1 = new BRepShell('s1', [{ face: f1, orientation: Orientation.FORWARD }]);
    
    return new BRepSolid(id, s1);
  }
}
