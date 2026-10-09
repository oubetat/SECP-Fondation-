import { TwinSyncEvent, SyncVerdict } from './types';
import { DigitalTwinCanonicalizer } from './DigitalTwinCanonicalizer';

export interface SyncRequest {
  sourceDomain: 'CAD' | 'PLM' | 'FEM' | 'CFD' | 'CAM' | 'FIELD';
  sourceVersion: string;
  sourceHash: string;
  targetDomain: 'CAD' | 'PLM' | 'FEM' | 'CFD' | 'CAM' | 'FIELD';
  targetVersion: string;
  targetHash: string;
}

export class TwinSynchronizationEngine {
  private syncLogs: TwinSyncEvent[] = [];

  public synchronizeDomains(request: SyncRequest): TwinSyncEvent {
    const timestamp = new Date().toISOString();
    const syncId = `SYNC-${DigitalTwinCanonicalizer.sha256(request.sourceDomain + request.targetDomain + timestamp).substring(0, 8)}`;

    let result: SyncVerdict = 'SYNCHRONIZED';
    let details: string | undefined = undefined;

    // Rule: No Blind Synchronization - Validate Identity & Hashes
    if (!request.sourceHash || request.sourceHash === '0'.repeat(64) || !request.targetHash || request.targetHash === '0'.repeat(64)) {
      result = 'INCOMPLETE';
      details = 'Missing source or target state hash. Blind synchronization rejected.';
    } else if (request.sourceVersion !== request.targetVersion) {
      // Cross-domain revision conflict
      result = 'CONFLICT';
      details = `Version mismatch between ${request.sourceDomain} (${request.sourceVersion}) and ${request.targetDomain} (${request.targetVersion}). Automatic sync blocked.`;
    } else if (request.sourceHash !== request.targetHash) {
      result = 'OUT_OF_SYNC';
      details = `Domain state hashes do not match. Manual reconciliation required.`;
    }

    const event: TwinSyncEvent = {
      syncId,
      sourceDomain: request.sourceDomain,
      sourceVersion: request.sourceVersion,
      sourceHash: request.sourceHash,
      targetDomain: request.targetDomain,
      targetVersion: request.targetVersion,
      targetHash: request.targetHash,
      timestamp,
      result,
      details
    };

    this.syncLogs.push(event);
    return event;
  }

  public getSyncHistory(): TwinSyncEvent[] {
    return this.syncLogs;
  }
}
