/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-073: Chain of Custody & Evidence Snapshot Engine
 */

import { EvidenceCustodyRecord, EvidenceSnapshot, CustodyAction } from './ForensicTypes';
import { ArtifactHasher } from './ArtifactRegistry';
import { EngineeringClock } from '../../../clock/EngineeringClock';

export class ChainOfCustodyEngine {
  private readonly custodyChain: EvidenceCustodyRecord[] = [];
  private readonly snapshotChain: EvidenceSnapshot[] = [];

  public appendCustodyEvent(params: {
    readonly evidenceId: string;
    readonly actor: string;
    readonly action: CustodyAction;
    readonly source: string;
    readonly destination: string;
    readonly reason: string;
    readonly authorization: string;
    readonly resultingArtifactId: string;
    readonly payloadHash: string;
  }): EvidenceCustodyRecord {
    const previousRecord = this.custodyChain.length > 0
      ? this.custodyChain[this.custodyChain.length - 1]
      : undefined;

    const previousHash = previousRecord ? previousRecord.newHash : '0000000000000000000000000000000000000000000000000000000000000000';
    const now = EngineeringClock.nowISO();
    const custodyEventId = `custody-${this.custodyChain.length + 1}-${ArtifactHasher.computeHash(params).substring(0, 16)}`;
    
    const eventContent = `${previousHash}|${params.evidenceId}|${params.actor}|${params.action}|${now}|${params.payloadHash}`;
    const newHash = ArtifactHasher.computeHash(eventContent);
    const signature = `SIG-${params.actor}-${newHash.substring(0, 16)}`;

    const record: EvidenceCustodyRecord = {
      evidenceId: params.evidenceId,
      custodyEventId,
      actor: params.actor,
      action: params.action,
      timestamp: now,
      source: params.source,
      destination: params.destination,
      previousHash,
      newHash,
      reason: params.reason,
      authorization: params.authorization,
      signature,
      resultingArtifactId: params.resultingArtifactId
    };

    this.custodyChain.push(record);
    return record;
  }

  public verifyCustodyChain(): { readonly isValid: boolean; readonly brokenAtEventId?: string } {
    for (let i = 0; i < this.custodyChain.length; i++) {
      const record = this.custodyChain[i];
      const prevHash = i === 0 ? '0000000000000000000000000000000000000000000000000000000000000000' : this.custodyChain[i - 1].newHash;
      if (record.previousHash !== prevHash) {
        return { isValid: false, brokenAtEventId: record.custodyEventId };
      }
    }
    return { isValid: true };
  }

  public getCustodyRecords(): readonly EvidenceCustodyRecord[] {
    return [...this.custodyChain];
  }

  public createSnapshot(params: {
    readonly artifactHashes: Record<string, string>;
    readonly environmentHash: string;
    readonly configurationHash: string;
    readonly processIdentity: string;
    readonly runIdentity: string;
  }): EvidenceSnapshot {
    const prevSnapshot = this.snapshotChain.length > 0
      ? this.snapshotChain[this.snapshotChain.length - 1]
      : undefined;

    const parentSnapshotHash = prevSnapshot ? prevSnapshot.snapshotRootHash : undefined;
    const now = EngineeringClock.nowISO();
    const snapshotId = `snap-${this.snapshotChain.length + 1}-${ArtifactHasher.computeHash(params).substring(0, 16)}`;

    const snapshotContent = {
      snapshotId,
      timestamp: now,
      artifactHashes: params.artifactHashes,
      environmentHash: params.environmentHash,
      configurationHash: params.configurationHash,
      processIdentity: params.processIdentity,
      runIdentity: params.runIdentity,
      parentSnapshotHash
    };

    const snapshotRootHash = ArtifactHasher.computeHash(snapshotContent);

    const snapshot: EvidenceSnapshot = {
      ...snapshotContent,
      snapshotRootHash
    };

    this.snapshotChain.push(snapshot);
    return snapshot;
  }

  public verifySnapshotChain(): boolean {
    for (let i = 0; i < this.snapshotChain.length; i++) {
      const snap = this.snapshotChain[i];
      const prevRoot = i === 0 ? undefined : this.snapshotChain[i - 1].snapshotRootHash;
      if (snap.parentSnapshotHash !== prevRoot) {
        return false;
      }
    }
    return true;
  }

  public getSnapshots(): readonly EvidenceSnapshot[] {
    return [...this.snapshotChain];
  }
}
