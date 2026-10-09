/**
 * SECP Industrial OS — EPC-004: Engineering Configuration Baseline Types
 * Domain-Agnostic Engineering Configuration Baseline Schema.
 */

export type BaselineStatus = 'DRAFT' | 'QUALIFIED' | 'SUPERSEDED' | 'REJECTED';

export interface CadComponentReference {
  readonly componentId: string;
  readonly name: string;
  readonly revision: string;
  readonly geometryHash: string;
}

export interface CadBaselineComponent {
  readonly cadId: string;
  readonly name: string;
  readonly revision: string;
  readonly geometryHash: string;
  readonly topologyHash?: string;
  readonly assemblyRevision?: string;
  readonly referencedComponents: readonly CadComponentReference[];
  readonly configurationState: Record<string, unknown>;
}

export interface MaterialBaselineComponent {
  readonly materialId: string;
  readonly name: string;
  readonly revision: string;
  readonly properties: Record<string, number | string>;
  readonly propertySource: string;
  readonly databaseVersion?: string;
}

export interface ParameterDefinition {
  readonly name: string;
  readonly value: number | string | boolean;
  readonly unit: string;
  readonly revision: string;
  readonly source: string;
  readonly tolerance?: {
    readonly lowerBound?: number;
    readonly upperBound?: number;
  };
}

export interface ParameterBaselineComponent {
  readonly parameterSetId: string;
  readonly revision: string;
  readonly parameters: readonly ParameterDefinition[];
}

export interface SimulationModelBaselineComponent {
  readonly modelId: string;
  readonly name: string;
  readonly revision: string;
  readonly physicsDomain: string;
  readonly governingConfig: Record<string, unknown>;
  readonly referencedGeometryId: string;
  readonly referencedMaterialIds: readonly string[];
  readonly modelParameters: Record<string, unknown>;
}

export interface MeshBaselineComponent {
  readonly meshId: string;
  readonly revision: string;
  readonly generationMethod: string;
  readonly meshParameters: Record<string, unknown>;
  readonly referencedGeometryId: string;
  readonly meshHash: string;
  readonly elementCount?: number;
  readonly nodeCount?: number;
}

export interface SolverBaselineComponent {
  readonly solverId: string;
  readonly name: string;
  readonly version: string;
  readonly solverConfig: Record<string, unknown>;
  readonly numericalMethod: string;
  readonly convergenceCriteria: Record<string, number>;
  readonly tolerances: Record<string, number>;
  readonly linearSolverConfig?: Record<string, unknown>;
}

export interface ControlsBaselineComponent {
  readonly controlId: string;
  readonly name: string;
  readonly revision: string;
  readonly controlParameters: Record<string, unknown>;
  readonly controlConfig: Record<string, unknown>;
  readonly referencedModelId?: string;
}

export interface ManufacturingOperation {
  readonly opId: string;
  readonly name: string;
  readonly type: string;
  readonly parameters?: Record<string, unknown>;
}

export interface ManufacturingDefinitionBaselineComponent {
  readonly manufacturingId: string;
  readonly revision: string;
  readonly bomReference: string;
  readonly processDefinition: Record<string, unknown>;
  readonly operations: readonly ManufacturingOperation[];
  readonly camToolpathReferences?: readonly string[];
  readonly materialDependencies?: readonly string[];
}

export interface BaselineDependencyNode {
  readonly nodeId: string;
  readonly componentType:
    | 'CAD'
    | 'MATERIALS'
    | 'PARAMETERS'
    | 'SIMULATION_MODELS'
    | 'MESH'
    | 'SOLVER'
    | 'CONTROLS'
    | 'MANUFACTURING_DEFINITION';
  readonly artifactId: string;
  readonly revision: string;
}

export interface BaselineDependencyEdge {
  readonly edgeId: string;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly relationship: string;
}

export interface BaselineDependencyGraph {
  readonly nodes: readonly BaselineDependencyNode[];
  readonly edges: readonly BaselineDependencyEdge[];
}

export interface BaselineProvenance {
  readonly creator: string;
  readonly createdAt: string;
  readonly sourceArtifacts: Record<string, string>;
  readonly artifactRevisions: Record<string, string>;
  readonly configurationRevision: string;
  readonly parentBaselineId?: string;
  readonly contentHash?: string;
}

export interface EngineeringConfigurationBaselineData {
  readonly baselineId: string;
  readonly productId: string;
  readonly productRevision: string;
  readonly configurationRevision: string;
  readonly status: BaselineStatus;
  readonly createdAt: string;
  readonly createdBy: string;

  readonly cad: CadBaselineComponent;
  readonly materials: readonly MaterialBaselineComponent[];
  readonly parameters: ParameterBaselineComponent;
  readonly simulationModels: readonly SimulationModelBaselineComponent[];
  readonly mesh: MeshBaselineComponent;
  readonly solver: SolverBaselineComponent;
  readonly controls: ControlsBaselineComponent;
  readonly manufacturingDefinition: ManufacturingDefinitionBaselineComponent;

  readonly dependencyGraph: BaselineDependencyGraph;
  readonly provenance: BaselineProvenance;
  readonly contentHash?: string;
  readonly isFrozen?: boolean;
}

export class ConfigurationBaselineValidationError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string = 'BASELINE_VALIDATION_ERROR',
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ConfigurationBaselineValidationError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ConfigurationBaselineValidationError.prototype);
  }
}

export interface DriftDetail {
  readonly component: string;
  readonly field: string;
  readonly expected: unknown;
  readonly actual: unknown;
  readonly message: string;
}

export interface BaselineDriftReport {
  readonly baselineId: string;
  readonly targetBaselineId?: string;
  readonly isDriftDetected: boolean;
  readonly driftedComponents: readonly string[];
  readonly details: readonly DriftDetail[];
  readonly timestamp: string;
}

export interface EPC004ValidationResult {
  readonly epc: 'EPC-004';
  readonly name: 'Engineering Configuration Baseline';
  readonly verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  readonly checks: Record<string, boolean>;
  readonly evidenceHash: string;
  readonly timestamp: string;
  readonly implementationRevision: string;
}
