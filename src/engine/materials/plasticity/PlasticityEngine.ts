import { 
  PlasticMaterialState, 
  ConstitutiveVerdict,

} from "./types";
import { VonMisesPlasticity, MaterialConstants } from "./VonMisesPlasticity";
import { ConsistentTangentOperator } from "./ConsistentTangentOperator";
import { ConstitutiveUtils } from "./ConstitutiveUtils";
import { HardeningLaws } from "./HardeningLaws";

export class PlasticityEngine {
  /**
   * Main entry point for element integration points.
   */
  public static computeUpdate(
    prevState: PlasticMaterialState,
    strainIncrement: number[],
    constants: MaterialConstants
  ): { 
    newState: PlasticMaterialState, 
    verdict: ConstitutiveVerdict, 
    tangent: number[][] 
  } {
    const { newState, verdict } = VonMisesPlasticity.updateState(prevState, strainIncrement, constants);
    
    // We need some intermediate values for tangent calculation if plastic
    const G = constants.E / (2 * (1 + constants.nu));
    const trialStress = prevState.stress.map((s, i) => {
       // Re-calculate trial stress locally or pass from updateState
       // To keep it clean and deterministic, let's just do the check
       return s; // Placeholder, real updateState should return trial state details
    });

    // Optimization: updateState should return q_trial and d_lambda for tangent
    // Let's refine the integration to be more robust
    const { q_trial, d_lambda, S_trial } = this.getInternalUpdateData(prevState, strainIncrement, constants);

    const tangent = ConsistentTangentOperator.calculate(
      constants.E,
      constants.nu,
      constants.H,
      q_trial,
      d_lambda,
      S_trial,
      verdict === ConstitutiveVerdict.PLASTIC
    );

    return { newState, verdict, tangent };
  }

  private static getInternalUpdateData(
    prevState: PlasticMaterialState,
    strainIncrement: number[],
    constants: MaterialConstants
  ) {
    const { E, nu, yieldStress0, H } = constants;
    const G = E / (2 * (1 + nu));
    const lambda = (E * nu) / ((1 + nu) * (1 - 2 * nu));
    
    const tr_deps = strainIncrement[0] + strainIncrement[1] + strainIncrement[2];
    const d_stress_elastic = [
      lambda * tr_deps + 2 * G * strainIncrement[0],
      lambda * tr_deps + 2 * G * strainIncrement[1],
      lambda * tr_deps + 2 * G * strainIncrement[2],
      G * strainIncrement[3],
      G * strainIncrement[4],
      G * strainIncrement[5]
    ];

    const trialStress = prevState.stress.map((s, i) => s + d_stress_elastic[i]);
    const { deviatoric: S_trial } = ConstitutiveUtils.getDeviatoric(trialStress);
    const q_trial = ConstitutiveUtils.calculateVonMises(trialStress);
    
    const hardening = HardeningLaws.linearIsotropic(yieldStress0, H, prevState.equivalentPlasticStrain);
    const f_trial = q_trial - hardening.yieldStress;
    const d_lambda = f_trial > 0 ? f_trial / (3 * G + H) : 0;

    return { q_trial, d_lambda, S_trial };
  }

  public static createInitialState(): PlasticMaterialState {
    return {
      stress: [0, 0, 0, 0, 0, 0],
      plasticStrain: [0, 0, 0, 0, 0, 0],
      elasticStrain: [0, 0, 0, 0, 0, 0],
      equivalentPlasticStrain: 0,
      backStress: [0, 0, 0, 0, 0, 0],
      hardeningVariables: {},
      temperature: 293.15,
      revision: 0,
      converged: true,
      timestamp: new Date().toISOString()
    };
  }
}
