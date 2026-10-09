/**
 * SECP Industrial OS v3 — PATCH-181: Immutable Audit & Data Lineage Engine
 * Records deterministic Merkle-linked audit trail events and tracks end-to-end data lineage.
 */

import { AuditTrailEvent, DataLineageRecord } from './EngineeringDataOSTypes';
import { generateDeterministicHashSync } from '../../../lib/hash';

export class ImmutableAuditEngine {
  private static events: AuditTrailEvent[] = [];
  private static lineages: Map<string, DataLineageRecord> = new Map();

  public static clear(): void {
    this.events = [];
    this.lineages.clear();
  }

  /**
   * Records an immutable audit event in a cryptographically linked Merkle hash chain.
   */
  public static recordEvent(
    actorId: string,
    actorRole: string,
    action: AuditTrailEvent['action'],
    targetObjectId: string,
    targetRevisionId: string,
    newState: string,
    changeDetails: Record<string, any>,
    previousState?: string
  ): AuditTrailEvent {
    const previousEventHash = this.events.length > 0
      ? this.events[this.events.length - 1].eventHash
      : '0x0000000000000000000000000000000000000000000000000000000000000000';

    const timestamp = new Date().toISOString();
    const eventId = `EVT-${generateDeterministicHashSync({ actorId, action, targetObjectId, targetRevisionId, timestamp }).substring(0, 8)}`;

    const payload = {
      eventId,
      timestamp,
      actorId,
      actorRole,
      action,
      targetObjectId,
      targetRevisionId,
      newState,
      previousState: previousState || 'NONE',
      changeDetails,
      previousEventHash
    };

    const eventHash = `0x${generateDeterministicHashSync(payload)}`;

    const event: AuditTrailEvent = {
      eventId,
      timestamp,
      actorId,
      actorRole,
      action,
      targetObjectId,
      targetRevisionId,
      previousState,
      newState,
      changeDetails,
      eventHash,
      previousEventHash
    };

    this.events.push(event);
    this.updateLineage(targetObjectId, targetRevisionId, actorId, action, newState, changeDetails);
    return event;
  }

  /**
   * Internal helper to maintain the end-to-end Data Lineage record.
   */
  private static updateLineage(
    objectId: string,
    revisionId: string,
    author: string,
    action: string,
    state: string,
    details: Record<string, any>
  ): void {
    let lineage = this.lineages.get(objectId);
    const timestamp = new Date().toISOString();

    if (!lineage) {
      lineage = {
        objectId,
        revisionId,
        originatingSystem: 'SECP_ENGINEERING_DATA_OS_V3',
        createdBy: author,
        createdAt: timestamp,
        modificationHistory: [],
        passedVerificationGates: ['GATE-SECP-179', 'GATE-SECP-180'],
        approvals: [],
        associatedConfigurations: ['CFG-DEFAULT-PROD'],
        associatedECOs: []
      };
      this.lineages.set(objectId, lineage);
    }

    lineage.revisionId = revisionId;
    lineage.modificationHistory.push({
      revision: revisionId,
      author,
      timestamp,
      changeReason: `${action}: ${JSON.stringify(details)}`,
      contentHash: details.contentHash || 'HASH-N/A'
    });

    if (action === 'APPROVE' || action === 'SIGN') {
      lineage.approvals.push({
        role: details.role || 'ENGINEER',
        signer: author,
        timestamp
      });
    }
  }

  /**
   * Verifies the cryptographic chain integrity of the entire audit log.
   */
  public static verifyAuditChainIntegrity(): {
    isChainValid: boolean;
    totalEvents: number;
    tamperedEventIndex?: number;
    reason: string;
  } {
    if (this.events.length === 0) {
      return { isChainValid: true, totalEvents: 0, reason: 'Audit trail is empty.' };
    }

    let expectedPrevHash = '0x0000000000000000000000000000000000000000000000000000000000000000';

    for (let i = 0; i < this.events.length; i++) {
      const evt = this.events[i];
      if (evt.previousEventHash !== expectedPrevHash) {
        return {
          isChainValid: false,
          totalEvents: this.events.length,
          tamperedEventIndex: i,
          reason: `Chain broken at event #${i} (${evt.eventId}). Previous hash mismatch.`
        };
      }

      const payload = {
        eventId: evt.eventId,
        timestamp: evt.timestamp,
        actorId: evt.actorId,
        actorRole: evt.actorRole,
        action: evt.action,
        targetObjectId: evt.targetObjectId,
        targetRevisionId: evt.targetRevisionId,
        newState: evt.newState,
        previousState: evt.previousState || 'NONE',
        changeDetails: evt.changeDetails,
        previousEventHash: evt.previousEventHash
      };

      const recomputedHash = `0x${generateDeterministicHashSync(payload)}`;
      if (recomputedHash !== evt.eventHash) {
        return {
          isChainValid: false,
          totalEvents: this.events.length,
          tamperedEventIndex: i,
          reason: `Event content tampered at event #${i} (${evt.eventId}). Hash recomputation mismatch.`
        };
      }

      expectedPrevHash = evt.eventHash;
    }

    return {
      isChainValid: true,
      totalEvents: this.events.length,
      reason: 'All audit events are cryptographically linked in an immutable Merkle chain.'
    };
  }

  public static getAuditTrail(): AuditTrailEvent[] {
    return [...this.events];
  }

  public static getDataLineage(objectId: string): DataLineageRecord | undefined {
    return this.lineages.get(objectId);
  }
}
