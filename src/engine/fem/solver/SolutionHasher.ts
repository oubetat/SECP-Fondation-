import { DOFManager } from './DOFManager';
import { StructuralModel } from './StructuralModel';
import { ElementRecoveryResult, EnergyMetrics, EquilibriumMetrics, PerformanceStats, ReactionResult, ResidualMetrics } from './types';

export class SolutionHasher {
  static computeHash(
    model: StructuralModel,
    u_global: number[],
    R_global: number[],
    energyMetrics: EnergyMetrics
  ): string {
    let str = `${model.id}_N${model.nodes.length}_E${model.elements.length}`;

    // Sample displacement vector
    const sampleU = u_global.slice(0, Math.min(10, u_global.length)).map((v) => v.toFixed(6)).join(',');
    const sampleR = R_global.slice(0, Math.min(10, R_global.length)).map((v) => v.toFixed(6)).join(',');

    str += `_u:[${sampleU}]_r:[${sampleR}]_U:${energyMetrics.globalStrainEnergy.toFixed(6)}`;

    // Simple deterministic hash calculation
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }

    return `SOLVER_HASH_079_${Math.abs(hash).toString(16)}`;
  }
}
