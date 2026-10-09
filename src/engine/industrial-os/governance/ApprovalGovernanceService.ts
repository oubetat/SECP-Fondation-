import { 
  ApprovalRecord, 
  EngineeringRole, 
  GovernanceContext, 
  GovernanceVerdict 
} from './types';
import { EngineeringObject, EngineeringObjectStatus } from '../types';
import { EvidenceBus } from '../evidence-bus/EvidenceBus';
import * as crypto from 'crypto';

export class ApprovalGovernanceService {
  private static instance: ApprovalGovernanceService;
  private approvals = new Map<string, ApprovalRecord[]>(); // objectIdentityId -> records
  private evidenceBus = EvidenceBus.getInstance();

  private constructor() {}

  public static getInstance(): ApprovalGovernanceService {
    if (!ApprovalGovernanceService.instance) {
      ApprovalGovernanceService.instance = new ApprovalGovernanceService();
    }
    return ApprovalGovernanceService.instance;
  }

  /**
   * Requests an approval for an object transition.
   */
  public requestApproval(
    obj: EngineeringObject, 
    targetState: EngineeringObjectStatus, 
    requestedBy: string,
    requiredRoles: EngineeringRole[]
  ): string {
    const requestId = crypto.randomBytes(16).toString("hex");
    
    // In a real system, we'd notify the approvers
    console.log(`[ApprovalGovernanceService] Approval requested for ${obj.identity.identityId} to ${targetState} by ${requestedBy}`);
    
    const records = this.approvals.get(obj.identity.identityId) || [];
    
    // Create pending records for required roles? 
    // Or just one record representing the request.
    // Let's create one record per required role for multi-person approval support.
    
    requiredRoles.forEach(role => {
      const record: ApprovalRecord = {
        approvalId: crypto.randomBytes(16).toString("hex"),
        objectIdentityId: obj.identity.identityId,
        revisionId: obj.identity.revisionId,
        approverId: '', // Pending
        role,
        decision: 'REQUESTED',
        timestamp: new Date().toISOString(),
        policyContextHash: '', // Would be computed from current policy state
        evidenceRefs: [],
        previousState: obj.status,
        targetState
      };
      records.push(record);
    });

    this.approvals.set(obj.identity.identityId, records);
    
    this.evidenceBus.publish({
      evidenceType: 'WORKFLOW_EVIDENCE',
      sourceCapability: 'APPROVAL_SERVICE',
      sourceOperation: 'REQUEST_APPROVAL',
      payload: {
        action: 'APPROVAL_REQUESTED',
        targetState,
        requiredRoles,
        requestedBy
      },
      correlationId: requestId,
      subjectIdentityId: obj.identity.identityId,
      sourceIdentityId: requestedBy,
      producerIdentityId: 'APPROVAL_SERVICE'
    });

    return requestId;
  }

  /**
   * Submits an approval decision.
   */
  public submitDecision(
    objIdentityId: string,
    approverId: string,
    role: EngineeringRole,
    decision: 'APPROVED' | 'REJECTED',
    evidenceRefs: string[] = []
  ): void {
    const records = this.approvals.get(objIdentityId);
    if (!records) throw new Error('No approval request found for this object');

    const pendingRecord = records.find(r => r.role === role && r.decision === 'REQUESTED');
    if (!pendingRecord) throw new Error(`No pending approval for role ${role}`);

    // Update record
    const updatedRecord: ApprovalRecord = {
      ...pendingRecord,
      approverId,
      decision,
      timestamp: new Date().toISOString(),
      evidenceRefs
    };

    const index = records.indexOf(pendingRecord);
    records[index] = updatedRecord;
    this.approvals.set(objIdentityId, records);

    this.evidenceBus.publish({
      evidenceType: 'WORKFLOW_EVIDENCE',
      sourceCapability: 'APPROVAL_SERVICE',
      sourceOperation: 'RECORD_APPROVAL',
      payload: {
        action: decision === 'APPROVED' ? 'APPROVAL_GRANTED' : 'APPROVAL_REJECTED',
        role,
        approverId,
        revisionId: pendingRecord.revisionId
      },
      correlationId: `APP-${crypto.randomBytes(16).toString("hex")}`,
      subjectIdentityId: objIdentityId,
      sourceIdentityId: approverId,
      producerIdentityId: 'APPROVAL_SERVICE'
    });
  }

  /**
   * Checks if all required approvals are met for an object.
   */
  public isApproved(objIdentityId: string, revisionId: string, targetState: EngineeringObjectStatus): boolean {
    const records = this.approvals.get(objIdentityId);
    if (!records) return false;

    const relevantRecords = records.filter(r => r.revisionId === revisionId && r.targetState === targetState);
    if (relevantRecords.length === 0) return false;

    // All requested must be APPROVED
    return relevantRecords.every(r => r.decision === 'APPROVED');
  }

  public getApprovals(objIdentityId: string): ApprovalRecord[] {
    return this.approvals.get(objIdentityId) || [];
  }
}
