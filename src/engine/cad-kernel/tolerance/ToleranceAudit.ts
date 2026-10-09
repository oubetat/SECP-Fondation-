/**
 * SECP CAD Kernel — Tolerance Audit
 * Phase 2 (PATCH-021)
 */

import { ToleranceContext, ToleranceOperation } from './ToleranceContext';
import { EngineeringHashChain } from '../../evidence/EngineeringHashChain';
import { EngineeringClock, DeterministicClock } from '../../core/clock';

export interface ToleranceAuditRecord {
  operation: ToleranceOperation;
  inputScale: number;
  unit: string;
  requestedTolerance: number;
  effectiveTolerance: number;
  policyId: string;
  escalation: boolean;
  reason?: string;
  deterministicDecision: boolean;
  timestamp: string; 
  hash?: string;
}

export class ToleranceAudit {
  private static records: ToleranceAuditRecord[] = [];
  private static clock: EngineeringClock = new DeterministicClock("2026-08-18T00:00:00.000Z");

  public static setClock(clock: EngineeringClock): void {
    this.clock = clock;
  }

  public static record(record: Omit<ToleranceAuditRecord, 'hash' | 'timestamp'>): void {
    const timestamp = this.clock.iso ? this.clock.iso() : this.clock.now().toISOString();
    const payload = {
      ...record,
      timestamp
    };
    const { canonicalHash } = EngineeringHashChain.computeCanonicalHash(payload);
    const fullRecord = {
      ...payload,
      hash: canonicalHash
    };
    this.records.push(fullRecord);
  }

  public static getRecords(): ToleranceAuditRecord[] {
    return [...this.records];
  }

  public static clear(): void {
    this.records = [];
  }
}
