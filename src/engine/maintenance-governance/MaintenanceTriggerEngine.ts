/**
 * PATCH-SECP-066: Maintenance Trigger Engine
 * Converts degradation and reliability events into maintenance triggers.
 */

import { MaintenanceTrigger, TriggerType } from './MaintenanceGovernanceTypes';

export class MaintenanceTriggerEngine {
  public static createTrigger(
    assetId: string, 
    type: TriggerType, 
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    evidenceRef: string
  ): MaintenanceTrigger {
    return {
      triggerId: `trig-${assetId}-${Date.now()}`,
      assetId,
      triggerType: type,
      source: 'SECP-065-RELIABILITY-MONITOR',
      severity,
      evidenceReference: evidenceRef,
      detectedAt: new Date().toISOString()
    };
  }

  public static evaluatePolicy(degradationLevel: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (degradationLevel > 80) return 'CRITICAL';
    if (degradationLevel > 50) return 'HIGH';
    if (degradationLevel > 20) return 'MEDIUM';
    return 'LOW';
  }
}
