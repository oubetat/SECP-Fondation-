import { 
  AuthContext, 
  EngineeringRole, 
  EngineeringAction, 
  ResourceType, 
  ProjectMember, 
  AccessDecision, 
  AccessAuditEvent,
  ResourceState,
  MembershipStatus,
  SecurityEventClassification
} from './AccessControlTypes';

export class AccessControlEngine {
  private members: ProjectMember[] = [];
  private auditLogs: AccessAuditEvent[] = [];

  constructor() {
    this.seedInitialAuditLogs();
  }

  private seedInitialAuditLogs(): void {
    this.auditLogs = [
      {
        id: 'AUD-001',
        timestamp: Date.now() - 3600000,
        userId: 'OWNER_ROOT',
        action: 'RELEASE',
        resourceType: 'RELEASE_PACKAGE',
        classification: 'INFO',
        decision: 'ALLOWED',
        detail: 'Initialized project root security boundary and cryptographic keys.'
      },
      {
        id: 'AUD-002',
        timestamp: Date.now() - 1800000,
        userId: 'ENGINEER_SARAH',
        action: 'UPDATE',
        resourceType: 'PART',
        classification: 'INFO',
        decision: 'ALLOWED',
        detail: 'Parametric CAD update on primary spool valve casing.'
      },
      {
        id: 'AUD-003',
        timestamp: Date.now() - 900000,
        userId: 'SUPPLIER_GLOBAL',
        action: 'EXPORT',
        resourceType: 'CAD_MODEL',
        classification: 'WARNING',
        decision: 'DENIED',
        detail: 'Unapproved supplier attempt to export confidential STEP geometry.'
      }
    ];
  }

  public getMembers(projectId?: string): ProjectMember[] {
    if (!projectId) return this.members;
    return this.members.filter(m => !m.projectId || m.projectId === projectId);
  }

  public addMember(member: Partial<ProjectMember> & { userId: string }): void {
    const existingIdx = this.members.findIndex(m => m.userId === member.userId && (!member.projectId || m.projectId === member.projectId));
    const fullMember: ProjectMember = {
      userId: member.userId,
      name: member.name || member.userId,
      role: member.role || 'ENGINEER',
      status: member.status || 'ACTIVE',
      projectId: member.projectId,
      grantedAt: member.grantedAt || Date.now(),
      grantedBy: member.grantedBy || 'SYSTEM',
      joinedAt: member.joinedAt || new Date().toISOString()
    };

    if (existingIdx >= 0) {
      this.members[existingIdx] = { ...this.members[existingIdx], ...fullMember };
    } else {
      this.members.push(fullMember);
    }
  }

  public updateMemberStatus(projectId: string, userId: string, status: MembershipStatus, currentUser: string): void {
    const member = this.members.find(m => m.userId === userId && (!m.projectId || m.projectId === projectId));
    if (member) {
      member.status = status;
      this.recordAuditLog({
        userId: currentUser,
        action: 'ADMIN_OVERRIDE',
        resourceType: 'AUDIT_LOG',
        classification: status === 'SUSPENDED' ? 'WARNING' : 'INFO',
        decision: 'ALLOWED',
        detail: `Updated membership status of user ${userId} to ${status} by ${currentUser}.`,
        projectId
      });
    }
  }

  public getAuditLogs(projectId?: string): AccessAuditEvent[] {
    if (!projectId) return this.auditLogs;
    return this.auditLogs.filter(log => !log.projectId || log.projectId === projectId);
  }

  public getAuditEvents(): AccessAuditEvent[] {
    return this.auditLogs;
  }

  public recordAuditLog(event: Omit<AccessAuditEvent, 'id' | 'timestamp'> & { timestamp?: number | string }): void {
    const log: AccessAuditEvent = {
      id: `AUD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: event.timestamp || Date.now(),
      userId: event.userId,
      action: event.action,
      resourceType: event.resourceType,
      classification: event.classification,
      decision: event.decision,
      detail: event.detail,
      projectId: event.projectId,
      reason: event.reason
    };
    this.auditLogs.unshift(log);
  }

  public authorize(
    ctx: AuthContext,
    projectId: string,
    targetResource: ResourceType,
    targetAction: EngineeringAction,
    state?: ResourceState
  ): AccessDecision {
    const member = this.members.find(m => m.userId === ctx.userId && (!m.projectId || m.projectId === projectId));
    const role: EngineeringRole = member?.role || ctx.role || 'GUEST';
    const status: MembershipStatus = member?.status || 'ACTIVE';

    if (status === 'SUSPENDED') {
      const decision: AccessDecision = {
        allowed: false,
        reason: `User ${ctx.userId} membership status is SUSPENDED. Access denied.`,
        timestamp: Date.now(),
        ruleMatched: 'SUSPENDED_MEMBER_BLOCK'
      };
      this.recordAuditLog({
        userId: ctx.userId,
        action: targetAction,
        resourceType: targetResource,
        classification: 'VIOLATION',
        decision: 'DENIED',
        detail: decision.reason,
        projectId
      });
      return decision;
    }

    // Released & Locked Resource Rules
    if (state?.isReleased && (targetAction === 'WRITE' || targetAction === 'UPDATE' || targetAction === 'DELETE')) {
      if (role !== 'OWNER' && targetAction !== 'ADMIN_OVERRIDE') {
        const decision: AccessDecision = {
          allowed: false,
          reason: 'Cannot modify released engineering baseline. ECO change order required.',
          timestamp: Date.now(),
          ruleMatched: 'IMMUTABLE_RELEASE_BOUNDARY'
        };
        this.recordAuditLog({
          userId: ctx.userId,
          action: targetAction,
          resourceType: targetResource,
          classification: 'VIOLATION',
          decision: 'DENIED',
          detail: decision.reason,
          projectId
        });
        return decision;
      }
    }

    if (state?.isLocked && state.lockedByUserId && state.lockedByUserId !== ctx.userId && targetAction !== 'READ') {
      if (role !== 'OWNER' && role !== 'ADMIN' && role !== 'PROJECT_ADMIN') {
        const decision: AccessDecision = {
          allowed: false,
          reason: `Resource is locked by user ${state.lockedByUserId}. Concurrent edit conflict prevented.`,
          timestamp: Date.now(),
          ruleMatched: 'CONCURRENCY_LOCK_ENFORCEMENT'
        };
        this.recordAuditLog({
          userId: ctx.userId,
          action: targetAction,
          resourceType: targetResource,
          classification: 'WARNING',
          decision: 'DENIED',
          detail: decision.reason,
          projectId
        });
        return decision;
      }
    }

    // Role-based policy evaluation
    let allowed = false;
    let reason = 'Role permissions verified.';

    switch (role) {
      case 'OWNER':
      case 'ADMIN':
      case 'PROJECT_ADMIN':
        allowed = true;
        reason = `Full administrative privileges granted for role ${role}.`;
        break;

      case 'ENGINEER':
        if (targetAction === 'DELETE' || targetAction === 'RELEASE' || targetAction === 'ADMIN_OVERRIDE') {
          allowed = false;
          reason = `Role ENGINEER is not authorized for action ${targetAction}.`;
        } else {
          allowed = true;
        }
        break;

      case 'CAE_ENGINEER':
        if (['READ', 'RUN_SIMULATION', 'WRITE', 'UPDATE'].includes(targetAction) && ['FEM_STUDY', 'CFD_DOMAIN', 'SIMULATION', 'PART'].includes(targetResource)) {
          allowed = true;
        } else if (targetAction === 'READ') {
          allowed = true;
        } else {
          allowed = false;
          reason = `CAE Engineer role limited to simulation and analysis assets.`;
        }
        break;

      case 'CAM_ENGINEER':
        if (['READ', 'POST_PROCESS_CAM', 'WRITE', 'UPDATE'].includes(targetAction) && ['CAM_TOOLPATH', 'PART'].includes(targetResource)) {
          allowed = true;
        } else if (targetAction === 'READ') {
          allowed = true;
        } else {
          allowed = false;
          reason = `CAM Programmer role restricted to toolpath and manufacturing artifacts.`;
        }
        break;

      case 'REVIEWER':
      case 'QUALITY':
        allowed = targetAction === 'READ' || targetAction === 'APPROVE' || targetAction === 'SUBMIT_FOR_REVIEW';
        reason = allowed ? `Approval / Reviewer privilege granted.` : `Action ${targetAction} requires authoring permissions.`;
        break;

      case 'VIEWER':
      case 'AUDITOR':
        allowed = targetAction === 'READ' || (role === 'AUDITOR' && targetResource === 'AUDIT_LOG');
        reason = allowed ? `Read-only inspection granted.` : `Audit/Viewer accounts have zero mutation authority.`;
        break;

      case 'SUPPLIER':
        if (state?.confidentialityLevel === 'RESTRICTED') {
          allowed = false;
          reason = 'Supplier access strictly restricted on proprietary IP artifacts.';
        } else {
          allowed = targetAction === 'READ' || targetAction === 'EXPORT';
        }
        break;

      default:
        allowed = false;
        reason = `Unknown or guest role has no access.`;
    }

    const decision: AccessDecision = {
      allowed,
      reason,
      timestamp: Date.now(),
      ruleMatched: `RBAC_ROLE_${role}`
    };

    this.recordAuditLog({
      userId: ctx.userId,
      action: targetAction,
      resourceType: targetResource,
      classification: allowed ? 'INFO' : 'WARNING',
      decision: allowed ? 'ALLOWED' : 'DENIED',
      detail: decision.reason,
      projectId
    });

    return decision;
  }

  public evaluateAccess(ctx: AuthContext, action: EngineeringAction, resource: ResourceType): AccessDecision {
    return this.authorize(ctx, 'PROJ-DEFAULT', resource, action);
  }
}
