import { IdentityClassification, EngineeringIdentity, EngineeringObjectType } from '../../identity/CanonicalEngineeringIdentity';
import { 
  GovernanceContext, 
  GovernanceDecision, 
  GovernanceVerdict, 
  EngineeringRole,
  ApprovalRecord 
} from './types';
import { EngineeringPolicyEngine } from '../policy/EngineeringPolicyEngine';
import { CapabilityResolver } from '../capabilities/CapabilityResolver';
import { EvidenceBus } from '../evidence-bus/EvidenceBus';
import { EngineeringStateMachine } from '../state-machine/EngineeringStateMachine';
import { PolicyContext, AggregatePolicyDecision } from '../policy/types';
import { SeparationOfDutiesEngine } from './SeparationOfDutiesEngine';
import { ApprovalGovernanceService } from './ApprovalGovernanceService';
import { IdentityGovernanceService } from './IdentityGovernanceService';
import * as crypto from 'crypto';

export class EnterpriseGovernanceEngine {
  private static instance: EnterpriseGovernanceEngine;
  private policyEngine = EngineeringPolicyEngine.getInstance();
  private stateMachine = EngineeringStateMachine.getInstance();
  private evidenceBus = EvidenceBus.getInstance();
  private sodEngine = SeparationOfDutiesEngine.getInstance();
  private approvalService = ApprovalGovernanceService.getInstance();
  private identityGov = IdentityGovernanceService.getInstance();
  
  private constructor() {}

  public static getInstance(): EnterpriseGovernanceEngine {
    if (!EnterpriseGovernanceEngine.instance) {
      EnterpriseGovernanceEngine.instance = new EnterpriseGovernanceEngine();
    }
    return EnterpriseGovernanceEngine.instance;
  }

  /**
   * Assigns roles to a user for testing/demo purposes.
   */
  public assignUserRoles(userId: string, roles: EngineeringRole[]): void {
    this.identityGov.assignRole(userId, roles);
  }

  /**
   * Evaluates a governance request.
   */
  public evaluate(context: GovernanceContext): GovernanceDecision {
    const decisionId = crypto.randomBytes(16).toString('hex');
    
    // Resolve roles, org and capabilities if not provided
    const resolvedRoles = context.roles.length > 0 ? context.roles : this.identityGov.getRoles(context.identity);
    const resolvedOrg = context.organizationId || this.identityGov.getOrganizationId(context.identity);
    const resolvedCapabilities = Array.from(new Set([...context.capabilities, ...this.identityGov.getCapabilities(context.identity)]));

    const enrichedContext: GovernanceContext = {
      ...context,
      roles: resolvedRoles,
      organizationId: resolvedOrg,
      capabilities: resolvedCapabilities
    };

    // 1. Separation of Duties (SoD) Validation
    const approvals = context.object ? this.approvalService.getApprovals(context.object.identity.identityId) : [];
    const sodResult = this.sodEngine.validate(enrichedContext, approvals);
    
    if (!sodResult.valid) {
      const decision: GovernanceDecision = {
        decisionId,
        verdict: 'DENY',
        reason: sodResult.reason || 'Separation of Duties Violation',
        policiesEvaluated: ['SOD-CORE-RULES'],
        requiredEvidence: [],
        context: enrichedContext,
        evaluatedAt: new Date().toISOString()
      };
      this.recordGovernanceAudit(enrichedContext, 'DENY', { overallEffect: 'DENY', decisions: [], reason: decision.reason, evaluatedAt: decision.evaluatedAt });
      return decision;
    }

    // 2. Policy Evaluation
    const policyContext: PolicyContext = {
      subject: enrichedContext.object?.identity || { 
        identityId: 'SYSTEM', 
        objectType: EngineeringObjectType.WORKFLOW,
        projectId: enrichedContext.projectId,
        revisionId: '0',
        objectVersion: 0,
        createdBy: 'SYSTEM',
        contentHash: '0',
        timestamp: enrichedContext.timestamp,
        classification: IdentityClassification.INTERNAL,
        tags: []
      },
      operation: enrichedContext.requestedAction,
      revisionId: enrichedContext.object?.revisionId,
      state: enrichedContext.object ? { stateType: enrichedContext.object.status } as any : undefined,
      actor: {
        id: enrichedContext.identity,
        type: 'USER',
        capabilities: enrichedContext.capabilities
      },
      metadata: {
        ...enrichedContext.metadata,
        roles: enrichedContext.roles,
        organizationId: enrichedContext.organizationId,
        projectId: enrichedContext.projectId
      },
      projectId: enrichedContext.projectId,
      environment: {
        timestamp: enrichedContext.timestamp,
        stage: 'PRODUCTION'
      }
    };

    const policyResult = this.policyEngine.evaluate(policyContext);
    
    // 3. Map Policy Effect to Governance Verdict
    const verdict = this.mapPolicyEffectToVerdict(policyResult.overallEffect);
    
    // 4. Record Governance Audit Event (Evidence)
    this.recordGovernanceAudit(enrichedContext, verdict, policyResult);

    return {
      decisionId,
      verdict,
      reason: policyResult.reason,
      policiesEvaluated: policyResult.decisions.map(d => `${d.policyId} v${d.policyVersion}`),
      requiredEvidence: this.extractRequiredEvidence(policyResult),
      context: enrichedContext,
      evaluatedAt: new Date().toISOString()
    };
  }

  private mapPolicyEffectToVerdict(effect: string): GovernanceVerdict {
    switch (effect) {
      case 'ALLOW': return 'ALLOW';
      case 'DENY': return 'DENY';
      case 'BLOCK': return 'DENY';
      case 'REQUIRE_APPROVAL': return 'REQUIRE_REVIEW';
      case 'REQUIRE_VERIFICATION': return 'REQUIRE_REVIEW';
      case 'REQUIRE_EVIDENCE': return 'REQUIRE_EVIDENCE';
      case 'CONFLICT': return 'POLICY_CONFLICT';
      default: return 'UNPROVEN';
    }
  }

  private extractRequiredEvidence(policyResult: AggregatePolicyDecision): string[] {
    const required: string[] = [];
    policyResult.decisions.forEach(d => {
      if (d.effect === 'REQUIRE_EVIDENCE') {
        required.push(...d.matchedConditions);
      }
    });
    return required;
  }

  private recordGovernanceAudit(context: GovernanceContext, verdict: GovernanceVerdict, policyResult: AggregatePolicyDecision): void {
    this.evidenceBus.publish({
      evidenceType: 'SECURITY_EVIDENCE',
      sourceCapability: 'GOVERNANCE_ENGINE',
      sourceOperation: context.requestedAction,
      payload: {
        action: context.requestedAction,
        verdict,
        reason: policyResult.reason,
        identity: context.identity,
        objectIdentityId: context.object?.identity.identityId,
        policies: policyResult.decisions.map(d => d.policyId)
      },
      correlationId: context.correlationId,
      subjectIdentityId: context.object?.identity.identityId || 'GLOBAL',
      sourceIdentityId: context.identity,
      producerIdentityId: 'GOVERNANCE_ENGINE'
    });
  }
}
