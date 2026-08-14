import { IndustrialSketchDefinition, SolverProvenanceRecord } from './IndustrialConstraintTypes';
import { IndustrialVariationalSolver, SolveResult } from './IndustrialVariationalSolver';
import { ParameterGraph } from '../parametric/ParameterGraph';
import { FeatureHistoryManager } from '../features/FeatureHistory';
import { ParametricTopologyBridge, ParametricTopologyPipelineReport } from '../topology/ParametricTopologyBridge';
import { DesignIntent } from '../intent/DesignIntentTypes';
import { ProcessType } from '../manufacturing/ManufacturingTypes';
import { GeometryKernelManager } from '../geometry/GeometryKernelManager';

export interface ParametricSketchPipelineReport {
  patch: 'SECP-053';
  timestamp: string;
  solveResult: SolveResult;
  topologyPipelineReport: ParametricTopologyPipelineReport;
  solverProvenance: SolverProvenanceRecord;
}

export class ParametricSketchBridge {

  public static async executeFullPipeline(
    sketch: IndustrialSketchDefinition,
    graph: ParameterGraph,
    historyManager: FeatureHistoryManager,
    modifiedConstraintId?: string,
    intents: DesignIntent[] = [],
    preferredProcess: ProcessType = ProcessType.MILLING_3AXIS
  ): Promise<ParametricSketchPipelineReport> {
    const timestamp = new Date().toISOString();
    const kernel = await GeometryKernelManager.getKernel();

    // 1. Solve Sketch Constraints (053-B / 053-E)
    const solver = new IndustrialVariationalSolver();
    const solveResult = solver.solve(sketch, modifiedConstraintId);

    // 2. Sync Driving Sketch Dimensions into Parameter Graph (051)
    for (const [cId, constraint] of Object.entries(sketch.constraints)) {
      if (constraint.suppressionState === 'SUPPRESSED') continue;
      if (constraint.parameterBinding && constraint.value !== undefined) {
        graph.updateParameter(constraint.parameterBinding, constraint.value);
      }
    }

    // 3. Execute Downstream Parametric & Topology Pipeline (051 -> 052 -> 048 -> 049 -> 050)
    const topologyPipelineReport = await ParametricTopologyBridge.executePipeline(
      graph,
      historyManager,
      [],
      intents,
      preferredProcess
    );

    // 4. Generate Solver Provenance Record (053-F)
    const constraintGraphHash = solveResult.dofReport.state !== 'INCONSISTENT'
      ? `sha256-cgraph-${this.hashString(JSON.stringify(sketch.constraints))}`
      : 'sha256-cgraph-inconsistent';

    const rawPayload = JSON.stringify({
      sketchRev: sketch.revision,
      cGraphHash: constraintGraphHash,
      paramRev: graph.getRevision(),
      state: solveResult.solutionState,
      dof: solveResult.dofReport.remainingDegreesOfFreedom,
      conflicts: solveResult.causalityReport.conflictSet
    });

    const resultHash = `sha256-${this.hashString(rawPayload)}`;
    const signature = `sha256-secp-053-${this.hashString(`${resultHash}-${topologyPipelineReport.topologicalProvenance.signature}`)}`;

    const solverProvenance: SolverProvenanceRecord = {
      systemVersion: 'SECP CAD CORE v1.0 (SECP-053)',
      timestamp,
      sketchRevision: sketch.revision,
      constraintGraphHash,
      parameterRevision: graph.getRevision(),
      solverVersion: 'IndustrialVariationalSolver v1.0',
      tolerance: 1e-5,
      solutionState: solveResult.solutionState,
      degreesOfFreedom: solveResult.dofReport.remainingDegreesOfFreedom,
      conflictSet: solveResult.causalityReport.conflictSet,
      resultHash,
      signature
    };

    return {
      patch: 'SECP-053',
      timestamp,
      solveResult,
      topologyPipelineReport,
      solverProvenance
    };
  }

  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}
