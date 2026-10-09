import { 
  PlasticMaterialState, 
  PlasticTrialState, 
  ConstitutiveVerdict,
  HardeningType
} from "./types";
import { ConstitutiveUtils } from "./ConstitutiveUtils";
import { HardeningLaws } from "./HardeningLaws";

export interface MaterialConstants {
  E: number;  // Young's modulus
  nu: number; // Poisson's ratio
  yieldStress0: number;
  H: number;  // Hardening modulus
}

export class VonMisesPlasticity {
  /**
   * Updates the material state using an incremental strain.
   * Implementation of Radial Return mapping for J2 plasticity with isotropic hardening.
   */
  public static updateState(
    prevState: PlasticMaterialState,
    strainIncrement: number[], // d_epsilon (Voigt)
    constants: MaterialConstants
  ): { newState: PlasticMaterialState, verdict: ConstitutiveVerdict } {
    const { E, nu, yieldStress0, H } = constants;
    const G = E / (2 * (1 + nu));
    const K = E / (3 * (1 - 2 * nu));

    // 1. Elastic Predictor
    // Hooke's Law for 3D
    const lambda = (E * nu) / ((1 + nu) * (1 - 2 * nu));
    const tr_deps = strainIncrement[0] + strainIncrement[1] + strainIncrement[2];
    
    const d_stress_elastic = [
      lambda * tr_deps + 2 * G * strainIncrement[0],
      lambda * tr_deps + 2 * G * strainIncrement[1],
      lambda * tr_deps + 2 * G * strainIncrement[2],
      2 * G * strainIncrement[3] / 2, // Voigt shear strain check: epsilon_ij = 0.5 * gamma_ij
      2 * G * strainIncrement[4] / 2,
      2 * G * strainIncrement[5] / 2
    ];
    // Correction for Voigt: strainIncrement[3,4,5] are usually engineering shear strains (gamma)
    // d_tau = G * d_gamma
    d_stress_elastic[3] = G * strainIncrement[3];
    d_stress_elastic[4] = G * strainIncrement[4];
    d_stress_elastic[5] = G * strainIncrement[5];

    const trialStress = prevState.stress.map((s, i) => s + d_stress_elastic[i]);
    const { deviatoric: S_trial, hydrostatic: P_trial } = ConstitutiveUtils.getDeviatoric(trialStress);
    const q_trial = ConstitutiveUtils.calculateVonMises(trialStress);

    // Hardening update
    const hardening = HardeningLaws.linearIsotropic(yieldStress0, H, prevState.equivalentPlasticStrain);
    const f_trial = q_trial - hardening.yieldStress;

    if (f_trial <= 0) {
      // 2. Elastic Step
      return {
        newState: {
          ...prevState,
          stress: trialStress,
          elasticStrain: prevState.elasticStrain.map((e, i) => e + strainIncrement[i]),
          revision: prevState.revision + 1,
          timestamp: new Date().toISOString()
        },
        verdict: ConstitutiveVerdict.ELASTIC
      };
    }

    // 3. Plastic Step (Radial Return)
    // Plastic multiplier: d_lambda = f_trial / (3G + H)
    const d_lambda = f_trial / (3 * G + H);
    
    // Direction: n = S_trial / ||S_trial|| (but q_trial = sqrt(3/2 S:S) in J2)
    // Correction for scaling
    const factor = 1 - (3 * G * d_lambda) / q_trial;
    
    const newDevStress = S_trial.map(s => s * factor);
    const newStress = newDevStress.map((s, i) => i < 3 ? s + P_trial : s);

    // Update plastic strain: d_eps_p = d_lambda * (3/2 * S_trial / q_trial)
    const d_eps_p_scalar = d_lambda;
    const direction = S_trial.map(s => (1.5 * s) / q_trial);
    const d_eps_p = direction.map(d => d * d_eps_p_scalar);

    const newPlasticStrain = prevState.plasticStrain.map((p, i) => p + d_eps_p[i]);
    const newEqPlasticStrain = prevState.equivalentPlasticStrain + d_lambda;

    return {
      newState: {
        ...prevState,
        stress: newStress,
        plasticStrain: newPlasticStrain,
        equivalentPlasticStrain: newEqPlasticStrain,
        revision: prevState.revision + 1,
        timestamp: new Date().toISOString()
      },
      verdict: ConstitutiveVerdict.PLASTIC
    };
  }
}
