/**
 * PATCH-SECP-066: Maintenance Provenance Engine
 * Generates immutable audit records for maintenance governance.
 */

import { MaintenanceWorkOrder, MaintenanceProvenanceRecord } from './MaintenanceGovernanceTypes';

export class MaintenanceProvenanceEngine {
  public static createProvenanceRecord(wo: MaintenanceWorkOrder, evidenceHash: string, signedBy: string): MaintenanceProvenanceRecord {
    const timestamp = new Date().toISOString();
    const payload = `${wo.workOrderId}|${evidenceHash}|${signedBy}|${timestamp}`;
    const sig = `sig-maint-${this.simpleHash(payload)}`;

    return {
      recordId: `maint-prov-${wo.workOrderId}`,
      workOrderId: wo.workOrderId,
      evidenceRootHash: evidenceHash,
      signedBy,
      immutableSignature: sig,
      timestamp
    };
  }

  private static simpleHash(input: string): string {
    let hash = 0x87654321;
    for (let i = 0; i < input.length; i++) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash &= hash;
    }
    return Math.abs(hash).toString(16).toUpperCase();
  }
}
