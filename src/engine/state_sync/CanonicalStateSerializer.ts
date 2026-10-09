import * as crypto from 'crypto';
import { EngineeringState, StateSynchronizationEvent, SynchronizationSession, StateDependency } from './types';

export class CanonicalStateSerializer {
  public static sha256(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  public static canonicalizePayload(payload: any): string {
    if (!payload) return '{}';
    const sortedObj: any = {};
    Object.keys(payload).sort().forEach(k => {
      const v = payload[k];
      sortedObj[k] = typeof v === 'number' ? Number(v.toFixed(6)) : v;
    });
    return JSON.stringify(sortedObj);
  }

  public static computeStateHash(
    payloadHash: string,
    entityId: string,
    stateVersion: number,
    schemaVersion: string,
    parentStateHash: string,
    dependencyFingerprint: string
  ): string {
    return this.sha256([
      payloadHash,
      entityId,
      stateVersion,
      schemaVersion,
      parentStateHash,
      dependencyFingerprint
    ].join('|'));
  }

  public static computeDependencyFingerprint(dependencies: StateDependency[]): string {
    if (dependencies.length === 0) return 'NO_DEPS';
    const sortedDeps = [...dependencies].sort((a, b) => a.entityId.localeCompare(b.entityId));
    const depStrings = sortedDeps.map(d => `${d.entityId}:${d.stateVersion}:${d.stateHash}`);
    return this.sha256(depStrings.join('|'));
  }

  public static computeSyncEventHash(
    payloadStr: string,
    previousEventHash: string
  ): string {
    return this.sha256([payloadStr, previousEventHash].join('|'));
  }

  public static computeSyncRootHash(
    sourceStateHash: string,
    targetStateHash: string,
    eventChainHash: string,
    conflictHashes: string
  ): string {
    return this.sha256([
      sourceStateHash,
      targetStateHash,
      eventChainHash,
      conflictHashes
    ].join('|SYNC_ROOT|'));
  }
}
