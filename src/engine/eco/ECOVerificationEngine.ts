import { createHash } from 'crypto';
import { 
  EngineeringChangeOrder, 
  ECOChangeSet, 
  ECOImplementationPlan, 
  ECOVerificationRecord, 
  ECOVerificationVerdict, 
  ImplementationStepStatus 
} from './types';

export class ECOVerificationEngine {

  public static verifyChange(
    eco: EngineeringChangeOrder,
    changeSet: ECOChangeSet,
    implementationPlan: ECOImplementationPlan,
    actualImplementedChanges: any[],
    verifierId: string
  ): ECOVerificationRecord {
    const mismatches: string[] = [];

    // 1. Check implementation completion
    const allStepsCompleted = implementationPlan.steps.every(s => s.status === ImplementationStepStatus.COMPLETED);
    if (!allStepsCompleted) {
      mismatches.push('INCOMPLETE_IMPLEMENTATION_STEPS');
    }

    // 2. Requested vs Actual comparison
    for (const proposed of changeSet.changes) {
      const actual = actualImplementedChanges.find(a => a.targetEntityId === proposed.targetEntityId);
      if (!actual) {
        mismatches.push(`MISSING_ACTUAL_CHANGE_FOR_${proposed.targetEntityId}`);
        continue;
      }

      if (JSON.stringify(proposed.proposedState) !== JSON.stringify(actual.actualState)) {
        mismatches.push(`MISMATCH_IN_ENTITY_${proposed.targetEntityId}: Requested ${JSON.stringify(proposed.proposedState)} vs Actual ${JSON.stringify(actual.actualState)}`);
      }
    }

    let verdict: ECOVerificationVerdict;
    if (!allStepsCompleted) {
      verdict = ECOVerificationVerdict.INCOMPLETE;
    } else if (mismatches.length > 0) {
      verdict = ECOVerificationVerdict.IMPLEMENTATION_MISMATCH;
    } else {
      verdict = ECOVerificationVerdict.VERIFIED;
    }

    const verifPayload = `${eco.ecoId}:${verdict}:${allStepsCompleted}:${mismatches.length}:${verifierId}`;
    const verifHash = createHash('sha256').update(verifPayload).digest('hex').slice(0, 12).toUpperCase();

    return {
      verificationId: `VERIF-${eco.ecoId}-${verifHash}`,
      ecoId: eco.ecoId,
      verdict,
      requestedVsActualMatched: mismatches.length === 0 && allStepsCompleted,
      mismatches,
      verifierId,
      timestamp: new Date().toISOString(),
      evidenceIds: [`VERIF-EVID-${verifHash}`]
    };
  }
}
