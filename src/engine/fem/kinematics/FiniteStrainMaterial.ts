import { Matrix } from "../core/MathUtils";
import { StressMeasure, FiniteStrainMeasure } from "./types";

export interface FiniteStrainMaterialState {
  stress: number[]; // Vectorized or tensor form depending on model
  stressMeasure: StressMeasure;
  strain: number[];
  strainMeasure: FiniteStrainMeasure;
  F: number[][];
  J: number;
  R: number[][];
  internalVariables: Record<string, any>;
  energy: number;
  isStepConverged: boolean;
}

export interface FiniteStrainMaterialModel {
  stressMeasure: StressMeasure;
  strainMeasure: FiniteStrainMeasure;

  /**
   * Initializes material state for a given integration point
   */
  initializeState(): FiniteStrainMaterialState;

  /**
   * Updates stress and tangent based on the deformation gradient F.
   */
  update(F: number[][], J: number, prevState: FiniteStrainMaterialState): {
    state: FiniteStrainMaterialState;
    tangent: Matrix; // Material tangent (C_mat) in appropriate measure
  };
}

/**
 * Interface for Hyperelastic models specifically
 */
export interface HyperelasticModel extends FiniteStrainMaterialModel {
  computeEnergy(F: number[][]): number;
}
