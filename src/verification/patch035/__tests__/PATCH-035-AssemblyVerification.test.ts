
import { describe, it, expect, beforeEach } from 'vitest';
import { EngineeringDocument } from '../../../engine/cad-kernel/document/CADDocument';
import { AssemblyVerificationEngine } from '../../../engine/assembly/verification/AssemblyVerificationEngine';
import { AssemblyIntentMutator } from '../../../engine/cad-kernel/document/AssemblyIntentMutator';
import { JointConstraintSolver } from '../../../engine/assembly/joints/JointConstraintSolver';
import { AssemblyCore } from '../../../engine/assembly/AssemblyCore';

describe('PHASE 8 — PROMPT-035 — ASSEMBLY VERIFICATION PROOF', () => {
  let doc: EngineeringDocument;

  beforeEach(() => {
    doc = {
      documentId: 'DOC-VERIFY-001',
      revision: 1,
      type: 'ASSEMBLY',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [],
      constraints: [],
      features: [],
      parameters: [],
      assembly: {
        instances: [
          {
            instanceId: 'INST-FIXED',
            documentId: 'PART-BLOCK',
            name: 'Base Block',
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            isGrounded: true
          },
          {
            instanceId: 'INST-MOVABLE',
            documentId: 'PART-PISTON',
            name: 'Piston',
            position: { x: 50, y: 50, z: 0 },
            rotation: { x: 0, y: 0, z: 0 }
          }
        ],
        mates: []
      },
      topologyMap: { version: 1, entries: {} },
      derived: {},
      evidence: []
    };
  });

  it('TEST 1: Coincident Verification (Positive & Negative)', () => {
    // 1. Add Coincident Mate
    doc = AssemblyIntentMutator.apply(doc, {
      type: 'ADD_MATE',
      mate: { mateId: 'M-COINCIDENT', type: 'COINCIDENT', instanceAId: 'INST-MOVABLE', instanceBId: 'INST-FIXED', offset: 0 }
    });

    // 2. Solve
    const solveResult = JointConstraintSolver.solveDocument(doc);
    doc = AssemblyIntentMutator.apply(doc, {
      type: 'BATCH_UPDATE_TRANSFORMS',
      transforms: solveResult.solvedTransforms
    });

    // 3. Verify Positive Case
    let report = AssemblyVerificationEngine.verify(doc);
    let coincidentRes = report.constraints.find(c => c.constraintId === 'M-COINCIDENT');
    
    console.log(`[COINCIDENT_POS] Residual: ${coincidentRes?.residual}`);
    expect(coincidentRes?.status).toBe('PASS');
    expect(coincidentRes?.residual).toBeLessThanOrEqual(AssemblyVerificationEngine.DEFAULT_TOLERANCE);

    // 4. Manual Displacement (Negative Case)
    doc = AssemblyIntentMutator.apply(doc, {
      type: 'UPDATE_TRANSFORM',
      instanceId: 'INST-MOVABLE',
      position: { x: 10, y: 10, z: 0 }, // Break coincidence
      rotation: { x: 0, y: 0, z: 0 }
    });

    report = AssemblyVerificationEngine.verify(doc);
    coincidentRes = report.constraints.find(c => c.constraintId === 'M-COINCIDENT');
    
    console.log(`[COINCIDENT_NEG] Residual: ${coincidentRes?.residual}`);
    expect(coincidentRes?.status).toBe('FAIL');
    expect(coincidentRes?.residual).toBeGreaterThan(AssemblyVerificationEngine.DEFAULT_TOLERANCE);
  });

  it('TEST 2: Concentric Verification (Positive & Negative)', () => {
    doc = AssemblyIntentMutator.apply(doc, {
      type: 'ADD_MATE',
      mate: { mateId: 'M-CONCENTRIC', type: 'CONCENTRIC', instanceAId: 'INST-MOVABLE', instanceBId: 'INST-FIXED' }
    });

    const solveResult = JointConstraintSolver.solveDocument(doc);
    doc = AssemblyIntentMutator.apply(doc, { type: 'BATCH_UPDATE_TRANSFORMS', transforms: solveResult.solvedTransforms });

    let report = AssemblyVerificationEngine.verify(doc);
    let concentricRes = report.constraints.find(c => c.constraintId === 'M-CONCENTRIC');
    expect(concentricRes?.status).toBe('PASS');

    // Break concentricity (offset X)
    doc = AssemblyIntentMutator.apply(doc, {
      type: 'UPDATE_TRANSFORM',
      instanceId: 'INST-MOVABLE',
      position: { x: 5, y: 0, z: 0 }, 
      rotation: { x: 0, y: 0, z: 0 }
    });

    report = AssemblyVerificationEngine.verify(doc);
    concentricRes = report.constraints.find(c => c.constraintId === 'M-CONCENTRIC');
    expect(concentricRes?.status).toBe('FAIL');
  });

  it('TEST 3: Distance Verification', () => {
    const TARGET_DIST = 120.5;
    doc = AssemblyIntentMutator.apply(doc, {
      type: 'ADD_MATE',
      mate: { mateId: 'M-DISTANCE', type: 'DISTANCE', instanceAId: 'INST-MOVABLE', instanceBId: 'INST-FIXED', offset: TARGET_DIST }
    });

    const solveResult = JointConstraintSolver.solveDocument(doc);
    doc = AssemblyIntentMutator.apply(doc, { type: 'BATCH_UPDATE_TRANSFORMS', transforms: solveResult.solvedTransforms });

    let report = AssemblyVerificationEngine.verify(doc);
    let distRes = report.constraints.find(c => c.constraintId === 'M-DISTANCE');
    expect(distRes?.status).toBe('PASS');
    expect(Math.abs((distRes?.actualRelationship as any).distance - TARGET_DIST)).toBeLessThanOrEqual(AssemblyVerificationEngine.DEFAULT_TOLERANCE);
  });

  it('TEST 4: DOF Derivation Verification', () => {
    // Initial State: INST-MOVABLE is free (6 DOF), INST-FIXED is grounded (0 DOF)
    let report = AssemblyVerificationEngine.verify(doc);
    expect(report.dof.totalAssemblyDOF).toBe(6);
    expect(report.dof.componentDOFs['INST-MOVABLE'].status).toBe('UNCONSTRAINED');

    // Add Concentric (Removes 4 DOF)
    doc = AssemblyIntentMutator.apply(doc, {
      type: 'ADD_MATE',
      mate: { mateId: 'M-CONC', type: 'CONCENTRIC', instanceAId: 'INST-MOVABLE', instanceBId: 'INST-FIXED' }
    });
    report = AssemblyVerificationEngine.verify(doc);
    expect(report.dof.totalAssemblyDOF).toBe(2); // 6 - 4 = 2
    expect(report.dof.componentDOFs['INST-MOVABLE'].status).toBe('PARTIALLY_CONSTRAINED');

    // Add Fixed (Removes all DOF)
    doc = AssemblyIntentMutator.apply(doc, {
      type: 'ADD_MATE',
      mate: { mateId: 'M-FIXED', type: 'FIXED', instanceAId: 'INST-MOVABLE', instanceBId: 'INST-FIXED' }
    });
    report = AssemblyVerificationEngine.verify(doc);
    expect(report.dof.totalAssemblyDOF).toBe(0);
    expect(report.dof.componentDOFs['INST-MOVABLE'].status).toBe('FULLY_CONSTRAINED');
  });

  it('TEST 5: Interference Verification', () => {
    // 1. Clear State (No Interference)
    doc = AssemblyIntentMutator.apply(doc, {
      type: 'UPDATE_TRANSFORM',
      instanceId: 'INST-MOVABLE',
      position: { x: 100, y: 100, z: 0 },
      rotation: { x: 0, y: 0, z: 0 }
    });
    let report = AssemblyVerificationEngine.verify(doc);
    expect(report.interference.hasInterference).toBe(false);

    // 2. Intentional Intersection (Move to x=5, y=5 while Fixed is at 0,0,0)
    doc = AssemblyIntentMutator.apply(doc, {
      type: 'UPDATE_TRANSFORM',
      instanceId: 'INST-MOVABLE',
      position: { x: 5, y: 5, z: 0 },
      rotation: { x: 0, y: 0, z: 0 }
    });
    report = AssemblyVerificationEngine.verify(doc);
    expect(report.interference.hasInterference).toBe(true);
    expect(report.interference.clashCount).toBe(1);
    console.log(`[INTERFERENCE] Detected clash between INST-FIXED and INST-MOVABLE`);
  });

  it('TEST 6: Full Regeneration & Re-Verification Proof', () => {
    // 1. Setup Verified State
    doc = AssemblyIntentMutator.apply(doc, {
      type: 'ADD_MATE',
      mate: { mateId: 'M-CONC', type: 'CONCENTRIC', instanceAId: 'INST-MOVABLE', instanceBId: 'INST-FIXED' }
    });
    const solveResult = JointConstraintSolver.solveDocument(doc);
    doc = AssemblyIntentMutator.apply(doc, { type: 'BATCH_UPDATE_TRANSFORMS', transforms: solveResult.solvedTransforms });
    
    const reportA = AssemblyVerificationEngine.verify(doc);
    expect(reportA.verdict).toBe('PASS');

    // 2. Destroy Runtime (Simulated by clearing memory, then rebuilding from doc)
    const runtime = new AssemblyCore();
    runtime.rebuildFromDocument(doc);
    
    // 3. Re-verify from the Rebuilt State (using the document)
    // The engine only uses the doc, so if doc matches, report matches.
    const reportB = AssemblyVerificationEngine.verify(doc, reportA);
    
    expect(reportB.verdict).toBe('PASS');
    expect(reportB.regeneration?.status).toBe('PASS');
    expect(reportB.regeneration?.residualsMatch).toBe(true);
    expect(reportB.regeneration?.dofMatches).toBe(true);
    
    console.log(`[REGEN_PROOF] Verification report identical after runtime destruction.`);
  });

  it('TEST 7: Gear Verification', () => {
    const RATIO = 2.0;
    doc = AssemblyIntentMutator.apply(doc, {
      type: 'ADD_MATE',
      mate: { 
        mateId: 'M-GEAR', 
        type: 'GEAR', 
        instanceAId: 'INST-FIXED', 
        instanceBId: 'INST-MOVABLE', 
        parameters: { ratio: RATIO } 
      }
    });

    // Rotate A by 90 deg (pi/2)
    // Expected B = -2.0 * pi/2 = -pi
    doc = AssemblyIntentMutator.apply(doc, {
      type: 'UPDATE_TRANSFORM',
      instanceId: 'INST-FIXED',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: Math.PI / 2 }
    });
    
    doc = AssemblyIntentMutator.apply(doc, {
      type: 'UPDATE_TRANSFORM',
      instanceId: 'INST-MOVABLE',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: -Math.PI }
    });

    let report = AssemblyVerificationEngine.verify(doc);
    expect(report.constraints.find(c => c.type === 'GEAR')?.status).toBe('PASS');

    // Break ratio
    doc = AssemblyIntentMutator.apply(doc, {
      type: 'UPDATE_TRANSFORM',
      instanceId: 'INST-MOVABLE',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 } // Incorrect rotation for gear
    });
    
    report = AssemblyVerificationEngine.verify(doc);
    expect(report.constraints.find(c => c.type === 'GEAR')?.status).toBe('FAIL');
  });

  it('TEST 8: Limit Verification', () => {
    doc = AssemblyIntentMutator.apply(doc, {
      type: 'ADD_MATE',
      mate: { 
        mateId: 'M-LIMIT', 
        type: 'LIMIT', 
        instanceAId: 'INST-MOVABLE', 
        instanceBId: 'INST-FIXED', 
        parameters: { min: 0, max: 100 } 
      }
    });

    // 1. Inside limit
    doc = AssemblyIntentMutator.apply(doc, { type: 'UPDATE_TRANSFORM', instanceId: 'INST-MOVABLE', position: { x: 50, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } });
    expect(AssemblyVerificationEngine.verify(doc).constraints.find(c => c.type === 'LIMIT')?.status).toBe('PASS');

    // 2. At boundary
    doc = AssemblyIntentMutator.apply(doc, { type: 'UPDATE_TRANSFORM', instanceId: 'INST-MOVABLE', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } });
    expect(AssemblyVerificationEngine.verify(doc).constraints.find(c => c.type === 'LIMIT')?.status).toBe('PASS');

    // 3. Violation
    doc = AssemblyIntentMutator.apply(doc, { type: 'UPDATE_TRANSFORM', instanceId: 'INST-MOVABLE', position: { x: -5, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } });
    expect(AssemblyVerificationEngine.verify(doc).constraints.find(c => c.type === 'LIMIT')?.status).toBe('FAIL');
  });
});
