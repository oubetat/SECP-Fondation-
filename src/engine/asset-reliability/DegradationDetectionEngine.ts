import { TelemetryReading } from './AssetReliabilityTypes';

export class DegradationDetectionEngine {
  public static analyzeTrend(readings: TelemetryReading[]): {
    trend: 'DEGRADING' | 'STABLE' | string;
    degradationLevel: number;
  } {
    if (readings.length < 2) {
      return { trend: 'STABLE', degradationLevel: 0 };
    }

    const first = readings[0].value;
    const last = readings[readings.length - 1].value;

    const trend = last > first ? 'DEGRADING' : 'STABLE';
    const degradationLevel = Math.abs(last - first);

    return {
      trend,
      degradationLevel
    };
  }
}
