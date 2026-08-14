/**
 * PATCH-SECP-065: Degradation Detection Engine
 * Identifies wear-and-tear trends from telemetry data.
 */

import { TelemetryReading } from './AssetReliabilityTypes';

export class DegradationDetectionEngine {
  public static analyzeTrend(readings: TelemetryReading[]): { degradationLevel: number; trend: 'STABLE' | 'DEGRADING' | 'CRITICAL' } {
    if (readings.length < 2) return { degradationLevel: 0, trend: 'STABLE' };

    // Simple slope analysis for demonstration
    const first = readings[0].value;
    const last = readings[readings.length - 1].value;
    const delta = last - first;

    let trend: 'STABLE' | 'DEGRADING' | 'CRITICAL' = 'STABLE';
    let degradationLevel = 0;

    if (delta > 50) {
      trend = 'CRITICAL';
      degradationLevel = 80;
    } else if (delta > 10) {
      trend = 'DEGRADING';
      degradationLevel = 30;
    }

    return { degradationLevel, trend };
  }
}
