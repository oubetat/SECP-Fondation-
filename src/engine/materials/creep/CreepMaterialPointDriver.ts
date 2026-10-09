import { CreepMaterialState, CreepVerdict } from "./types";
import { CreepEngine, CreepConstants } from "./CreepEngine";

export interface CreepLoadingStep {
  stress: number[];
  temperature: number;
  dt: number; // in seconds
}

export interface CreepMaterialPointReport {
  history: {
    time: number;
    state: CreepMaterialState;
    verdict: CreepVerdict;
  }[];
}

export class CreepMaterialPointDriver {
  /**
   * Drives a material point through a prescribed stress-temperature-time history.
   */
  public static runPath(
    initialState: CreepMaterialState,
    path: CreepLoadingStep[],
    constants: CreepConstants
  ): CreepMaterialPointReport {
    const history: { time: number; state: CreepMaterialState; verdict: CreepVerdict }[] = [];
    let currentState = initialState;

    path.forEach((step) => {
      const { newState, verdict } = CreepEngine.computeUpdate(
        currentState,
        step.stress,
        step.temperature,
        step.dt,
        constants
      );
      
      currentState = newState;
      history.push({ time: newState.accumulatedTime, state: newState, verdict });
    });

    return { history };
  }
}
