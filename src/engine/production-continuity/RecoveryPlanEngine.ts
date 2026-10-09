import { IncidentSeverity, RecoveryStrategy } from './ProductionContinuityTypes';

export class RecoveryPlanEngine {
  public static selectStrategy(severity: IncidentSeverity): RecoveryStrategy {
    if (severity === 'CRITICAL') {
      return 'FAILOVER';
    }
    if (severity === 'HIGH') {
      return 'FAILOVER';
    }
    if (severity === 'MEDIUM') {
      return 'WARM_BOOT';
    }
    return 'COLD_BOOT';
  }
}
