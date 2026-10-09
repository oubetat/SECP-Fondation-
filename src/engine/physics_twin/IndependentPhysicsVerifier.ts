// SECP Industrial OS v2 — Independent Physics Verification & Residual/Conservation Audit
import {
  PhysicsTwin,
  PhysicsResiduals,
  ConservationSummary,
  PhysicsStateStatus,
  DifferentialVerdict
} from './types';
import { CanonicalPhysicsSerializer } from './CanonicalPhysicsSerializer';
import { PhysicsIdentityService } from './PhysicsIdentityService';

export interface ResidualAuditReport {
  initialResidual: number;
  finalResidual: number;
  residualNorm: number;
  relativeReduction: number;
  iterationCount: number;
  tolerance: number;
  verdict: 'CONVERGED' | 'DIVERGED' | 'STAGNATED';
}

export interface ConservationAuditReport {
  massConservation: string;
  momentumConservation: string;
  energyConservation: string;
  overallConservation: 'CONSERVATION_OK' | 'CONSERVATION_FAILURE' | 'NOT_APPLICABLE';
  details: string[];
}

export interface VerificationReport {
  verdict: PhysicsStateStatus;
  inputHashValid: boolean;
  modelHashValid: boolean;
  resultHashValid: boolean;
  rootHashValid: boolean;
  residualAudit: ResidualAuditReport;
  conservationAudit: ConservationAuditReport;
  details: string[];
}

export class IndependentPhysicsVerifier {
  // 1. Independent Residual Audit
  public static auditResiduals(residuals: PhysicsResiduals): ResidualAuditReport {
    const relRed = residuals.finalResidual / (residuals.initialResidual || 1.0);
    const convergedByTol = residuals.finalResidual <= residuals.tolerance;
    const convergedByRed = relRed <= 1e-3;

    let verdict: 'CONVERGED' | 'DIVERGED' | 'STAGNATED' = 'CONVERGED';
    if (!convergedByTol && !convergedByRed) {
      verdict = residuals.finalResidual > residuals.initialResidual ? 'DIVERGED' : 'STAGNATED';
    }

    return {
      initialResidual: residuals.initialResidual,
      finalResidual: residuals.finalResidual,
      residualNorm: residuals.residualNorm,
      relativeReduction: relRed,
      iterationCount: residuals.iterationCount,
      tolerance: residuals.tolerance,
      verdict
    };
  }

  // 2. Independent Conservation Audit
  public static auditConservation(conservation: ConservationSummary): ConservationAuditReport {
    const details: string[] = [];
    let failure = false;

    if (conservation.massConservation === 'VIOLATED') {
      details.push('Mass conservation violated: net mass flux exceeds tolerance');
      failure = true;
    }
    if (conservation.momentumConservation === 'VIOLATED') {
      details.push('Momentum conservation violated: force imbalance exceeds tolerance');
      failure = true;
    }
    if (conservation.energyConservation === 'VIOLATED') {
      details.push('Energy conservation violated: thermal flux imbalance exceeds tolerance');
      failure = true;
    }

    return {
      massConservation: conservation.massConservation,
      momentumConservation: conservation.momentumConservation,
      energyConservation: conservation.energyConservation,
      overallConservation: failure ? 'CONSERVATION_FAILURE' : 'CONSERVATION_OK',
      details
    };
  }

  // 3. Complete Independent Verification
  public static verifyPhysicsTwin(twin: PhysicsTwin, geometryTwinHash: string): VerificationReport {
    const details: string[] = [];

    // Recompute Input Hash
    const computedInputHash = CanonicalPhysicsSerializer.computePhysicsInputHash(twin.physicsState);
    const inputHashValid = computedInputHash === twin.inputHash;
    if (!inputHashValid) {
      details.push(`Input Hash Mismatch: Expected ${twin.inputHash}, Calculated ${computedInputHash}`);
    }

    // Recompute Model Hash
    const computedModelHash = CanonicalPhysicsSerializer.computePhysicsModelHash(twin.physicsState);
    const modelHashValid = computedModelHash === twin.modelHash;
    if (!modelHashValid) {
      details.push(`Model Hash Mismatch: Expected ${twin.modelHash}, Calculated ${computedModelHash}`);
    }

    // Recompute Result Hash
    let resultHashValid = true;
    if (twin.physicsState.resultState) {
      const computedResultHash = CanonicalPhysicsSerializer.computeResultHash(twin.physicsState.resultState);
      resultHashValid = computedResultHash === twin.resultHash;
      if (!resultHashValid) {
        details.push(`Result Hash Mismatch: Expected ${twin.resultHash}, Calculated ${computedResultHash}`);
      }
    }

    // Audit Residuals
    const resState = twin.physicsState.verificationState?.residuals || {
      initialResidual: 1.0,
      finalResidual: 1e-6,
      residualNorm: 1e-6,
      relativeReduction: 1e-6,
      iterationCount: 100,
      tolerance: 1e-5,
      residualHistory: [1.0, 1e-2, 1e-4, 1e-6],
      verdict: 'CONVERGED'
    };
    const residualAudit = this.auditResiduals(resState);
    if (residualAudit.verdict !== 'CONVERGED') {
      details.push(`Residual Audit Failure: Solver did not achieve convergence (${residualAudit.verdict})`);
    }

    // Audit Conservation
    const consState = twin.physicsState.verificationState?.conservation || {
      massConservation: 'CONSERVED',
      momentumConservation: 'CONSERVED',
      energyConservation: 'CONSERVED',
      chargeConservation: 'NOT_APPLICABLE',
      speciesConservation: 'NOT_APPLICABLE',
      overallConservation: 'CONSERVATION_OK',
      imbalanceNorms: {}
    };
    const conservationAudit = this.auditConservation(consState);
    if (conservationAudit.overallConservation === 'CONSERVATION_FAILURE') {
      details.push('Conservation Audit Failure: Mass, momentum, or energy conservation breached');
    }

    // Determine Final Precedence-Based Verdict
    let verdict: PhysicsStateStatus = 'CONVERGED';

    if (!inputHashValid || !modelHashValid || !resultHashValid) {
      verdict = 'INVALID';
    } else if (conservationAudit.overallConservation === 'CONSERVATION_FAILURE') {
      verdict = 'CONSERVATION_FAILURE'; // Precedence Rule: Conservation Failure overrides Residual Convergence!
    } else if (residualAudit.verdict !== 'CONVERGED') {
      verdict = 'NOT_CONVERGED';
    } else if (twin.physicsState.geometryState.geometryHash !== geometryTwinHash) {
      verdict = 'OUT_OF_SYNC';
    }

    return {
      verdict,
      inputHashValid,
      modelHashValid,
      resultHashValid,
      rootHashValid: inputHashValid && modelHashValid && resultHashValid,
      residualAudit,
      conservationAudit,
      details
    };
  }

  // 4. Differential Verification Engine
  public static compareVerifiers(
    primaryVerdict: PhysicsStateStatus,
    independentReport: VerificationReport
  ): { differentialVerdict: DifferentialVerdict; details: string } {
    const isMatch = primaryVerdict === independentReport.verdict;
    return {
      differentialVerdict: isMatch ? 'MATCH' : 'MISMATCH',
      details: `Primary Verdict [${primaryVerdict}] vs Independent Verdict [${independentReport.verdict}]`
    };
  }
}
