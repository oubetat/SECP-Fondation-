/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-062: RANS Turbulence State
 */

import { 
  RansTurbulenceVariables, 
  ReynoldsStressField, 
  TurbulenceStateVerdict 
} from './RansSolverTypes';

export class RansTurbulenceState {
  public readonly variables: RansTurbulenceVariables;
  public readonly turbulentViscosity: readonly number[];
  public readonly reynoldsStress?: ReynoldsStressField;
  public readonly verdict: TurbulenceStateVerdict;

  constructor(
    variables: RansTurbulenceVariables,
    turbulentViscosity: readonly number[],
    reynoldsStress?: ReynoldsStressField,
    verdict: TurbulenceStateVerdict = TurbulenceStateVerdict.UNPROVEN
  ) {
    this.variables = variables;
    this.turbulentViscosity = turbulentViscosity;
    this.reynoldsStress = reynoldsStress;
    this.verdict = verdict;
  }

  public validateBounds(): { valid: boolean; message?: string } {
    if (this.variables.k) {
      for (const val of this.variables.k) {
        if (val < 0) return { valid: false, message: 'Negative k detected' };
      }
    }
    if (this.variables.omega) {
      for (const val of this.variables.omega) {
        if (val <= 0) return { valid: false, message: 'Zero or negative omega detected' };
      }
    }
    return { valid: true };
  }
}
