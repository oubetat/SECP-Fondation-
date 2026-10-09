/**
 * PATCH-SECP-065: Asset Health Engine
 * Computes the overall health score of an industrial asset.
 */

import { MachineState, AssetHealthReport, ReliabilityMetrics, ReliabilityDecision } from './AssetReliabilityTypes';

export class AssetHealthEngine {
  public static computeHealth(
    assetId: string,
    state: MachineState,
    metrics: ReliabilityMetrics,
    degradationLevel: number
  ): AssetHealthReport {
    // Base health from availability
    let healthScore = metrics.availability;

    // Deduct for degradation
    healthScore -= (degradationLevel * 0.5);

    // Deduct for non-running states if they are faults
    if (state === 'FAULT') healthScore -= 50;
    if (state === 'DEGRADED') healthScore -= 20;

    healthScore = Math.max(0, Math.min(100, healthScore));

    // Simple decision mapping (will be refined by ReliabilityDecisionEngine)
    let decision: ReliabilityDecision = 'CONTINUE';
    if (healthScore < 40) decision = 'EMERGENCY_SHUTDOWN';
    else if (healthScore < 70) decision = 'IMMEDIATE_MAINTENANCE';
    else if (healthScore < 90) decision = 'INSPECT_SOON';

    return {
      assetId,
      timestamp: new Date().toISOString(),
      state,
      healthScore,
      activeAlarms: healthScore < 70 ? ['LOW_HEALTH_THRESHOLD'] : [],
      reliabilityDecision: decision,
      evidenceRootHash: `sha256-health-root-${assetId}-${Math.floor(healthScore)}`
    };
  }
}
