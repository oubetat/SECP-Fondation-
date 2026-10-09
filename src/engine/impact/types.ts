export type ImpactAnalysisStatus = 
  | 'DRAFT' 
  | 'RUNNING' 
  | 'COMPLETE' 
  | 'INCOMPLETE' 
  | 'FAILED' 
  | 'SUPERSEDED';

export type ImpactClass = 
  | 'DIRECT' 
  | 'INDIRECT' 
  | 'TRANSITIVE' 
  | 'INFORMATIONAL' 
  | 'REVIEW_REQUIRED' 
  | 'REVERIFICATION_REQUIRED' 
  | 'INVALIDATED';

export type ImpactSeverity = 
  | 'NONE' 
  | 'LOW' 
  | 'MEDIUM' 
  | 'HIGH' 
  | 'CRITICAL';

export type RelationshipType = 
  | 'BOM_COMPONENT' 
  | 'ASSEMBLY_OCCURRENCE' 
  | 'USES_REVISION' 
  | 'MATERIAL_DEPENDENCY' 
  | 'MANUFACTURING_DEPENDENCY' 
  | 'TOOLPATH_DEPENDENCY' 
  | 'CONFIGURATION_DEPENDENCY' 
  | 'DOCUMENT_DEPENDENCY' 
  | 'SIMULATION_DEPENDENCY' 
  | 'VALIDATION_DEPENDENCY' 
  | 'EFFECTIVITY_DEPENDENCY' 
  | 'ECO_DEPENDENCY';

export type ActionType = 
  | 'CREATE_REVISION' 
  | 'UPDATE_BOM' 
  | 'REVERIFY_CFD' 
  | 'REVERIFY_FEA' 
  | 'REVALIDATE' 
  | 'UPDATE_TOOLPATH' 
  | 'REGENERATE_GCODE' 
  | 'REVIEW_CERTIFICATION' 
  | 'UPDATE_DOCUMENT';

export type ImpactClosureStatus = 
  | 'OPEN' 
  | 'PARTIAL' 
  | 'COMPLETE' 
  | 'BLOCKED' 
  | 'INVALID';

export interface EffectivityContext {
  startDate?: string;
  endDate?: string;
  startSerial?: string;
  endSerial?: string;
  configuration?: string;
  project?: string;
  contract?: string;
}

export interface ImpactNode {
  nodeId: string;
  entityId: string;
  entityType: 'PART' | 'ASSEMBLY' | 'BOM' | 'MATERIAL' | 'MANUFACTURING' | 'TOOLPATH' | 'GCODE' | 'SIMULATION' | 'DOCUMENT' | 'CONFIGURATION' | 'DRAWING';
  revisionId: string;
  sourceRevisionId?: string;
  configurationId?: string;
  effectivity?: EffectivityContext;
  impactClass: ImpactClass;
  severity: ImpactSeverity;
  distance: number;
  pathCount: number;
  status: 'OPEN' | 'REVIEWED' | 'RESOLVED' | 'WAIVED';
  isSafetyCritical?: boolean;
}

export interface ImpactEdge {
  edgeId: string;
  fromNode: string;
  toNode: string;
  relationshipType: RelationshipType;
  relationshipId: string;
  revisionContext?: string;
  effectivity?: EffectivityContext;
  confidence: number;
  evidenceId: string;
}

export interface ImpactPath {
  pathId: string;
  nodes: string[];
  edges: string[];
  description: string;
}

export interface DependencyCycle {
  cycleId: string;
  cycleNodes: string[];
  cycleEdges: string[];
  cyclePath: string;
  cycleHash: string;
}

export interface ImpactAction {
  actionId: string;
  actionType: ActionType;
  targetEntityId: string;
  targetRevisionId: string;
  description: string;
  sequence: number;
  dependsOnActionIds: string[];
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
}

export interface GraphSnapshotNode {
  entityId: string;
  revisionId: string;
  entityType: string;
  properties?: Record<string, any>;
  effectivity?: EffectivityContext;
}

export interface GraphSnapshotEdge {
  edgeId: string;
  from: string; // "entityId:revisionId"
  to: string;   // "entityId:revisionId"
  type: RelationshipType;
  relationshipId?: string;
  properties?: Record<string, any>;
  effectivity?: EffectivityContext;
}

export interface GraphSnapshot {
  snapshotId: string;
  snapshotVersion: string;
  createdAt: string;
  graphSnapshotHash: string;
  nodes: GraphSnapshotNode[];
  edges: GraphSnapshotEdge[];
}

export interface UnknownDependency {
  sourceId: string;
  targetId: string;
  reason: string;
}

export interface BrokenEdge {
  edgeId: string;
  missingEntityId: string;
}

export interface ImpactSummary {
  directCount: number;
  indirectCount: number;
  transitiveCount: number;
  criticalCount: number;
  reviewRequiredCount: number;
  reverificationCount: number;
  invalidatedCount: number;
  unknownCount: number;
}

export interface ChangeImpactAnalysis {
  impactAnalysisId: string;
  ecoId: string;
  analysisVersion: string;
  rootChangeIds: string[];
  rootEntityIds: string[];
  rootRevisionIds: string[];
  status: ImpactAnalysisStatus;
  createdAt: string;
  createdBy: string;
  completedAt?: string;
  algorithmVersion: string;
  policyVersion: string;
  graphSnapshotHash: string;
  analysisHash: string;
  verdict: 'VALID' | 'INCOMPLETE' | 'INVALID' | 'STALE';
  nodes: ImpactNode[];
  edges: ImpactEdge[];
  paths: ImpactPath[];
  cycles: DependencyCycle[];
  actions: ImpactAction[];
  unknownDependencies: UnknownDependency[];
  brokenEdges: BrokenEdge[];
  isTruncated: boolean;
  summary: ImpactSummary;
}

export interface ChangeImpactReport {
  analysisIdentity: {
    impactAnalysisId: string;
    ecoId: string;
    analysisVersion: string;
    algorithmVersion: string;
    policyVersion: string;
  };
  rootChange: {
    rootChangeIds: string[];
    rootEntityIds: string[];
    rootRevisionIds: string[];
  };
  graphSnapshot: {
    snapshotId: string;
    graphSnapshotHash: string;
    nodeCount: number;
    edgeCount: number;
  };
  affectedNodes: ImpactNode[];
  affectedPaths: ImpactPath[];
  cycles: DependencyCycle[];
  classificationSummary: Record<string, number>;
  severitySummary: Record<string, number>;
  requiredActions: ImpactAction[];
  unknowns: UnknownDependency[];
  brokenEdges: BrokenEdge[];
  closureStatus: ImpactClosureStatus;
  verdict: 'VALID' | 'INCOMPLETE' | 'INVALID' | 'STALE';
  analysisHash: string;
  evidenceHash: string;
  timestamp: string;
}

export interface DifferentialVerificationResult {
  verdict: 'MATCH' | 'MISMATCH' | 'INCOMPLETE' | 'INVALID';
  nodeMatch: boolean;
  edgeMatch: boolean;
  pathMatch: boolean;
  severityMatch: boolean;
  hashMatch: boolean;
  mismatches: string[];
}
