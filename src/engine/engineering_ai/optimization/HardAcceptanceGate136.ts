import { DesignOptimizationEngine } from './DesignOptimizationEngine';
import { OptimizationVerificationGate } from './OptimizationVerificationGate';
import {
  OptimizationProblem,
  OptimizationCandidate,
  OptimizationVerdict,
  OptimizationObjective,
  EngineeringConstraint,
  DesignVariable
} from './types';

export interface Gate136Result {
  gateId: string;
  description: string;
  passed: boolean;
  verdict: string;
  details: string;
}

export class HardAcceptanceGate136 {
  public static runAllTests(): Gate136Result[] {
    const results: Gate136Result[] = [];

    // 1. Mandatory Test: Feasibility Filtering
    results.push(this.testFeasibilityFiltering());

    // 2. Mandatory Test: Pareto Dominance
    results.push(this.testParetoDominance());

    // 3. Mandatory Test: Verification Gate (L5)
    results.push(this.testVerificationGate());

    // 4. Mandatory Test: Manufacturing Constraint Blocking
    results.push(this.testManufacturingConstraint());

    // 5. Mandatory Test: Reproducibility (Hash Check)
    results.push(this.testReproducibility());

    return results;
  }

  private static testFeasibilityFiltering(): Gate136Result {
    const constraint: EngineeringConstraint = {
      constraintId: 'C1',
      expression: 'stress <= 250',
      type: 'STRUCTURAL',
      operator: '<=',
      limit: 250,
      unit: 'MPa',
      tolerance: 0,
      severity: 'HARD_CONSTRAINT'
    };

    const candidate: Partial<OptimizationCandidate> = {
      objectiveValues: { 'C1': 280 }
    };

    const res = DesignOptimizationEngine.evaluateFeasibility(candidate, [constraint]);
    const passed = res.feasibility === false && res.violations.length > 0;

    return {
      gateId: 'GATE-136-FEASIBILITY',
      description: 'Block candidates that violate hard constraints',
      passed,
      verdict: passed ? 'INFEASIBLE' : 'FAILED',
      details: passed ? 'Successfully blocked infeasible design.' : 'Failed to block invalid design.'
    };
  }

  private static testParetoDominance(): Gate136Result {
    const obj1: OptimizationObjective = { objectiveId: 'O1', name: 'Mass', expression: 'm', direction: 'MINIMIZE', weight: 1, priority: 1, unit: 'kg' };
    const obj2: OptimizationObjective = { objectiveId: 'O2', name: 'Stiffness', expression: 'k', direction: 'MAXIMIZE', weight: 1, priority: 1, unit: 'N/m' };

    const a: any = { objectiveValues: { 'O1': 10, 'O2': 100 } };
    const b: any = { objectiveValues: { 'O1': 12, 'O2': 90 } };

    const aDominatesB = DesignOptimizationEngine.computeDominance(a, b, [obj1, obj2]);
    const passed = aDominatesB === true;

    return {
      gateId: 'GATE-136-PARETO',
      description: 'Correctly identify Pareto dominance between designs',
      passed,
      verdict: passed ? 'DOMINATES' : 'FAILED',
      details: passed ? 'Correctly identified dominant design.' : 'Failed to identify dominance.'
    };
  }

  private static testVerificationGate(): Gate136Result {
    const problem = this.getBasicProblem();
    const candidate: any = {
      candidateId: 'CAN-001',
      objectiveValues: { 'MASS': 8.5 },
      designVariables: { 'thickness': 2.0 }
    };
    const independentResult = {
      objectives: { 'MASS': 8.5 }
    };

    const verdict = OptimizationVerificationGate.verify(problem, candidate, independentResult);
    const passed = verdict === 'VERIFIED_OPTIMUM';

    return {
      gateId: 'GATE-136-VERIFICATION',
      description: 'Independent evaluation must verify optimization results',
      passed,
      verdict,
      details: passed ? 'Successfully verified optimum.' : 'Verification failed.'
    };
  }

  private static testManufacturingConstraint(): Gate136Result {
    const manufacturingConstraint: EngineeringConstraint = {
      constraintId: 'MFG-THK',
      expression: 'thickness >= 2.0',
      type: 'MANUFACTURING',
      operator: '>=',
      limit: 2.0,
      unit: 'mm',
      tolerance: 0,
      severity: 'HARD_CONSTRAINT'
    };

    const candidate: any = {
      objectiveValues: { 'MFG-THK': 1.5 } // Violates minimum thickness
    };

    const res = DesignOptimizationEngine.evaluateFeasibility(candidate, [manufacturingConstraint]);
    const passed = res.feasibility === false;

    return {
      gateId: 'GATE-136-MFG-BLOCK',
      description: 'Reject designs that violate manufacturing constraints',
      passed,
      verdict: passed ? 'MANUFACTURING_INFEASIBLE' : 'FAILED',
      details: passed ? 'Correctly rejected unmanufacturable design.' : 'Failed to reject.'
    };
  }

  private static testReproducibility(): Gate136Result {
    const problem = this.getBasicProblem();
    const candidates: any[] = [
      { candidateId: 'C1', designVariables: { x: 1 }, objectiveValues: { y: 2 } }
    ];

    const hash1 = DesignOptimizationEngine.generateHash(problem, candidates);
    const hash2 = DesignOptimizationEngine.generateHash(problem, candidates);
    const passed = hash1 === hash2;

    return {
      gateId: 'GATE-136-REPRODUCIBILITY',
      description: 'Optimization records must be deterministic and hash-verified',
      passed,
      verdict: passed ? 'PASS' : 'FAIL',
      details: passed ? 'Hashes matched.' : 'Hashes diverged.'
    };
  }

  private static getBasicProblem(): OptimizationProblem {
    return {
      problemId: 'PROB-001',
      designId: 'DES-001',
      variables: [
        { variableId: 'THK', name: 'Thickness', type: 'CONTINUOUS', unit: 'mm', lowerBound: 1.0, upperBound: 5.0, defaultValue: 2.5 }
      ],
      objectives: [
        { objectiveId: 'MASS', name: 'Mass', expression: 'm', direction: 'MINIMIZE', weight: 1, priority: 1, unit: 'kg' }
      ],
      constraints: [],
      terminationCriteria: { maxEvaluations: 100, maxIterations: 10, objectiveTolerance: 0.001 }
    };
  }
}
