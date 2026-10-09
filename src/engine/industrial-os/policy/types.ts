export type PolicyEffect = 
  | 'ALLOW' 
  | 'DENY' 
  | 'BLOCK' 
  | 'CONFLICT' 
  | 'REQUIRE_VERIFICATION' 
  | 'REQUIRE_EVIDENCE' 
  | 'REQUIRE_APPROVAL' 
  | 'WARN';

export interface PolicyCondition {
  field: string;
  operator: 'EQUALS' | 'NOT_EQUALS' | 'IN' | 'NOT_IN' | 'MATCHES' | 'EXISTS' | 'GT' | 'LT' | 'CONTAINS' | 'NOT_CONTAINS';
  value: any;
  description?: string;
}

export interface EngineeringPolicy {
  policyId: string;
  policyVersion: string;
  name: string;
  description: string;
  status: 'ACTIVE' | 'INACTIVE' | string;
  priority: number;
  effect: PolicyEffect;
  conditions: PolicyCondition[];
  scope: 'GLOBAL' | 'PROJECT' | string;
}

export interface PolicyContext {
  subject: {
    identityId: string;
    objectType: string;
    [key: string]: any;
  };
  operation: string;
  projectId?: string;
  environment?: {
    timestamp: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface PolicyDecision {
  decisionId: string;
  policyId: string;
  policyVersion: string;
  effect: PolicyEffect;
  subjectIdentityId: string;
  operation: string;
  matchedConditions: string[];
  failedConditions: string[];
  reason: string;
  evaluatedAt: string;
}

export interface AggregatePolicyDecision {
  overallEffect: PolicyEffect;
  decisions: PolicyDecision[];
  reason: string;
  evaluatedAt: string;
}
