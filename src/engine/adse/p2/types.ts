/**
 * SECP — ADSE-P2 MBSE / SysML Semantics Contracts
 * Advanced Aerospace & Defense Systems Engineering (ADSE)
 */

export type MBSESemanticCategory = 
  | 'STRUCTURAL'
  | 'REQUIREMENT'
  | 'BEHAVIORAL'
  | 'PARAMETRIC'
  | 'FLOW';

export type MBSEElementType = 
  | 'Package'
  | 'Model'
  | 'System'
  | 'Subsystem'
  | 'Component'
  | 'Part'
  | 'Port'
  | 'Interface'
  | 'Connector'
  | 'Allocation'
  | 'Function'
  | 'Activity'
  | 'Action'
  | 'Behavior'
  | 'State'
  | 'StateTransition'
  | 'Event'
  | 'Trigger'
  | 'Guard'
  | 'Effect'
  | 'ConstraintBlock'
  | 'Constraint'
  | 'Parameter'
  | 'ValueProperty'
  | 'UnitReference'
  | 'Binding'
  | 'ItemFlow'
  | 'FlowPort'
  | 'FlowProperty'
  | 'Signal';

export type MBSERelationshipType = 
  | 'DERIVES_FROM'
  | 'REFINES'
  | 'SATISFIES'
  | 'VERIFIES'
  | 'ALLOCATES'
  | 'COMPOSES'
  | 'CONNECTS'
  | 'FLOWS_TO'
  | 'IMPLEMENTS'
  | 'PERFORMS'
  | 'DEPENDS_ON'
  | 'CONSTRAINS'
  | 'TRIGGERS'
  | 'TRANSITIONS_TO'
  | 'BINDS_TO'
  | 'REPRESENTS';

export type CoreBindingState = 'UNBOUND' | 'BOUND_CANONICAL' | 'VERIFIED_CORE';

export interface MBSEElementIdentity {
  mbseId: string; // e.g., 'mbse:system:SYS-001'
  elementType: MBSEElementType;
  displayName: string;
  category: MBSESemanticCategory;
  configurationId: string;
  revisionId: string;
  coreBindingState: CoreBindingState;
  engineeringObjectId?: string; // Canonical link to SECP Core / P1 object
  canonicalGeometryHash?: string;
  revisionHash?: string;
  metadata?: Record<string, any>;
}

export interface MBSERelationshipContract {
  relationshipId: string;
  relationshipType: MBSERelationshipType;
  sourceMbseId: string;
  targetMbseId: string;
  configurationId: string;
  revisionId: string;
  cardinality?: '1:1' | '1:N' | 'N:1' | 'N:M';
  provenanceId: string;
  isCustomValid: boolean;
}

// Behavioral Elements
export interface MBSEState {
  mbseId: string;
  name: string;
  owningBehaviorMbseId: string;
  entryAction?: string;
  exitAction?: string;
  isInitial?: boolean;
  isFinal?: boolean;
}

export interface MBSEStateTransition {
  mbseId: string;
  sourceStateMbseId: string;
  targetStateMbseId: string;
  triggerEvent: string;
  guardCondition?: string; // JavaScript / SECP expression e.g., 'temperature <= 800'
  effectAction?: string;
}

// Parametric & Constraint
export interface MBSEValueProperty {
  mbseId: string;
  name: string;
  value: number | string | boolean;
  unit: string;
  ownerMbseId: string;
}

export interface MBSEConstraintBlock {
  mbseId: string;
  name: string;
  expression: string; // e.g., 'thrust >= mass * gravity'
  parameters: Array<{ name: string; unit: string; valuePropertyMbseId?: string }>;
}

export interface MBSEBinding {
  mbseId: string;
  constraintBlockMbseId: string;
  parameterName: string;
  targetValuePropertyMbseId: string;
}

// Flow Elements
export interface MBSEFlowPort {
  mbseId: string;
  name: string;
  direction: 'IN' | 'OUT' | 'INOUT';
  ownerMbseId: string; // Component or Subsystem ID
  dataType?: string;
}

export interface MBSEItemFlow {
  mbseId: string;
  name: string;
  itemType: string; // e.g. 'POWER_KW', 'HYDRAULIC_FLUID', 'TELEMETRY_DATA'
  sourcePortMbseId: string;
  targetPortMbseId: string;
  flowDirection: 'IN' | 'OUT' | 'INOUT';
  connectorMbseId?: string;
  rate?: number;
  unit?: string;
}

export interface MBSEConnector {
  mbseId: string;
  name: string;
  sourcePortMbseId: string;
  targetPortMbseId: string;
  configurationId: string;
}

// Impact Analysis
export interface MBSEImpactNode {
  mbseId: string;
  elementType: MBSEElementType;
  displayName: string;
  impactType: 'DIRECT' | 'INDIRECT' | 'CONSTRAINT_PROPAGATION';
  detail: string;
}

export interface MBSEImpactReport {
  parameterMbseId: string;
  oldValue: any;
  newValue: any;
  affectedNodes: MBSEImpactNode[];
  constraintViolations: string[];
}

// Consistency Findings
export type MBSEFindingSeverity = 'CRITICAL' | 'WARNING' | 'INFO';
export type MBSEFindingCategory = 'STRUCTURAL' | 'REQUIREMENT' | 'BEHAVIORAL' | 'FLOW' | 'PARAMETRIC' | 'CONFIGURATION';

export interface MBSEFinding {
  findingId: string;
  severity: MBSEFindingSeverity;
  category: MBSEFindingCategory;
  sourceMbseId: string;
  targetMbseId?: string;
  ruleCode: string;
  explanation: string;
  revisionId: string;
  configurationId: string;
  provenanceId: string;
}

export interface MBSEConsistencyReport {
  timestamp: string;
  configurationId: string;
  revisionId: string;
  totalChecksPassed: number;
  totalFindings: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  findings: MBSEFinding[];
  isConsistent: boolean;
}

// Governance Actions
export type ADSEP2Action = 
  | 'CREATE_MBSE_ELEMENT'
  | 'MODIFY_MBSE_ELEMENT'
  | 'CREATE_RELATIONSHIP'
  | 'REMOVE_RELATIONSHIP'
  | 'ALLOCATE_BEHAVIOR'
  | 'BIND_CONSTRAINT'
  | 'PUBLISH_MBSE_MODEL';
