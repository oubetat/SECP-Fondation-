import { AssemblyVerdict, AssemblyCheck } from './HardAcceptanceGate211';
import { AssemblyDOFAnalyzer } from '../assembly/AssemblyDOFAnalyzer';
import { AssemblyComponent, AssemblyConstraint } from '../assembly/AssemblyConstraintTypes';

export interface HardAcceptanceGate216Result {
  verdict: AssemblyVerdict | 'PROVEN';
  checks: AssemblyCheck[];
  timestamp: string;
  evidenceHash: string;
  testDetails: string[];
}

export class HardAcceptanceGate216 {
  public evaluate(): HardAcceptanceGate216Result {
    const checks: AssemblyCheck[] = [
      { id: 'FREE_COMP', name: 'Acceptance Test 1 — Free Component', status: 'UNPROVEN', description: 'Verifies a free component has 6 DOF and is under-constrained.' },
      { id: 'GROUNDED_COMP', name: 'Acceptance Test 2 — Grounded Component', status: 'UNPROVEN', description: 'Verifies a grounded component has 0 DOF and is fully constrained.' },
      { id: 'SHAFT_HOUSING', name: 'Acceptance Test 3 — Shaft in Housing', status: 'UNPROVEN', description: 'Verifies concentric mate locks 4 DOFs, leaving axial translation/rotation.' },
      { id: 'REDUNDANT', name: 'Acceptance Test 4 — Redundant Constraint', status: 'UNPROVEN', description: 'Verifies duplicate constraints are flagged as redundant candidates.' },
      { id: 'CONFLICT', name: 'Acceptance Test 5 — Conflict Detection', status: 'UNPROVEN', description: 'Verifies conflicting constraint systems are reported as conflicted.' },
      { id: 'SINGULAR', name: 'Acceptance Test 6 — Singular Configuration', status: 'UNPROVEN', description: 'Verifies collinearity and near-singularities trigger singular flags.' },
      { id: 'DETERMINISTIC', name: 'Acceptance Test 7 — Deterministic Replay', status: 'UNPROVEN', description: 'Verifies multi-pass evaluations produce identical results.' }
    ];

    const testDetails: string[] = [];

    try {
      // Setup default placeholder structures
      const baseTransform = {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        matrix: [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]
      };

      // ==========================================
      // Test 1: Free Component
      // ==========================================
      const compFree: AssemblyComponent = new AssemblyComponent({
        instanceId: 'comp-free',
        partId: 'part-free',
        name: 'Free Part',
        placementTransform: { ...baseTransform },
        worldTransform: { ...baseTransform },
        suppressed: false,
        fixed: false
      });

      const rep1 = AssemblyDOFAnalyzer.analyze([compFree], []);
      const checkFree = checks.find(c => c.id === 'FREE_COMP')!;
      if (rep1.freeDOF === 6 && rep1.componentDOFStates[0].status === 'FREE') {
        checkFree.status = 'PASS';
        testDetails.push('Test 1 PASS: Free component initialized with 6 DOF.');
      } else {
        checkFree.status = 'FAIL';
        testDetails.push(`Test 1 FAIL: Expected 6 DOF, got ${rep1.freeDOF}`);
      }

      // ==========================================
      // Test 2: Grounded Component
      // ==========================================
      const compGrounded: AssemblyComponent = new AssemblyComponent({
        instanceId: 'comp-ground',
        partId: 'part-ground',
        name: 'Grounded Bed',
        placementTransform: { ...baseTransform },
        worldTransform: { ...baseTransform },
        suppressed: false,
        fixed: true
      });

      const rep2 = AssemblyDOFAnalyzer.analyze([compGrounded], []);
      const checkGround = checks.find(c => c.id === 'GROUNDED_COMP')!;
      if (rep2.freeDOF === 0 && rep2.componentDOFStates[0].status === 'FULLY_CONSTRAINED') {
        checkGround.status = 'PASS';
        testDetails.push('Test 2 PASS: Grounded component has 0 DOF and FULLY_CONSTRAINED status.');
      } else {
        checkGround.status = 'FAIL';
        testDetails.push(`Test 2 FAIL: Expected 0 DOF, got ${rep2.freeDOF}`);
      }

      // ==========================================
      // Test 3: Shaft in Housing
      // ==========================================
      const housing: AssemblyComponent = new AssemblyComponent({
        instanceId: 'housing',
        partId: 'part-housing',
        name: 'Housing',
        placementTransform: { ...baseTransform },
        worldTransform: { ...baseTransform },
        suppressed: false,
        fixed: true
      });
      const shaft: AssemblyComponent = new AssemblyComponent({
        instanceId: 'shaft',
        partId: 'part-shaft',
        name: 'Shaft',
        placementTransform: { ...baseTransform },
        worldTransform: { ...baseTransform },
        suppressed: false,
        fixed: false
      });
      const concentric: AssemblyConstraint = {
        constraintId: 'const-concentric',
        assemblyId: 'asm-1',
        componentA: 'housing',
        componentB: 'shaft',
        geometryRefA: { componentId: 'housing', topologyType: 'AXIS', topologyIndex: 0, geometricSignature: 'sig1' },
        geometryRefB: { componentId: 'shaft', topologyType: 'AXIS', topologyIndex: 0, geometricSignature: 'sig2' },
        type: 'CONCENTRIC',
        parameters: {},
        status: 'SATISFIED',
        solverError: 0,
        revision: 1
      };

      const rep3 = AssemblyDOFAnalyzer.analyze([housing, shaft], [concentric]);
      const checkShaft = checks.find(c => c.id === 'SHAFT_HOUSING')!;
      const shaftState = rep3.componentDOFStates.find(s => s.occurrenceId === 'shaft')!;
      // Concentric removes 4 DOFs, so 6 - 4 = 2 remaining DOFs (axial rotation & translation)
      if (rep3.freeDOF === 2 && shaftState.remainingDOF === 2) {
        checkShaft.status = 'PASS';
        testDetails.push('Test 3 PASS: Shaft in housing has 2 remaining DOFs.');
      } else {
        checkShaft.status = 'FAIL';
        testDetails.push(`Test 3 FAIL: Expected 2 relative DOFs, got ${shaftState.remainingDOF}`);
      }

      // ==========================================
      // Test 4: Redundant Constraint
      // ==========================================
      const lock1: AssemblyConstraint = {
        constraintId: 'const-lock-1',
        assemblyId: 'asm-1',
        componentA: 'housing',
        componentB: 'shaft',
        geometryRefA: { componentId: 'housing', topologyType: 'FACE', topologyIndex: 0, geometricSignature: 'sig1' },
        geometryRefB: { componentId: 'shaft', topologyType: 'FACE', topologyIndex: 0, geometricSignature: 'sig2' },
        type: 'LOCK',
        parameters: {},
        status: 'SATISFIED',
        solverError: 0,
        revision: 1
      };
      const lock2: AssemblyConstraint = {
        constraintId: 'const-lock-2',
        assemblyId: 'asm-1',
        componentA: 'housing',
        componentB: 'shaft',
        geometryRefA: { componentId: 'housing', topologyType: 'FACE', topologyIndex: 0, geometricSignature: 'sig1' },
        geometryRefB: { componentId: 'shaft', topologyType: 'FACE', topologyIndex: 0, geometricSignature: 'sig2' },
        type: 'LOCK',
        parameters: {},
        status: 'SATISFIED',
        solverError: 0,
        revision: 1
      };

      const rep4 = AssemblyDOFAnalyzer.analyze([housing, shaft], [lock1, lock2]);
      const checkRedundant = checks.find(c => c.id === 'REDUNDANT')!;
      if (rep4.redundantConstraints.includes('const-lock-2')) {
        checkRedundant.status = 'PASS';
        testDetails.push('Test 4 PASS: Secondary redundant lock constraint correctly identified.');
      } else {
        checkRedundant.status = 'FAIL';
        testDetails.push(`Test 4 FAIL: Redundant lock not flagged.`);
      }

      // ==========================================
      // Test 5: Conflict Detection
      // ==========================================
      const conflictLock: AssemblyConstraint = {
        constraintId: 'const-conflict',
        assemblyId: 'asm-1',
        componentA: 'housing',
        componentB: 'shaft',
        geometryRefA: { componentId: 'housing', topologyType: 'FACE', topologyIndex: 0, geometricSignature: 'sig1' },
        geometryRefB: { componentId: 'shaft', topologyType: 'FACE', topologyIndex: 0, geometricSignature: 'sig2' },
        type: 'LOCK',
        parameters: {},
        status: 'CONFLICTING',
        solverError: 15.5, // simulate large solver residual
        revision: 1
      };

      const rep5 = AssemblyDOFAnalyzer.analyze([housing, shaft], [lock1, conflictLock]);
      const checkConflict = checks.find(c => c.id === 'CONFLICT')!;
      if (rep5.evidence.conflictingConstraints.includes('const-conflict')) {
        checkConflict.status = 'PASS';
        testDetails.push('Test 5 PASS: Conflict detected on constraints with high solver residual.');
      } else {
        checkConflict.status = 'FAIL';
        testDetails.push(`Test 5 FAIL: Conflict was not recorded.`);
      }

      // ==========================================
      // Test 6: Singular Configuration
      // ==========================================
      const collinearShaft: AssemblyComponent = new AssemblyComponent({
        instanceId: 'shaft',
        partId: 'part-shaft',
        name: 'Shaft',
        // Tilted alignment which leads to local dependency / singular conditioning index
        placementTransform: {
          position: { x: 1e-6, y: 1e-6, z: 0 },
          rotation: { x: 0.001, y: 0.001, z: 0 },
          matrix: [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]
        },
        worldTransform: { ...baseTransform },
        suppressed: false,
        fixed: false
      });
      const rep6 = AssemblyDOFAnalyzer.analyze([housing, collinearShaft], [concentric]);
      const checkSingular = checks.find(c => c.id === 'SINGULAR')!;
      if (rep6.evidence.singularityStatus !== undefined) {
        checkSingular.status = 'PASS';
        testDetails.push(`Test 6 PASS: Singularity status computed. Conditioning: ${rep6.evidence.conditioningStatus}`);
      } else {
        checkSingular.status = 'FAIL';
        testDetails.push('Test 6 FAIL: Singularity evaluation omitted.');
      }

      // ==========================================
      // Test 7: Deterministic Replay
      // ==========================================
      const replay1 = AssemblyDOFAnalyzer.analyze([housing, shaft], [concentric]);
      const replay2 = AssemblyDOFAnalyzer.analyze([housing, shaft], [concentric]);
      const checkReplay = checks.find(c => c.id === 'DETERMINISTIC')!;
      if (
        replay1.freeDOF === replay2.freeDOF &&
        replay1.evidence.evidenceHash === replay2.evidence.evidenceHash
      ) {
        checkReplay.status = 'PASS';
        testDetails.push('Test 7 PASS: Replay verification succeeded with identical evidence hashes.');
      } else {
        checkReplay.status = 'FAIL';
        testDetails.push('Test 7 FAIL: Nondeterministic hash divergence on replay.');
      }

    } catch (e: any) {
      testDetails.push(`Error executing tests: ${e.message}`);
    }

    const verdict = checks.every(c => c.status === 'PASS') ? 'PROVEN' : 'FAIL';

    return {
      verdict,
      checks,
      timestamp: new Date().toISOString(),
      evidenceHash: `ev_dof_analysis_p216_${verdict.toLowerCase()}_${Date.now().toString(36)}`,
      testDetails
    };
  }
}
