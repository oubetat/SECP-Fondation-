import { ManufacturingOptimizationEngine } from './ManufacturingOptimizationEngine';
import { ManufacturingVerificationGate } from './ManufacturingVerificationGate';
import { ManufacturingOptimizationProblem, ManufacturingCandidate, ManufacturingConstraint } from './types';

export interface Gate137Result {
  gateId: string;
  description: string;
  passed: boolean;
  verdict: string;
  details: string;
}

export class HardAcceptanceGate137 {
  public static runAllTests(): Gate137Result[] {
    const results: Gate137Result[] = [];

    // 1. Mandatory Test: Kinematic Validation
    results.push(this.testKinematicValidation());

    // 2. Mandatory Test: Collision Detection
    results.push(this.testCollisionDetection());

    // 3. Mandatory Test: Manufacturing Hard Constraints
    results.push(this.testHardConstraints());

    // 4. Mandatory Test: Independent G-Code & Twin Verification
    results.push(this.testIndependentVerification());

    // 5. Mandatory Test: Immutable Evidence
    results.push(this.testImmutableEvidence());

    return results;
  }

  private static testKinematicValidation(): Gate137Result {
    const candidate: Partial<ManufacturingCandidate> = {
      kinematicsStatus: 'INVALID',
      collisionStatus: 'NONE'
    };
    const evaluated = ManufacturingOptimizationEngine.evaluateCandidate(candidate, []);
    const passed = evaluated.feasibility === false && evaluated.constraintViolations.some(v => v.constraintId === 'KINEMATICS');
    return {
      gateId: 'GATE-137-KINEMATICS',
      description: 'Reject processes with kinematic violations (axis limits, singularities)',
      passed,
      verdict: passed ? 'INFEASIBLE' : 'FAILED',
      details: passed ? 'Successfully caught kinematic violation.' : 'Failed to enforce kinematics.'
    };
  }

  private static testCollisionDetection(): Gate137Result {
    const candidate: Partial<ManufacturingCandidate> = {
      kinematicsStatus: 'VALID',
      collisionStatus: 'FATAL'
    };
    const evaluated = ManufacturingOptimizationEngine.evaluateCandidate(candidate, []);
    const passed = evaluated.feasibility === false && evaluated.constraintViolations.some(v => v.constraintId === 'COLLISION');
    return {
      gateId: 'GATE-137-COLLISION',
      description: 'Reject processes with fatal collisions',
      passed,
      verdict: passed ? 'COLLISION_DETECTED' : 'FAILED',
      details: passed ? 'Successfully caught fatal collision.' : 'Failed to enforce collision constraint.'
    };
  }

  private static testHardConstraints(): Gate137Result {
    const constraint: ManufacturingConstraint = {
      constraintId: 'MAX_SPINDLE_POWER',
      category: 'MACHINE',
      expression: 'power <= 15',
      operator: '<=',
      limit: 15,
      unit: 'kW',
      tolerance: 0,
      severity: 'HARD_CONSTRAINT'
    };
    const candidate: Partial<ManufacturingCandidate> = {
      kinematicsStatus: 'VALID',
      collisionStatus: 'NONE',
      objectives: { 'MAX_SPINDLE_POWER': 18 }
    };
    const evaluated = ManufacturingOptimizationEngine.evaluateCandidate(candidate, [constraint]);
    const passed = evaluated.feasibility === false;
    return {
      gateId: 'GATE-137-HARD-CONSTRAINT',
      description: 'Enforce hard manufacturing constraints (e.g., spindle power)',
      passed,
      verdict: passed ? 'INFEASIBLE' : 'FAILED',
      details: passed ? 'Successfully enforced spindle power limit.' : 'Failed to enforce limit.'
    };
  }

  private static testIndependentVerification(): Gate137Result {
    const problem = this.getBasicProblem();
    const candidate: ManufacturingCandidate = {
      candidateId: 'C1',
      processPlan: {} as any,
      objectives: {},
      constraintViolations: [],
      feasibility: true,
      collisionStatus: 'NONE',
      kinematicsStatus: 'VALID',
      gcodeVerified: true,
      machineTwinVerified: true
    };
    
    // Simulate failure in independent twin verification
    const independentResult = {
      ...candidate,
      machineTwinVerified: false 
    };

    const verdict = ManufacturingVerificationGate.verify(problem, candidate, independentResult);
    const passed = verdict === 'VERIFICATION_FAILURE';

    return {
      gateId: 'GATE-137-VERIFICATION',
      description: 'Require independent G-Code and Machine Twin verification',
      passed,
      verdict,
      details: passed ? 'Correctly rejected unverified process.' : 'Accepted unverified process.'
    };
  }

  private static testImmutableEvidence(): Gate137Result {
    const problem = this.getBasicProblem();
    const candidates = [{ candidateId: 'C1' } as ManufacturingCandidate];
    const hash1 = ManufacturingOptimizationEngine.generateHash(problem, candidates);
    const hash2 = ManufacturingOptimizationEngine.generateHash(problem, candidates);
    const passed = hash1 === hash2;
    return {
      gateId: 'GATE-137-PROVENANCE',
      description: 'Ensure optimization provenance is deterministic and hashed',
      passed,
      verdict: passed ? 'PASS' : 'FAIL',
      details: passed ? 'Hashes are consistent.' : 'Hashes vary.'
    };
  }

  private static getBasicProblem(): ManufacturingOptimizationProblem {
    return {
      problemId: 'PROB-MFG-01',
      partId: 'P1',
      materialId: 'M1',
      objectives: [{ type: 'MINIMIZE_CYCLE_TIME', weight: 1 }],
      constraints: []
    };
  }
}
