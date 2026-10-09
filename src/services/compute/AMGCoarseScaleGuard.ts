import { AMGStrategyShift, AMGStrategyProvenance } from './distributed_cfd_types';

export class AMGCoarseScaleGuard {
  public static readonly STRATEGY_VERSION = 'v3.2-Guard';

  /**
   * 187. COARSE GRID ANALYSIS & 188. COARSE GRID DEGRADATION
   * Determines if the AMG coarse grid has degraded in parallel efficiency.
   * If the number of cells on the coarse level is small relative to rank count,
   * communication cost dominates. Shift strategy accordingly.
   */
  public static analyzeCoarseGrid(
    coarseCellCount: number,
    worldSize: number,
    iteration: number,
    currentSolver: string
  ): { 
    shouldShift: boolean; 
    recommendedStrategy: 'DIRECT' | 'BLOCK' | 'REDUCED-RANK' | 'COARSE-GRID-CENTRALIZED' | 'STANDARD_AMG';
    shiftRecord?: AMGStrategyShift;
  } {
    const coarseToRankRatio = coarseCellCount / (worldSize || 1);
    
    // Communication cost model: logarithmic latency factor scaling with world size
    const communicationCost = worldSize > 1 ? Math.log2(worldSize) * 8.5 : 0;
    const computationCost = coarseToRankRatio * 1.2;

    // Degradation occurs when communication cost exceeds computational work on coarse grid
    const isDegraded = worldSize > 1 && (coarseToRankRatio < 50.0 || communicationCost > computationCost);

    if (isDegraded) {
      let recommendedStrategy: 'DIRECT' | 'BLOCK' | 'REDUCED-RANK' | 'COARSE-GRID-CENTRALIZED' = 'COARSE-GRID-CENTRALIZED';
      
      if (coarseCellCount < 10) {
        recommendedStrategy = 'DIRECT';
      } else if (worldSize > 16) {
        recommendedStrategy = 'REDUCED-RANK';
      } else if (coarseCellCount < 100) {
        recommendedStrategy = 'COARSE-GRID-CENTRALIZED';
      } else {
        recommendedStrategy = 'BLOCK';
      }

      const shiftRecord: AMGStrategyShift = {
        type: 'SOLVER_STRATEGY_SHIFT',
        previousSolver: currentSolver,
        newSolver: recommendedStrategy,
        reason: `Coarse grid degradation detected (Coarse ratio: ${coarseToRankRatio.toFixed(2)}, Comm cost: ${communicationCost.toFixed(2)})`,
        coarseGridSize: coarseCellCount,
        worldSize,
        iteration
      };

      return {
        shouldShift: true,
        recommendedStrategy,
        shiftRecord
      };
    }

    return {
      shouldShift: false,
      recommendedStrategy: 'STANDARD_AMG'
    };
  }

  /**
   * 190. AMG STRATEGY PROVENANCE
   * Generates a structural provenance record for each AMG grid hierarchy and setup.
   */
  public static generateProvenance(
    coarseGridSizes: number[],
    aggregationPolicy: string,
    solverPolicy: string
  ): AMGStrategyProvenance {
    const sizesHashString = coarseGridSizes.join('-');
    const hierarchyHash = `hash-amg-hierarchy-${sizesHashString}-${aggregationPolicy.substring(0, 3)}-${solverPolicy.substring(0, 3)}`;

    return {
      hierarchyHash,
      coarseGridSizes,
      aggregationPolicy,
      solverPolicy,
      strategyVersion: this.STRATEGY_VERSION
    };
  }
}
