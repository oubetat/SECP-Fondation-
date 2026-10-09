import { Matrix } from "../core/MathUtils";
import { DeformationGradient } from "./DeformationGradient";
import { StrainMeasures, StressMeasures } from "./StrainMeasures";
import { StressMeasure, FiniteStrainMeasure } from "./types";

export interface KinematicFormulation {
  name: string;
  update(
    referenceCoords: number[][],
    currentCoords: number[][],
    dNdX: number[][]
  ): {
    F: number[][];
    J: number;
    strain: Matrix;
    stressMeasure: StressMeasure;
  };
}

/**
 * Total Lagrangian Formulation:
 * Measures everything relative to the initial reference configuration.
 * Uses PK2 stress and Green-Lagrange strain.
 */
export class TotalLagrangianFormulation implements KinematicFormulation {
  name = "Total Lagrangian";

  update(
    referenceCoords: number[][],
    currentCoords: number[][],
    dNdX: number[][]
  ) {
    const res = DeformationGradient.compute(referenceCoords, currentCoords, dNdX);
    const C = StrainMeasures.computeRightCauchyGreen(res.F);
    const E = StrainMeasures.computeGreenLagrange(C);

    return {
      F: res.F,
      J: res.J,
      strain: E,
      stressMeasure: StressMeasure.PK2
    };
  }
}

/**
 * Updated Lagrangian Formulation:
 * Measures everything relative to the current configuration (or previous step).
 * Typically uses Cauchy stress and spatial strain measures.
 */
export class UpdatedLagrangianFormulation implements KinematicFormulation {
  name = "Updated Lagrangian";

  update(
    referenceCoords: number[][],
    currentCoords: number[][],
    dNdX: number[][]
  ) {
    const res = DeformationGradient.compute(referenceCoords, currentCoords, dNdX);
    const B = StrainMeasures.computeLeftCauchyGreen(res.F);
    const e = StrainMeasures.computeAlmansi(B);

    return {
      F: res.F,
      J: res.J,
      strain: e,
      stressMeasure: StressMeasure.CAUCHY
    };
  }
}
