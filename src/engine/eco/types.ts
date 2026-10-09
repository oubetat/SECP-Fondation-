export enum ECRStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  UNDER_REVIEW = "UNDER_REVIEW",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
  CONVERTED_TO_ECO = "CONVERTED_TO_ECO"
}

export enum ChangeReason {
  DESIGN_ERROR = "DESIGN_ERROR",
  PERFORMANCE = "PERFORMANCE",
  SAFETY = "SAFETY",
  MANUFACTURING = "MANUFACTURING",
  COST = "COST",
  MATERIAL = "MATERIAL",
  REGULATORY = "REGULATORY",
  CUSTOMER_REQUIREMENT = "CUSTOMER_REQUIREMENT",
  SUPPLIER_CHANGE = "SUPPLIER_CHANGE",
  QUALITY = "QUALITY",
  MAINTENANCE = "MAINTENANCE",
  OBSOLESCENCE = "OBSOLESCENCE",
  FIELD_FAILURE = "FIELD_FAILURE",
  OTHER = "OTHER"
}

export enum Priority {
  LOW = "LOW",
  NORMAL = "NORMAL",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL"
}

export enum ECOStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  IMPACT_ANALYSIS = "IMPACT_ANALYSIS",
  UNDER_REVIEW = "UNDER_REVIEW",
  PENDING_APPROVAL = "PENDING_APPROVAL",
  APPROVED = "APPROVED",
  IMPLEMENTING = "IMPLEMENTING",
  VERIFICATION = "VERIFICATION",
  RELEASED = "RELEASED",
  CLOSED = "CLOSED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
  BLOCKED = "BLOCKED",
  FAILED = "FAILED"
}

export enum ChangeScope {
  PART = "PART",
  ASSEMBLY = "ASSEMBLY",
  BOM = "BOM",
  MATERIAL = "MATERIAL",
  MANUFACTURING = "MANUFACTURING",
  CONFIGURATION = "CONFIGURATION",
  DOCUMENT = "DOCUMENT",
  MULTI_DOMAIN = "MULTI_DOMAIN"
}

export enum ECOOperation {
  ADD = "ADD",
  REMOVE = "REMOVE",
  MODIFY = "MODIFY",
  REPLACE = "REPLACE",
  REVISE = "REVISE",
  RECLASSIFY = "RECLASSIFY",
  MOVE = "MOVE",
  SPLIT = "SPLIT",
  MERGE = "MERGE"
}

export enum ImpactCategory {
  DIRECT = "DIRECT",
  INDIRECT = "INDIRECT",
  DOWNSTREAM = "DOWNSTREAM",
  UPSTREAM = "UPSTREAM",
  CONFIGURATION = "CONFIGURATION",
  MANUFACTURING = "MANUFACTURING",
  MATERIAL = "MATERIAL",
  DOCUMENTATION = "DOCUMENTATION",
  SERVICE = "SERVICE",
  PROCUREMENT = "PROCUREMENT"
}

export enum ImpactSeverity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
  SAFETY_CRITICAL = "SAFETY_CRITICAL"
}

export enum ImpactAnalysisStatus {
  COMPLETE = "COMPLETE",
  INCOMPLETE = "INCOMPLETE",
  FAILED = "FAILED",
  UNVERIFIED = "UNVERIFIED"
}

export enum ApprovalRole {
  ENGINEERING = "ENGINEERING",
  MANUFACTURING = "MANUFACTURING",
  QUALITY = "QUALITY",
  MATERIALS = "MATERIALS",
  SAFETY = "SAFETY",
  REGULATORY = "REGULATORY",
  PLM = "PLM",
  CHANGE_AUTHORITY = "CHANGE_AUTHORITY"
}

export enum ApprovalDecision {
  APPROVE = "APPROVE",
  REJECT = "REJECT",
  CONDITIONAL = "CONDITIONAL",
  NEEDS_REVIEW = "NEEDS_REVIEW"
}

export enum ImplementationStepStatus {
  PENDING = "PENDING",
  READY = "READY",
  IN_PROGRESS = "IN_PROGRESS",
  BLOCKED = "BLOCKED",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  SKIPPED = "SKIPPED"
}

export enum ECOVerificationVerdict {
  VERIFIED = "VERIFIED",
  NOT_VERIFIED = "NOT_VERIFIED",
  IMPLEMENTATION_MISMATCH = "IMPLEMENTATION_MISMATCH",
  VALIDATION_FAILURE = "VALIDATION_FAILURE",
  INCOMPLETE = "INCOMPLETE",
  INVALID = "INVALID"
}

export interface EngineeringChangeRequest {
  changeRequestId: string;
  title: string;
  description: string;
  reason: ChangeReason;
  priority: Priority;
  requesterId: string;
  createdAt: string;
  affectedEntities: string[];
  status: ECRStatus;
  evidenceIds: string[];
}

export interface ProposedChange {
  changeId: string;
  targetEntityId: string;
  sourceRevisionId?: string;
  targetRevisionId?: string;
  operation: ECOOperation;
  reason: string;
  beforeState: any;
  proposedState: any;
}

export interface ECOChangeSet {
  changeSetId: string;
  ecoId: string;
  changes: ProposedChange[];
  createdAt: string;
}

export interface AffectedImpactNode {
  entityId: string;
  revisionId?: string;
  category: ImpactCategory;
  severity: ImpactSeverity;
  reason: string;
}

export interface ECOImpactGraph {
  impactAnalysisId: string;
  ecoId: string;
  nodes: AffectedImpactNode[];
  status: ImpactAnalysisStatus;
  analyzedAt: string;
}

export interface EvaluationRecord {
  evaluationId: string;
  ecoId: string;
  domain: string;
  evaluatorId: string;
  decision: ApprovalDecision;
  findings: string[];
  evidenceIds: string[];
  timestamp: string;
}

export interface ECOApproval {
  approvalId: string;
  ecoId: string;
  role: ApprovalRole;
  actorId: string;
  decision: ApprovalDecision;
  reason: string;
  timestamp: string;
  evidenceId?: string;
  conditions?: string[];
}

export interface ImplementationStep {
  stepId: string;
  sequence: number;
  description: string;
  targetEntity: string;
  operation: ECOOperation;
  owner: string;
  status: ImplementationStepStatus;
  startedAt?: string;
  completedAt?: string;
  evidenceIds: string[];
  dependencies: string[]; // stepIds
}

export interface ECOImplementationPlan {
  planId: string;
  ecoId: string;
  steps: ImplementationStep[];
  requiredTests: string[];
  requiredEvidence: string[];
}

export interface Effectivity {
  effectiveDate?: string;
  serialRange?: string;
  lotRange?: string;
  configuration?: string;
  project?: string;
  contract?: string;
}

export interface EngineeringChangeOrder {
  ecoId: string;
  ecoNumber: string;
  title: string;
  description: string;
  reason: ChangeReason;
  sourceRequestId?: string;
  status: ECOStatus;
  priority: Priority;
  createdBy: string;
  createdAt: string;
  approvedAt?: string;
  releasedAt?: string;
  implementedAt?: string;
  closedAt?: string;
  targetEffectivity: Effectivity;
  configurationScope: string[];
  changeScope: ChangeScope;
  affectedEntityIds: string[];
  affectedRevisionIds: string[];
  affectedBOMIds: string[];
  affectedAssemblyIds: string[];
  affectedConfigurationIds: string[];
  changeSetId?: string;
  impactAnalysisId?: string;
  evidenceId?: string;
  ecoVersion: number;
  dependsOnEcoIds: string[];
}

export interface ECOVerificationRecord {
  verificationId: string;
  ecoId: string;
  verdict: ECOVerificationVerdict;
  requestedVsActualMatched: boolean;
  mismatches: string[];
  verifierId: string;
  timestamp: string;
  evidenceIds: string[];
}

export interface ECOSnapshot {
  ecoId: string;
  ecoNumber: string;
  status: ECOStatus;
  sourceRevisions: string[];
  targetRevisions: string[];
  changeSetHash: string;
  impactHash: string;
  approvalHash: string;
  verificationHash: string;
  ecoHash: string;
  timestamp: string;
}

export interface ECOForensicEvidence {
  beforeStateHash: string;
  afterStateHash: string;
  changeSetHash: string;
  impactHash: string;
  approvalHash: string;
  implementationHash: string;
  verificationHash: string;
  ecoHash: string;
  ecoDependencyHash: string;
}

export interface ECOAuditRecord {
  ecoId: string;
  action: string;
  actorId: string;
  timestamp: string;
  beforeStatus: ECOStatus | null;
  afterStatus: ECOStatus;
  reason: string;
}
