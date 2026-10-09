import { PredictionModel, PredictionInputSnapshot, PredictiveEngineeringRecord, UncertaintyEstimation } from './types';

export class PredictionIdentityService {
  public static verifyUnitSafety(model: PredictionModel, snapshot: PredictionInputSnapshot): { valid: boolean; error?: string } {
    for (const key of Object.keys(model.canonicalUnits)) {
      if (snapshot.features[key] && snapshot.features[key].unit !== model.canonicalUnits[key]) {
        return { valid: false, error: `UNIT_MISMATCH: Feature ${key} expected ${model.canonicalUnits[key]}, got ${snapshot.features[key].unit}` };
      }
    }
    return { valid: true };
  }

  public static detectOOD(model: PredictionModel, snapshot: PredictionInputSnapshot): { status: 'IN_DOMAIN' | 'NEAR_BOUNDARY' | 'OUT_OF_DISTRIBUTION', error?: string } {
    for (const key of Object.keys(model.inputBounds)) {
      const val = snapshot.features[key]?.value;
      if (val === undefined) continue;
      const bounds = model.inputBounds[key];
      if (val < bounds.min || val > bounds.max) {
        return { status: 'OUT_OF_DISTRIBUTION', error: `OUT_OF_DISTRIBUTION: Feature ${key} value ${val} outside bounds [${bounds.min}, ${bounds.max}]` };
      }
      // Simple near boundary logic: within 5% of bounds
      const range = bounds.max - bounds.min;
      if (val < bounds.min + 0.05 * range || val > bounds.max - 0.05 * range) {
        return { status: 'NEAR_BOUNDARY' };
      }
    }
    return { status: 'IN_DOMAIN' };
  }

  public static verifyPhysicalPlausibility(target: string, value: number, unit: string): { valid: boolean; error?: string } {
    if (target === 'temperature' && unit === 'K' && value < 0) {
      return { valid: false, error: 'PHYSICS_VIOLATION: Temperature below absolute zero' };
    }
    if (target === 'mass' && value <= 0) {
      return { valid: false, error: 'PHYSICS_VIOLATION: Mass must be positive' };
    }
    if (target === 'probability' && (value < 0 || value > 1)) {
      return { valid: false, error: 'PHYSICS_VIOLATION: Probability must be between 0 and 1' };
    }
    return { valid: true };
  }
}
