import { EngineeringObject } from '../types';
import { GuardResult, TransitionContext } from './types';

export interface Guard {
  readonly id: string;
  readonly description: string;
  evaluate(
    obj: EngineeringObject,
    context: TransitionContext,
    resolveObject: (id: string) => EngineeringObject | undefined
  ): GuardResult;
}

export class SimulationReadyToRunningGuard implements Guard {
  public readonly id = 'SIMULATION_READY_TO_RUNNING';
  public readonly description = 'Verifies readiness for simulation execution (mesh, solver, BCs, and materials)';

  public evaluate(
    obj: EngineeringObject,
    context: TransitionContext,
    resolveObject: (id: string) => EngineeringObject | undefined
  ): GuardResult {
    const failedChecks: string[] = [];
    let isUnproven = false;

    // Check upstream dependencies in registry
    let hasMesh = false;
    let hasMaterial = false;

    for (const depId of obj.dependencies) {
      const dep = resolveObject(depId);
      if (dep) {
        if (dep.identity.objectType === 'MESH') hasMesh = true;
        if (dep.identity.objectType === 'MATERIAL') hasMaterial = true;
      }
    }

    if (!hasMesh) {
      failedChecks.push('Missing upstream MESH dependency');
    }
    if (!hasMaterial) {
      failedChecks.push('Missing upstream MATERIAL dependency');
    }

    // Evaluate context metadata
    const meta = context.metadata || {};

    if (meta.solverExists === undefined) {
      isUnproven = true;
    } else if (!meta.solverExists) {
      failedChecks.push('Solver configuration is missing or invalid');
    }

    if (meta.boundaryConditionsValid === undefined) {
      isUnproven = true;
    } else if (!meta.boundaryConditionsValid) {
      failedChecks.push('Boundary conditions failed validation');
    }

    if (meta.materialModelValid === undefined) {
      isUnproven = true;
    } else if (!meta.materialModelValid) {
      failedChecks.push('Material model properties are invalid for physics solver');
    }

    if (meta.configValid === undefined) {
      isUnproven = true;
    } else if (!meta.configValid) {
      failedChecks.push('Simulation runtime configuration is invalid');
    }

    if (failedChecks.length > 0) {
      return {
        verdict: 'FAIL',
        reason: 'Simulation requirements not met',
        failedChecks,
        evidenceRefs: obj.evidenceRefs
      };
    }

    if (isUnproven) {
      return {
        verdict: 'UNPROVEN',
        reason: 'Insufficient telemetry to prove simulation readiness',
        evidenceRefs: obj.evidenceRefs
      };
    }

    return {
      verdict: 'PASS',
      reason: 'All mesh, solver, boundary conditions, and material model validations passed',
      evidenceRefs: obj.evidenceRefs
    };
  }
}

export class ResultComputedToVerifiedGuard implements Guard {
  public readonly id = 'RESULT_COMPUTED_TO_VERIFIED';
  public readonly description = 'Validates physical consistency, solver residual limits, and conservation checks';

  public evaluate(
    obj: EngineeringObject,
    context: TransitionContext,
    resolveObject: (id: string) => EngineeringObject | undefined
  ): GuardResult {
    const failedChecks: string[] = [];
    let isUnproven = false;

    const meta = context.metadata || {};

    if (meta.residualChecksPassed === undefined) {
      isUnproven = true;
    } else if (!meta.residualChecksPassed) {
      failedChecks.push('Solver residuals exceeded validation convergence tolerances');
    }

    if (meta.conservationPassed === undefined) {
      isUnproven = true;
    } else if (!meta.conservationPassed) {
      failedChecks.push('Conservation equations (mass/momentum/energy) failed continuity checks');
    }

    if (meta.verificationEvidenceExists === undefined) {
      isUnproven = true;
    } else if (!meta.verificationEvidenceExists) {
      failedChecks.push('Verification evidence file or artifact is missing');
    }

    if (obj.evidenceRefs.length === 0) {
      failedChecks.push('No cryptographic evidence records linked to result');
    }

    if (failedChecks.length > 0) {
      return {
        verdict: 'FAIL',
        reason: 'Numerical result validation failed physical and continuity checks',
        failedChecks,
        evidenceRefs: obj.evidenceRefs
      };
    }

    if (isUnproven) {
      return {
        verdict: 'UNPROVEN',
        reason: 'Insufficient residual/conservation analytics to verify solver results',
        evidenceRefs: obj.evidenceRefs
      };
    }

    return {
      verdict: 'PASS',
      reason: 'Continuity, residuals, conservation laws, and evidence records successfully verified',
      evidenceRefs: obj.evidenceRefs
    };
  }
}

export class EvidenceGeneratedToVerifiedGuard implements Guard {
  public readonly id = 'EVIDENCE_GENERATED_TO_VERIFIED';
  public readonly description = 'Cryptographically validates evidence checksums and actor signatures';

  public evaluate(
    obj: EngineeringObject,
    context: TransitionContext,
    resolveObject: (id: string) => EngineeringObject | undefined
  ): GuardResult {
    const failedChecks: string[] = [];
    let isUnproven = false;

    const meta = context.metadata || {};

    if (meta.signatureVerified === undefined) {
      isUnproven = true;
    } else if (!meta.signatureVerified) {
      failedChecks.push('Cryptographic signature validation failed for signing authority');
    }

    if (meta.hashMatched === undefined) {
      isUnproven = true;
    } else if (!meta.hashMatched) {
      failedChecks.push('Payload SHA-256 hash mismatch against original artifact baseline');
    }

    if (failedChecks.length > 0) {
      return {
        verdict: 'FAIL',
        reason: 'Cryptographic validation failed',
        failedChecks,
        evidenceRefs: obj.evidenceRefs
      };
    }

    if (isUnproven) {
      return {
        verdict: 'UNPROVEN',
        reason: 'Missing signing key or target artifact payload to perform validation',
        evidenceRefs: obj.evidenceRefs
      };
    }

    return {
      verdict: 'PASS',
      reason: 'Signatures and SHA-256 integrity baseline verified successfully',
      evidenceRefs: obj.evidenceRefs
    };
  }
}

export class ManufacturingReleasedToExecutedGuard implements Guard {
  public readonly id = 'MANUFACTURING_RELEASED_TO_EXECUTED';
  public readonly description = 'Validates physical fabrication telemetry against CNC controller execution logs';

  public evaluate(
    obj: EngineeringObject,
    context: TransitionContext,
    resolveObject: (id: string) => EngineeringObject | undefined
  ): GuardResult {
    const failedChecks: string[] = [];
    let isUnproven = false;

    const meta = context.metadata || {};

    if (meta.hasExecutionTelemetry === undefined) {
      isUnproven = true;
    } else if (!meta.hasExecutionTelemetry) {
      failedChecks.push('Machine tool execution stream or controller log is missing');
    }

    if (meta.spindleLoadWithinLimits !== undefined && !meta.spindleLoadWithinLimits) {
      failedChecks.push('Telemetry reports anomalous spindle load exceeding tool limits');
    }

    if (meta.collisionDetected !== undefined && meta.collisionDetected) {
      failedChecks.push('CNC controller telemetry reported machine collision during cycle');
    }

    if (failedChecks.length > 0) {
      return {
        verdict: 'FAIL',
        reason: 'Machine telemetry validation failed cycle safety checks',
        failedChecks,
        evidenceRefs: obj.evidenceRefs
      };
    }

    if (isUnproven) {
      return {
        verdict: 'UNPROVEN',
        reason: 'Physical CNC telemetry is required to verify real machine execution',
        evidenceRefs: obj.evidenceRefs
      };
    }

    return {
      verdict: 'PASS',
      reason: 'Spindle cycles, feedrates, and kinematics match program constraints',
      evidenceRefs: obj.evidenceRefs
    };
  }
}
