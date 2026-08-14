/**
 * PATCH-SECP-073: Convergence Analysis Engine
 * Calculates L2 residual norm trends under sequential mesh refinements.
 */

import { FEAMesh, BoundaryCondition, LoadDefinition } from './StructuralPhysicsTypes';
import { StructuralAnalysisEngine } from './StructuralAnalysisEngine';

export interface ConvergenceReport {
  isConverged: boolean;
  refinementSteps: number;
  residualTrend: number[];
  finalDisplacement: number;
}

export class ConvergenceAnalysisEngine {
  /**
   * Refines a mesh and verifies displacement solution convergence.
   */
  public static verifyConvergence(
    partId: string,
    initialLength: number,
    materialId: string,
    area: number,
    bcs: BoundaryCondition[],
    loads: LoadDefinition[]
  ): ConvergenceReport {
    const residualTrend: number[] = [];
    let prevDisp = 0.0;
    let finalDisplacement = 0.0;

    // Run FEA at successive mesh density steps (e.g. 2, 4, 8 elements)
    const steps = [2, 4, 8];
    const MeshTopologyEngine = require('./MeshTopologyEngine').MeshTopologyEngine;

    for (const numElems of steps) {
      const mesh = MeshTopologyEngine.generate1DBeamMesh({ id: partId } as any, initialLength, numElems, materialId, area);
      
      // Map boundary conditions to corresponding node IDs (fixed node is 1, load node is final index)
      const mappedBCs = bcs.map(bc => ({ ...bc, nodeId: bc.nodeId === 1 ? 1 : numElems + 1 }));
      const mappedLoads = loads.map(l => ({ ...l, nodeId: l.nodeId === 1 ? 1 : numElems + 1 }));

      const res = StructuralAnalysisEngine.runFEA(partId, mesh, mappedBCs, mappedLoads);
      finalDisplacement = res.maxDisplacement;

      if (prevDisp > 0) {
        const residual = Math.abs(finalDisplacement - prevDisp) / prevDisp;
        residualTrend.push(residual);
      } else {
        residualTrend.push(1.0);
      }
      prevDisp = finalDisplacement;
    }

    const finalResidual = residualTrend[residualTrend.length - 1] || 1.0;
    const isConverged = finalResidual < 1e-3;

    return {
      isConverged,
      refinementSteps: steps.length,
      residualTrend,
      finalDisplacement
    };
  }
}
