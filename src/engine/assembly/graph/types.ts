/**
 * PATCH-113: Assembly Graph Engine Types
 * SECP Industrial OS v2 - Engineering Truth
 * 
 * Strict separation of:
 * - Part Definition vs Part Occurrence
 * - Assembly Definition vs Assembly Occurrence
 * - Hierarchical containment vs Graph relationships
 * - 4x4 Homogeneous Transform determinism
 * - Topological and B-Rep Geometry binding
 * - Constraints, Interfaces & Kinematic Foundations
 * - Configuration, Revision, Lifecycle and Provenance
 */

// ==========================================
// 1. Core Enumerations
// ==========================================

export enum AssemblyNodeType {
  ROOT_ASSEMBLY = "ROOT_ASSEMBLY",
  SUBASSEMBLY = "SUBASSEMBLY",
  PART = "PART",
  COMPONENT = "COMPONENT",
  VIRTUAL_COMPONENT = "VIRTUAL_COMPONENT",
  REFERENCE_COMPONENT = "REFERENCE_COMPONENT",
  SKELETON = "SKELETON",
  LAYOUT = "LAYOUT",
  DATUM = "DATUM",
  FASTENER = "FASTENER",
  TOOLING = "TOOLING",
  FIXTURE = "FIXTURE"
}

export enum AssemblyEdgeType {
  CONTAINS = "CONTAINS",
  INSTANCE_OF = "INSTANCE_OF",
  REFERENCES = "REFERENCES",
  CONSTRAINS = "CONSTRAINS",
  ATTACHED_TO = "ATTACHED_TO",
  CONNECTED_TO = "CONNECTED_TO",
  DEPENDS_ON = "DEPENDS_ON",
  DERIVED_FROM = "DERIVED_FROM",
  ALIGNED_WITH = "ALIGNED_WITH",
  MATED_WITH = "MATED_WITH",
  INTERFACES_WITH = "INTERFACES_WITH",
  SUPPRESSED_BY = "SUPPRESSED_BY",
  REPLACED_BY = "REPLACED_BY"
}

export enum OccurrenceConfigurationState {
  ACTIVE = "ACTIVE",
  SUPPRESSED = "SUPPRESSED",
  EXCLUDED = "EXCLUDED",
  OPTIONAL = "OPTIONAL",
  VARIANT = "VARIANT",
  OBSOLETE = "OBSOLETE"
}

export enum AssemblyLifecycleState {
  DRAFT = "DRAFT",
  IN_REVIEW = "IN_REVIEW",
  RELEASED = "RELEASED",
  OBSOLETE = "OBSOLETE",
  RETIRED = "RETIRED"
}

export enum ConstraintStatus {
  VALID = "VALID",
  INVALID = "INVALID",
  UNRESOLVED = "UNRESOLVED",
  SUPPRESSED = "SUPPRESSED",
  DISABLED = "DISABLED"
}

export enum ConstraintType {
  COINCIDENT = "COINCIDENT",
  CONCENTRIC = "CONCENTRIC",
  PARALLEL = "PARALLEL",
  PERPENDICULAR = "PERPENDICULAR",
  DISTANCE = "DISTANCE",
  ANGLE = "ANGLE",
  TANGENT = "TANGENT",
  FIXED = "FIXED",
  GEAR = "GEAR",
  RACK_PINION = "RACK_PINION",
  SCREW = "SCREW",
  SYMMETRIC = "SYMMETRIC"
}

export enum InterfaceType {
  CONTACT = "CONTACT",
  MOUNTING = "MOUNTING",
  FASTENING = "FASTENING",
  ALIGNMENT = "ALIGNMENT",
  ROTATIONAL = "ROTATIONAL",
  TRANSLATIONAL = "TRANSLATIONAL",
  ELECTRICAL = "ELECTRICAL",
  FLUID = "FLUID",
  THERMAL = "THERMAL",
  STRUCTURAL = "STRUCTURAL"
}

export enum JointType {
  FIXED = "FIXED",
  REVOLUTE = "REVOLUTE",
  PRISMATIC = "PRISMATIC",
  CYLINDRICAL = "CYLINDRICAL",
  SPHERICAL = "SPHERICAL",
  PLANAR = "PLANAR",
  UNIVERSAL = "UNIVERSAL"
}

export enum ValidationSeverity {
  INFO = "INFO",
  WARNING = "WARNING",
  ERROR = "ERROR",
  CRITICAL = "CRITICAL"
}

export enum AssemblyErrorCode {
  CONTAINMENT_CYCLE = "CONTAINMENT_CYCLE",
  MISSING_PART_DEFINITION = "MISSING_PART_DEFINITION",
  INVALID_PARENT_REFERENCE = "INVALID_PARENT_REFERENCE",
  DUPLICATE_OCCURRENCE_ID = "DUPLICATE_OCCURRENCE_ID",
  DUPLICATE_NODE_ID = "DUPLICATE_NODE_ID",
  DUPLICATE_EDGE_ID = "DUPLICATE_EDGE_ID",
  ORPHAN_OCCURRENCE = "ORPHAN_OCCURRENCE",
  INVALID_TRANSFORM = "INVALID_TRANSFORM",
  INVALID_REVISION_REFERENCE = "INVALID_REVISION_REFERENCE",
  BROKEN_REFERENCE = "BROKEN_REFERENCE",
  BROKEN_CRITICAL_REFERENCE = "BROKEN_CRITICAL_REFERENCE",
  INVALID_CONFIGURATION = "INVALID_CONFIGURATION",
  CONCURRENT_MODIFICATION = "CONCURRENT_MODIFICATION",
  TAMPERED_GRAPH = "TAMPERED_GRAPH",
  INVALID_HASH = "INVALID_HASH",
  UNIT_MISMATCH = "UNIT_MISMATCH",
  UNKNOWN_ERROR = "UNKNOWN_ERROR"
}

export enum ComponentDiffType {
  ADDED_COMPONENT = "ADDED_COMPONENT",
  REMOVED_COMPONENT = "REMOVED_COMPONENT",
  REPLACED_COMPONENT = "REPLACED_COMPONENT",
  MOVED_COMPONENT = "MOVED_COMPONENT",
  REVISION_CHANGED = "REVISION_CHANGED",
  CONSTRAINT_CHANGED = "CONSTRAINT_CHANGED",
  INTERFACE_CHANGED = "INTERFACE_CHANGED",
  CONFIGURATION_CHANGED = "CONFIGURATION_CHANGED"
}

// ==========================================
// 2. Geometry & Mathematical Structures
// ==========================================

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface BoundingBox3D {
  min: Vector3D;
  max: Vector3D;
}

/**
 * 4x4 Homogeneous Transformation Matrix
 * Column-major 16-element array [m00, m10, m20, m30, m01, m11, ...]
 * or 4x4 array of numbers.
 * P_world = T * P_local
 */
export type Matrix4x4 = [
  [number, number, number, number],
  [number, number, number, number],
  [number, number, number, number],
  [number, number, number, number]
];

export interface TransformDefinition {
  translation: Vector3D;
  rotationEulerDeg?: Vector3D; // XYZ order
  rotationQuaternion?: { x: number; y: number; z: number; w: number };
  matrix: Matrix4x4;
}

export interface UnitSystemConfig {
  unitSystem: "SI" | "IMPERIAL" | "CUSTOM";
  lengthUnit: "mm" | "cm" | "m" | "inch" | "ft";
  angleUnit: "deg" | "rad";
  massUnit: "kg" | "g" | "lb" | "tonne";
}

export interface CoordinateSystemDefinition {
  id: string;
  name: string;
  type: "ASSEMBLY_WORLD" | "PART_LOCAL" | "OCCURRENCE_LOCAL" | "REFERENCE_DATUM";
  origin: Vector3D;
  xAxis: Vector3D;
  yAxis: Vector3D;
  zAxis: Vector3D;
  transform: Matrix4x4;
}

export interface GeometryReference {
  geometryId: string;
  geometryRevision: string;
  geometryHash: string;
  topologyType?: "SOLID" | "SHELL" | "FACE" | "EDGE" | "VERTEX" | "DATUM";
  bRepModelRef?: string;
  nurbsRef?: string;
  meshId?: string;
}

// ==========================================
// 3. Definitions vs Occurrences
// ==========================================

/**
 * Part Definition (Master Asset)
 * Single source of truth for part engineering specifications.
 */
export interface PartDefinition {
  partId: string;
  partRevision: string;
  name: string;
  description?: string;
  unitSystem: UnitSystemConfig;
  geometryReference: GeometryReference;
  materialId?: string;
  materialName?: string;
  massKg: number;
  centerOfMassLocal: Vector3D;
  boundingBoxLocal: BoundingBox3D;
  isFlexible: boolean;
  lifecycleState: AssemblyLifecycleState;
  metadata?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

/**
 * Occurrence Identity & State
 * Represents a single physical instance in the assembly hierarchy.
 */
export interface AssemblyOccurrence {
  occurrenceId: string;
  name: string;
  nodeType: AssemblyNodeType;
  partId: string;
  partRevision: string;
  assemblyId: string;
  assemblyRevision: string;
  parentOccurrenceId: string | null; // null for root occurrence
  instancePath: string; // e.g. "A-001/O-001/O-007"
  localTransform: TransformDefinition;
  worldTransform: TransformDefinition;
  configurationState: OccurrenceConfigurationState;
  lifecycleState: AssemblyLifecycleState;
  geometryReference: GeometryReference;
  customParameters?: Record<string, number | string | boolean>;
  isFixed: boolean;
  metadata?: Record<string, any>;
}

// ==========================================
// 4. Graph Nodes & Edges
// ==========================================

export interface AssemblyNode {
  nodeId: string;
  nodeType: AssemblyNodeType;
  name: string;
  partId?: string;
  partRevision?: string;
  assemblyId: string;
  assemblyRevision: string;
  occurrenceId: string;
  parentOccurrenceId: string | null;
  geometryReference?: GeometryReference;
  transformReference?: TransformDefinition;
  configurationState: OccurrenceConfigurationState;
  lifecycleState: AssemblyLifecycleState;
  isLeaf: boolean;
  metadata?: Record<string, any>;
}

export interface AssemblyEdge {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: AssemblyEdgeType;
  edgeRevision: string;
  sourceOccurrenceId?: string;
  targetOccurrenceId?: string;
  metadata?: Record<string, any>;
}

// ==========================================
// 5. Constraints, Interfaces & Kinematics
// ==========================================

export interface ConstraintGeometryReference {
  occurrenceId: string;
  geometryId?: string;
  topologyType?: "FACE" | "EDGE" | "VERTEX" | "AXIS" | "PLANE";
  topologyCanonicalPath?: string;
  coordinateSystemId?: string;
}

export interface AssemblyConstraint {
  constraintId: string;
  name: string;
  constraintType: ConstraintType;
  sourceOccurrenceId: string;
  targetOccurrenceId: string;
  sourceRef: ConstraintGeometryReference;
  targetRef: ConstraintGeometryReference;
  offsetMm?: number;
  angleDeg?: number;
  minLimit?: number;
  maxLimit?: number;
  status: ConstraintStatus;
  isFlipped?: boolean;
  metadata?: Record<string, any>;
}

export interface AssemblyInterface {
  interfaceId: string;
  name: string;
  interfaceType: InterfaceType;
  sourceOccurrenceId: string;
  targetOccurrenceId: string;
  sourceGeometryRefs: ConstraintGeometryReference[];
  targetGeometryRefs: ConstraintGeometryReference[];
  status: "ACTIVE" | "PENDING_VERIFICATION" | "SUPPRESSED" | "INVALID";
  fastenerReference?: {
    fastenerOccurrenceId: string;
    fastenerPartId: string;
    nominalDiameterMm?: number;
    tighteningTorqueNm?: number;
  };
  metadata?: Record<string, any>;
}

export interface AssemblyKinematicJoint {
  jointId: string;
  name: string;
  jointType: JointType;
  parentOccurrenceId: string;
  childOccurrenceId: string;
  dofCount: number;
  currentValue: number; // mm or deg
  minLimit?: number;
  maxLimit?: number;
  actuatorType?: "PASSIVE" | "MOTORIZED" | "SERVO" | "HYDRAULIC";
  axisVector?: Vector3D;
  pivotPoint?: Vector3D;
}

// ==========================================
// 6. Configurations & Snapshots
// ==========================================

export interface AssemblyConfiguration {
  configurationId: string;
  name: string;
  description?: string;
  isDefault: boolean;
  occurrenceStates: Record<string, OccurrenceConfigurationState>;
  parameterOverrides: Record<string, Record<string, number | string | boolean>>;
  suppressedConstraints: string[];
  suppressedInterfaces: string[];
}

export interface AssemblyDependencySnapshot {
  snapshotId: string;
  assemblyId: string;
  assemblyRevision: string;
  componentIds: string[];
  componentRevisions: Record<string, string>;
  dependencyHash: string;
  createdAt: number;
}

export interface AssemblySnapshot {
  snapshotId: string;
  assemblyId: string;
  assemblyRevision: string;
  graphHash: string;
  nodeCount: number;
  edgeCount: number;
  occurrenceCount: number;
  configurationId: string;
  timestamp: number;
  validatorVersion: string;
  fingerprint: string;
}

export interface AssemblyProvenance {
  createdBy: string;
  createdAt: number;
  source: string;
  sourceRevision: string;
  parentRevision?: string;
  changeSetDescription: string;
  signature?: string;
}

export interface AssemblyAuditRecord {
  assemblyChangeId: string;
  assemblyId: string;
  actorId: string;
  timestamp: number;
  operation: "CREATE" | "ADD_OCCURRENCE" | "UPDATE_OCCURRENCE" | "DELETE_OCCURRENCE" | "ADD_CONSTRAINT" | "UPDATE_CONSTRAINT" | "ADD_INTERFACE" | "UPDATE_CONFIGURATION" | "RELEASE_REVISION";
  beforeHash: string;
  afterHash: string;
  details?: Record<string, any>;
}

// ==========================================
// 7. Validation & Forensic Structures
// ==========================================

export interface AssemblyValidationError {
  errorCode: AssemblyErrorCode;
  severity: ValidationSeverity;
  message: string;
  nodeId?: string;
  occurrenceId?: string;
  edgeId?: string;
  constraintId?: string;
  details?: Record<string, any>;
}

export interface AssemblyValidationReport {
  assemblyId: string;
  assemblyRevision: string;
  graphValid: boolean;
  totalErrors: number;
  totalWarnings: number;
  nodeErrors: AssemblyValidationError[];
  edgeErrors: AssemblyValidationError[];
  referenceErrors: AssemblyValidationError[];
  transformErrors: AssemblyValidationError[];
  constraintErrors: AssemblyValidationError[];
  configurationErrors: AssemblyValidationError[];
  revisionErrors: AssemblyValidationError[];
  cycleErrors: AssemblyValidationError[];
  orphanErrors: AssemblyValidationError[];
  allErrors: AssemblyValidationError[];
  evaluatedAt: number;
}

export interface AssemblyDiffItem {
  diffType: ComponentDiffType;
  occurrenceId: string;
  partId?: string;
  beforeRevision?: string;
  afterRevision?: string;
  beforeTransform?: Matrix4x4;
  afterTransform?: Matrix4x4;
  beforeState?: string;
  afterState?: string;
  description: string;
}

export interface AssemblyDiffReport {
  assemblyId: string;
  sourceRevision: string;
  targetRevision: string;
  isIdentical: boolean;
  diffItems: AssemblyDiffItem[];
  addedCount: number;
  removedCount: number;
  movedCount: number;
  modifiedCount: number;
}

// ==========================================
// 8. BOM & Physical Structures
// ==========================================

export interface AssemblyBOMItem {
  itemNumber: number;
  partId: string;
  partRevision: string;
  partName: string;
  nodeType: AssemblyNodeType;
  quantity: number;
  occurrenceIds: string[];
  unit: string;
  materialName?: string;
  unitMassKg: number;
  totalMassKg: number;
  isSubassembly: boolean;
  isSuppressed: boolean;
}

export interface AssemblyEngineeringBOM {
  assemblyId: string;
  assemblyRevision: string;
  configurationId: string;
  generatedAt: number;
  totalUniqueParts: number;
  totalQuantity: number;
  totalMassKg: number;
  items: AssemblyBOMItem[];
}

export interface AssemblyPhysicalProperties {
  assemblyId: string;
  assemblyRevision: string;
  totalMassKg: number;
  centerOfMassWorld: Vector3D;
  boundingBoxWorld: BoundingBox3D;
  activeComponentCount: number;
  suppressedComponentCount: number;
}

export interface InterferenceCandidate {
  candidateId: string;
  occurrenceAId: string;
  occurrenceBId: string;
  boundingBoxOverlap: boolean;
  distanceEstimateMm: number;
  candidateType: "CLEARANCE_WARNING" | "POTENTIAL_COLLISION" | "CONTACT_INTERFACE";
}

// ==========================================
// 9. Interop & Import/Export
// ==========================================

export interface AssemblyImportContract {
  sourceFormat: "STEP_AP242" | "JT" | "NATIVE_CAD" | "PLM_JSON";
  sourceFileName: string;
  sourceFileHash: string;
  sourceAssemblyId: string;
  sourceRevision: string;
  importerVersion: string;
  importTimestamp: number;
}

export interface AssemblyImportResult {
  success: boolean;
  contract: AssemblyImportContract;
  assemblyId: string;
  assemblyRevision: string;
  nodeCount: number;
  occurrenceCount: number;
  constraintCount: number;
  graphFingerprint: string;
  validationReport: AssemblyValidationReport;
}

export interface AssemblyExportResult {
  success: boolean;
  targetFormat: "STEP_AP242" | "JT" | "NATIVE_CAD" | "PLM_JSON";
  exportTimestamp: number;
  assemblyId: string;
  assemblyRevision: string;
  data: string;
  exportedGraphHash: string;
}

export interface RoundTripFidelityReport {
  success: boolean;
  formatTested: string;
  originalGraphHash: string;
  reimportedGraphHash: string;
  hashesMatch: boolean;
  nodeCountDelta: number;
  occurrenceCountDelta: number;
  transformFidelityMaxError: number;
  fidelityScorePercent: number;
}
