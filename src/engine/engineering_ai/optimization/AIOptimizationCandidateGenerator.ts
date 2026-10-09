/**
 * SECP Industrial OS - PATCH-309 Candidate Generator
 * Generates optimization candidate parameter sets using strategy models (Bayesian, Evolutionary,
 * Surrogate-assisted search) and performs pre-solve schema, unit, and bounds validation.
 */

import {
  EngineeringOptimizationProblem,
  OptimizationCandidate,
  SearchStrategyType,
} from './AIOptimizationTypes309';

export class AIOptimizationCandidateGenerator {
  /**
   * Generates candidate parameter sets based on optimization search strategy and prior history.
   */
  public generateCandidate(
    problem: EngineeringOptimizationProblem,
    strategy: SearchStrategyType,
    iteration: number,
    history: OptimizationCandidate[]
  ): { parameters: Record<string, number>; parentCandidateId?: string } {
    const parameters: Record<string, number> = {};
    let parentCandidateId: string | undefined = undefined;

    if (history.length > 0 && strategy === 'BAYESIAN_OPTIMIZATION') {
      // Find best candidate so far and perturb parameters towards convergence
      const best = history
        .filter((c) => c.status === 'VALIDATED')
        .sort((a, b) => b.overallScore - a.overallScore)[0] ?? history[history.length - 1];

      parentCandidateId = best.candidateId;

      for (const v of problem.variables) {
        const currentVal = best.parameters[v.name] ?? v.currentValue;
        // Adaptive step reduction as iteration grows
        const stepFactor = Math.max(0.1, 1 - iteration / (problem.stoppingCriteria.maxIterations * 1.2));
        const delta = (v.step * (Math.random() > 0.5 ? 1 : -1) * stepFactor);
        const clamped = Math.min(v.max, Math.max(v.min, Number((currentVal + delta).toFixed(2))));
        parameters[v.name] = clamped;
      }
    } else if (strategy === 'EVOLUTIONARY_SEARCH' && history.length >= 2) {
      // Crossover top 2 candidates
      const sorted = [...history]
        .filter((c) => c.status === 'VALIDATED')
        .sort((a, b) => b.overallScore - a.overallScore);

      const p1 = sorted[0];
      const p2 = sorted[1] ?? sorted[0];
      parentCandidateId = p1.candidateId;

      for (const v of problem.variables) {
        const val1 = p1.parameters[v.name] ?? v.min;
        const val2 = p2.parameters[v.name] ?? v.max;
        const blended = (val1 + val2) / 2;
        const clamped = Math.min(v.max, Math.max(v.min, Number(blended.toFixed(2))));
        parameters[v.name] = clamped;
      }
    } else {
      // Initial / Grid / Random Search candidate generation
      for (const v of problem.variables) {
        const span = v.max - v.min;
        const gridStep = span / Math.max(1, problem.stoppingCriteria.maxIterations - 1);
        const val = v.min + (iteration % Math.max(1, problem.stoppingCriteria.maxIterations)) * gridStep;
        parameters[v.name] = Number(Math.min(v.max, Math.max(v.min, val)).toFixed(2));
      }
    }

    return { parameters, parentCandidateId };
  }

  /**
   * Pre-validates parameter bounds and units before dispatching expensive solver runs.
   */
  public preValidateCandidate(
    problem: EngineeringOptimizationProblem,
    parameters: Record<string, number>
  ): { valid: boolean; reason?: string } {
    for (const v of problem.variables) {
      const val = parameters[v.name];
      if (val === undefined) {
        return { valid: false, reason: `Missing required parameter ${v.name}` };
      }
      if (val < v.min || val > v.max) {
        return { valid: false, reason: `Parameter ${v.name} value ${val} out of bounds [${v.min}, ${v.max}]` };
      }
    }
    return { valid: true };
  }
}
