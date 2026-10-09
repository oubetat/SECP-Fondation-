import * as crypto from "crypto";
import { MaterialStateData, MaterialStatus } from "./types";

export class MaterialStateHasher {
  static hashState(state: MaterialStateData): string {
    const canonicalPayload = {
      version: state.version,
      stepId: state.stepId,
      incrementId: state.incrementId,
      materialStatus: state.materialStatus,
      stress: state.stress.map(v => Number(v.toFixed(12))),
      totalStrain: state.totalStrain.map(v => Number(v.toFixed(12))),
      elasticStrain: state.elasticStrain.map(v => Number(v.toFixed(12))),
      plasticStrain: state.plasticStrain.map(v => Number(v.toFixed(12))),
      equivalentPlasticStrain: Number(state.equivalentPlasticStrain.toFixed(12)),
      plasticDissipation: Number(state.plasticDissipation.toFixed(12)),
      elasticEnergy: Number(state.elasticEnergy.toFixed(12)),
      internalVariables: Object.keys(state.internalVariables || {})
        .sort()
        .reduce((acc, k) => {
          acc[k] = Number((state.internalVariables[k] || 0).toFixed(12));
          return acc;
        }, {} as Record<string, number>)
    };

    const jsonString = JSON.stringify(canonicalPayload);
    return crypto.createHash('sha256').update(jsonString).digest('hex');
  }

  static validateStateIntegrity(state: MaterialStateData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check array lengths
    if (!state.stress || state.stress.length === 0) errors.push("Stress vector is missing or empty");
    if (!state.totalStrain || state.totalStrain.length === 0) errors.push("Total strain vector is missing or empty");
    if (!state.elasticStrain || state.elasticStrain.length === 0) errors.push("Elastic strain vector is missing or empty");
    if (!state.plasticStrain || state.plasticStrain.length === 0) errors.push("Plastic strain vector is missing or empty");

    // Check NaNs and Infs
    const checkNumbers = (arr: number[], name: string) => {
      for (let i = 0; i < arr.length; i++) {
        if (Number.isNaN(arr[i]) || !Number.isFinite(arr[i])) {
          errors.push(`Non-finite or NaN value detected in ${name} at index ${i}`);
        }
      }
    };

    if (state.stress) checkNumbers(state.stress, "stress");
    if (state.totalStrain) checkNumbers(state.totalStrain, "totalStrain");
    if (state.elasticStrain) checkNumbers(state.elasticStrain, "elasticStrain");
    if (state.plasticStrain) checkNumbers(state.plasticStrain, "plasticStrain");

    // Check equivalent plastic strain
    if (state.equivalentPlasticStrain < -1e-12 || Number.isNaN(state.equivalentPlasticStrain) || !Number.isFinite(state.equivalentPlasticStrain)) {
      errors.push(`Invalid equivalent plastic strain kappa: ${state.equivalentPlasticStrain}`);
    }

    // Check plastic dissipation
    if (state.plasticDissipation < -1e-12 || Number.isNaN(state.plasticDissipation) || !Number.isFinite(state.plasticDissipation)) {
      errors.push(`Invalid plastic dissipation: ${state.plasticDissipation}`);
    }

    // Check elastic energy
    if (state.elasticEnergy < -1e-12 || Number.isNaN(state.elasticEnergy) || !Number.isFinite(state.elasticEnergy)) {
      errors.push(`Invalid elastic energy: ${state.elasticEnergy}`);
    }

    // Check strain additive split: totalStrain approx = elasticStrain + plasticStrain
    if (state.totalStrain && state.elasticStrain && state.plasticStrain &&
        state.totalStrain.length === state.elasticStrain.length &&
        state.totalStrain.length === state.plasticStrain.length) {
      for (let i = 0; i < state.totalStrain.length; i++) {
        const diff = Math.abs(state.totalStrain[i] - (state.elasticStrain[i] + state.plasticStrain[i]));
        if (diff > 1e-6) {
          errors.push(`Strain additive split violation at component ${i}: total=${state.totalStrain[i]}, e+p=${state.elasticStrain[i] + state.plasticStrain[i]}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export class MaterialStateSerializer {
  static serialize(state: MaterialStateData): string {
    const hash = MaterialStateHasher.hashState(state);
    const payload = {
      ...state,
      stateHash: hash
    };
    return JSON.stringify(payload);
  }

  static deserialize(jsonString: string): MaterialStateData {
    const state = JSON.parse(jsonString) as MaterialStateData;
    const computedHash = MaterialStateHasher.hashState(state);
    if (state.stateHash && state.stateHash !== computedHash) {
      throw new Error(`State deserialization integrity violation: expected hash ${state.stateHash}, got ${computedHash}`);
    }
    state.stateHash = computedHash;
    return state;
  }
}
