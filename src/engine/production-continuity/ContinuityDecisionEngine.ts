import { IncidentSeverity, ContinuityDecision } from './ProductionContinuityTypes';

export class ContinuityDecisionEngine {
  public static decide(severity: IncidentSeverity, readiness: boolean): ContinuityDecision {
    if (severity === 'CRITICAL' && readiness) {
      return 'TRIGGER_FAILOVER';
    }
    if (severity === 'HIGH' && readiness) {
      return 'TRIGGER_FAILOVER';
    }
    if (severity === 'CRITICAL') {
      return 'SUSPEND_PRODUCTION';
    }
    return 'CONTINUE_NOMINAL';
  }
}
