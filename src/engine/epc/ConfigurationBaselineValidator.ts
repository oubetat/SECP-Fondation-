/**
 * SECP Industrial OS — EPC-004: Configuration Baseline Validator
 * Comprehensive Integrity & Mandate Rules Validator for Engineering Configuration Baselines.
 */

import {
  EngineeringConfigurationBaselineData,
  ConfigurationBaselineValidationError,
  CadBaselineComponent,
  MaterialBaselineComponent,
  ParameterBaselineComponent,
  SimulationModelBaselineComponent,
  MeshBaselineComponent,
  SolverBaselineComponent,
  ControlsBaselineComponent,
  ManufacturingDefinitionBaselineComponent,
  BaselineDependencyGraph
} from './ConfigurationBaselineTypes';

export class ConfigurationBaselineValidator {
  /**
   * Validates a complete Engineering Configuration Baseline payload.
   * Throws ConfigurationBaselineValidationError if invalid or incomplete.
   */
  public static validate(data: EngineeringConfigurationBaselineData): EngineeringConfigurationBaselineData {
    if (!data || typeof data !== 'object') {
      throw new ConfigurationBaselineValidationError(
        'Baseline payload must be a non-null object',
        'INVALID_BASELINE_PAYLOAD'
      );
    }

    // Top level identity
    this.assertNonEmptyString(data.baselineId, 'baselineId', 'MISSING_BASELINE_ID');
    this.assertNonEmptyString(data.productId, 'productId', 'MISSING_PRODUCT_ID');
    this.assertNonEmptyString(data.productRevision, 'productRevision', 'MISSING_PRODUCT_REVISION');
    this.assertNonEmptyString(data.configurationRevision, 'configurationRevision', 'MISSING_CONFIG_REVISION');
    this.assertNonEmptyString(data.createdBy, 'createdBy', 'MISSING_CREATED_BY');
    this.assertNonEmptyString(data.createdAt, 'createdAt', 'MISSING_CREATED_AT');

    const validStatuses = ['DRAFT', 'QUALIFIED', 'SUPERSEDED', 'REJECTED'];
    if (!data.status || !validStatuses.includes(data.status)) {
      throw new ConfigurationBaselineValidationError(
        `Invalid baseline status '${data.status}'. Allowed: ${validStatuses.join(', ')}`,
        'INVALID_STATUS'
      );
    }

    // 1. CAD Component
    this.validateCad(data.cad);

    // 2. Materials Component
    this.validateMaterials(data.materials);

    // 3. Parameters Component
    this.validateParameters(data.parameters);

    // 4. Simulation Models
    this.validateSimulationModels(data.simulationModels, data.cad, data.materials);

    // 5. Mesh Component
    this.validateMesh(data.mesh, data.cad);

    // 6. Solver Component
    this.validateSolver(data.solver);

    // 7. Controls Component
    this.validateControls(data.controls, data.simulationModels);

    // 8. Manufacturing Definition Component
    this.validateManufacturing(data.manufacturingDefinition, data.materials);

    // 9. Dependency Graph
    this.validateDependencyGraph(data.dependencyGraph);

    // 10. Provenance
    this.validateProvenance(data);

    // Qualification enforcement
    if (data.status === 'QUALIFIED') {
      if (!data.isFrozen) {
        throw new ConfigurationBaselineValidationError(
          'Qualified baseline must be frozen (isFrozen = true)',
          'UNFROZEN_QUALIFIED_BASELINE'
        );
      }
      if (!data.contentHash || typeof data.contentHash !== 'string' || data.contentHash.trim() === '') {
        throw new ConfigurationBaselineValidationError(
          'Qualified baseline must possess a valid contentHash',
          'MISSING_CONTENT_HASH'
        );
      }
    }

    return data;
  }

  private static validateCad(cad: CadBaselineComponent): void {
    if (!cad || typeof cad !== 'object') {
      throw new ConfigurationBaselineValidationError('CAD component is mandatory', 'MISSING_CAD_COMPONENT');
    }
    this.assertNonEmptyString(cad.cadId, 'cad.cadId', 'MISSING_CAD_ID');
    this.assertNonEmptyString(cad.name, 'cad.name', 'MISSING_CAD_NAME');
    this.assertNonEmptyString(cad.revision, 'cad.revision', 'MISSING_CAD_REVISION');
    this.assertNonEmptyString(cad.geometryHash, 'cad.geometryHash', 'MISSING_CAD_GEOMETRY_HASH');

    if (!Array.isArray(cad.referencedComponents)) {
      throw new ConfigurationBaselineValidationError('cad.referencedComponents must be an array', 'INVALID_CAD_COMPONENTS');
    }
    for (const comp of cad.referencedComponents) {
      this.assertNonEmptyString(comp.componentId, 'cad.referencedComponents.componentId', 'MISSING_CAD_SUBCOMP_ID');
      this.assertNonEmptyString(comp.revision, 'cad.referencedComponents.revision', 'MISSING_CAD_SUBCOMP_REVISION');
      this.assertNonEmptyString(comp.geometryHash, 'cad.referencedComponents.geometryHash', 'MISSING_CAD_SUBCOMP_HASH');
    }

    if (!cad.configurationState || typeof cad.configurationState !== 'object') {
      throw new ConfigurationBaselineValidationError('cad.configurationState must be an object', 'INVALID_CAD_CONFIG');
    }
  }

  private static validateMaterials(materials: readonly MaterialBaselineComponent[]): void {
    if (!Array.isArray(materials) || materials.length === 0) {
      throw new ConfigurationBaselineValidationError(
        'Materials component is mandatory and must contain at least one material definition',
        'MISSING_MATERIALS_COMPONENT'
      );
    }

    const materialIds = new Set<string>();
    for (const mat of materials) {
      if (!mat || typeof mat !== 'object') {
        throw new ConfigurationBaselineValidationError('Material definition must be a non-null object', 'INVALID_MATERIAL');
      }
      this.assertNonEmptyString(mat.materialId, 'material.materialId', 'MISSING_MATERIAL_ID');
      this.assertNonEmptyString(mat.name, 'material.name', 'MISSING_MATERIAL_NAME');
      this.assertNonEmptyString(mat.revision, 'material.revision', 'MISSING_MATERIAL_REVISION');
      this.assertNonEmptyString(mat.propertySource, 'material.propertySource', 'MISSING_MATERIAL_SOURCE');

      if (!mat.properties || typeof mat.properties !== 'object' || Object.keys(mat.properties).length === 0) {
        throw new ConfigurationBaselineValidationError(
          `Material '${mat.materialId}' must contain at least one property`,
          'EMPTY_MATERIAL_PROPERTIES'
        );
      }

      if (materialIds.has(mat.materialId)) {
        throw new ConfigurationBaselineValidationError(
          `Duplicate material ID '${mat.materialId}' in materials array`,
          'DUPLICATE_MATERIAL_ID'
        );
      }
      materialIds.add(mat.materialId);
    }
  }

  private static validateParameters(params: ParameterBaselineComponent): void {
    if (!params || typeof params !== 'object') {
      throw new ConfigurationBaselineValidationError('Parameters component is mandatory', 'MISSING_PARAMETERS_COMPONENT');
    }
    this.assertNonEmptyString(params.parameterSetId, 'parameters.parameterSetId', 'MISSING_PARAM_SET_ID');
    this.assertNonEmptyString(params.revision, 'parameters.revision', 'MISSING_PARAM_SET_REVISION');

    if (!Array.isArray(params.parameters) || params.parameters.length === 0) {
      throw new ConfigurationBaselineValidationError(
        'Parameters component must contain at least one parameter definition',
        'EMPTY_PARAMETER_SET'
      );
    }

    for (const p of params.parameters) {
      this.assertNonEmptyString(p.name, 'parameter.name', 'MISSING_PARAMETER_NAME');
      this.assertNonEmptyString(p.unit, 'parameter.unit', 'MISSING_PARAMETER_UNIT');
      this.assertNonEmptyString(p.revision, 'parameter.revision', 'MISSING_PARAMETER_REVISION');
      this.assertNonEmptyString(p.source, 'parameter.source', 'MISSING_PARAMETER_SOURCE');

      if (p.value === undefined || p.value === null) {
        throw new ConfigurationBaselineValidationError(
          `Parameter '${p.name}' missing mandatory value`,
          'MISSING_PARAMETER_VALUE'
        );
      }
    }
  }

  private static validateSimulationModels(
    simModels: readonly SimulationModelBaselineComponent[],
    cad: CadBaselineComponent,
    materials: readonly MaterialBaselineComponent[]
  ): void {
    if (!Array.isArray(simModels) || simModels.length === 0) {
      throw new ConfigurationBaselineValidationError(
        'Simulation models component is mandatory and must contain at least one simulation model',
        'MISSING_SIMULATION_MODELS_COMPONENT'
      );
    }

    const matIds = new Set(materials.map(m => m.materialId));

    for (const model of simModels) {
      if (!model || typeof model !== 'object') {
        throw new ConfigurationBaselineValidationError('Simulation model must be a non-null object', 'INVALID_SIM_MODEL');
      }
      this.assertNonEmptyString(model.modelId, 'simulationModel.modelId', 'MISSING_SIM_MODEL_ID');
      this.assertNonEmptyString(model.name, 'simulationModel.name', 'MISSING_SIM_MODEL_NAME');
      this.assertNonEmptyString(model.revision, 'simulationModel.revision', 'MISSING_SIM_MODEL_REVISION');
      this.assertNonEmptyString(model.physicsDomain, 'simulationModel.physicsDomain', 'MISSING_SIM_MODEL_DOMAIN');
      this.assertNonEmptyString(model.referencedGeometryId, 'simulationModel.referencedGeometryId', 'MISSING_SIM_MODEL_GEOM_REF');

      // Verify geometry reference
      if (model.referencedGeometryId !== cad.cadId && !cad.referencedComponents.some(c => c.componentId === model.referencedGeometryId)) {
        throw new ConfigurationBaselineValidationError(
          `Simulation model '${model.modelId}' references unknown CAD geometry '${model.referencedGeometryId}'`,
          'BROKEN_GEOMETRY_REFERENCE'
        );
      }

      // Verify material references
      if (!Array.isArray(model.referencedMaterialIds) || model.referencedMaterialIds.length === 0) {
        throw new ConfigurationBaselineValidationError(
          `Simulation model '${model.modelId}' must reference at least one material`,
          'MISSING_SIM_MODEL_MATERIAL_REFS'
        );
      }

      for (const mId of model.referencedMaterialIds) {
        if (!matIds.has(mId)) {
          throw new ConfigurationBaselineValidationError(
            `Simulation model '${model.modelId}' references unknown material '${mId}'`,
            'BROKEN_MATERIAL_REFERENCE'
          );
        }
      }
    }
  }

  private static validateMesh(mesh: MeshBaselineComponent, cad: CadBaselineComponent): void {
    if (!mesh || typeof mesh !== 'object') {
      throw new ConfigurationBaselineValidationError('Mesh component is mandatory', 'MISSING_MESH_COMPONENT');
    }
    this.assertNonEmptyString(mesh.meshId, 'mesh.meshId', 'MISSING_MESH_ID');
    this.assertNonEmptyString(mesh.revision, 'mesh.revision', 'MISSING_MESH_REVISION');
    this.assertNonEmptyString(mesh.generationMethod, 'mesh.generationMethod', 'MISSING_MESH_METHOD');
    this.assertNonEmptyString(mesh.referencedGeometryId, 'mesh.referencedGeometryId', 'MISSING_MESH_GEOM_REF');
    this.assertNonEmptyString(mesh.meshHash, 'mesh.meshHash', 'MISSING_MESH_HASH');

    if (mesh.referencedGeometryId !== cad.cadId && !cad.referencedComponents.some(c => c.componentId === mesh.referencedGeometryId)) {
      throw new ConfigurationBaselineValidationError(
        `Mesh '${mesh.meshId}' references unknown CAD geometry '${mesh.referencedGeometryId}'`,
        'BROKEN_MESH_GEOMETRY_REFERENCE'
      );
    }
  }

  private static validateSolver(solver: SolverBaselineComponent): void {
    if (!solver || typeof solver !== 'object') {
      throw new ConfigurationBaselineValidationError('Solver component is mandatory', 'MISSING_SOLVER_COMPONENT');
    }
    this.assertNonEmptyString(solver.solverId, 'solver.solverId', 'MISSING_SOLVER_ID');
    this.assertNonEmptyString(solver.name, 'solver.name', 'MISSING_SOLVER_NAME');
    this.assertNonEmptyString(solver.version, 'solver.version', 'MISSING_SOLVER_VERSION');
    this.assertNonEmptyString(solver.numericalMethod, 'solver.numericalMethod', 'MISSING_SOLVER_METHOD');

    if (!solver.convergenceCriteria || typeof solver.convergenceCriteria !== 'object' || Object.keys(solver.convergenceCriteria).length === 0) {
      throw new ConfigurationBaselineValidationError('Solver convergenceCriteria must be a non-empty object', 'MISSING_CONVERGENCE_CRITERIA');
    }

    if (!solver.tolerances || typeof solver.tolerances !== 'object' || Object.keys(solver.tolerances).length === 0) {
      throw new ConfigurationBaselineValidationError('Solver tolerances must be a non-empty object', 'MISSING_SOLVER_TOLERANCES');
    }
  }

  private static validateControls(
    controls: ControlsBaselineComponent,
    simModels: readonly SimulationModelBaselineComponent[]
  ): void {
    if (!controls || typeof controls !== 'object') {
      throw new ConfigurationBaselineValidationError('Controls component is mandatory', 'MISSING_CONTROLS_COMPONENT');
    }
    this.assertNonEmptyString(controls.controlId, 'controls.controlId', 'MISSING_CONTROL_ID');
    this.assertNonEmptyString(controls.name, 'controls.name', 'MISSING_CONTROL_NAME');
    this.assertNonEmptyString(controls.revision, 'controls.revision', 'MISSING_CONTROL_REVISION');

    if (controls.referencedModelId) {
      const modelExists = simModels.some(m => m.modelId === controls.referencedModelId);
      if (!modelExists) {
        throw new ConfigurationBaselineValidationError(
          `Controls '${controls.controlId}' references unknown simulation model '${controls.referencedModelId}'`,
          'BROKEN_CONTROL_MODEL_REFERENCE'
        );
      }
    }
  }

  private static validateManufacturing(
    mfg: ManufacturingDefinitionBaselineComponent,
    materials: readonly MaterialBaselineComponent[]
  ): void {
    if (!mfg || typeof mfg !== 'object') {
      throw new ConfigurationBaselineValidationError('Manufacturing definition component is mandatory', 'MISSING_MANUFACTURING_COMPONENT');
    }
    this.assertNonEmptyString(mfg.manufacturingId, 'manufacturingDefinition.manufacturingId', 'MISSING_MFG_ID');
    this.assertNonEmptyString(mfg.revision, 'manufacturingDefinition.revision', 'MISSING_MFG_REVISION');
    this.assertNonEmptyString(mfg.bomReference, 'manufacturingDefinition.bomReference', 'MISSING_MFG_BOM_REF');

    if (!Array.isArray(mfg.operations) || mfg.operations.length === 0) {
      throw new ConfigurationBaselineValidationError('Manufacturing definition operations must contain at least one operation', 'EMPTY_MFG_OPERATIONS');
    }

    if (mfg.materialDependencies) {
      const matIds = new Set(materials.map(m => m.materialId));
      for (const matDep of mfg.materialDependencies) {
        if (!matIds.has(matDep)) {
          throw new ConfigurationBaselineValidationError(
            `Manufacturing definition references unknown material dependency '${matDep}'`,
            'BROKEN_MFG_MATERIAL_REFERENCE'
          );
        }
      }
    }
  }

  private static validateDependencyGraph(graph: BaselineDependencyGraph): void {
    if (!graph || typeof graph !== 'object') {
      throw new ConfigurationBaselineValidationError('Dependency graph is mandatory', 'MISSING_DEPENDENCY_GRAPH');
    }
    if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) {
      throw new ConfigurationBaselineValidationError('Dependency graph nodes must contain at least one node', 'EMPTY_DEPENDENCY_NODES');
    }
    if (!Array.isArray(graph.edges)) {
      throw new ConfigurationBaselineValidationError('Dependency graph edges must be an array', 'INVALID_DEPENDENCY_EDGES');
    }

    const nodeIds = new Set(graph.nodes.map(n => n.nodeId));
    for (const edge of graph.edges) {
      if (!nodeIds.has(edge.sourceNodeId)) {
        throw new ConfigurationBaselineValidationError(
          `Dependency edge '${edge.edgeId}' references unknown source node '${edge.sourceNodeId}'`,
          'BROKEN_DEPENDENCY_SOURCE_NODE'
        );
      }
      if (!nodeIds.has(edge.targetNodeId)) {
        throw new ConfigurationBaselineValidationError(
          `Dependency edge '${edge.edgeId}' references unknown target node '${edge.targetNodeId}'`,
          'BROKEN_DEPENDENCY_TARGET_NODE'
        );
      }
      if (edge.sourceNodeId === edge.targetNodeId) {
        throw new ConfigurationBaselineValidationError(
          `Self-referencing dependency edge '${edge.edgeId}' on node '${edge.sourceNodeId}' is invalid`,
          'SELF_REFERENCING_DEPENDENCY'
        );
      }
    }

    // Cycle detection using DFS
    this.detectDependencyCycles(graph);
  }

  private static detectDependencyCycles(graph: BaselineDependencyGraph): void {
    const adjMap = new Map<string, string[]>();
    for (const node of graph.nodes) {
      adjMap.set(node.nodeId, []);
    }
    for (const edge of graph.edges) {
      const list = adjMap.get(edge.sourceNodeId);
      if (list) list.push(edge.targetNodeId);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const neighbors = adjMap.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true;
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const node of graph.nodes) {
      if (!visited.has(node.nodeId)) {
        if (dfs(node.nodeId)) {
          throw new ConfigurationBaselineValidationError(
            `Circular dependency detected in baseline dependency graph starting at node '${node.nodeId}'`,
            'CIRCULAR_DEPENDENCY_DETECTED'
          );
        }
      }
    }
  }

  private static validateProvenance(data: EngineeringConfigurationBaselineData): void {
    const prov = data.provenance;
    if (!prov || typeof prov !== 'object') {
      throw new ConfigurationBaselineValidationError('Provenance is mandatory', 'MISSING_PROVENANCE');
    }
    this.assertNonEmptyString(prov.creator, 'provenance.creator', 'MISSING_PROVENANCE_CREATOR');
    this.assertNonEmptyString(prov.createdAt, 'provenance.createdAt', 'MISSING_PROVENANCE_CREATED_AT');
    this.assertNonEmptyString(
      prov.configurationRevision,
      'provenance.configurationRevision',
      'MISSING_PROVENANCE_CONFIG_REVISION'
    );
  }

  private static assertNonEmptyString(val: unknown, name: string, errorCode: string): void {
    if (typeof val !== 'string' || val.trim() === '') {
      throw new ConfigurationBaselineValidationError(
        `Field '${name}' must be a non-empty string`,
        errorCode
      );
    }
  }
}
