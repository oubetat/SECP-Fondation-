/**
 * SECP-056 Digital Thread Parametric Assembly ↔ Manufacturing Intelligence Bridge Engine
 */

import { ParameterGraph } from '../parametric/ParameterGraph';
import { FeatureHistoryManager } from '../features/FeatureHistory';
import { IndustrialSketchDefinition } from '../sketch/IndustrialConstraintTypes';
import { SurfaceOperationParams } from '../surface/IndustrialSurfaceTypes';
import { DesignIntent } from '../intent/DesignIntentTypes';
import { ProcessType } from './ManufacturingTypes';
import { ParametricAssemblyBridge, ParametricAssemblyPipelineReport } from '../assembly/ParametricAssemblyBridge';
import { ProductionFeatureRecognitionEngine } from './ProductionFeatureRecognitionEngine';
import { ProductionDFMDecisionEngine } from './ProductionDFMDecisionEngine';
import {
  ProductionManufacturingFeature,
  ManufacturingFeatureGraph,
  ManufacturingAssessment,
  ManufacturingProvenanceRecord
} from './ProductionManufacturingTypes';

export interface ParametricManufacturingPipelineReport {
  patch: 'SECP-056';
  timestamp: string;
  assemblyPipelineReport: ParametricAssemblyPipelineReport;
  manufacturingFeatures: ProductionManufacturingFeature[];
  featureGraph: ManufacturingFeatureGraph;
  manufacturingAssessment: ManufacturingAssessment;
  manufacturingProvenance: ManufacturingProvenanceRecord;
}

export class ParametricManufacturingBridge {

  public static async executeFullManufacturingPipeline(
    sketch: IndustrialSketchDefinition,
    graph: ParameterGraph,
    historyManager: FeatureHistoryManager,
    surfaceParams: SurfaceOperationParams,
    modifiedConstraintId?: string,
    intents: DesignIntent[] = [],
    preferredProcess: ProcessType = ProcessType.MILLING_3AXIS
  ): Promise<ParametricManufacturingPipelineReport> {
    const timestamp = new Date().toISOString();

    // 1. Execute Downstream Assembly Pipeline (SECP-055 -> SECP-054 -> 053 -> 051 -> 052 -> 048 -> 049 -> 050)
    const assemblyPipelineReport = await ParametricAssemblyBridge.executeFullAssemblyPipeline(
      sketch,
      graph,
      historyManager,
      surfaceParams,
      modifiedConstraintId,
      intents,
      preferredProcess
    );

    const history = historyManager.getHistory();
    const topologyIdentities = assemblyPipelineReport.surfacePipelineReport.sketchPipelineReport.topologyPipelineReport.topologyIdentities || [];

    // 2. Extract Manufacturing Features (056-A Topology-Aware Recognition)
    const features = ProductionFeatureRecognitionEngine.extractManufacturingFeatures(history, topologyIdentities);

    // 3. Build Feature Graph (056-B)
    const featureGraph = ProductionFeatureRecognitionEngine.buildManufacturingFeatureGraph(features, sketch.revision);

    // 4. Evaluate DFM Assessment & Decision Spectrum (056-C, 056-D, 056-E)
    const isGeometricallyValid = assemblyPipelineReport.surfacePipelineReport.sketchPipelineReport.topologyPipelineReport.featureRegenerationSuccess;
    const isEngineeringValid = assemblyPipelineReport.assemblyGraphValidation.isValid;

    const manufacturingAssessment = ProductionDFMDecisionEngine.evaluateManufacturingAssessment(
      features,
      isGeometricallyValid,
      isEngineeringValid,
      preferredProcess
    );

    // 5. Build Digital Thread Manufacturing Provenance Record
    const rawPayload = JSON.stringify({
      sketchRev: sketch.revision,
      featCount: features.length,
      status: manufacturingAssessment.status,
      asmSig: assemblyPipelineReport.assemblyProvenance.signature
    });

    const resultHash = `sha256-${this.hashString(rawPayload)}`;
    const signature = `sha256-secp-056-${this.hashString(`${resultHash}-${assemblyPipelineReport.assemblyProvenance.signature}`)}`;

    const manufacturingProvenance: ManufacturingProvenanceRecord = {
      systemVersion: 'SECP CAD CORE v1.0 (SECP-056)',
      timestamp,
      featureGraphHash: `sha256-fgraph-${this.hashString(features.map(f => f.featureId).join(','))}`,
      processPlanHash: `sha256-proc-${this.hashString(manufacturingAssessment.process)}`,
      dfmHash: `sha256-dfm-${this.hashString(manufacturingAssessment.status)}`,
      resultHash,
      signature
    };

    return {
      patch: 'SECP-056',
      timestamp,
      assemblyPipelineReport,
      manufacturingFeatures: features,
      featureGraph,
      manufacturingAssessment,
      manufacturingProvenance
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
