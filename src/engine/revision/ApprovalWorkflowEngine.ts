import { createHash } from 'crypto';
import { EngineeringChangeOrder } from './EcoManagementEngine';

// ==========================================
// 1. Core Types & Interfaces
// ==========================================

export type WorkflowType =
  | 'CHANGE_APPROVAL'
  | 'ECO_APPROVAL'
  | 'REVISION_APPROVAL'
  | 'RELEASE_APPROVAL'
  | 'DESIGN_REVIEW'
  | 'FEM_REVIEW'
  | 'CFD_REVIEW'
  | 'CAM_REVIEW'
  | 'DRAWING_REVIEW'
  | 'SAFETY_REVIEW';

export type WorkflowStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'WAITING'
  | 'BLOCKED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'COMPLETED';

export type StepStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CHANGES_REQUESTED'
  | 'SKIPPED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'BLOCKED';

export type StepExecutionOrder = 'SEQUENTIAL' | 'PARALLEL' | 'HYBRID';

export type ApproverRole =
  | 'ENGINEERING_LEAD'
  | 'QUALITY_LEAD'
  | 'MANUFACTURING_LEAD'
  | 'SAFETY_AUTHORITY'
  | 'PROJECT_AUTHORITY';

export interface ApprovalPolicy {
  policyId: string;
  version: number;
  requiredRoles: ApproverRole[];
  executionOrder: StepExecutionOrder;
  riskThreshold: number;
  severityThreshold: string;
  requiresSafetySignoff: boolean;
  requiresUnanimous: boolean;
}

export interface ApprovalStep {
  stepId: string;
  name: string;
  role: ApproverRole;
  assignedApprover: string;
  status: StepStatus;
  decision?: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES';
  comment?: string;
  timestamp?: string;
  sequenceNumber: number;
  dependencies: string[]; // Prerequisite step IDs
  evidenceId?: string;
}

export interface ApprovalDelegation {
  delegator: string;
  delegate: string;
  startDate: string;
  endDate: string;
  scope: string;
  reason: string;
}

export interface ApprovalWorkflow {
  workflowId: string;
  workflowType: WorkflowType;
  objectId: string;
  objectType: 'ECO' | 'REVISION' | 'CHANGE';
  version: number;
  status: WorkflowStatus;
  policyId: string;
  policyVersion: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  owner: string;
  requester: string;
  
  // High fidelity structures
  steps: ApprovalStep[];
  delegations: ApprovalDelegation[];
  
  // Snapshots for Change Detection & Integrity
  objectHashSnapshot: string;
  riskScoreSnapshot: number;
  integrityHash?: string;
  cycleNumber: number;
}

export interface ApprovalPackage {
  workflow: ApprovalWorkflow;
  steps: ApprovalStep[];
  decisions: any[];
  auditTrail: any[];
  packageHash: string;
}

// ==========================================
// 2. Approval Workflow Engine
// ==========================================

export class ApprovalWorkflowEngine {
  private workflows: Map<string, ApprovalWorkflow> = new Map();
  private policies: Map<string, ApprovalPolicy> = new Map();
  private auditEvents: Array<{ timestamp: string; type: string; details: string; actor: string }> = [];

  constructor() {
    this.seedPolicies();
  }

  public reset(): void {
    this.workflows.clear();
    this.auditEvents = [];
  }

  public loadDemoWorkflows(): void {
    this.seedDefaultWorkflow();
  }

  private seedPolicies() {
    // Normal Low-Risk Policy
    this.policies.set('POL-LOW-RISK', {
      policyId: 'POL-LOW-RISK',
      version: 1,
      requiredRoles: ['ENGINEERING_LEAD'],
      executionOrder: 'SEQUENTIAL',
      riskThreshold: 30,
      severityThreshold: 'MINOR',
      requiresSafetySignoff: false,
      requiresUnanimous: true
    });

    // High-Risk Multi-Level Policy
    this.policies.set('POL-HIGH-RISK', {
      policyId: 'POL-HIGH-RISK',
      version: 2,
      requiredRoles: ['ENGINEERING_LEAD', 'QUALITY_LEAD', 'MANUFACTURING_LEAD', 'PROJECT_AUTHORITY'],
      executionOrder: 'PARALLEL',
      riskThreshold: 70,
      severityThreshold: 'CRITICAL',
      requiresSafetySignoff: true,
      requiresUnanimous: true
    });
  }

  private seedDefaultWorkflow() {
    // Register default workflow for pre-seeded ECO-2026-000001
    const ecoHash = createHash('sha256').update('ECO-2026-000001-v1').digest('hex');
    this.createWorkflow(
      'WF-001',
      'ECO_APPROVAL',
      'ECO-ID-0001',
      'ECO',
      'CHIEF_DESIGNER',
      75, // Risk score
      ecoHash
    );
  }

  // ==========================================
  // Dynamic Policy Routing & Setup
  // ==========================================

  public createWorkflow(
    workflowId: string,
    workflowType: WorkflowType,
    objectId: string,
    objectType: 'ECO' | 'REVISION' | 'CHANGE',
    requester: string,
    riskScore: number,
    objectHash: string
  ): ApprovalWorkflow {
    // Select policy based on multi-factor risk parameters
    const policyId = riskScore > 60 ? 'POL-HIGH-RISK' : 'POL-LOW-RISK';
    const policy = this.policies.get(policyId)!;

    // Generate steps according to policy definition
    const steps: ApprovalStep[] = [];
    if (policyId === 'POL-HIGH-RISK') {
      // Parallel high-risk steps
      steps.push({
        stepId: 'STP-001',
        name: 'Aerospace Engineering Review',
        role: 'ENGINEERING_LEAD',
        assignedApprover: 'LEAD_INTEGRATOR',
        status: 'PENDING',
        sequenceNumber: 1,
        dependencies: []
      });
      steps.push({
        stepId: 'STP-002',
        name: 'Material & Quality Assurance Gate',
        role: 'QUALITY_LEAD',
        assignedApprover: 'QUALITY_LEAD',
        status: 'PENDING',
        sequenceNumber: 1,
        dependencies: []
      });
      steps.push({
        stepId: 'STP-003',
        name: 'Toolpath & CAM Feasibility Study',
        role: 'MANUFACTURING_LEAD',
        assignedApprover: 'MFG_LEAD',
        status: 'PENDING',
        sequenceNumber: 1,
        dependencies: []
      });
      steps.push({
        stepId: 'STP-004',
        name: 'Rotor Assembly Final Release Authority',
        role: 'PROJECT_AUTHORITY',
        assignedApprover: 'CHIEF_DESIGNER',
        status: 'PENDING',
        sequenceNumber: 2,
        dependencies: ['STP-001', 'STP-002', 'STP-003'] // Waits for other 3 steps to finish (Hybrid sequence)
      });
    } else {
      // Sequential simple step
      steps.push({
        stepId: 'STP-001',
        name: 'Design Change Verification',
        role: 'ENGINEERING_LEAD',
        assignedApprover: 'LEAD_INTEGRATOR',
        status: 'PENDING',
        sequenceNumber: 1,
        dependencies: []
      });
    }

    const workflow: ApprovalWorkflow = {
      workflowId,
      workflowType,
      objectId,
      objectType,
      version: 1,
      status: 'ACTIVE',
      policyId,
      policyVersion: policy.version,
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      owner: requester,
      requester,
      steps,
      delegations: [],
      objectHashSnapshot: objectHash,
      riskScoreSnapshot: riskScore,
      cycleNumber: 1
    };

    this.workflows.set(workflowId, workflow);
    this.logEvent(workflowId, 'WORKFLOW_STARTED', requester, `Approval process initialized using Policy ${policyId} (v${policy.version})`);

    return workflow;
  }

  // ==========================================
  // Sign-off Actions & Decision Matrices
  // ==========================================

  public submitDecision(
    workflowId: string,
    stepId: string,
    actor: string,
    role: ApproverRole,
    decision: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES',
    comment: string,
    currentObjectHash: string
  ): ApprovalWorkflow {
    const wf = this.workflows.get(workflowId);
    if (!wf) throw new Error(`WORKFLOW_NOT_FOUND`);

    if (wf.status !== 'ACTIVE') {
      throw new Error(`WORKFLOW_INACTIVE: Deciding on a closed or inactive workflow is prohibited.`);
    }

    // 1. Change Detection / Artifact Drift safeguard
    if (wf.objectHashSnapshot !== currentObjectHash) {
      wf.status = 'BLOCKED';
      this.workflows.set(workflowId, wf);
      this.logEvent(workflowId, 'HASH_MISMATCH_ALERT', actor, `Workflow BLOCKED. Target geometry revision changed dynamically mid-flight!`);
      throw new Error(`ARTIFACT_DRIFT_DETECTED: Target design variant modified since approval start. Signature voided.`);
    }

    const step = wf.steps.find(s => s.stepId === stepId);
    if (!step) throw new Error(`STEP_NOT_FOUND`);

    // 2. Separation of duties rules
    if (actor === wf.requester) {
      throw new Error(`SELF_APPROVAL_VIOLATION: Requester is barred from signing off on self-authored changes.`);
    }

    // 3. Delegation lookup
    let isAuthorized = step.assignedApprover === actor;
    if (!isAuthorized) {
      const delegation = wf.delegations.find(d => d.delegate === actor && d.scope === step.role);
      if (delegation) {
        const now = new Date();
        const start = new Date(delegation.startDate);
        const end = new Date(delegation.endDate);
        if (now >= start && now <= end) {
          isAuthorized = true;
          this.logEvent(workflowId, 'DELEGATE_SIGN_OFF', actor, `Delegate ${actor} signed off on behalf of ${step.assignedApprover}.`);
        }
      }
    }

    if (!isAuthorized) {
      throw new Error(`UNAUTHORIZED_ACTOR: User context lacks required project or role authorization for step '${step.name}'.`);
    }

    // 4. Sequence dependency assertion
    const openPrereqs = step.dependencies.some(depId => {
      const dep = wf.steps.find(s => s.stepId === depId);
      return dep && dep.status !== 'APPROVED';
    });

    if (openPrereqs) {
      throw new Error(`PREREQUISITE_LOCKED: Predecessor reviews must be COMPLETED prior to submitting downstream votes.`);
    }

    // 5. Commit decision
    step.status = decision === 'APPROVE' ? 'APPROVED' : decision === 'REJECT' ? 'REJECTED' : 'CHANGES_REQUESTED';
    step.decision = decision;
    step.comment = comment;
    step.timestamp = new Date().toISOString();
    const sigPayload = `${workflowId}:${stepId}:${actor}:${decision}:${step.timestamp}`;
    step.evidenceId = `SIG-${createHash('sha256').update(sigPayload).digest('hex').slice(0, 16).toUpperCase()}`;

    this.logEvent(workflowId, 'STEP_DECISION', actor, `${step.role} signed off decision: ${decision}. Comment: ${comment}`);

    // 6. Handle Rejections or changes
    if (decision === 'REJECT') {
      wf.status = 'REJECTED';
      wf.completedAt = new Date().toISOString();
    } else if (decision === 'REQUEST_CHANGES') {
      wf.status = 'BLOCKED';
    } else {
      // Check if all steps are completed
      const allDone = wf.steps.every(s => s.status === 'APPROVED');
      if (allDone) {
        wf.status = 'COMPLETED';
        wf.completedAt = new Date().toISOString();
        this.logEvent(workflowId, 'WORKFLOW_COMPLETED', 'SYSTEM', `All multi-disciplinary approvals verified successfully.`);
      }
    }

    this.workflows.set(workflowId, wf);
    return wf;
  }

  // ==========================================
  // Delegation Support
  // ==========================================

  public addDelegation(
    workflowId: string,
    delegator: string,
    delegate: string,
    scope: ApproverRole,
    reason: string
  ) {
    const wf = this.workflows.get(workflowId);
    if (!wf) throw new Error(`WORKFLOW_NOT_FOUND`);

    wf.delegations.push({
      delegator,
      delegate,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(), // 24-hour temporary delegation
      scope,
      reason
    });

    this.workflows.set(workflowId, wf);
    this.logEvent(workflowId, 'DELEGATION_REGISTERED', delegator, `Temporary delegate authority delegated to ${delegate} for role ${scope}.`);
  }

  // ==========================================
  // Dynamic Rework Cycle Reinjection
  // ==========================================

  public triggerReworkCycle(workflowId: string, actor: string, newObjectHash: string) {
    const wf = this.workflows.get(workflowId);
    if (!wf) throw new Error(`WORKFLOW_NOT_FOUND`);

    wf.status = 'ACTIVE';
    wf.cycleNumber += 1;
    wf.objectHashSnapshot = newObjectHash;

    // Reset steps while preserving old cycles in audit logs
    wf.steps.forEach(s => {
      s.status = 'PENDING';
      s.decision = undefined;
      s.comment = undefined;
      s.timestamp = undefined;
      s.evidenceId = undefined;
    });

    this.workflows.set(workflowId, wf);
    this.logEvent(workflowId, 'REWORK_CYCLE_STARTED', actor, `Injected new engineering iteration loop. Cycle: ${wf.cycleNumber}`);
  }

  // ==========================================
  // General Helpers & Audit Packing
  // ==========================================

  public getWorkflow(workflowId: string): ApprovalWorkflow | undefined {
    return this.workflows.get(workflowId);
  }

  public getAllWorkflows(): ApprovalWorkflow[] {
    return Array.from(this.workflows.values());
  }

  public getHistory(workflowId: string) {
    return this.auditEvents.filter(e => e.details.includes(workflowId) || e.details.toLowerCase().includes('workflow'));
  }

  public generateApprovalPackage(workflowId: string): ApprovalPackage {
    const wf = this.workflows.get(workflowId);
    if (!wf) throw new Error(`WORKFLOW_NOT_FOUND`);

    const payload = JSON.stringify({
      workflowId: wf.workflowId,
      status: wf.status,
      snapshotHash: wf.objectHashSnapshot,
      steps: wf.steps.map(s => ({ id: s.stepId, status: s.status, sig: s.evidenceId }))
    });

    const packageHash = createHash('sha256').update(payload).digest('hex');
    wf.integrityHash = packageHash;

    return {
      workflow: wf,
      steps: wf.steps,
      decisions: wf.steps.filter(s => s.decision),
      auditTrail: this.getHistory(workflowId),
      packageHash
    };
  }

  private logEvent(workflowId: string, type: string, actor: string, details: string) {
    this.auditEvents.push({
      timestamp: new Date().toISOString(),
      type,
      actor,
      details: `[${workflowId}] ${details}`
    });
  }
}
