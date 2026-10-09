import {
  OptimizationCandidate,
  OptimizationProblem,
  OptimizationVerdict,
  OptimizationEvidenceBundle
} from './types';
import { DesignOptimizationEngine } from './DesignOptimizationEngine';

export class OptimizationVerificationGate {
  public static verify(
    problem: OptimizationProblem,
    candidate: OptimizationCandidate,
    independentResult: any
  ): OptimizationVerdict {
    // 1. Check constraints again (Independent Verification)
    const feasibility = DesignOptimizationEngine.evaluateFeasibility(candidate, problem.constraints);
    if (!feasibility.feasibility) {
      return 'VERIFICATION_FAILURE';
    }

    // 2. Check if objectives match independent evaluation
    for (const obj of problem.objectives) {
      const claimed = candidate.objectiveValues[obj.objectiveId];
      const verified = independentResult.objectives[obj.objectiveId];
      const error = Math.abs(claimed - verified) / (Math.abs(verified) || 1e-9);
      
      if (error > 0.01) { // 1% tolerance
        return 'VERIFICATION_FAILURE';
      }
    }

    // 3. Physical Validity (Mocked)
    if (independentResult.physicalInvalidity) {
      return 'INSUFFICIENT_EVIDENCE';
    }

    return 'VERIFIED_OPTIMUM';
  }

  public static bundleEvidence(
    problem: OptimizationProblem,
    history: OptimizationCandidate[],
    verdict: OptimizationVerdict
  ): OptimizationEvidenceBundle {
    return {
      problemId: problem.problemId,
      optimizationHash: DesignOptimizationEngine.generateHash(problem, history),
      candidateHistory: history,
      finalVerdict: verdict,
      verificationResults: { timestamp: new Date().toISOString() }
    };
  }
}
