import { 
  CreepMaterialState, 
  CreepVerdict, 
  TimeUnit 
} from "./types";
import { NortonCreepLaw } from "./NortonCreepLaw";
import { ConstitutiveUtils } from "../plasticity/ConstitutiveUtils";
import { TimeConverter } from "./TimeConverter";

export interface CreepConstants {
  A0: number;
  n: number;
  Q: number;
  R: number;
  E: number;
  nu: number;
}

export class CreepEngine {
  /**
   * Updates the material state for a given time increment and stress.
   * Currently implements an implicit-style update (radial return mapping for creep).
   */
  public static computeUpdate(
    prevState: CreepMaterialState,
    currentStress: number[],
    temperature: number,
    timeIncrement: number, // in seconds
    constants: CreepConstants
  ): { newState: CreepMaterialState; verdict: CreepVerdict } {
    if (timeIncrement <= 0) {
      return { newState: prevState, verdict: CreepVerdict.CONVERGED };
    }

    const sigmaEq = ConstitutiveUtils.calculateVonMises(currentStress);
    if (sigmaEq === 0) {
      return { 
        newState: { 
          ...prevState, 
          accumulatedTime: prevState.accumulatedTime + timeIncrement,
          timestamp: new Date().toISOString() 
        }, 
        verdict: CreepVerdict.CONVERGED 
      };
    }

    // 1. Calculate creep rate at current stress and temperature
    const rate = NortonCreepLaw.calculateRate(sigmaEq, temperature, constants);

    // 2. Incremental creep strain magnitude
    const deltaEpsCrScalar = rate * timeIncrement;

    // 3. Creep flow direction (n = 3/2 * S / sigmaEq)
    const { deviatoric: S } = ConstitutiveUtils.getDeviatoric(currentStress);
    const direction = S.map(s => (1.5 * s) / sigmaEq);

    // 4. Tensorial increment
    const deltaEpsCr = direction.map(d => d * deltaEpsCrScalar);

    // 5. Update state
    const newCreepStrainTensor = prevState.creepStrainTensor.map((eps, i) => eps + deltaEpsCr[i]);
    const newEqCreepStrain = prevState.equivalentCreepStrain + deltaEpsCrScalar;

    const newState: CreepMaterialState = {
      ...prevState,
      creepStrainTensor: newCreepStrainTensor,
      equivalentCreepStrain: newEqCreepStrain,
      creepStrainRate: rate,
      accumulatedTime: prevState.accumulatedTime + timeIncrement,
      temperature,
      stressState: currentStress,
      revision: prevState.revision + 1,
      converged: true,
      timestamp: new Date().toISOString()
    };

    return { newState, verdict: CreepVerdict.CONVERGED };
  }

  public static createInitialState(temperature: number = 293.15): CreepMaterialState {
    return {
      creepStrainTensor: [0, 0, 0, 0, 0, 0],
      equivalentCreepStrain: 0,
      creepStrainRate: 0,
      internalVariables: {},
      accumulatedTime: 0,
      temperature,
      stressState: [0, 0, 0, 0, 0, 0],
      revision: 0,
      converged: true,
      timestamp: new Date().toISOString()
    };
  }
}
