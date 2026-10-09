import {
  ReliabilityPackage,
  AssetHealthReport,
  AssetReliabilityRecord,
  ReliabilityMetrics,
  TelemetryReading,
  FailureEvent
} from './AssetReliabilityTypes';

export class ReliabilityPackageEngine {
  public static compilePackage(
    healthReport: AssetHealthReport,
    reliabilityRecord: AssetReliabilityRecord,
    metrics: ReliabilityMetrics,
    recentTelemetry: TelemetryReading[],
    recentFailures: FailureEvent[]
  ): ReliabilityPackage {
    return {
      packageId: `pkg-rel-${healthReport.assetId}`,
      assetId: healthReport.assetId,
      timestamp: new Date().toISOString(),
      healthReport,
      reliabilityRecord,
      metrics,
      recentTelemetry,
      recentFailures
    };
  }
}
