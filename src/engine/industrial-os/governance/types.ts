import { EngineeringIdentity } from '../../identity/CanonicalEngineeringIdentity';
import { EngineeringObjectStatus } from '../types';
import { PolicyEffect } from '../policy/types';

/**
 * Canonical Engineering Roles in the SECP Industrial OS.
 */
export enum EngineeringRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  ENGINEERING_LEAD = 'ENGINEERING_LEAD',
  DESIGN_ENGINEER = 'DESIGN_ENGINEER',
  SIMULATION_ENGINEER = 'SIMULATION_ENGINEER',
  MANUFACTURING_ENGINEER = 'MANUFACTURING_ENGINEER',
  REVIEWER = 'REVIEWER',
  VALIDATOR = 'VALIDATOR',
  AUDITOR = 'AUDITOR',
  VIEWER = 'VIEWER'
}

/**
 * Enterprise Governance Verdicts.
 */
export type GovernanceVerdict = 
  | 'ALLOW'
  | 'DENY'
  | 'REQUIRE_REVIEW'
  | 'REQUIRE_EVIDENCE'
  | 'POLICY_CONFLICT'
  | 'UNPROVEN'
  | 'INVALID';

/**
 * Governance Context for evaluation.
 */
export interface GovernanceContext {
  readonly identity: string;
  readonly organizationId: string;
  readonly businessUnitId?: string;
  readonly projectId: string;
  readonly workspaceId?: string;
  
  readonly roles: EngineeringRole[];
  readonly capabilities: string[];
  
  readonly object?: {
    readonly id: string;
    readonly identity: EngineeringIdentity;
    readonly status: EngineeringObjectStatus;
    readonly revisionId: string;
    readonly creatorId: string;
  };
  
  readonly requestedAction: string;
  readonly metadata: Record<string, any>;
  readonly timestamp: string;
  readonly correlationId: string;
}

/**
 * Governance Decision.
 */
export interface GovernanceDecision {
  readonly decisionId: string;
  readonly verdict: GovernanceVerdict;
  readonly reason: string;
  readonly policiesEvaluated: string[];
  readonly requiredEvidence: string[];
  readonly context: GovernanceContext;
  readonly evaluatedAt: string;
}

/**
 * Approval Record.
 */
export interface ApprovalRecord {
  readonly approvalId: string;
  readonly objectIdentityId: string;
  readonly revisionId: string;
  readonly approverId: string;
  readonly role: EngineeringRole;
  readonly decision: 'APPROVED' | 'REJECTED' | 'REQUESTED';
  readonly timestamp: string;
  readonly policyContextHash: string;
  readonly evidenceRefs: string[];
  readonly previousState: EngineeringObjectStatus;
  readonly targetState: EngineeringObjectStatus;
}

/**
 * Enterprise Entity Definitions.
 */
export interface Organization {
  readonly id: string;
  readonly name: string;
}

export interface BusinessUnit {
  readonly id: string;
  readonly orgId: string;
  readonly name: string;
}

export interface EngineeringTeam {
  readonly id: string;
  readonly buId: string;
  readonly name: string;
}

export interface ProjectGovernance {
  readonly id: string;
  readonly teamId: string;
  readonly name: string;
  readonly defaultPolicies: string[];
}
