/**
 * SECP Industrial OS — EPC-020: Structural Traceability & Lifecycle Bridge
 * Binds Structural Components, Parameters, Materials, and Load Cases to:
 * - EPC-003: Requirement Traceability (DRONE-REQ-001, 005, 006, 007, 008, 010, 018, 019, 020)
 * - EPC-004: Configuration Baseline Manager
 * - EPC-006: Multidisciplinary Model Registry (CAD, FEA, CFD, Mesh, Dynamics)
 * - EPC-007: Engineering Dependency Graph
 * - EPC-009/011: Evidence Package and Provenance
 */

import { MultidisciplinaryModelRegistry } from '../MultidisciplinaryModelRegistry';
import { ModelType, MultidisciplinaryModel } from '../MultidisciplinaryModelTypes';
import { ConfigurationBaselineManager } from '../ConfigurationBaselineManager';
import {
  CadBaselineComponent,
  MaterialBaselineComponent,
  ParameterBaselineComponent,
  SimulationModelBaselineComponent,
  MeshBaselineComponent,
  SolverBaselineComponent,
  ControlsBaselineComponent,
  ManufacturingDefinitionBaselineComponent
} from '../ConfigurationBaselineTypes';
import { RequirementTraceabilityEngine } from '../RequirementTraceabilityEngine';
import { EngineeringHashChain } from '../../evidence/EngineeringHashChain';
import {
  StructuralComponent,
  StructuralSubsystemModel
} from './StructuralComponentTypes';

export class StructuralTraceabilityBridge {
  /**
   * Registers all 5 structural components in EPC-006 Multidisciplinary Model Registry.
   */
  public static registerComponentsInModelRegistry(
    registry: MultidisciplinaryModelRegistry,
    components: readonly StructuralComponent[]
  ): MultidisciplinaryModel[] {
    const registered: MultidisciplinaryModel[] = [];

    for (const comp of components) {
      const rawModel: Omit<MultidisciplinaryModel, 'contentHash'> = {
        modelId: comp.componentId,
        modelType: ModelType.CAD,
        name: comp.name,
        description: `Structural CAD solid model for ${comp.componentType} (${comp.partNumber})`,
        domain: 'INDUSTRIAL_DRONE',
        productId: comp.productId,
        productRevisionId: '1.0',
        variantId: 'VAR-HEX-01',
        configurationId: `CFG-DRONE-STRUCTURAL-${comp.componentId}`,
        modelRevision: comp.revision,
        lifecycleStatus: 'DESIGN_DEFINED' as any,
        artifactReference: `cad/structural/${comp.componentId}_REV_${comp.revision}.step`,
        dependencyIds: ['REQ-SPEC-DRONE-017', 'ARCH-DRONE-018', ...comp.traceableRequirementIds],
        parameterSetReference: `param/structural/${comp.componentId}_params.json`,
        materialReference: comp.materialReference.materialId,
        geometryReference: comp.geometryReference.geometryHash,
        provenance: {
          creator: comp.author,
          createdAt: comp.createdAt,
          productConfigurationId: `CFG-DRONE-STRUCTURAL-${comp.componentId}`,
          dependencies: ['EPC-017', 'EPC-018', 'EPC-019'],
          hash: comp.contentHash
        },
        createdAt: comp.createdAt,
        createdBy: comp.author
      };

      const { createdAt, createdBy, provenance, ...rest } = rawModel as any;
      const computedHash = EngineeringHashChain.computeCanonicalHash(rest).canonicalHash;

      const model: MultidisciplinaryModel = {
        ...rawModel,
        contentHash: computedHash
      };

      registry.registerModel(model);
      registered.push(model);
    }

    return registered;
  }

  /**
   * Registers forward FEA / Structural Analysis models for the structural components in the registry.
   */
  public static registerForwardAnalysisModels(
    registry: MultidisciplinaryModelRegistry,
    components: readonly StructuralComponent[]
  ): void {
    for (const comp of components) {
      for (const ana of comp.analysisReferences) {
        const rawAna: Omit<MultidisciplinaryModel, 'contentHash'> = {
          modelId: ana.analysisId,
          modelType: ModelType.FEA,
          name: `${comp.componentType} FEA Model (${ana.analysisType})`,
          description: `Discretized finite element structural model for ${comp.name} targeting solver ${ana.targetSolver}`,
          domain: 'INDUSTRIAL_DRONE',
          productId: comp.productId,
          productRevisionId: '1.0',
          variantId: 'VAR-HEX-01',
          configurationId: `CFG-FEA-${comp.componentId}`,
          modelRevision: '1.0',
          lifecycleStatus: 'DESIGN_DEFINED' as any,
          artifactReference: `sim/fea/${ana.analysisId}.json`,
          dependencyIds: [comp.componentId],
          parameterSetReference: `param/fea/${ana.analysisId}_params.json`,
          materialReference: comp.materialReference.materialId,
          geometryReference: comp.geometryReference.geometryHash,
          provenance: {
            creator: 'SECP-CAE-ENGINEER',
            createdAt: comp.createdAt,
            productConfigurationId: `CFG-FEA-${comp.componentId}`,
            dependencies: [`${comp.componentId}@${comp.revision}`],
            hash: comp.contentHash
          },
          createdAt: comp.createdAt,
          createdBy: 'SECP-CAE-ENGINEER'
        };

        const { createdAt, createdBy, provenance, ...rest } = rawAna as any;
        const computedHash = EngineeringHashChain.computeCanonicalHash(rest).canonicalHash;

        registry.registerModel({
          ...rawAna,
          contentHash: computedHash
        });
      }
    }
  }

  /**
   * Populates Requirement Traceability Engine with all structural requirements and component edges.
   */
  public static populateTraceabilityGraph(
    traceEngine: RequirementTraceabilityEngine,
    components: readonly StructuralComponent[]
  ): void {
    const structuralRequirements: Record<string, string> = {
      'DRONE-REQ-001': 'Airframe Structural Integrity & B-Rep Topology Verification',
      'DRONE-REQ-005': 'Modular Arm Subsystem with Quick-Clamp Flange & Carbon Fiber Construction',
      'DRONE-REQ-006': 'High-Heat-Dissipation CNC Aluminum Motor Mount & Propulsion Interface',
      'DRONE-REQ-007': 'High-Shock Landing Gear with Rollover Stability Footprint',
      'DRONE-REQ-008': 'Vibration-Isolated Lower-Deck Mission Payload Mounting Rail',
      'DRONE-REQ-010': 'Upper-Deck Quick-Release 10G Crash Retention Battery Tray',
      'DRONE-REQ-018': 'Aerospace Grade Composite Laminate & 7075-T6 Materials Compliance',
      'DRONE-REQ-019': 'Standardized Metric Fasteners & Torque Verification',
      'DRONE-REQ-020': 'Environmental & Multi-Axis Vibration Resistance Standards'
    };

    // 1. Register Requirements in Traceability Graph
    for (const [reqId, reqName] of Object.entries(structuralRequirements)) {
      if (!traceEngine.getArtifact(reqId)) {
        traceEngine.addArtifact({
          artifactId: reqId,
          type: 'REQUIREMENT',
          name: reqName
        });
      }
    }

    // 2. Register Components as DESIGN_FEATURE Artifacts and link to Requirements
    for (const comp of components) {
      if (!traceEngine.getArtifact(comp.componentId)) {
        traceEngine.addArtifact({
          artifactId: comp.componentId,
          type: 'DESIGN_FEATURE',
          name: comp.name
        });
      }

      for (const reqId of comp.traceableRequirementIds) {
        traceEngine.addEdge({
          edgeId: `EDGE-TRC-${reqId}-${comp.componentId}`,
          sourceId: reqId,
          targetId: comp.componentId,
          relationshipType: 'REQUIREMENT_TO_DESIGN_FEATURE'
        });
      }
    }
  }

  /**
   * Creates an immutable Configuration Baseline Manager instance for the structural subsystem.
   */
  public static createConfigurationBaseline(
    subsystem: StructuralSubsystemModel
  ): ConfigurationBaselineManager {
    const baselineId = `BSL-DRONE-STRUCTURAL-${subsystem.revision}`;

    const cad: CadBaselineComponent = {
      cadId: subsystem.subsystemId,
      name: subsystem.name,
      revision: subsystem.revision,
      geometryHash: subsystem.contentHash,
      referencedComponents: subsystem.components.map(c => ({
        componentId: c.componentId,
        name: c.name,
        revision: c.revision,
        geometryHash: c.geometryReference.geometryHash
      })),
      configurationState: {
        totalComponents: subsystem.components.length,
        totalMassKg: subsystem.aggregateMassProperties.totalMassKg
      }
    };

    const materialsMap = new Map<string, MaterialBaselineComponent>();
    for (const c of subsystem.components) {
      if (!materialsMap.has(c.materialReference.materialId)) {
        materialsMap.set(c.materialReference.materialId, {
          materialId: c.materialReference.materialId,
          name: c.materialReference.materialName,
          revision: c.materialReference.revision,
          properties: {
            densityKgM3: c.materialReference.densityKgM3,
            youngsModulusGPa: c.materialReference.youngModulusGPa,
            poissonsRatio: c.materialReference.poissonsRatio,
            yieldStrengthMPa: c.materialReference.yieldStrengthMPa,
            ultimateStrengthMPa: c.materialReference.ultimateStrengthMPa
          },
          propertySource: c.materialReference.provenance,
          databaseVersion: '4.2.0'
        });
      }
    }
    const materials = Array.from(materialsMap.values());

    const parameters: ParameterBaselineComponent = {
      parameterSetId: `PARAMSET-DRONE-STRUCTURAL-${subsystem.revision}`,
      revision: subsystem.revision,
      parameters: subsystem.components.flatMap(c =>
        Object.entries(c.parameterSet).map(([k, v]) => ({
          name: `${c.componentId}.${k}`,
          value: v.value,
          unit: v.unit,
          revision: c.revision,
          source: v.source
        }))
      )
    };

    const simulationModels: SimulationModelBaselineComponent[] = subsystem.components.flatMap(c =>
      c.analysisReferences.map(a => ({
        modelId: a.analysisId,
        name: `${c.name} - ${a.analysisType}`,
        revision: '1.0',
        physicsDomain: 'STRUCTURAL_FEA',
        governingConfig: { solver: a.targetSolver },
        referencedGeometryId: c.componentId,
        referencedMaterialIds: [c.materialReference.materialId],
        modelParameters: { allowableStressMPa: a.allowableVonMisesStressMPa }
      }))
    );

    const mesh: MeshBaselineComponent = {
      meshId: 'MESH-DRONE-STRUCTURAL-001',
      revision: '1.0',
      generationMethod: 'TET10_QUADRATIC',
      meshParameters: { targetElementSizeMm: 3.0, maxAspectRatio: 3.5 },
      referencedGeometryId: subsystem.subsystemId,
      meshHash: subsystem.contentHash,
      elementCount: 120000,
      nodeCount: 45000
    };

    const solver: SolverBaselineComponent = {
      solverId: 'SOLVER-SECP-FEA-4.2',
      name: 'SECP Multi-Body Structural Solver',
      version: '4.2.0',
      solverConfig: { parallelThreads: 8, sparseSolver: true },
      numericalMethod: 'DIRECT_SPARSE_CHOLESKY',
      convergenceCriteria: { tolerance: 1e-6 },
      tolerances: { absolute: 1e-8, relative: 1e-6 }
    };

    const controls: ControlsBaselineComponent = {
      controlId: 'CTRL-STRUCTURAL-DAMPING-001',
      name: 'Structural Resonance Dampening Filter',
      revision: '1.0',
      controlParameters: { notchFilterHz: 85.0, bandwidthHz: 10.0 },
      controlConfig: { sampleRateHz: 1000 }
    };

    const manufacturingDefinition: ManufacturingDefinitionBaselineComponent = {
      manufacturingId: 'MFG-DRONE-STRUCTURAL-001',
      revision: '1.0',
      bomReference: 'BOM-DRONE-STRUCTURAL-001',
      processDefinition: { primaryProcess: 'CNC_MILLING_AND_COMPOSITE_AUTOCLAVE' },
      operations: subsystem.components.map(c => ({
        opId: `OP-MFG-${c.componentId}`,
        name: `Manufacturing ${c.manufacturingDefinition.process} for ${c.partNumber}`,
        type: c.manufacturingDefinition.process
      }))
    };

    return ConfigurationBaselineManager.createDraft({
      baselineId,
      productId: 'PROD-IND-DRONE-001',
      productRevision: '1.0',
      configurationRevision: subsystem.revision,
      createdBy: 'SECP-STRUCTURAL-ENGINEER',
      cad,
      materials,
      parameters,
      simulationModels,
      mesh,
      solver,
      controls,
      manufacturingDefinition
    });
  }
}
