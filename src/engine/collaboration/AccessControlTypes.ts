export type EngineeringRole = 
  | 'OWNER'
  | 'ADMIN' 
  | 'PROJECT_ADMIN' 
  | 'ENGINEER' 
  | 'CAE_ENGINEER' 
  | 'CAM_ENGINEER' 
  | 'REVIEWER' 
  | 'QUALITY' 
  | 'SUPPLIER' 
  | 'VIEWER' 
  | 'AUDITOR' 
  | 'GUEST';

export type EngineeringAction = 
  | 'READ' 
  | 'WRITE' 
  | 'UPDATE' 
  | 'DELETE' 
  | 'APPROVE' 
  | 'EXPORT' 
  | 'RELEASE' 
  | 'SUBMIT_FOR_REVIEW' 
  | 'RUN_SIMULATION' 
  | 'POST_PROCESS_CAM' 
  | 'ADMIN_OVERRIDE';

export type ResourceType = 
  | 'PART' 
  | 'ASSEMBLY' 
  | 'SKETCH' 
  | 'DRAWING' 
  | 'FEM_STUDY' 
  | 'CFD_DOMAIN' 
  | 'CAM_TOOLPATH' 
  | 'ECO' 
  | 'RELEASE_PACKAGE' 
  | 'AUDIT_LOG' 
  | 'CAD_MODEL' 
  | 'BOM' 
  | 'SIMULATION';

export type ResourceStateStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'RELEASED' | 'LOCKED' | 'ARCHIVED';
export type ConfidentialityLevel = 'INTERNAL' | 'RESTRICTED' | 'PUBLIC' | 'SUPPLIER_SHARED';
export type MembershipStatus = 'ACTIVE' | 'SUSPENDED' | 'INVITED' | 'REVOKED';
export type SecurityEventClassification = 'INFO' | 'WARNING' | 'VIOLATION' | 'SECURITY_ALERT';

export interface AuthContext {
  userId: string;
  role?: EngineeringRole;
  organizationId?: string;
  sessionId?: string;
  tenantId?: string;
  isAiAgent?: boolean;
}

export interface ResourceState {
  objectId?: string;
  projectId?: string;
  tenantId?: string;
  ownerId?: string;
  isReleased?: boolean;
  isApproved?: boolean;
  isLocked?: boolean;
  lockedByUserId?: string;
  confidentialityLevel?: ConfidentialityLevel;
  status?: ResourceStateStatus;
}

export interface ProjectMember {
  userId: string;
  name?: string;
  role: EngineeringRole;
  status: MembershipStatus;
  projectId?: string;
  grantedAt?: number | string;
  grantedBy?: string;
  joinedAt?: string;
  email?: string;
}

export interface AccessDecision {
  allowed: boolean;
  reason: string;
  timestamp: string | number;
  evaluatedAt?: number;
  ruleMatched?: string;
}

export interface AccessAuditEvent {
  id: string;
  timestamp: string | number;
  userId: string;
  action: EngineeringAction | string;
  resourceType: ResourceType | string;
  classification: SecurityEventClassification | string;
  decision: 'ALLOWED' | 'DENIED';
  detail: string;
  projectId?: string;
  reason?: string;
}
