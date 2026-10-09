import { 
  PlasticMaterialState, 
  ConstitutiveVerdict 
} from "./types";
import { ConstitutiveUtils } from "./ConstitutiveUtils";
import { HardeningLaws } from "./HardeningLaws";
import { MaterialConstants } from "./VonMisesPlasticity";

export interface PlasticityAuditReport {
  verdict: string;
  checks: { id: string; passed: boolean; details: string }[];
}

export class IndependentPlasticityAuditor {
  public static audit(
    history: { state: PlasticMaterialState; verdict: ConstitutiveVerdict }[],
    constants: MaterialConstants
  ): PlasticityAuditReport {
    const checks: { id: string; passed: boolean; details: string }[] = [];

    // 1. YIELD_CONSISTENCY
    const yieldChecks = history.filter(h => h.verdict === ConstitutiveVerdict.PLASTIC).map(h => {
      const q = ConstitutiveUtils.calculateVonMises(h.state.stress);
      const sy = HardeningLaws.linearIsotropic(constants.yieldStress0, constants.H, h.state.equivalentPlasticStrain).yieldStress;
      return Math.abs(q - sy) / sy < 1e-6; // 0.0001% tolerance
    });
    checks.push({
      id: "YIELD_CONSISTENCY",
      passed: yieldChecks.every(c => c === true),
      details: "Verified that stress states during plastic flow remain on the yield surface"
    });

    // 2. PLASTIC_STRAIN_MONOTONICITY
    const plasticStrains = history.map(h => h.state.equivalentPlasticStrain);
    const monotonic = plasticStrains.every((val, i) => i === 0 || val >= plasticStrains[i - 1] - 1e-15);
    checks.push({
      id: "MONOTONIC_PLASTIC_STRAIN",
      passed: monotonic,
      details: "Verified that equivalent plastic strain is non-decreasing"
    });

    // 3. DISSIPATION_CHECK
    // Plastic work increment dw_p = sigma : d_eps_p >= 0
    let dissipationPassed = true;
    for (let i = 1; i < history.length; i++) {
       if (history[i].verdict === ConstitutiveVerdict.PLASTIC) {
         const d_eps_p = history[i].state.plasticStrain.map((p, j) => p - history[i-1].state.plasticStrain[j]);
         const dw_p = ConstitutiveUtils.dot(history[i].state.stress, d_eps_p);
         if (dw_p < -1e-9) {
           dissipationPassed = false;
           break;
         }
       }
    }
    checks.push({
      id: "THERMODYNAMIC_DISSIPATION",
      passed: dissipationPassed,
      details: "Verified positive plastic work dissipation"
    });

    const verdict = checks.every(c => c.passed) ? "PASS" : "FAIL";

    return { verdict, checks };
  }
}
