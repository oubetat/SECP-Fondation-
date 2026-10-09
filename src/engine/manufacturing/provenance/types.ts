/**
 * SECP Industrial OS v2 — PATCH-111 CAM Provenance Types
 * Engineering Truth & Full Digital Thread Lineage
 */

export enum CAMArtifactType {
  CAD_MODEL = "CAD_MODEL",
  CAD_REVISION = "CAD_REVISION",
  MANUFACTURING_FEATURE = "MANUFACTURING_FEATURE",
  MATERIAL = "MATERIAL",
  MACHINE = "MACHINE",
  KINEMATIC_MODEL = "KINEMATIC_MODEL",
  TOOL = "TOOL",
  FIXTURE = "FIXTURE",
  CAM_OPERATION = "CAM_OPERATION",
  TOOLPATH = "TOOLPATH",
  SIMULATION = "SIMULATION",
  POST_PROCESSOR = "POST_PROCESSOR",
  NC_PROGRAM = "NC_PROGRAM",
  GCODE_VERIFICATION = "GCODE_VERIFICATION",
  DIGITAL_TWIN_STATE = "DIGITAL_TWIN_STATE",
  MANUFACTURING_EVIDENCE = "MANUFACTURING_EVIDENCE"
}

export enum ProvenanceEdgeType {
  DERIVED_FROM = "DERIVED_FROM",
  USED = "USED",
  GENERATED = "GENERATED",
  TRANSFORMED_FROM = "TRANSFORMED_FROM",
  SIMULATED_FROM = "SIMULATED_FROM",
  POST_PROCESSED_FROM = "POST_PROCESSED_FROM",
  VERIFIED_FROM = "VERIFIED_FROM",
  EXECUTED_FROM = "EXECUTED_FROM"
}

export enum AgentType {
  HUMAN = "HUMAN",
  CAM_ENGINE = "CAM_ENGINE",
  AI_ENGINE = "AI_ENGINE",
  POST_PROCESSOR = "POST_PROCESSOR",
  SIMULATOR = "SIMULATOR",
  VERIFIER = "VERIFIER",
  SYSTEM = "SYSTEM"
}

export enum ArtifactLifecycleStatus {
  DRAFT = "DRAFT",
  AI_GENERATED = "AI_GENERATED",
  HUMAN_MODIFIED = "HUMAN_MODIFIED",
  PUBLISHED = "PUBLISHED",
  ENGINEERING_VALIDATED = "ENGINEERING_VALIDATED",
  STALE_DERIVATIVE = "STALE_DERIVATIVE",
  RETIRED = "RETIRED",
  SUPERSEDED = "SUPERSEDED",
  REVOKED = "REVOKED"
}

export enum ParameterSource {
  USER_DEFINED = "USER_DEFINED",
  MATERIAL_DATABASE = "MATERIAL_DATABASE",
  TOOL_DATABASE = "TOOL_DATABASE",
  MACHINE_LIMIT = "MACHINE_LIMIT",
  CAM_DEFAULT = "CAM_DEFAULT",
  AI_GENERATED = "AI_GENERATED",
  DERIVED = "DERIVED",
  IMPORTED = "IMPORTED",
  UNKNOWN = "UNKNOWN"
}

export enum ReproducibilityStatus {
  REPRODUCIBLE = "REPRODUCIBLE",
  PARTIALLY_REPRODUCIBLE = "PARTIALLY_REPRODUCIBLE",
  NON_REPRODUCIBLE = "NON_REPRODUCIBLE",
  UNDETERMINED = "UNDETERMINED"
}

export enum CompatibilityVerdict {
  COMPATIBLE = "COMPATIBLE",
  INCOMPATIBLE = "INCOMPATIBLE",
  REQUIRES_REGENERATION = "REQUIRES_REGENERATION",
  UNDETERMINED = "UNDETERMINED"
}

export enum ProvenanceGapType {
  MISSING_PARENT = "MISSING_PARENT",
  MISSING_REVISION = "MISSING_REVISION",
  MISSING_HASH = "MISSING_HASH",
  MISSING_PARAMETER_SOURCE = "MISSING_PARAMETER_SOURCE",
  MISSING_AGENT = "MISSING_AGENT",
  MISSING_ENVIRONMENT = "MISSING_ENVIRONMENT",
  MISSING_MACHINE = "MISSING_MACHINE",
  MISSING_TOOL = "MISSING_TOOL",
  MISSING_MATERIAL = "MISSING_MATERIAL",
  MISSING_SIMULATION = "MISSING_SIMULATION",
  MISSING_VERIFICATION = "MISSING_VERIFICATION",
  MISSING_EXECUTION = "MISSING_EXECUTION"
}

export enum ChangeSignificance {
  COSMETIC = "COSMETIC",
  METADATA_ONLY = "METADATA_ONLY",
  ENGINEERING_RELEVANT = "ENGINEERING_RELEVANT",
  MANUFACTURING_RELEVANT = "MANUFACTURING_RELEVANT",
  VERIFICATION_RELEVANT = "VERIFICATION_RELEVANT",
  CRITICAL = "CRITICAL"
}

export enum ProvenanceVerdict {
  PROVENANCE_COMPLETE = "PROVENANCE_COMPLETE",
  PROVENANCE_GAP = "PROVENANCE_GAP",
  ORPHAN_PROVENANCE = "ORPHAN_PROVENANCE",
  STALE_DERIVATIVE = "STALE_DERIVATIVE",
  PROVENANCE_INTEGRITY_FAILURE = "PROVENANCE_INTEGRITY_FAILURE",
  REPRODUCTION_MISMATCH = "REPRODUCTION_MISMATCH",
  COMPATIBLE = "COMPATIBLE",
  INCOMPATIBLE = "INCOMPATIBLE",
  REQUIRES_REGENERATION = "REQUIRES_REGENERATION",
  APPROVAL_INVALIDATED = "APPROVAL_INVALIDATED",
  RETROSPECTIVE_RECORD = "RETROSPECTIVE_RECORD",
  RECONSTRUCTION_INCOMPLETE = "RECONSTRUCTION_INCOMPLETE",
  INVALID = "INVALID",
  UNDETERMINED = "UNDETERMINED"
}

export interface CAMProvenanceContract {
  provenanceId: string;
  projectId: string;
  manufacturingJobId: string;
  provenanceRevision: number;
  rootArtifactId: string;
  rootRevision: string;
  provenancePolicyId: string;
  hashPolicyId: string;
  identityPolicyId: string;
  retentionPolicyId: string;
}

export interface RootArtifactIdentity {
  rootArtifactId: string;
  rootArtifactType: CAMArtifactType;
  rootRevision: string;
  rootFingerprint: string;
  createdAt: string;
}

export interface CAMArtifactIdentity {
  artifactId: string;
  artifactType: CAMArtifactType;
  artifactRevision: string;
  artifactFingerprint: string;
  createdAt: string;
  createdBy: string;
  sourceSystem: string;
}

export interface RevisionIdentity {
  revisionId: string;
  parentRevisionId?: string;
  revisionNumber: number;
  revisionFingerprint: string;
  changeReason: string;
  status: ArtifactLifecycleStatus;
}

export interface CAMTransformationRecord {
  transformationId: string;
  inputArtifactIds: string[];
  outputArtifactId: string;
  algorithmId: string;
  algorithmRevision: string;
  parametersHash: string;
  configurationHash: string;
  agentId: string;
  timestamp: string;
  environmentFingerprint: string;
}

export interface AgentIdentity {
  agentType: AgentType;
  agentId: string;
  agentRevision: string;
  authorId?: string;
  role?: string;
  modelId?: string;
  modelRevision?: string;
  promptPolicyId?: string;
  parameterPolicyId?: string;
  executionId?: string;
}

export interface ParameterProvenance {
  parameterName: string;
  value: any;
  source: ParameterSource;
  policyId?: string;
  policyRevision?: string;
  isExplicit: boolean;
}

export interface ToolProvenance {
  toolId: string;
  toolRevision: string;
  toolGeometryHash: string;
  toolAssemblyHash: string;
  toolMaterial: string;
  diameter: number;
  length: number;
  holder: string;
}

export interface MachineProvenance {
  machineId: string;
  machineRevision: string;
  machineProfileHash: string;
  controllerProfileHash: string;
  kinematicModelHash: string;
}

export interface FixtureProvenance {
  fixtureId: string;
  fixtureRevision: string;
  fixtureGeometryHash: string;
  fixtureConfigurationHash: string;
}

export interface MaterialProvenance {
  materialId: string;
  materialRevision: string;
  materialQualification: string;
  materialState: string;
  materialPropertySetHash: string;
}

export interface FeatureProvenance {
  featureId: string;
  featureRevision: string;
  featureType: string;
  featureGeometryHash: string;
}

export interface CAMOperationProvenance {
  operationId: string;
  operationRevision: string;
  featureIds: string[];
  toolId: string;
  machineId: string;
  strategyId: string;
  parameterSetHash: string;
  inputGeometryHash: string;
  outputToolpathHash: string;
  parameters: ParameterProvenance[];
}

export interface StrategyProvenance {
  strategyId: string;
  strategyRevision: string;
  algorithmId: string;
  algorithmRevision: string;
  configurationHash: string;
}

export interface ToolpathProvenance {
  toolpathId: string;
  toolpathRevision: string;
  sourceOperationIds: string[];
  toolpathHash: string;
  generationAlgorithm: string;
  algorithmRevision: string;
  generationParametersHash: string;
  pointCount: number;
  totalLengthMM: number;
}

export interface SimulationProvenance {
  simulationId: string;
  simulationRevision: string;
  toolpathHash: string;
  machineHash: string;
  toolHash: string;
  stockHash: string;
  fixtureHash: string;
  simulationPolicyHash: string;
  simulationEngineRevision: string;
  verdict: string;
}

export interface PostProcessorProvenance {
  postProcessorId: string;
  postProcessorRevision: string;
  controllerProfileId: string;
  controllerProfileRevision: string;
  inputToolpathHash: string;
  postConfigurationHash: string;
  outputNC_Hash: string;
}

export interface GCodeProvenance {
  ncProgramId: string;
  ncRevision: string;
  sourceToolpathHash: string;
  postProcessorRevision: string;
  ncHash: string;
  lineCount: number;
}

export interface VerificationProvenance {
  verificationId: string;
  verificationRevision: string;
  ncHash: string;
  verificationEngineRevision: string;
  verificationPolicyHash: string;
  verdict: string;
}

export interface DigitalTwinProvenance {
  twinId: string;
  twinRevision: string;
  machineId: string;
  machineRevision: string;
  stateHash: string;
  executionTimestamp: number;
}

export interface ExecutionProvenance {
  executionId: string;
  machineId: string;
  programHash: string;
  startTime: number;
  endTime?: number;
  operatorReference: string;
  twinRevision: string;
  reconciliationVerdict: string;
}

export interface CAMEnvironmentFingerprint {
  camEngineHash: string;
  geometryKernelHash: string;
  simulationEngineHash: string;
  postProcessorHash: string;
  dependencyLockHash: string;
  configurationHash: string;
  os: string;
  runtime: string;
}

export interface ProvenanceNode {
  identity: CAMArtifactIdentity;
  revision: RevisionIdentity;
  payload: {
    content: any;
    metadata: any;
    configuration: any;
  };
  contentHash: string;
  metadataHash: string;
  agent: AgentIdentity;
  status: ArtifactLifecycleStatus;
  isRoot: boolean;
}

export interface ProvenanceEdge {
  edgeId: string;
  sourceArtifactId: string;
  targetArtifactId: string;
  type: ProvenanceEdgeType;
  transformationId?: string;
  timestamp: string;
}

export interface ProvenanceTimelineEvent {
  eventId: string;
  eventSequence: number;
  artifactId: string;
  action: string;
  agent: AgentIdentity;
  sourceTimestamp: number;
  recordedTimestamp: number;
  recordingMode: "ORIGINAL" | "RETROSPECTIVE";
  payloadHash: string;
  previousEventHash: string;
  currentEventHash: string;
}

export interface ApprovalRecord {
  approvalId: string;
  artifactId: string;
  artifactHash: string;
  approverId: string;
  approverRole: string;
  timestamp: string;
  decision: "APPROVED" | "REJECTED" | "INVALIDATED";
  signature: string;
  invalidationReason?: string;
}

export interface ForensicQueryResponse {
  artifactId: string;
  originCADRevision: string;
  assumedMaterial: string;
  targetTool: string;
  targetMachine: string;
  simulationVerdict: string;
  generatedGCodeHash: string;
  verificationVerdict: string;
  executionTwinStateHash: string;
  isVerified: boolean;
  isTwinSynchronized: boolean;
  completeLineage: boolean;
}

export interface HardAcceptanceResult111 {
  passed: boolean;
  scorePercentage: number;
  totalChecks: number;
  passedChecks: number;
  verdict: ProvenanceVerdict;
  timestamp: string;
  details: { checkName: string; status: "PASS" | "FAIL"; evidence: string }[];
}
