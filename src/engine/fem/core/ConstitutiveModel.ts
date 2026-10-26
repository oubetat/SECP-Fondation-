import { Matrix } from "../MathUtils";
import { IntegrationPointState } from "../FEMTypes";

export interface ConstitutiveResult {
  stress: number[]; // Voigt
  tangent: Matrix;
  state: IntegrationPointState;
}

export interface ConstitutiveModel {
  update(
    strainIncrement: number[],
    previousState: IntegrationPointState
  ): ConstitutiveResult;

  getInitialState(): IntegrationPointState;
}
