/**
 * SECP — ADSE-P1 Requirements & System Model Contracts
 * Advanced Aerospace & Defense Systems Engineering (ADSE)
 */

import { RevisionLifecycleState } from '../../revision/types';

export type RequirementType = 'FUNCTIONAL' | 'PERFORMANCE' | 'SAFETY' | 'INTERFACE' | 'ENVIRONMENTAL' | 'PHYSICAL' | 'RELIABILITY';
export type RequirementPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type RequirementStatus = 'DRAFT' | 'PROPOSED' | 'VALIDATED' | 'BASELINED' | 'SUPERSEDED' | 'RETIRED';

export interface ADSERequirement {
  id: string;
  systemId: string;
  title: string;
  statement: string;
  rationale: string;
  source: string;
  type: RequirementType;
  priority: RequirementPriority;
  status: RequirementStatus;
  version: number;
  revisionId: string; // Bound to SECP RevisionEngine
  configurationId: string;
  parentRequirementId?: string;
  verificationIntentIds: string[];
  constraintIds: string[];
  provenanceId: string;
  canonicalRef?: string; // Deep link to SECP Canonical Model object if applicable
}

export interface ADSEFunction {
  id: string;
  systemId: string;
  name: string;
  description: string;
  inputs: string[];
  outputs: string[];
  allocatedToSubsystemId?: string;
  allocatedToComponentId?: string;
}

export interface ADSESubsystem {
  id: string;
  systemId: string;
  name: string;
  description: string;
  parentSubsystemId?: string;
}

export interface ADSEComponentReference {
  id: string;
  systemId: string;
  name: string;
  subsystemId: string;
  engineeringObjectId: string; // Canonical link to SECP Core object
}

export interface ADSEInterface {
  id: string;
  systemId: string;
  sourceId: string;
  targetId: string;
  interfaceType: 'MECHANICAL' | 'ELECTRICAL' | 'THERMAL' | 'DATA' | 'SOFTWARE' | 'FLUID';
  parameters: Record<string, any>;
}

export interface ADSEConstraint {
  id: string;
  systemId: string;
  title: string;
  expression: string;
  targetEntityId: string;
}

export interface ADSEAllocation {
  id: string;
  systemId: string;
  sourceId: string;
  targetId: string;
  allocationType: 'FUNCTION_TO_SUBSYSTEM' | 'REQUIREMENT_TO_FUNCTION' | 'REQUIREMENT_TO_SUBSYSTEM' | 'BUDGET_ALLOCATION';
  value?: number;
  unit?: string;
}

export interface ADSEVerificationIntent {
  id: string;
  systemId: string;
  requirementId: string;
  method: 'ANALYSIS' | 'TEST' | 'INSPECTION' | 'SIMULATION' | 'DEMONSTRATION';
  successCriteria: string;
  coreSolverKind?: string; // Link to CoreExecutionAuthority solver (e.g. 'mach-flow')
  status: 'PENDING' | 'VERIFIED' | 'FAILED';
  evidenceLeafHash?: string; // Link to SECP Evidence
}

export interface ADSESystemModel {
  systemId: string;
  name: string;
  description: string;
  revisionId: string;
  configurationId: string;
  subsystems: string[]; // Subsystem IDs
  functions: string[]; // Function IDs
  components: string[]; // Component Reference IDs
  interfaces: string[]; // Interface IDs
  constraints: string[]; // Constraint IDs
  allocations: string[]; // Allocation IDs
  requirements: string[]; // Requirement IDs
}

export interface TraceabilityLink {
  sourceId: string;
  targetId: string;
  relationship: 'IMPLEMENTS' | 'ALLOCATED_TO' | 'VERIFIES' | 'DEPENDS_ON' | 'PARENT_OF';
}

export interface ImpactAnalysisResult {
  rootCauseId: string;
  affectedEntities: Array<{
    id: string;
    type: string;
    reason: string;
  }>;
}

/**
 * P1 Governance Action Types
 */
export type ADSEP1Action = 
  | 'CREATE_REQUIREMENT'
  | 'MODIFY_REQUIREMENT'
  | 'BASELINE_REQUIREMENT'
  | 'CREATE_SYSTEM_MODEL'
  | 'ALLOCATE_FUNCTION'
  | 'TRACE_REQUIREMENT'
  | 'BIND_VERIFICATION_INTENT'
  | 'CHANGE_SYSTEM_CONFIGURATION';
