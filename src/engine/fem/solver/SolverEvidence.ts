import { DOFManager } from './DOFManager';
import { StructuralModel } from './StructuralModel';
import { ElementRecoveryResult, EnergyMetrics, EquilibriumMetrics, PerformanceStats, ReactionResult, ResidualMetrics, SolverVerdictResult } from './types';

export interface ForensicTraceRecord {
  nodeId: string;
  globalIndex: number;
  dof: string;
  displacement: number;
  reaction: number;
  associatedElements: { elementId: string; stress: number[]; strain: number[]; vonMises: number }[];
}

export interface SolverEvidencePacket {
  modelId: string;
  verdictResult: SolverVerdictResult;
  residualMetrics: ResidualMetrics;
  equilibriumMetrics: EquilibriumMetrics;
  energyMetrics: EnergyMetrics;
  performanceStats: PerformanceStats;
  forensicTraces: ForensicTraceRecord[];
  timestamp: string;
}

export class SolverEvidence {
  static createPacket(
    model: StructuralModel,
    dofManager: DOFManager,
    u_global: number[],
    R_global: number[],
    elementResults: ElementRecoveryResult[],
    residualMetrics: ResidualMetrics,
    equilibriumMetrics: EquilibriumMetrics,
    energyMetrics: EnergyMetrics,
    performanceStats: PerformanceStats,
    verdictResult: SolverVerdictResult
  ): SolverEvidencePacket {
    const traces: ForensicTraceRecord[] = [];

    // Map element results for quick node lookup
    const elementMap = new Map<string, ElementRecoveryResult>();
    elementResults.forEach((r) => elementMap.set(r.elementId, r));

    for (let i = 0; i < dofManager.totalDOFs; i++) {
      const dof = dofManager.globalDOFs[i];

      // Find associated elements for this node
      const assocElems: { elementId: string; stress: number[]; strain: number[]; vonMises: number }[] = [];
      for (const elem of model.elements) {
        if (elem.nodeIds.includes(dof.nodeId)) {
          const res = elementMap.get(elem.id);
          if (res) {
            assocElems.push({
              elementId: elem.id,
              stress: res.elementCenterStress,
              strain: res.elementCenterStrain,
              vonMises: res.elementCenterVonMises
            });
          }
        }
      }

      traces.push({
        nodeId: dof.nodeId,
        globalIndex: i,
        dof: dof.dof,
        displacement: u_global[i],
        reaction: R_global[i],
        associatedElements: assocElems
      });
    }

    return {
      modelId: model.id,
      verdictResult,
      residualMetrics,
      equilibriumMetrics,
      energyMetrics,
      performanceStats,
      forensicTraces: traces,
      timestamp: new Date().toISOString()
    };
  }
}
