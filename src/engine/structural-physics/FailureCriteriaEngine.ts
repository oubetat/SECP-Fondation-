/**
 * PATCH-SECP-073: Failure Criteria Engine
 * Determines yield stress boundaries and computes the factor of safety margin.
 */

import { MaterialModelEngine } from './MaterialModelEngine';

export class FailureCriteriaEngine {
  public static calculateSafetyFactor(
    vonMisesStress: number,
    materialId: string
  ): number {
    const material = MaterialModelEngine.getMaterial(materialId);
    if (vonMisesStress <= 0) return 15.0; // Infinite safety ceiling

    const safety = material.yieldStrength / vonMisesStress;
    return Math.min(15.0, safety); // Caps at 15
  }

  public static isYieldExceeded(maxStress: number, materialId: string): boolean {
    const material = MaterialModelEngine.getMaterial(materialId);
    return maxStress > material.yieldStrength;
  }
}
