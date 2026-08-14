/**
 * PATCH-SECP-065: Reliability Package Engine
 * Bundles all reliability evidence into a single verifiable package.
 */

import { 
  ReliabilityPackage, 
  AssetHealthReport, 
  AssetReliabilityRecord, 
  ReliabilityMetrics, 
  TelemetryReading, 
  FailureEvent 
} from './AssetReliabilityTypes';

export class ReliabilityPackageEngine {
  public static createPackage(
    report: AssetHealthReport,
    record: AssetReliabilityRecord,
    metrics: ReliabilityMetrics,
    telemetry: TelemetryReading[],
    failures: FailureEvent[]
  ): ReliabilityPackage {
    return {
      packageId: `rel-pkg-${report.assetId}-${Date.now()}`,
      assetId: report.assetId,
      timestamp: new Date().toISOString(),
      healthReport: report,
      reliabilityRecord: record,
      metrics,
      recentTelemetry: telemetry,
      recentFailures: failures
    };
  }
}
