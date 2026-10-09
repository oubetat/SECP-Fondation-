import { CreepMaterialState, CreepVerdict } from "./types";
import { NortonCreepLaw } from "./NortonCreepLaw";
import { ConstitutiveUtils } from "../plasticity/ConstitutiveUtils";
import { CreepConstants } from "./CreepEngine";

export interface CreepAuditReport {
  verdict: string;
  checks: { id: string; passed: boolean; details: string }[];
}

export class IndependentCreepAuditor {
  public static audit(
    history: { state: CreepMaterialState; verdict: CreepVerdict }[],
    constants: CreepConstants
  ): CreepAuditReport {
    const checks: { id: string; passed: boolean; details: string }[] = [];

    // 1. TIME_MONOTONICITY
    const times = history.map(h => h.state.accumulatedTime);
    const timeMonotonic = times.every((t, i) => i === 0 || t >= times[i - 1]);
    checks.push({
      id: "TIME_MONOTONICITY",
      passed: timeMonotonic,
      details: "Verified that accumulated time is non-decreasing"
    });

    // 2. CREEP_STRAIN_MONOTONICITY
    const strains = history.map(h => h.state.equivalentCreepStrain);
    const strainMonotonic = strains.every((s, i) => i === 0 || s >= strains[i - 1] - 1e-15);
    checks.push({
      id: "CREEP_STRAIN_MONOTONICITY",
      passed: strainMonotonic,
      details: "Verified that equivalent creep strain is non-decreasing"
    });

    // 3. NORTON_CONSISTENCY
    const rateChecks = history.map(h => {
      const sigmaEq = ConstitutiveUtils.calculateVonMises(h.state.stressState);
      if (sigmaEq === 0) return h.state.creepStrainRate === 0;
      
      const expectedRate = NortonCreepLaw.calculateRate(sigmaEq, h.state.temperature, constants);
      return Math.abs(h.state.creepStrainRate - expectedRate) / (expectedRate || 1) < 1e-6;
    });
    checks.push({
      id: "NORTON_LAW_CONSISTENCY",
      passed: rateChecks.every(c => c === true),
      details: "Verified that calculated creep rate matches Norton Power-Law"
    });

    // 4. THERMODYNAMIC_DISSIPATION
    // dw_cr = sigma : d_eps_cr >= 0
    let dissipationPassed = true;
    for (let i = 1; i < history.length; i++) {
       const d_eps_cr = history[i].state.creepStrainTensor.map((eps, j) => eps - history[i-1].state.creepStrainTensor[j]);
       const dw_cr = ConstitutiveUtils.dot(history[i].state.stressState, d_eps_cr);
       if (dw_cr < -1e-9) {
         dissipationPassed = false;
         break;
       }
    }
    checks.push({
      id: "THERMODYNAMIC_DISSIPATION",
      passed: dissipationPassed,
      details: "Verified positive creep work dissipation"
    });

    const verdict = checks.every(c => c.passed) ? "PASS" : "FAIL";

    return { verdict, checks };
  }
}
