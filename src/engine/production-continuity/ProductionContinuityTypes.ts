/**
 * PATCH-SECP-067: Production Continuity & Disaster Recovery Types
 * Defines the core models for industrial state recovery and continuity governance.
 */

export type ProductionState = 'NOMINAL' | 'DEGRADED' | 'SUSPENDED' | 'CRITICAL_OUTAGE' | 'RECOVERING' | 'FAILOVER_ACTIVE';

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type RecoveryStrategy = 'WARM_BOOT' | 'COLD_BOOT' | 'FAILOVER' | 'ROLLBACK' | 'MANUAL_INTERVENTION';

export type ContinuityDecision = 'CONTINUE_NOMINAL' | 'TRIGGER_FAILOVER' | 'INITIATE_RECOVERY' | 'SUSPEND_PRODUCTION' | 'ESCALATE_TO_ENGINEERING';

export interface ProductionStateSnapshot {
  timestamp: string;
  state: ProductionState;
  activeWorkOrders: string[];
  machineStates: Record<string, string>;
  controlHash: string; // Hash of the control logic state
}

export interface ContinuityPlan {
  planId: string;
  name: string;
  version: string;
  rtoTargetSeconds: number; // Recovery Time Objective
  rpoTargetSeconds: number; // Recovery Point Objective
  strategies: Record<string, RecoveryStrategy>;
  lastTestedAt: string;
}

export interface ContinuityTrigger {
  triggerId: string;
  source: string;
  severity: IncidentSeverity;
  incidentType: 'HARDWARE_FAILURE' | 'SOFTWARE_CORRUPTION' | 'TELEMETRY_LOSS' | 'POWER_OUTAGE' | 'CYBER_SECURITY';
  detectedAt: string;
  evidenceHash: string;
}

export interface RecoveryExecutionRecord {
  executionId: string;
  triggerId: string;
  strategy: RecoveryStrategy;
  startTime: string;
  endTime?: string;
  stepsExecuted: string[];
  backupReference?: string;
  success: boolean;
  actualRtoSeconds?: number;
}

export interface BackupMetadata {
  backupId: string;
  timestamp: string;
  snapshotHash: string;
  integritySignature: string;
  isVerified: boolean;
}

export interface ContinuityProvenanceRecord {
  recordId: string;
  incidentId: string;
  recoveryId: string;
  evidenceRootHash: string;
  signedBy: string;
  immutableSignature: string;
  timestamp: string;
}

export interface ContinuityPackage {
  packageId: string;
  snapshot: ProductionStateSnapshot;
  trigger: ContinuityTrigger;
  recovery: RecoveryExecutionRecord;
  backup: BackupMetadata;
  provenance: ContinuityProvenanceRecord;
}
