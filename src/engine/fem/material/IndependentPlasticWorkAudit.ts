import { MaterialStateData } from "./types";
import { MaterialTolerancePolicy } from "./MaterialTolerancePolicy";

export interface PlasticWorkAuditReport {
  isValid: boolean;
  totalPlasticWork: number;
  totalElasticEnergy: number;
  incrementsAudited: number;
  isDissipationNonNegative: boolean;
  maxNegativeDissipationViolation: number;
  internalEnergyConsistency: boolean;
  energyError: number;
  errors: string[];
}

export class IndependentPlasticWorkAudit {
  /**
   * Independently recomputes plastic work across a sequence of material states.
   * Compares with material internal energy bookkeeping.
   */
  static auditHistory(
    history: MaterialStateData[],
    tolerancePolicy?: MaterialTolerancePolicy
  ): PlasticWorkAuditReport {
    const policy = tolerancePolicy || MaterialTolerancePolicy.getDefault();
    const errors: string[] = [];

    let computedPlasticWork = 0.0;
    let maxNegativeViolation = 0.0;

    for (let k = 1; k < history.length; k++) {
      const statePrev = history[k - 1];
      const stateCurr = history[k];

      // Plastic strain increment: dEpsP = epsP_curr - epsP_prev
      const dEpsP = stateCurr.plasticStrain.map((v, i) => v - statePrev.plasticStrain[i]);

      // Mid-point stress tensor
      let dWork = 0.0;
      const len = Math.min(stateCurr.stress.length, dEpsP.length);

      for (let i = 0; i < len; i++) {
        const avgStress = 0.5 * (statePrev.stress[i] + stateCurr.stress[i]);
        dWork += avgStress * dEpsP[i];
      }

      if (dWork < -policy.energyTolerance) {
        const violation = Math.abs(dWork);
        if (violation > maxNegativeViolation) {
          maxNegativeViolation = violation;
        }
        errors.push(`Negative plastic work dissipation detected at step ${stateCurr.stepId}, inc ${stateCurr.incrementId}: ${dWork} J`);
      }

      computedPlasticWork += Math.max(0.0, dWork);
    }

    const latestState = history[history.length - 1];
    const reportedPlasticWork = latestState.plasticDissipation;
    const energyError = Math.abs(computedPlasticWork - reportedPlasticWork);
    const internalEnergyConsistency = energyError <= policy.energyTolerance + 1e-7 * Math.abs(reportedPlasticWork);

    if (!internalEnergyConsistency) {
      errors.push(`Plastic work bookkeeping discrepancy: recomputed=${computedPlasticWork}, recorded=${reportedPlasticWork}`);
    }

    const isValid = errors.length === 0;

    return {
      isValid,
      totalPlasticWork: computedPlasticWork,
      totalElasticEnergy: latestState.elasticEnergy,
      incrementsAudited: history.length - 1,
      isDissipationNonNegative: maxNegativeViolation <= policy.energyTolerance,
      maxNegativeDissipationViolation: maxNegativeViolation,
      internalEnergyConsistency,
      energyError,
      errors
    };
  }
}
