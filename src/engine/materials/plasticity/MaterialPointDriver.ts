import { PlasticMaterialState, ConstitutiveVerdict } from "./types";
import { PlasticityEngine } from "./PlasticityEngine";
import { MaterialConstants } from "./VonMisesPlasticity";

export interface LoadingStep {
  strainIncrement: number[];
  temperature?: number;
}

export interface MaterialPointReport {
  history: {
    step: number;
    state: PlasticMaterialState;
    verdict: ConstitutiveVerdict;
  }[];
}

export class MaterialPointDriver {
  /**
   * Drives a material point through a prescribed strain path.
   */
  public static runPath(
    initialState: PlasticMaterialState,
    path: LoadingStep[],
    constants: MaterialConstants
  ): MaterialPointReport {
    const history: { step: number; state: PlasticMaterialState; verdict: ConstitutiveVerdict }[] = [];
    let currentState = initialState;

    path.forEach((step, index) => {
      const { newState, verdict } = PlasticityEngine.computeUpdate(
        currentState,
        step.strainIncrement,
        constants
      );
      
      currentState = newState;
      history.push({ step: index + 1, state: newState, verdict });
    });

    return { history };
  }
}
