/**
 * SECP Industrial OS v2 — Timeline & Hash Chain Tamper Detection Engine
 * Immutable Chronological Event Trace with Cryptographic Hash Chaining
 */

import { ProvenanceTimelineEvent, AgentIdentity } from "./types";
import { CanonicalizationEngine } from "./CanonicalizationEngine";

export class CAMProvenanceTimelineEngine {
  private events: ProvenanceTimelineEvent[] = [];

  public appendEvent(
    artifactId: string,
    action: string,
    agent: AgentIdentity,
    payload: any,
    recordingMode: "ORIGINAL" | "RETROSPECTIVE" = "ORIGINAL",
    customSourceTimestamp?: number
  ): ProvenanceTimelineEvent {
    const sequence = this.events.length + 1;
    const now = Date.now();
    const sourceTimestamp = customSourceTimestamp || now;

    const previousHash = this.events.length > 0 
      ? this.events[this.events.length - 1].currentEventHash 
      : "0000000000000000000000000000000000000000000000000000000000000000";

    const payloadHash = CanonicalizationEngine.computeHash(payload);

    const eventContent = {
      sequence,
      artifactId,
      action,
      agent,
      sourceTimestamp,
      recordedTimestamp: now,
      recordingMode,
      payloadHash,
      previousHash
    };

    const currentEventHash = CanonicalizationEngine.computeHash(eventContent);

    const event: ProvenanceTimelineEvent = {
      eventId: `EVT_${sequence.toString().padStart(6, "0")}`,
      eventSequence: sequence,
      artifactId,
      action,
      agent,
      sourceTimestamp,
      recordedTimestamp: now,
      recordingMode,
      payloadHash,
      previousEventHash: previousHash,
      currentEventHash
    };

    this.events.push(event);
    return event;
  }

  public getEvents(): ProvenanceTimelineEvent[] {
    return [...this.events];
  }

  /**
   * Validates cryptographic integrity of entire hash chain
   */
  public validateChainIntegrity(): {
    isValid: boolean;
    brokenAtSequence?: number;
    details: string;
  } {
    if (this.events.length === 0) {
      return { isValid: true, details: "Timeline is empty." };
    }

    let expectedPrevHash = "0000000000000000000000000000000000000000000000000000000000000000";

    for (let i = 0; i < this.events.length; i++) {
      const evt = this.events[i];

      if (evt.previousEventHash !== expectedPrevHash) {
        return {
          isValid: false,
          brokenAtSequence: evt.eventSequence,
          details: `Sequence ${evt.eventSequence} previous hash mismatch. Expected ${expectedPrevHash}, found ${evt.previousEventHash}`
        };
      }

      const eventContent = {
        sequence: evt.eventSequence,
        artifactId: evt.artifactId,
        action: evt.action,
        agent: evt.agent,
        sourceTimestamp: evt.sourceTimestamp,
        recordedTimestamp: evt.recordedTimestamp,
        recordingMode: evt.recordingMode,
        payloadHash: evt.payloadHash,
        previousHash: evt.previousEventHash
      };

      const recalculatedHash = CanonicalizationEngine.computeHash(eventContent);
      if (recalculatedHash !== evt.currentEventHash) {
        return {
          isValid: false,
          brokenAtSequence: evt.eventSequence,
          details: `Sequence ${evt.eventSequence} hash payload mismatch. Calculated ${recalculatedHash}, recorded ${evt.currentEventHash}`
        };
      }

      expectedPrevHash = evt.currentEventHash;
    }

    return {
      isValid: true,
      details: `Hash chain valid across ${this.events.length} chronological events.`
    };
  }

  /**
   * Intentionally tamper with event at sequence (for adversarial test verification)
   */
  public tamperEventPayload(sequenceNumber: number): void {
    const evt = this.events.find(e => e.eventSequence === sequenceNumber);
    if (evt) {
      evt.action = "TAMPERED_ACTION_OVERWRITE";
      // Hash is intentionally NOT updated to simulate malicious tampering
    }
  }
}
