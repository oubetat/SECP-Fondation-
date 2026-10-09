import {
  ManufacturingOptimizationProblem,
  ManufacturingCandidate,
  ManufacturingVerdict,
  ManufacturingConstraint,
  ProcessPlan
} from './types';
import * as crypto from 'crypto';

export class ManufacturingOptimizationEngine {
  public static evaluateCandidate(
    candidate: Partial<ManufacturingCandidate>,
    constraints: ManufacturingConstraint[]
  ): ManufacturingCandidate {
    let feasibility = true;
    const constraintViolations = [];

    // Collision Check
    if (candidate.collisionStatus === 'FATAL') {
      feasibility = false;
      constraintViolations.push({ constraintId: 'COLLISION', severity: 'HARD_CONSTRAINT', details: 'Fatal collision detected' });
    }

    // Kinematic Check
    if (candidate.kinematicsStatus === 'INVALID') {
      feasibility = false;
      constraintViolations.push({ constraintId: 'KINEMATICS', severity: 'HARD_CONSTRAINT', details: 'Kinematic violation (axis limit or singularity)' });
    }

    // General Constraints
    for (const constraint of constraints) {
      const val = candidate.objectives ? candidate.objectives[constraint.constraintId] : null;
      if (val !== null && val !== undefined) {
        if (constraint.operator === '<=' && val > (constraint.limit as number) + constraint.tolerance) {
          if (constraint.severity === 'HARD_CONSTRAINT') feasibility = false;
          constraintViolations.push({ constraintId: constraint.constraintId, violationAmount: val - (constraint.limit as number) });
        }
        if (constraint.operator === '>=' && val < (constraint.limit as number) - constraint.tolerance) {
           if (constraint.severity === 'HARD_CONSTRAINT') feasibility = false;
           constraintViolations.push({ constraintId: constraint.constraintId, violationAmount: (constraint.limit as number) - val });
        }
      }
    }

    return {
      ...candidate,
      feasibility,
      constraintViolations
    } as ManufacturingCandidate;
  }

  public static generateHash(problem: ManufacturingOptimizationProblem, candidates: ManufacturingCandidate[]): string {
    const payload = JSON.stringify({
      problemId: problem.problemId,
      candidates: candidates.map(c => c.candidateId)
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }
}
