import { J2PlasticityModel } from "./J2PlasticityModel";
import { MaterialState } from "./MaterialState";
import { ConstitutiveUpdateResult } from "./types";
import { MaterialTolerancePolicy } from "./MaterialTolerancePolicy";

export interface SubstepRecord {
  substepIndex: number;
  totalSubsteps: number;
  subStrainIncrement: number[];
  result: ConstitutiveUpdateResult;
  committedState: MaterialState;
}

export interface SubsteppingResult {
  finalState: MaterialState;
  finalResult: ConstitutiveUpdateResult;
  substepsCount: number;
  substepRecords: SubstepRecord[];
  converged: boolean;
  totalPlasticDissipation: number;
  diagnostics: string;
}

export class MaterialSubstepController {
  private model: J2PlasticityModel;
  private tolerancePolicy: MaterialTolerancePolicy;

  constructor(model: J2PlasticityModel, tolerancePolicy?: MaterialTolerancePolicy) {
    this.model = model;
    this.tolerancePolicy = tolerancePolicy || MaterialTolerancePolicy.getDefault();
  }

  /**
   * Partitions a large strain increment into N substeps, executing constitutive update sequentially.
   */
  executeSubsteppedUpdate(
    largeStrainIncrement: number[],
    initialState: MaterialState,
    substepCount: number = 10
  ): SubsteppingResult {
    if (substepCount < 1) throw new Error("substepCount must be at least 1");

    const subInc = largeStrainIncrement.map(v => v / substepCount);
    let currentState = initialState.clone();
    const records: SubstepRecord[] = [];
    let lastResult: ConstitutiveUpdateResult | null = null;
    let totalDissipation = currentState.plasticDissipation;

    for (let s = 0; s < substepCount; s++) {
      const res = this.model.updateConstitutive(subInc, currentState);
      if (!res.converged || res.verdict !== 'CONVERGED') {
        return {
          finalState: currentState,
          finalResult: res,
          substepsCount: s + 1,
          substepRecords: records,
          converged: false,
          totalPlasticDissipation: totalDissipation,
          diagnostics: `Substepping failed at substep ${s + 1} of ${substepCount}: ${res.diagnostics || res.verdict}`
        };
      }

      totalDissipation += res.plasticDissipationIncrement;

      // Update state for next substep
      const nextState = new MaterialState({
        stress: res.stress,
        totalStrain: currentState.totalStrain.map((v, i) => v + subInc[i]),
        elasticStrain: res.elasticStrain,
        plasticStrain: res.plasticStrain,
        equivalentPlasticStrain: res.equivalentPlasticStrain,
        plasticDissipation: totalDissipation,
        elasticEnergy: res.elasticEnergy,
        internalVariables: { ...currentState.internalVariables },
        materialStatus: res.materialStatus,
        stepId: currentState.stepId,
        incrementId: currentState.incrementId + 1,
        version: currentState.version
      });

      records.push({
        substepIndex: s + 1,
        totalSubsteps: substepCount,
        subStrainIncrement: subInc,
        result: res,
        committedState: nextState.clone()
      });

      currentState = nextState;
      lastResult = res;
    }

    return {
      finalState: currentState,
      finalResult: lastResult!,
      substepsCount: substepCount,
      substepRecords: records,
      converged: true,
      totalPlasticDissipation: totalDissipation,
      diagnostics: `Successfully executed ${substepCount} substeps.`
    };
  }
}
