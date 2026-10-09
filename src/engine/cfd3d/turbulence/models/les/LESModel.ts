/**
 * SECP Industrial OS v2 — Large Eddy Simulation (LES) Model Base Contract
 * Phase 16 (PATCH-176: Turbulence Benchmark → Advanced Turbulence Framework)
 */

import { TurbulenceModel } from '../../contract/TurbulenceModel';
import { TurbulenceState, Matrix3x3 } from '../../types/TurbulenceTypes';
import { Fvm3DMesh } from '../../../Fvm3DTypes';

export interface LESModel extends TurbulenceModel {
  computeFilterScale(mesh: Fvm3DMesh): number[];
  computeSubgridViscosity(states: TurbulenceState[], strainRates: Matrix3x3[], mesh: Fvm3DMesh): number[];
  computeSubgridStress(states: TurbulenceState[], strainRates: Matrix3x3[], density: number, mesh: Fvm3DMesh): Matrix3x3[];
}
