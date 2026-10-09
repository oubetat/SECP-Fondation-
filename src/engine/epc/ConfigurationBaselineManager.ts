/**
 * SECP Industrial OS — EPC-004: Configuration Baseline Manager
 * Core Immutable Baseline Engine, Lifecycle, Drift Detection, and Revisioning.
 */

import {
  EngineeringConfigurationBaselineData,
  ConfigurationBaselineValidationError,
  BaselineStatus,
  BaselineDriftReport,
  DriftDetail,
  CadBaselineComponent,
  MaterialBaselineComponent,
  ParameterBaselineComponent,
  SimulationModelBaselineComponent,
  MeshBaselineComponent,
  SolverBaselineComponent,
  ControlsBaselineComponent,
  ManufacturingDefinitionBaselineComponent,
  BaselineDependencyGraph,
  BaselineProvenance
} from './ConfigurationBaselineTypes';
import { ConfigurationBaselineValidator } from './ConfigurationBaselineValidator';
import { ConfigurationBaselineSerializer } from './ConfigurationBaselineSerializer';

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

export class ConfigurationBaselineManager {
  private data: EngineeringConfigurationBaselineData;

  constructor(initialData: EngineeringConfigurationBaselineData) {
    ConfigurationBaselineValidator.validate(initialData);
    this.data = JSON.parse(JSON.stringify(initialData));
  }

  /**
   * Factory method to create a new DRAFT Engineering Configuration Baseline.
   */
  public static createDraft(params: {
    baselineId: string;
    productId: string;
    productRevision: string;
    configurationRevision: string;
    createdBy: string;
    cad: CadBaselineComponent;
    materials: MaterialBaselineComponent[];
    parameters: ParameterBaselineComponent;
    simulationModels: SimulationModelBaselineComponent[];
    mesh: MeshBaselineComponent;
    solver: SolverBaselineComponent;
    controls: ControlsBaselineComponent;
    manufacturingDefinition: ManufacturingDefinitionBaselineComponent;
    dependencyGraph?: BaselineDependencyGraph;
    parentBaselineId?: string;
  }): ConfigurationBaselineManager {
    const createdAt = new Date().toISOString();

    const graph: BaselineDependencyGraph = params.dependencyGraph || {
      nodes: [
        { nodeId: 'N-CAD', componentType: 'CAD', artifactId: params.cad.cadId, revision: params.cad.revision },
        ...params.materials.map(m => ({ nodeId: `N-MAT-${m.materialId}`, componentType: 'MATERIALS' as const, artifactId: m.materialId, revision: m.revision })),
        { nodeId: 'N-PARAM', componentType: 'PARAMETERS', artifactId: params.parameters.parameterSetId, revision: params.parameters.revision },
        ...params.simulationModels.map(s => ({ nodeId: `N-SIM-${s.modelId}`, componentType: 'SIMULATION_MODELS' as const, artifactId: s.modelId, revision: s.revision })),
        { nodeId: 'N-MESH', componentType: 'MESH', artifactId: params.mesh.meshId, revision: params.mesh.revision },
        { nodeId: 'N-SOLVER', componentType: 'SOLVER', artifactId: params.solver.solverId, revision: params.solver.version },
        { nodeId: 'N-CTRL', componentType: 'CONTROLS', artifactId: params.controls.controlId, revision: params.controls.revision },
        { nodeId: 'N-MFG', componentType: 'MANUFACTURING_DEFINITION', artifactId: params.manufacturingDefinition.manufacturingId, revision: params.manufacturingDefinition.revision }
      ],
      edges: [
        { edgeId: 'E-CAD-PARAM', sourceNodeId: 'N-CAD', targetNodeId: 'N-PARAM', relationship: 'DRIVES_PARAMETERS' },
        { edgeId: 'E-PARAM-SIM', sourceNodeId: 'N-PARAM', targetNodeId: `N-SIM-${params.simulationModels[0].modelId}`, relationship: 'CONFIGURES_SIMULATION' },
        { edgeId: 'E-SIM-MESH', sourceNodeId: `N-SIM-${params.simulationModels[0].modelId}`, targetNodeId: 'N-MESH', relationship: 'DISCRETIZED_BY' },
        { edgeId: 'E-MESH-SOLVER', sourceNodeId: 'N-MESH', targetNodeId: 'N-SOLVER', relationship: 'SOLVED_BY' },
        { edgeId: 'E-SOLVER-CTRL', sourceNodeId: 'N-SOLVER', targetNodeId: 'N-CTRL', relationship: 'VALIDATES_CONTROL' },
        { edgeId: 'E-CTRL-MFG', sourceNodeId: 'N-CTRL', targetNodeId: 'N-MFG', relationship: 'MANUFACTURING_CONSTRAINED_BY' }
      ]
    };

    const provenance: BaselineProvenance = {
      creator: params.createdBy,
      createdAt,
      sourceArtifacts: {
        cad: params.cad.cadId,
        parameters: params.parameters.parameterSetId,
        mesh: params.mesh.meshId,
        solver: params.solver.solverId,
        controls: params.controls.controlId,
        manufacturing: params.manufacturingDefinition.manufacturingId
      },
      artifactRevisions: {
        cad: params.cad.revision,
        parameters: params.parameters.revision,
        mesh: params.mesh.revision,
        solver: params.solver.version,
        controls: params.controls.revision,
        manufacturing: params.manufacturingDefinition.revision
      },
      configurationRevision: params.configurationRevision,
      parentBaselineId: params.parentBaselineId
    };

    const draftData: EngineeringConfigurationBaselineData = {
      baselineId: params.baselineId,
      productId: params.productId,
      productRevision: params.productRevision,
      configurationRevision: params.configurationRevision,
      status: 'DRAFT',
      createdAt,
      createdBy: params.createdBy,
      cad: params.cad,
      materials: params.materials,
      parameters: params.parameters,
      simulationModels: params.simulationModels,
      mesh: params.mesh,
      solver: params.solver,
      controls: params.controls,
      manufacturingDefinition: params.manufacturingDefinition,
      dependencyGraph: graph,
      provenance,
      isFrozen: false
    };

    return new ConfigurationBaselineManager(draftData);
  }

  /**
   * Returns copy or frozen baseline data.
   */
  public getData(): EngineeringConfigurationBaselineData {
    if (this.data.isFrozen) {
      return deepFreeze(JSON.parse(JSON.stringify(this.data)));
    }
    return JSON.parse(JSON.stringify(this.data));
  }

  /**
   * Asserts baseline immutability before any update.
   */
  private assertMutable(): void {
    if (this.data.isFrozen || this.data.status === 'QUALIFIED') {
      throw new ConfigurationBaselineValidationError(
        `Baseline '${this.data.baselineId}' is qualified and immutable. Modifications require creating a new baseline revision.`,
        'IMMUTABILITY_VIOLATION'
      );
    }
  }

  /**
   * Updates component in DRAFT status.
   */
  public updateCad(cad: CadBaselineComponent): void {
    this.assertMutable();
    this.data = { ...this.data, cad };
    ConfigurationBaselineValidator.validate(this.data);
  }

  public updateMaterials(materials: MaterialBaselineComponent[]): void {
    this.assertMutable();
    this.data = { ...this.data, materials };
    ConfigurationBaselineValidator.validate(this.data);
  }

  public updateParameters(parameters: ParameterBaselineComponent): void {
    this.assertMutable();
    this.data = { ...this.data, parameters };
    ConfigurationBaselineValidator.validate(this.data);
  }

  public updateSimulationModels(simModels: SimulationModelBaselineComponent[]): void {
    this.assertMutable();
    this.data = { ...this.data, simulationModels: simModels };
    ConfigurationBaselineValidator.validate(this.data);
  }

  public updateMesh(mesh: MeshBaselineComponent): void {
    this.assertMutable();
    this.data = { ...this.data, mesh };
    ConfigurationBaselineValidator.validate(this.data);
  }

  public updateSolver(solver: SolverBaselineComponent): void {
    this.assertMutable();
    this.data = { ...this.data, solver };
    ConfigurationBaselineValidator.validate(this.data);
  }

  public updateControls(controls: ControlsBaselineComponent): void {
    this.assertMutable();
    this.data = { ...this.data, controls };
    ConfigurationBaselineValidator.validate(this.data);
  }

  public updateManufacturingDefinition(mfg: ManufacturingDefinitionBaselineComponent): void {
    this.assertMutable();
    this.data = { ...this.data, manufacturingDefinition: mfg };
    ConfigurationBaselineValidator.validate(this.data);
  }

  /**
   * Qualifies and freezes the baseline.
   * Computes deterministic canonical content hash.
   */
  public qualify(): EngineeringConfigurationBaselineData {
    if (this.data.status === 'QUALIFIED' && this.data.isFrozen && this.data.contentHash) {
      // Already qualified
      return this.getData();
    }

    // Ensure baseline is valid prior to qualification
    ConfigurationBaselineValidator.validate(this.data);

    const qualifiedState: EngineeringConfigurationBaselineData = {
      ...this.data,
      status: 'QUALIFIED',
      isFrozen: true
    };

    // Compute canonical content hash over qualified state
    const { contentHash } = ConfigurationBaselineSerializer.serialize(qualifiedState);

    this.data.status = 'QUALIFIED';
    this.data.isFrozen = true;
    this.data.contentHash = contentHash;
    this.data.provenance = {
      ...this.data.provenance,
      contentHash
    };

    // Re-verify fully populated qualified state
    ConfigurationBaselineValidator.validate(this.data);

    return this.getData();
  }

  /**
   * Verifies that the baseline hash matches canonical serialization recomputation.
   */
  public verifyIntegrity(): boolean {
    if (!this.data.contentHash) return false;
    const { contentHash: recomputedHash } = ConfigurationBaselineSerializer.serialize(this.data);
    return recomputedHash === this.data.contentHash;
  }

  /**
   * Creates a new baseline revision referencing this parent baseline.
   */
  public createRevision(params: {
    newBaselineId: string;
    newConfigurationRevision: string;
    createdBy: string;
    changes?: Partial<EngineeringConfigurationBaselineData>;
  }): ConfigurationBaselineManager {
    const parentData = this.getData();

    const mergedData: EngineeringConfigurationBaselineData = {
      ...parentData,
      ...(params.changes || {}),
      baselineId: params.newBaselineId,
      configurationRevision: params.newConfigurationRevision,
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
      createdBy: params.createdBy,
      isFrozen: false,
      contentHash: undefined,
      provenance: {
        creator: params.createdBy,
        createdAt: new Date().toISOString(),
        sourceArtifacts: parentData.provenance.sourceArtifacts,
        artifactRevisions: parentData.provenance.artifactRevisions,
        configurationRevision: params.newConfigurationRevision,
        parentBaselineId: parentData.baselineId
      }
    };

    return new ConfigurationBaselineManager(mergedData);
  }

  /**
   * Compares this baseline against another baseline or payload to detect configuration drift.
   */
  public detectDrift(target: ConfigurationBaselineManager | EngineeringConfigurationBaselineData): BaselineDriftReport {
    const b1 = this.getData();
    const b2 = target instanceof ConfigurationBaselineManager ? target.getData() : target;

    const details: DriftDetail[] = [];
    const driftedComponentsSet = new Set<string>();

    const recordDrift = (component: string, field: string, expected: unknown, actual: unknown) => {
      driftedComponentsSet.add(component);
      details.push({
        component,
        field,
        expected,
        actual,
        message: `Configuration drift in ${component}.${field}: expected '${JSON.stringify(expected)}', got '${JSON.stringify(actual)}'`
      });
    };

    // 1. CAD
    if (b1.cad.revision !== b2.cad.revision) recordDrift('CAD', 'revision', b1.cad.revision, b2.cad.revision);
    if (b1.cad.geometryHash !== b2.cad.geometryHash) recordDrift('CAD', 'geometryHash', b1.cad.geometryHash, b2.cad.geometryHash);

    // 2. Materials
    if (b1.materials.length !== b2.materials.length) {
      recordDrift('MATERIALS', 'count', b1.materials.length, b2.materials.length);
    } else {
      for (let i = 0; i < b1.materials.length; i++) {
        const m1 = b1.materials[i];
        const m2 = b2.materials[i];
        if (m1.revision !== m2.revision) recordDrift('MATERIALS', `[${m1.materialId}].revision`, m1.revision, m2.revision);
        if (JSON.stringify(m1.properties) !== JSON.stringify(m2.properties)) {
          recordDrift('MATERIALS', `[${m1.materialId}].properties`, m1.properties, m2.properties);
        }
      }
    }

    // 3. Parameters
    if (b1.parameters.revision !== b2.parameters.revision) recordDrift('PARAMETERS', 'revision', b1.parameters.revision, b2.parameters.revision);
    const p1Map = new Map(b1.parameters.parameters.map(p => [p.name, p]));
    const p2Map = new Map(b2.parameters.parameters.map(p => [p.name, p]));
    for (const [name, p1] of p1Map.entries()) {
      const p2 = p2Map.get(name);
      if (!p2) {
        recordDrift('PARAMETERS', `parameter '${name}'`, p1, 'MISSING');
      } else {
        if (p1.value !== p2.value) recordDrift('PARAMETERS', `parameter '${name}'.value`, p1.value, p2.value);
        if (p1.unit !== p2.unit) recordDrift('PARAMETERS', `parameter '${name}'.unit`, p1.unit, p2.unit);
      }
    }

    // 4. Simulation Models
    if (b1.simulationModels.length !== b2.simulationModels.length) {
      recordDrift('SIMULATION_MODELS', 'count', b1.simulationModels.length, b2.simulationModels.length);
    } else {
      for (let i = 0; i < b1.simulationModels.length; i++) {
        const sm1 = b1.simulationModels[i];
        const sm2 = b2.simulationModels[i];
        if (sm1.revision !== sm2.revision) recordDrift('SIMULATION_MODELS', `[${sm1.modelId}].revision`, sm1.revision, sm2.revision);
        if (JSON.stringify(sm1.governingConfig) !== JSON.stringify(sm2.governingConfig)) {
          recordDrift('SIMULATION_MODELS', `[${sm1.modelId}].governingConfig`, sm1.governingConfig, sm2.governingConfig);
        }
      }
    }

    // 5. Mesh
    if (b1.mesh.revision !== b2.mesh.revision) recordDrift('MESH', 'revision', b1.mesh.revision, b2.mesh.revision);
    if (b1.mesh.meshHash !== b2.mesh.meshHash) recordDrift('MESH', 'meshHash', b1.mesh.meshHash, b2.mesh.meshHash);

    // 6. Solver
    if (b1.solver.version !== b2.solver.version) recordDrift('SOLVER', 'version', b1.solver.version, b2.solver.version);
    if (JSON.stringify(b1.solver.convergenceCriteria) !== JSON.stringify(b2.solver.convergenceCriteria)) {
      recordDrift('SOLVER', 'convergenceCriteria', b1.solver.convergenceCriteria, b2.solver.convergenceCriteria);
    }
    if (JSON.stringify(b1.solver.tolerances) !== JSON.stringify(b2.solver.tolerances)) {
      recordDrift('SOLVER', 'tolerances', b1.solver.tolerances, b2.solver.tolerances);
    }

    // 7. Controls
    if (b1.controls.revision !== b2.controls.revision) recordDrift('CONTROLS', 'revision', b1.controls.revision, b2.controls.revision);
    if (JSON.stringify(b1.controls.controlParameters) !== JSON.stringify(b2.controls.controlParameters)) {
      recordDrift('CONTROLS', 'controlParameters', b1.controls.controlParameters, b2.controls.controlParameters);
    }

    // 8. Manufacturing Definition
    if (b1.manufacturingDefinition.revision !== b2.manufacturingDefinition.revision) {
      recordDrift('MANUFACTURING_DEFINITION', 'revision', b1.manufacturingDefinition.revision, b2.manufacturingDefinition.revision);
    }
    if (b1.manufacturingDefinition.bomReference !== b2.manufacturingDefinition.bomReference) {
      recordDrift('MANUFACTURING_DEFINITION', 'bomReference', b1.manufacturingDefinition.bomReference, b2.manufacturingDefinition.bomReference);
    }

    const isDriftDetected = details.length > 0;

    return {
      baselineId: b1.baselineId,
      targetBaselineId: b2.baselineId,
      isDriftDetected,
      driftedComponents: Array.from(driftedComponentsSet),
      details,
      timestamp: new Date().toISOString()
    };
  }
}
