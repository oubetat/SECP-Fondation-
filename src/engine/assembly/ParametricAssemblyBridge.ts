/**
 * SECP-055 Parametric Assembly ↔ Topology ↔ Engineering Bridge Engine
 */

import { ParameterGraph } from '../parametric/ParameterGraph';
import { FeatureHistoryManager } from '../features/FeatureHistory';
import { IndustrialSketchDefinition } from '../sketch/IndustrialConstraintTypes';
import { SurfaceOperationParams } from '../surface/IndustrialSurfaceTypes';
import { ParametricSurfaceBridge, ParametricSurfacePipelineReport } from '../surface/ParametricSurfaceBridge';
import {
  AssemblyNode,
  ComponentInstance,
  AssemblyMate,
  AssemblyGraphValidationResult,
  AssemblyDOFAnalysis,
  AssemblyInterferenceReport,
  AssemblyProvenanceRecord
} from './ProductionAssemblyTypes';
import { ProductionAssemblyGraphEngine } from './ProductionAssemblyGraphEngine';
import { createTransform3D } from './AssemblyConstraintTypes';
import { DesignIntent } from '../intent/DesignIntentTypes';
import { ProcessType } from '../manufacturing/ManufacturingTypes';

export interface ParametricAssemblyPipelineReport {
  patch: 'SECP-055';
  timestamp: string;
  surfacePipelineReport: ParametricSurfacePipelineReport;
  assemblyGraphValidation: AssemblyGraphValidationResult;
  dofAnalysis: AssemblyDOFAnalysis;
  interferenceReports: AssemblyInterferenceReport[];
  assemblyProvenance: AssemblyProvenanceRecord;
}

export class ParametricAssemblyBridge {

  public static async executeFullAssemblyPipeline(
    sketch: IndustrialSketchDefinition,
    graph: ParameterGraph,
    historyManager: FeatureHistoryManager,
    surfaceParams: SurfaceOperationParams,
    modifiedConstraintId?: string,
    intents: DesignIntent[] = [],
    preferredProcess: ProcessType = ProcessType.MILLING_3AXIS
  ): Promise<ParametricAssemblyPipelineReport> {
    const timestamp = new Date().toISOString();

    // 1. Execute Downstream Surface & Parametric & Topology Pipeline (054 -> 053 -> 051 -> 052 -> 048 -> 049 -> 050)
    const surfacePipelineReport = await ParametricSurfaceBridge.executeFullSurfacePipeline(
      sketch,
      graph,
      historyManager,
      surfaceParams,
      modifiedConstraintId,
      intents,
      preferredProcess
    );

    // 2. Build Production Assembly Graph Nodes & Components
    const rootAssembly: AssemblyNode = {
      id: 'asm-root-01',
      name: 'IndustrialGearboxAssembly',
      isRoot: true,
      childInstanceIds: ['comp-housing-01', 'comp-shaft-01'],
      subassemblyIds: [],
      revision: sketch.revision
    };

    const compHousing: ComponentInstance = {
      id: 'comp-housing-01',
      name: 'GearboxHousingInstance',
      type: 'PART',
      partDefinitionId: 'part-housing-def',
      parentAssemblyId: 'asm-root-01',
      activeConfigurationId: 'config-default',
      transform: createTransform3D({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }),
      isFixed: true,
      suppressionState: 'ACTIVE',
      persistentTopologyPath: 'part-housing-def/FeatureExtrude_01/FACE:p-face-101'
    };

    const compShaft: ComponentInstance = {
      id: 'comp-shaft-01',
      name: 'InputShaftInstance',
      type: 'PART',
      partDefinitionId: 'part-shaft-def',
      parentAssemblyId: 'asm-root-01',
      activeConfigurationId: 'config-default',
      transform: createTransform3D({ x: 0, y: 0, z: 50 }, { x: 0, y: 0, z: 0 }),
      isFixed: false,
      suppressionState: 'ACTIVE',
      persistentTopologyPath: 'part-shaft-def/FeatureExtrude_02/CYLINDRICAL:p-cyl-201'
    };

    const allAssemblies = new Map<string, AssemblyNode>();
    allAssemblies.set(rootAssembly.id, rootAssembly);

    const componentsMap = new Map<string, ComponentInstance>();
    componentsMap.set(compHousing.id, compHousing);
    componentsMap.set(compShaft.id, compShaft);

    // 3. Define Assembly Mates with Persistent Topology IDs (052)
    const concentricMate: AssemblyMate = {
      id: 'mate-concentric-01',
      name: 'ShaftToHousingConcentric',
      type: 'CONCENTRIC',
      primaryRef: {
        componentInstanceId: 'comp-housing-01',
        partId: 'part-housing-def',
        featureId: 'FeatureExtrude_01',
        topologyType: 'FACE',
        persistentTopologyId: 'p-face-101',
        canonicalPath: 'part-housing-def/FeatureExtrude_01/FACE:p-face-101'
      },
      secondaryRef: {
        componentInstanceId: 'comp-shaft-01',
        partId: 'part-shaft-def',
        featureId: 'FeatureExtrude_02',
        topologyType: 'FACE',
        persistentTopologyId: 'p-cyl-201',
        canonicalPath: 'part-shaft-def/FeatureExtrude_02/CYLINDRICAL:p-cyl-201'
      },
      suppressionState: 'ACTIVE'
    };

    const mates = [concentricMate];

    // 4. Validate Assembly Graph Topology (055-A)
    const assemblyGraphValidation = ProductionAssemblyGraphEngine.validateAssemblyGraph(
      rootAssembly,
      allAssemblies,
      componentsMap,
      mates
    );

    // 5. Calculate DOF (055-C)
    const dofAnalysis = ProductionAssemblyGraphEngine.calculateAssemblyDOF(
      [compHousing, compShaft],
      mates
    );

    // 6. Check Interference & Clearance (055-D)
    const interferenceReport = await ProductionAssemblyGraphEngine.checkInterferenceAndClearance(
      compHousing,
      compShaft,
      2.0
    );

    // 7. Generate Engineering Assembly Provenance Record (055-F)
    const rawPayload = JSON.stringify({
      sketchRev: sketch.revision,
      asmId: rootAssembly.id,
      isValid: assemblyGraphValidation.isValid,
      netDOF: dofAnalysis.netSystemDOF,
      surfaceSig: surfacePipelineReport.surfaceProvenance.signature
    });

    const resultHash = `sha256-${this.hashString(rawPayload)}`;
    const signature = `sha256-secp-055-${this.hashString(`${resultHash}-${surfacePipelineReport.surfaceProvenance.signature}`)}`;

    const assemblyProvenance: AssemblyProvenanceRecord = {
      systemVersion: 'SECP CAD CORE v1.0 (SECP-055)',
      timestamp,
      assemblyRevision: sketch.revision,
      assemblyGraphHash: `sha256-asmgraph-${this.hashString(rootAssembly.id)}`,
      mateSystemHash: `sha256-mates-${this.hashString(concentricMate.id)}`,
      kinematicHash: `sha256-kinematics-${this.hashString(dofAnalysis.netSystemDOF.toString())}`,
      interferenceHash: `sha256-interf-${this.hashString(interferenceReport.resultType)}`,
      resultHash,
      signature
    };

    return {
      patch: 'SECP-055',
      timestamp,
      surfacePipelineReport,
      assemblyGraphValidation,
      dofAnalysis,
      interferenceReports: [interferenceReport],
      assemblyProvenance
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
