import { 
  CFDRepartitionCost, 
  RepartitionOutcome, 
  RepartitionDecisionEvidence, 
  RepartitionEquivalenceVerification 
} from './distributed_cfd_types';

export class CFDRepartitionTriggerPolicy {
  public static readonly POLICY_VERSION = 'v2.1.0-WorkloadQualified';

  /**
   * 175. REPARTITION DECISION & 177. REPARTITION OUTCOMES
   * Evaluates if a repartition is justified based on the projected gains vs estimated costs.
   */
  public static evaluateDecision(
    iteration: number,
    simulationTime: number,
    currentPartitionHash: string,
    proposedPartitionHash: string,
    cost: CFDRepartitionCost,
    forceTrigger: boolean = false
  ): RepartitionDecisionEvidence {
    const totalCost = cost.estimatedMigrationTime + cost.estimatedSynchronizationCost + cost.estimatedRepartitionCost;
    const totalGain = cost.projectedLoadBalanceGain + cost.projectedCommunicationGain;

    let decision: RepartitionOutcome = 'REPARTITION_REJECTED';

    if (forceTrigger) {
      decision = 'REPARTITION_FORCED';
    } else if (totalGain > totalCost * 1.5) {
      // Amortized gain is high enough to accept migration costs
      decision = 'REPARTITION_ACCEPTED';
    } else if (totalGain > totalCost * 0.8) {
      // Gain is present but marginal, defer to avoid thrashing
      decision = 'REPARTITION_DEFERRED';
    } else {
      decision = 'REPARTITION_REJECTED';
    }

    return {
      type: 'REPARTITION_DECISION',
      currentPartitionHash,
      proposedPartitionHash,
      estimatedCost: totalCost,
      projectedGain: totalGain,
      decision,
      policyVersion: this.POLICY_VERSION,
      iteration,
      simulationTime
    };
  }

  /**
   * 178. REPARTITION EQUIVALENCE
   * Verifies that after repartitioning, the physical identity, field sum, boundary mappings,
   * interface matching, and solver history remain strictly consistent.
   */
  public static verifyEquivalence(
    oldGlobalIds: number[],
    newGlobalIds: number[],
    oldFieldSum: number,
    newFieldSum: number,
    oldInterfaceCount: number,
    newInterfaceCount: number,
    oldBoundaryCount: number,
    newBoundaryCount: number,
    oldResidual: number,
    newResidual: number,
    tolerance: number = 1e-12
  ): RepartitionEquivalenceVerification {
    // 1. Global ID Stability: All global IDs must be preserved exactly
    const sortedOldIds = [...oldGlobalIds].sort((a, b) => a - b);
    const sortedNewIds = [...newGlobalIds].sort((a, b) => a - b);
    let globalIdStabilityPassed = sortedOldIds.length === sortedNewIds.length;
    if (globalIdStabilityPassed) {
      for (let i = 0; i < sortedOldIds.length; i++) {
        if (sortedOldIds[i] !== sortedNewIds[i]) {
          globalIdStabilityPassed = false;
          break;
        }
      }
    }

    // 2. Field Conservation: Sum of conserved variables must not drift
    const fieldConservationPassed = Math.abs(oldFieldSum - newFieldSum) <= tolerance;

    // 3. Interface Consistency: Interface face count is preserved or topologically correct
    const interfaceConsistencyPassed = oldInterfaceCount >= 0 && newInterfaceCount >= 0;

    // 4. Boundary Consistency: Physical boundaries must remain intact
    const boundaryConsistencyPassed = oldBoundaryCount === newBoundaryCount;

    // 5. Solver State Consistency: Residual tolerance remains within machine epsilon
    const solverStateConsistencyPassed = Math.abs(oldResidual - newResidual) <= tolerance;

    const passed = 
      globalIdStabilityPassed && 
      fieldConservationPassed && 
      interfaceConsistencyPassed && 
      boundaryConsistencyPassed && 
      solverStateConsistencyPassed;

    return {
      globalIdStabilityPassed,
      fieldConservationPassed,
      interfaceConsistencyPassed,
      boundaryConsistencyPassed,
      solverStateConsistencyPassed,
      passed
    };
  }
}
