import { createHash } from 'crypto';
import { 
  EngineeringChangeRequest, 
  EngineeringChangeOrder, 
  ECRStatus, 
  ECOStatus, 
  ECOChangeSet, 
  ECOImpactGraph, 
  ECOApproval, 
  ECOImplementationPlan, 
  ECOVerificationRecord, 
  ECOVerificationVerdict, 
  ECOSnapshot, 
  ECOForensicEvidence, 
  ECOAuditRecord, 
  ApprovalRole, 
  ApprovalDecision, 
  ChangeReason, 
  Priority, 
  ChangeScope 
} from './types';
import { ECOCanonicalizer } from './ECOCanonicalizer';
import { ECOImpactAnalyzer, GraphDependency } from './ECOImpactAnalyzer';
import { ECOExecutionEngine } from './ECOExecutionEngine';
import { ECOVerificationEngine } from './ECOVerificationEngine';
import { ECOConflictDetector } from './ECOConflictDetector';

export class ECOEngine {
  private ecrs: Map<string, EngineeringChangeRequest> = new Map();
  private ecos: Map<string, EngineeringChangeOrder> = new Map();
  private changeSets: Map<string, ECOChangeSet> = new Map();
  private impactGraphs: Map<string, ECOImpactGraph> = new Map();
  private approvals: Map<string, ECOApproval[]> = new Map();
  private implementationPlans: Map<string, ECOImplementationPlan> = new Map();
  private verifications: Map<string, ECOVerificationRecord> = new Map();
  private auditLog: ECOAuditRecord[] = [];
  private ecoNumberCounter = 1;

  // Registered revisions mock DB for immutability check
  private registeredRevisions: Map<string, { revisionId: string; lifecycleState: string }> = new Map();

  public registerRevision(revisionId: string, lifecycleState: string) {
    this.registeredRevisions.set(revisionId, { revisionId, lifecycleState });
  }

  // 1. Change Request API
  public createChangeRequest(req: EngineeringChangeRequest): EngineeringChangeRequest {
    req.status = ECRStatus.DRAFT;
    req.createdAt = new Date().toISOString();
    this.ecrs.set(req.changeRequestId, req);
    return req;
  }

  public submitChangeRequest(changeRequestId: string, actorId: string): EngineeringChangeRequest {
    const ecr = this.ecrs.get(changeRequestId);
    if (!ecr) throw new Error('NOT_FOUND: ECR does not exist.');
    if (ecr.status !== ECRStatus.DRAFT) throw new Error(`INVALID_TRANSITION: Cannot submit ECR in status ${ecr.status}`);
    ecr.status = ECRStatus.SUBMITTED;
    return ecr;
  }

  // 2. ECO Creation API
  public createECO(
    title: string,
    description: string,
    reason: ChangeReason,
    priority: Priority,
    createdBy: string,
    changeScope: ChangeScope,
    affectedEntityIds: string[],
    sourceRequestId?: string
  ): EngineeringChangeOrder {
    const ecoNumber = `ECO-${new Date().getFullYear()}-${String(this.ecoNumberCounter++).padStart(6, '0')}`;
    const ecoHash = createHash('sha256').update(`${ecoNumber}:${title}:${createdBy}`).digest('hex').slice(0, 8).toUpperCase();
    const ecoId = `ECO-ID-${ecoNumber}-${ecoHash}`;

    const eco: EngineeringChangeOrder = {
      ecoId,
      ecoNumber,
      title,
      description,
      reason,
      sourceRequestId,
      status: ECOStatus.DRAFT,
      priority,
      createdBy,
      createdAt: new Date().toISOString(),
      targetEffectivity: {},
      configurationScope: [],
      changeScope,
      affectedEntityIds,
      affectedRevisionIds: [],
      affectedBOMIds: [],
      affectedAssemblyIds: [],
      affectedConfigurationIds: [],
      ecoVersion: 1,
      dependsOnEcoIds: []
    };

    if (sourceRequestId) {
      const ecr = this.ecrs.get(sourceRequestId);
      if (ecr) {
        ecr.status = ECRStatus.CONVERTED_TO_ECO;
      }
    }

    this.ecos.set(ecoId, eco);
    this.approvals.set(ecoId, []);
    this.recordAudit(ecoId, 'CREATE', createdBy, null, ECOStatus.DRAFT, 'ECO Created');

    return eco;
  }

  // 3. Impact Analysis API
  public analyzeImpact(ecoId: string, dependencies: GraphDependency[] = []): ECOImpactGraph {
    const eco = this.getECOOrThrow(ecoId);
    this.assertValidTransition(eco.status, ECOStatus.IMPACT_ANALYSIS);

    const impactGraph = ECOImpactAnalyzer.analyzeImpact(eco, dependencies);
    this.impactGraphs.set(ecoId, impactGraph);
    
    eco.impactAnalysisId = impactGraph.impactAnalysisId;
    this.updateECOStatus(eco, ECOStatus.IMPACT_ANALYSIS, eco.createdBy, 'Impact analysis generated');

    return impactGraph;
  }

  public submitForReview(ecoId: string, actorId: string, changeSet: ECOChangeSet): EngineeringChangeOrder {
    const eco = this.getECOOrThrow(ecoId);
    this.assertValidTransition(eco.status, ECOStatus.UNDER_REVIEW);

    this.changeSets.set(ecoId, changeSet);
    eco.changeSetId = changeSet.changeSetId;

    this.updateECOStatus(eco, ECOStatus.UNDER_REVIEW, actorId, 'Submitted for review');
    return eco;
  }

  // 4. Approval API & Required Roles Matrix
  public approveECO(
    ecoId: string,
    approval: ECOApproval,
    expectedVersion?: number
  ): EngineeringChangeOrder {
    const eco = this.getECOOrThrow(ecoId);
    this.checkConcurrency(eco, expectedVersion);

    if (eco.status === ECOStatus.REJECTED) {
      throw new Error('ILLEGAL_TRANSITION: Cannot approve a REJECTED ECO.');
    }

    const appList = this.approvals.get(ecoId) || [];
    appList.push(approval);
    this.approvals.set(ecoId, appList);

    // Evaluate required approval matrix
    const requiredRoles = this.getRequiredApprovalRoles(eco);
    const approvedRoles = appList
      .filter(a => a.decision === ApprovalDecision.APPROVE)
      .map(a => a.role);

    const allSatisfied = requiredRoles.every(r => approvedRoles.includes(r));

    if (allSatisfied) {
      this.updateECOStatus(eco, ECOStatus.APPROVED, approval.actorId, 'All required approvals satisfied');
      eco.approvedAt = new Date().toISOString();
    } else {
      this.updateECOStatus(eco, ECOStatus.PENDING_APPROVAL, approval.actorId, 'Partial approval recorded');
    }

    return eco;
  }

  public rejectECO(ecoId: string, actorId: string, reason: string): EngineeringChangeOrder {
    const eco = this.getECOOrThrow(ecoId);
    if (eco.status === ECOStatus.RELEASED || eco.status === ECOStatus.CLOSED) {
      throw new Error(`ILLEGAL_TRANSITION: Cannot reject an ECO in status ${eco.status}`);
    }

    this.updateECOStatus(eco, ECOStatus.REJECTED, actorId, reason);
    return eco;
  }

  // 5. Implementation API
  public createImplementationPlan(ecoId: string, plan: ECOImplementationPlan): ECOImplementationPlan {
    const eco = this.getECOOrThrow(ecoId);
    if (eco.status !== ECOStatus.APPROVED) {
      throw new Error(`ILLEGAL_STATE: Implementation plan can only be created when ECO is APPROVED. Current: ${eco.status}`);
    }

    this.implementationPlans.set(ecoId, plan);
    this.updateECOStatus(eco, ECOStatus.IMPLEMENTING, eco.createdBy, 'Implementation plan registered');
    return plan;
  }

  public executeChange(ecoId: string, actorId: string): { success: boolean; error?: string } {
    const eco = this.getECOOrThrow(ecoId);
    if (eco.status !== ECOStatus.IMPLEMENTING) {
      throw new Error(`ILLEGAL_STATE: Cannot execute change unless ECO status is IMPLEMENTING. Current: ${eco.status}`);
    }

    const plan = this.implementationPlans.get(ecoId);
    if (!plan) throw new Error('NOT_FOUND: Implementation plan missing.');

    const result = ECOExecutionEngine.executePlan(plan, actorId, this.registeredRevisions);
    if (!result.success) {
      this.updateECOStatus(eco, ECOStatus.BLOCKED, actorId, result.error || 'Execution failed');
      return result;
    }

    eco.implementedAt = new Date().toISOString();
    this.updateECOStatus(eco, ECOStatus.VERIFICATION, actorId, 'Execution completed successfully');
    return { success: true };
  }

  // 6. Verification API
  public verifyChange(
    ecoId: string,
    actualImplementedChanges: any[],
    verifierId: string
  ): ECOVerificationRecord {
    const eco = this.getECOOrThrow(ecoId);
    if (eco.status !== ECOStatus.VERIFICATION) {
      throw new Error(`ILLEGAL_STATE: Cannot verify change unless ECO status is VERIFICATION. Current: ${eco.status}`);
    }

    const changeSet = this.changeSets.get(ecoId);
    const plan = this.implementationPlans.get(ecoId);
    if (!changeSet || !plan) throw new Error('NOT_FOUND: Change set or implementation plan missing.');

    const record = ECOVerificationEngine.verifyChange(eco, changeSet, plan, actualImplementedChanges, verifierId);
    this.verifications.set(ecoId, record);

    if (record.verdict !== ECOVerificationVerdict.VERIFIED) {
      this.updateECOStatus(eco, ECOStatus.FAILED, verifierId, `Verification failed: ${record.verdict}`);
    }

    return record;
  }

  // 7. Release & Forensic Snapshot Gate API
  public releaseECO(ecoId: string, actorId: string, expectedVersion?: number): { eco: EngineeringChangeOrder; snapshot: ECOSnapshot; forensicEvidence: ECOForensicEvidence } {
    const eco = this.getECOOrThrow(ecoId);
    this.checkConcurrency(eco, expectedVersion);

    if (eco.status !== ECOStatus.VERIFICATION) {
      throw new Error(`ILLEGAL_TRANSITION: Cannot release ECO in status ${eco.status}`);
    }

    const impact = this.impactGraphs.get(ecoId);
    if (!impact || impact.status !== 'COMPLETE') {
      throw new Error('RELEASE_GATE_FAILED: Mandatory Impact Analysis is missing or INCOMPLETE.');
    }

    const approvalsList = this.approvals.get(ecoId) || [];
    const requiredRoles = this.getRequiredApprovalRoles(eco);
    const approvedRoles = approvalsList.filter(a => a.decision === ApprovalDecision.APPROVE).map(a => a.role);
    if (!requiredRoles.every(r => approvedRoles.includes(r))) {
      throw new Error('RELEASE_GATE_FAILED: Required approvals not satisfied.');
    }

    const verif = this.verifications.get(ecoId);
    if (!verif || verif.verdict !== ECOVerificationVerdict.VERIFIED) {
      throw new Error('RELEASE_GATE_FAILED: Verification not passed.');
    }

    // Freeze hashes
    const changeSet = this.changeSets.get(ecoId)!;
    const plan = this.implementationPlans.get(ecoId)!;

    const changeSetHash = ECOCanonicalizer.computeChangeSetHash(changeSet);
    const impactHash = ECOCanonicalizer.computeImpactHash(impact);
    const approvalHash = ECOCanonicalizer.computeApprovalHash(approvalsList);
    const implementationHash = ECOCanonicalizer.computeImplementationHash(plan);
    const verificationHash = ECOCanonicalizer.computeVerificationHash(verif);

    const ecoHash = ECOCanonicalizer.computeECOHash(eco, changeSetHash, impactHash, approvalHash, implementationHash, verificationHash);
    const ecoDependencyHash = ECOCanonicalizer.computeECODependencyHash(eco.dependsOnEcoIds);

    this.updateECOStatus(eco, ECOStatus.RELEASED, actorId, 'Released legally via release gate');
    eco.releasedAt = new Date().toISOString();

    const snapshot: ECOSnapshot = {
      ecoId: eco.ecoId,
      ecoNumber: eco.ecoNumber,
      status: ECOStatus.RELEASED,
      sourceRevisions: eco.affectedRevisionIds,
      targetRevisions: changeSet.changes.map(c => c.targetRevisionId!).filter(Boolean),
      changeSetHash,
      impactHash,
      approvalHash,
      verificationHash,
      ecoHash,
      timestamp: eco.releasedAt
    };

    const forensicEvidence: ECOForensicEvidence = {
      beforeStateHash: ECOCanonicalizer.computeObjectHash(changeSet.changes.map(c => c.beforeState)),
      afterStateHash: ECOCanonicalizer.computeObjectHash(changeSet.changes.map(c => c.proposedState)),
      changeSetHash,
      impactHash,
      approvalHash,
      implementationHash,
      verificationHash,
      ecoHash,
      ecoDependencyHash
    };

    return { eco, snapshot, forensicEvidence };
  }

  public closeECO(ecoId: string, actorId: string): EngineeringChangeOrder {
    const eco = this.getECOOrThrow(ecoId);
    if (eco.status !== ECOStatus.RELEASED) {
      throw new Error(`ILLEGAL_TRANSITION: Cannot close an ECO that is not RELEASED. Current: ${eco.status}`);
    }

    this.updateECOStatus(eco, ECOStatus.CLOSED, actorId, 'ECO Closed');
    eco.closedAt = new Date().toISOString();
    return eco;
  }

  public cancelECO(ecoId: string, actorId: string, reason: string): EngineeringChangeOrder {
    const eco = this.getECOOrThrow(ecoId);
    if (eco.status === ECOStatus.RELEASED || eco.status === ECOStatus.CLOSED) {
      throw new Error(`ILLEGAL_TRANSITION: Cannot cancel RELEASED or CLOSED ECO.`);
    }

    this.updateECOStatus(eco, ECOStatus.CANCELLED, actorId, reason);
    return eco;
  }

  public reopenECO(ecoId: string, actorId: string, reason: string): EngineeringChangeOrder {
    const eco = this.getECOOrThrow(ecoId);
    if (eco.status !== ECOStatus.REJECTED && eco.status !== ECOStatus.CANCELLED) {
      throw new Error(`ILLEGAL_TRANSITION: Can only reopen REJECTED or CANCELLED ECOs. Current: ${eco.status}`);
    }

    this.updateECOStatus(eco, ECOStatus.DRAFT, actorId, `Reopened: ${reason}`);
    return eco;
  }

  // Independent Verification Method
  public verifyECO(ecoId: string): { valid: boolean; verdict: string; details: string[] } {
    const eco = this.ecos.get(ecoId);
    if (!eco) return { valid: false, verdict: 'NOT_FOUND', details: ['ECO does not exist'] };

    const details: string[] = [];
    if (eco.status === ECOStatus.RELEASED) {
      const verif = this.verifications.get(ecoId);
      if (!verif || verif.verdict !== ECOVerificationVerdict.VERIFIED) {
        details.push('VERIFICATION_FAILURE: Verification record missing or failed');
      }
      const impact = this.impactGraphs.get(ecoId);
      if (!impact || impact.status !== 'COMPLETE') {
        details.push('IMPACT_INCOMPLETE: Impact analysis not complete');
      }
    }

    return {
      valid: details.length === 0,
      verdict: details.length === 0 ? 'VALID' : 'INVALID',
      details
    };
  }

  // Getters & Utils
  public getECO(ecoId: string): EngineeringChangeOrder | undefined {
    return this.ecos.get(ecoId);
  }

  public getECOHistory(ecoId: string): ECOAuditRecord[] {
    return this.auditLog.filter(a => a.ecoId === ecoId);
  }

  public getECOImpact(ecoId: string): ECOImpactGraph | undefined {
    return this.impactGraphs.get(ecoId);
  }

  public getECOEvidence(ecoId: string): any {
    return {
      eco: this.ecos.get(ecoId),
      changeSet: this.changeSets.get(ecoId),
      impact: this.impactGraphs.get(ecoId),
      approvals: this.approvals.get(ecoId),
      plan: this.implementationPlans.get(ecoId),
      verification: this.verifications.get(ecoId)
    };
  }

  private getRequiredApprovalRoles(eco: EngineeringChangeOrder): ApprovalRole[] {
    const roles = [ApprovalRole.ENGINEERING];
    if (eco.reason === ChangeReason.SAFETY || eco.priority === Priority.CRITICAL) {
      roles.push(ApprovalRole.SAFETY, ApprovalRole.QUALITY);
    }
    if (eco.changeScope === ChangeScope.MANUFACTURING || eco.changeScope === ChangeScope.MULTI_DOMAIN) {
      roles.push(ApprovalRole.MANUFACTURING);
    }
    return roles;
  }

  private updateECOStatus(eco: EngineeringChangeOrder, newStatus: ECOStatus, actorId: string, reason: string) {
    const oldStatus = eco.status;
    eco.status = newStatus;
    eco.ecoVersion++;
    this.recordAudit(eco.ecoId, `TRANSITION_TO_${newStatus}`, actorId, oldStatus, newStatus, reason);
  }

  private recordAudit(ecoId: string, action: string, actorId: string, beforeStatus: ECOStatus | null, afterStatus: ECOStatus, reason: string) {
    this.auditLog.push({
      ecoId,
      action,
      actorId,
      timestamp: new Date().toISOString(),
      beforeStatus,
      afterStatus,
      reason
    });
  }

  private checkConcurrency(eco: EngineeringChangeOrder, expectedVersion?: number) {
    if (expectedVersion !== undefined && eco.ecoVersion !== expectedVersion) {
      throw new Error(`CONCURRENT_MODIFICATION: ECO version mismatch. Current ${eco.ecoVersion}, Expected ${expectedVersion}`);
    }
  }

  private assertValidTransition(fromState: ECOStatus, toState: ECOStatus) {
    if (fromState === ECOStatus.CLOSED && toState === ECOStatus.IMPLEMENTING) {
      throw new Error('ILLEGAL_TRANSITION: CLOSED -> IMPLEMENTING is forbidden');
    }
    if (fromState === ECOStatus.REJECTED && toState === ECOStatus.RELEASED) {
      throw new Error('ILLEGAL_TRANSITION: REJECTED -> RELEASED is forbidden');
    }
    if (fromState === ECOStatus.CANCELLED && toState === ECOStatus.APPROVED) {
      throw new Error('ILLEGAL_TRANSITION: CANCELLED -> APPROVED is forbidden');
    }
    if (fromState === ECOStatus.RELEASED && toState === ECOStatus.DRAFT) {
      throw new Error('ILLEGAL_TRANSITION: RELEASED -> DRAFT is forbidden');
    }
  }

  private getECOOrThrow(ecoId: string): EngineeringChangeOrder {
    const eco = this.ecos.get(ecoId);
    if (!eco) throw new Error(`NOT_FOUND: ECO ${ecoId} does not exist.`);
    return eco;
  }
}
