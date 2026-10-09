import { SparseMatrix } from '../sparse/SparseMatrix';
import { ElementRecoveryResult, EnergyMetrics } from './types';

export class EnergyEvaluator {
  static evaluateEnergy(
    K_full: SparseMatrix,
    u_global: number[],
    F_global: number[],
    elementResults: ElementRecoveryResult[],
    tolerance: number = 1e-6
  ): EnergyMetrics {
    const totalDOFs = K_full.rows;

    // Global strain energy U_global = 0.5 * u^T * K * u
    const Ku = K_full.spmv(u_global);
    let uKu = 0;
    for (let i = 0; i < totalDOFs; i++) {
      uKu += u_global[i] * Ku[i];
    }
    const globalStrainEnergy = 0.5 * uKu;

    // External work W_ext = 0.5 * F^T * u
    let Fu = 0;
    for (let i = 0; i < totalDOFs; i++) {
      Fu += F_global[i] * u_global[i];
    }
    const externalWork = 0.5 * Fu;

    // Sum of element strain energies
    let sumElementStrainEnergy = 0;
    for (const res of elementResults) {
      sumElementStrainEnergy += res.elementStrainEnergy;
    }

    const energyErrorAbsolute = Math.abs(globalStrainEnergy - sumElementStrainEnergy);
    const denom = Math.abs(globalStrainEnergy) + 1e-12;
    const energyErrorRelative = energyErrorAbsolute / denom;

    const workEnergyErrorAbs = Math.abs(globalStrainEnergy - externalWork);
    const workEnergyErrorRelative = workEnergyErrorAbs / denom;

    const passed = energyErrorRelative <= tolerance || energyErrorAbsolute <= tolerance;

    return {
      globalStrainEnergy,
      sumElementStrainEnergy,
      externalWork,
      energyErrorAbsolute,
      energyErrorRelative,
      workEnergyErrorRelative,
      passed
    };
  }
}
