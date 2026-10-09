import { GovernanceContext, GovernanceDecision, GovernanceVerdict } from './types';
import { EvidenceBus } from '../evidence-bus/EvidenceBus';
import { EngineeringEventStore } from '../event-model/EngineeringEventStore';

export class GovernanceAuditService {
  private static instance: GovernanceAuditService;
  private evidenceBus = EvidenceBus.getInstance();
  private eventStore = EngineeringEventStore.getInstance();

  private constructor() {}

  public static getInstance(): GovernanceAuditService {
    if (!GovernanceAuditService.instance) {
      GovernanceAuditService.instance = new GovernanceAuditService();
    }
    return GovernanceAuditService.instance;
  }

  /**
   * Audits a governance decision.
   */
  public auditDecision(decision: GovernanceDecision): void {
    const { context, verdict, reason, evaluatedAt, decisionId } = decision;

    // 1. Publish to Evidence Bus
    this.evidenceBus.publish({
      evidenceType: 'SECURITY_EVIDENCE',
      sourceCapability: 'GOVERNANCE_ENGINE',
      sourceOperation: context.requestedAction,
      payload: {
        decisionId,
        verdict,
        reason,
        evaluatedAt,
        action: context.requestedAction,
        identity: context.identity,
        objectIdentityId: context.object?.identity.identityId,
        revisionId: context.object?.revisionId,
        policiesEvaluated: decision.policiesEvaluated
      },
      correlationId: context.correlationId,
      subjectIdentityId: context.object?.identity.identityId || 'GLOBAL',
      sourceIdentityId: context.identity,
      producerIdentityId: 'GOVERNANCE_ENGINE'
    });

    // 2. Record to Unified Event Store
    this.eventStore.append({
      eventType: verdict === 'ALLOW' ? 'USER_ACTION' : 'POLICY_VIOLATION',
      actor: { id: context.identity, type: 'USER' },
      source: { service: 'GOVERNANCE', component: 'AUDIT', version: '1.0' },
      objectRefs: [context.object?.id || 'SYSTEM'],
      payload: {
        decisionId,
        verdict,
        reason,
        action: context.requestedAction,
        correlationId: context.correlationId
      },
      correlationId: context.correlationId
    });

    if (verdict === 'DENY' || verdict === 'POLICY_CONFLICT') {
      this.eventStore.append({
        eventType: 'POLICY_VIOLATION',
        actor: { id: context.identity, type: 'USER' },
        source: { service: 'GOVERNANCE', component: 'AUDIT', version: '1.0' },
        objectRefs: [context.object?.id || 'SYSTEM'],
        payload: {
          decisionId,
          verdict,
          reason,
          action: context.requestedAction,
          violationType: 'GOVERNANCE_REJECTION'
        },
        correlationId: context.correlationId
      });
    }
  }
}
