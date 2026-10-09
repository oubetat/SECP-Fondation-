import {
  OptimizationProblem,
  OptimizationCandidate,
  ConstraintViolation,
  OptimizationVerdict,
  DesignVariable,
  EngineeringConstraint,
  OptimizationObjective
} from './types';
import * as crypto from 'crypto';

export class DesignOptimizationEngine {
  public static evaluateFeasibility(
    candidate: Partial<OptimizationCandidate>,
    constraints: EngineeringConstraint[]
  ): { feasibility: boolean; violations: ConstraintViolation[] } {
    const violations: ConstraintViolation[] = [];
    let isFeasible = true;

    for (const constraint of constraints) {
      const observedValue = candidate.objectiveValues?.[constraint.constraintId] || 0; // Mock or real mapping
      let violationAmount = 0;

      switch (constraint.operator) {
        case '<=':
          if (observedValue > (constraint.limit as number) + constraint.tolerance) {
            violationAmount = observedValue - (constraint.limit as number);
          }
          break;
        case '>=':
          if (observedValue < (constraint.limit as number) - constraint.tolerance) {
            violationAmount = (constraint.limit as number) - observedValue;
          }
          break;
        // Other operators...
      }

      if (violationAmount > 0) {
        violations.push({
          constraintId: constraint.constraintId,
          observedValue,
          limit: constraint.limit,
          violationAmount,
          severity: constraint.severity
        });
        if (constraint.severity === 'HARD_CONSTRAINT') {
          isFeasible = false;
        }
      }
    }

    return { feasibility: isFeasible, violations };
  }

  public static computeDominance(a: OptimizationCandidate, b: OptimizationCandidate, objectives: OptimizationObjective[]): boolean {
    // A dominates B if it's better or equal in all objectives and strictly better in at least one
    let betterInAtLeastOne = false;
    let worseInAtLeastOne = false;

    for (const obj of objectives) {
      const valA = a.objectiveValues[obj.objectiveId];
      const valB = b.objectiveValues[obj.objectiveId];

      if (obj.direction === 'MINIMIZE') {
        if (valA > valB) worseInAtLeastOne = true;
        if (valA < valB) betterInAtLeastOne = true;
      } else {
        if (valA < valB) worseInAtLeastOne = true;
        if (valA > valB) betterInAtLeastOne = true;
      }
    }

    return betterInAtLeastOne && !worseInAtLeastOne;
  }

  public static generateHash(problem: OptimizationProblem, candidates: OptimizationCandidate[]): string {
    const data = JSON.stringify({
      problemId: problem.problemId,
      candidates: candidates.map(c => ({ id: c.candidateId, variables: c.designVariables, objectives: c.objectiveValues }))
    });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  public static rankCandidates(candidates: OptimizationCandidate[], objectives: OptimizationObjective[]): OptimizationCandidate[] {
    // Simple scalarization for ranking if weights are provided, or Pareto sorting
    return [...candidates].sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;
      objectives.forEach(obj => {
        const valA = a.objectiveValues[obj.objectiveId] || 0;
        const valB = b.objectiveValues[obj.objectiveId] || 0;
        const multiplier = obj.direction === 'MINIMIZE' ? -1 : 1;
        scoreA += valA * obj.weight * multiplier;
        scoreB += valB * obj.weight * multiplier;
      });
      return scoreB - scoreA;
    });
  }
}
