import { ManufacturingCandidate, ManufacturingOptimizationProblem, ManufacturingVerdict, ManufacturingEvidenceBundle } from './types';
import { ManufacturingOptimizationEngine } from './ManufacturingOptimizationEngine';

export class ManufacturingVerificationGate {
  public static verify(
    problem: ManufacturingOptimizationProblem,
    candidate: ManufacturingCandidate,
    independentVerificationResult: any
  ): ManufacturingVerdict {
    
    if (!candidate.feasibility) {
      return 'MANUFACTURING_INFEASIBLE';
    }

    if (candidate.collisionStatus === 'FATAL' || independentVerificationResult.collisionStatus === 'FATAL') {
      return 'COLLISION_DETECTED';
    }

    if (candidate.kinematicsStatus === 'INVALID' || independentVerificationResult.kinematicsStatus === 'INVALID') {
      return 'KINEMATIC_VIOLATION';
    }

    if (!independentVerificationResult.gcodeVerified) {
      return 'VERIFICATION_FAILURE';
    }

    if (!independentVerificationResult.machineTwinVerified) {
      return 'VERIFICATION_FAILURE';
    }
    
    // Check constraints independently
    const independentEval = ManufacturingOptimizationEngine.evaluateCandidate(
      independentVerificationResult,
      problem.constraints
    );

    if (!independentEval.feasibility) {
      return 'VERIFICATION_FAILURE';
    }

    return 'VERIFIED_MANUFACTURING_PLAN';
  }

  public static generateEvidence(problem: ManufacturingOptimizationProblem, candidates: ManufacturingCandidate[], verdict: ManufacturingVerdict, verifiedPlan?: any): ManufacturingEvidenceBundle {
    return {
      problemId: problem.problemId,
      optimizationHash: ManufacturingOptimizationEngine.generateHash(problem, candidates),
      candidateHistory: candidates,
      finalVerdict: verdict,
      verifiedPlan,
      timestamp: new Date().toISOString()
    };
  }
}
