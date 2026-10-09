/**
 * SECP Industrial OS v3 — PATCH-181: Engineering Data OS Types
 * Unified domain models for Enterprise Product Lifecycle Management,
 * Design-in-Context, Revision Branching, ECOs, Approval Workflows,
 * Configuration Management, Cross-System Impact Analysis, and Digital Signatures.
 */

export type ReleaseLifecycleState = 
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'VERIFIED'
  | 'APPROVED'
  | 'RELEASED'
  | 'OBSOLETE'
  | 'SUPERSEDED'
  | 'REJECTED'
  | 'INVALIDATED';

export type EngineeringDomainType =
  | 'PROJECT'
  | 'PRODUCT'
  | 'ASSEMBLY'
  | 'PART'
  | 'FEATURE'
  | 'DRAWING'
  | 'MATERIAL'
  | 'SIMULATION_FEM'
  | 'SIMULATION_CFD'
  | 'SIMULATION_THERMAL'
  | 'CAM_TOOLPATH'
  | 'NC_PROGRAM'
  | 'MANUFACTURING_OPERATION'
  | 'BOM'
  | 'CONFIGURATION'
  | 'CERTIFICATE'
  | 'SPECIFICATION';

export interface EngineeringObject {
  objectId: string;
  domain: EngineeringDomainType;
  name: string;
  description: string;
  projectCode: string;
  productLine: string;
  activeRevisionId: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, any>;
  tags: string[];
}

export interface RevisionNode {
  revisionId: string;
  objectId: string;
  revisionLabel: string; // e.g. "REV-A", "REV-B.1-EXP", "REV-C"
  versionSequence: number;
  branchName: string; // e.g. "master", "feat/aerospace-lightweight", "experimental/ti-mesh"
  parentRevisionId?: string;
  secondaryParentId?: string; // For 3-way merge
  state: ReleaseLifecycleState;
  author: string;
  timestamp: string;
  commitMessage: string;
  contentHash: string; // SHA-256 hash of engineering definition/geometry/parameters
  dependencyHash: string;
  isImmutable: boolean; // Once RELEASED/APPROVED, cannot be modified
  digitalSignature?: DigitalSignature;
  properties: Record<string, any>;
}

export interface RevisionBranch {
  branchName: string;
  objectId: string;
  headRevisionId: string;
  baseRevisionId: string;
  isProtected: boolean;
  createdAt: string;
  createdBy: string;
}

export interface DigitalSignature {
  signatureId: string;
  targetRevisionId: string;
  signerIdentity: string;
  signerRole: 'LEAD_ENGINEER' | 'VERIFICATION_SPECIALIST' | 'QUALITY_DIRECTOR' | 'CHIEF_ENGINEER' | 'SYSTEM_ADMIN';
  timestamp: string;
  signedContentHash: string;
  cryptographicSignatureHex: string;
  isValid: boolean;
  invalidationReason?: string;
}

export interface ApprovalStep {
  stepIndex: number;
  stepName: string;
  requiredRole: 'LEAD_ENGINEER' | 'VERIFICATION_SPECIALIST' | 'QUALITY_DIRECTOR' | 'CHIEF_ENGINEER';
  assignedApprover?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED' | 'REWORK_REQUESTED';
  isParallel: boolean;
  decidedBy?: string;
  decidedAt?: string;
  comments?: string;
  signature?: DigitalSignature;
}

export interface ApprovalWorkflow {
  workflowId: string;
  targetObjectId: string;
  targetRevisionId: string;
  targetType: 'ECO' | 'RELEASE_BASELINE' | 'REVISION';
  steps: ApprovalStep[];
  currentStepIndex: number;
  overallStatus: 'DRAFT' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' | 'REWORK';
  startedAt: string;
  completedAt?: string;
  escalationPolicy?: {
    timeoutHours: number;
    escalateToRole: string;
  };
}

export interface ChangeRequestItem {
  itemId: string;
  targetObjectId: string;
  targetDomain: EngineeringDomainType;
  changeType: 'ADD' | 'MODIFY' | 'REPLACE' | 'OBSOLETE' | 'PARAMETER_UPDATE';
  proposedRevision: string;
  description: string;
  reason: string;
  currentValue?: any;
  proposedValue?: any;
}

export interface EngineeringChangeOrder {
  ecoId: string;
  ecoNumber: string; // e.g. "ECO-2026-0811"
  title: string;
  description: string;
  changeReason: 'DESIGN_OPTIMIZATION' | 'DEFECT_CORRECTION' | 'WEIGHT_REDUCTION' | 'COST_REDUCTION' | 'SUPPLIER_OBSOLESCENCE' | 'REGULATORY_COMPLIANCE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL_URGENT';
  author: string;
  createdAt: string;
  status: 'PROPOSED' | 'IMPACT_ANALYSIS' | 'UNDER_REVIEW' | 'VERIFYING' | 'APPROVED' | 'IMPLEMENTED' | 'REJECTED' | 'CLOSED';
  changeRequests: ChangeRequestItem[];
  affectedObjectIds: string[];
  workflowId?: string;
  verificationRequirements: {
    femReanalysisRequired: boolean;
    cfdReanalysisRequired: boolean;
    camRegenerationRequired: boolean;
    drawingUpdateRequired: boolean;
    pmiValidationRequired: boolean;
    bomRecalculationRequired: boolean;
  };
  impactSummary?: ImpactAnalysisReport;
  approvedBy?: string;
  approvedAt?: string;
  releaseBaselineId?: string;
}

export interface BOMItem {
  itemNumber: number;
  partNumber: string;
  partName: string;
  revision: string;
  quantity: number;
  unit: 'EA' | 'MM' | 'KG' | 'SET';
  materialSpec: string;
  supplierCode: string;
  unitCostUSD: number;
  isOptional: boolean;
  substitutePartNumbers?: string[];
  subAssemblyId?: string;
  level: number;
  effectivity?: {
    startDate?: string;
    endDate?: string;
    serialStart?: number;
    serialEnd?: number;
  };
}

export interface BillOfMaterials {
  bomId: string;
  productId: string;
  productName: string;
  revision: string;
  configurationId?: string;
  items: BOMItem[];
  totalPartCount: number;
  totalUniqueParts: number;
  totalCostUSD: number;
  isFrozen: boolean;
}

export interface BOMDiffChange {
  changeType: 'ADDED' | 'REMOVED' | 'QTY_MODIFIED' | 'REV_CHANGED' | 'MATERIAL_CHANGED' | 'SUPPLIER_CHANGED' | 'SUBSTITUTE_CHANGED';
  partNumber: string;
  partName: string;
  oldValue?: any;
  newValue?: any;
  costDeltaUSD: number;
  weightDeltaKg: number;
  severity: 'INFO' | 'MODERATE' | 'CRITICAL';
}

export interface BOMDiffResult {
  sourceRevision: string;
  targetRevision: string;
  sourceConfig?: string;
  targetConfig?: string;
  changes: BOMDiffChange[];
  totalAdded: number;
  totalRemoved: number;
  totalModified: number;
  netCostDeltaUSD: number;
  engineeringImpactSummary: string[];
}

export interface EffectivityRule {
  ruleId: string;
  type: 'DATE_RANGE' | 'SERIAL_RANGE' | 'LOT_NUMBER' | 'BLOCK_NUMBER';
  startValue: string | number;
  endValue?: string | number;
  description: string;
}

export interface ProductConfiguration {
  configId: string;
  productId: string;
  configCode: string; // e.g. "CFG-AERO-EXTREME", "CFG-STD-150KW"
  name: string;
  description: string;
  baseRevision: string;
  variantOptions: Record<string, string>; // featureKey -> optionValue
  effectivityRules: EffectivityRule[];
  activeBOMId: string;
  state: ReleaseLifecycleState;
  createdAt: string;
}

export interface EngineeringBaseline {
  baselineId: string;
  name: string;
  productId: string;
  configurationId: string;
  targetRevision: string;
  snapshotTimestamp: string;
  frozenArtifacts: {
    cadRevision: string;
    cadHash: string;
    bomRevision: string;
    bomHash: string;
    drawingsRevision: string;
    materialRevision: string;
    femSimulationRevision?: string;
    cfdSimulationRevision?: string;
    camToolpathRevision?: string;
    ncProgramRevision?: string;
  };
  approvalSignatures: DigitalSignature[];
  merkleRootHash: string;
  isImmutable: boolean;
}

export interface DependencyLink {
  sourceObjectId: string;
  sourceRevisionId: string;
  targetObjectId: string;
  targetRevisionId: string;
  relationType: 
    | 'CONTAINS_COMPONENT'
    | 'DERIVES_FROM_CAD'
    | 'SIMULATES_GEOMETRY'
    | 'GENERATES_TOOLPATH'
    | 'DRAWS_PART'
    | 'ASSIGNS_MATERIAL'
    | 'INCLUDED_IN_BOM'
    | 'CONSTRAINS_FEATURE'
    | 'CONFIGURES_VARIANT';
  isStrict: boolean; // If strict, any revision change in target invalidates source
}

export interface ImpactAnalysisReport {
  rootSourceObjectId: string;
  rootSourceRevisionId: string;
  changeSummary: string;
  affectedAssemblies: { objectId: string; name: string; revision: string }[];
  affectedDrawings: { objectId: string; name: string; currentStatus: ReleaseLifecycleState }[];
  affectedSimulations: { objectId: string; domain: string; status: 'VALID' | 'INVALIDATED' | 'REQUIRES_RECALCULATION' }[];
  affectedCAMToolpaths: { objectId: string; toolpathName: string; status: 'VALID' | 'OUTDATED' }[];
  affectedConfigurations: { configId: string; configCode: string }[];
  bomImpact: {
    costImpactUSD: number;
    partsChangedCount: number;
  };
  manufacturingImpact: {
    toolingChangeRequired: boolean;
    ncReprogrammingRequired: boolean;
    estimatedLeadTimeImpactDays: number;
  };
  releaseBlockers: string[];
  recommendedAction: string;
}

export interface DataLineageRecord {
  objectId: string;
  revisionId: string;
  originatingSystem: string;
  createdBy: string;
  createdAt: string;
  modificationHistory: {
    revision: string;
    author: string;
    timestamp: string;
    changeReason: string;
    contentHash: string;
  }[];
  passedVerificationGates: string[];
  approvals: {
    role: string;
    signer: string;
    timestamp: string;
  }[];
  associatedConfigurations: string[];
  associatedECOs: string[];
}

export interface AuditTrailEvent {
  eventId: string;
  timestamp: string;
  actorId: string;
  actorRole: string;
  action: 'CREATE_REVISION' | 'BRANCH' | 'MERGE' | 'SIGN' | 'APPROVE' | 'REJECT' | 'INVALIDATE' | 'CREATE_BASELINE' | 'RELEASE_CONFIG' | 'UPDATE_BOM';
  targetObjectId: string;
  targetRevisionId: string;
  previousState?: string;
  newState: string;
  changeDetails: Record<string, any>;
  eventHash: string;
  previousEventHash: string; // Merkle chain link
}
