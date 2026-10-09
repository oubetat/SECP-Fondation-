import { ElementRecoveryResult, StrainStressPointResult } from './types';

export class GaussPointResults {
  static createPointResult(
    location: { x: number; y: number; z?: number },
    strain: number[],
    stress: number[],
    vonMises: number,
    gaussPoint?: { xi: number; eta?: number; zeta?: number; weight: number }
  ): StrainStressPointResult {
    return {
      location,
      gaussPoint,
      strain: [...strain],
      stress: [...stress],
      vonMisesStress: vonMises
    };
  }
}
