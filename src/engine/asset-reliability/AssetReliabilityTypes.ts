/**
 * PATCH-SECP-065: Manufacturing Asset & Machine Reliability Types
 * Defines the core structures for machine identity, state, telemetry, health, and reliability.
 * Adheres to SECP Industrial OS decoupling principles.
 */

export type MachineState = 'OFFLINE' | 'IDLE' | 'RUNNING' | 'MAINTENANCE' | 'FAULT' | 'DEGRADED';

export type FailureSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ReliabilityDecision = 'CONTINUE' | 'INSPECT_SOON' | 'IMMEDIATE_MAINTENANCE' | 'EMERGENCY_SHUTDOWN';

export interface AssetIdentity {
  assetId: string;
  name: string;
  type: string;
  manufacturer: string;
  serialNumber: string;
  commissioningDate: string;
  configurationVersion: string;
}

export interface TelemetryReading {
  timestamp: string;
  sensorId: string;
  metricName: string;
  value: number;
  unit: string;
  isValid: boolean;
}

export interface FailureEvent {
  eventId: string;
  assetId: string;
  timestamp: string;
  errorCode: string;
  severity: FailureSeverity;
  description: string;
  relatedProcessId?: string;
}

export interface ReliabilityMetrics {
  mtbf: number; // Mean Time Between Failures (hours)
  mttr: number; // Mean Time To Repair (hours)
  availability: number; // Percentage (0-100)
  totalRuntimeHours: number;
  failureCount: number;
}

export interface AssetHealthReport {
  assetId: string;
  timestamp: string;
  state: MachineState;
  healthScore: number; // 0-100
  activeAlarms: string[];
  reliabilityDecision: ReliabilityDecision;
  evidenceRootHash: string;
}

export interface AssetReliabilityRecord {
  recordId: string;
  assetId: string;
  timestamp: string;
  healthScore: number;
  decision: ReliabilityDecision;
  evidenceRootHash: string;
  signedBy: string;
  immutableSignature: string;
}

export interface AssetLedgerAnchor {
  anchorId: string;
  reliabilityRecordId: string;
  ledgerType: 'INTERNAL' | 'SECP_LOCAL_LEDGER' | string;
  blockIndex: number;
  anchoredHash: string;
  anchoredTimestamp: string;
  anchorValidationSignature: string;
}

export interface ReliabilityPackage {
  packageId: string;
  assetId: string;
  timestamp: string;
  healthReport: AssetHealthReport;
  reliabilityRecord: AssetReliabilityRecord;
  metrics: ReliabilityMetrics;
  recentTelemetry: TelemetryReading[];
  recentFailures: FailureEvent[];
}
