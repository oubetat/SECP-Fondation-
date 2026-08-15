/**
 * SequenceValidator: Per-stream monotonic sequence tracking & packet loss / anomaly detection
 * Supports:
 * - Expected vs Received sequence tracking
 * - Detection of missing packets (gaps), duplicate packets, reordered packets, and sequence resets
 * - Real-time metrics calculation (packet loss rate, duplicate rate, reorder rate)
 */

import { SequenceValidationResult } from '../IndustrialTelemetryTypes';

export interface StreamSequenceState {
  lastSequence: number;
  expectedSequence: number;
  totalReceived: number;
  totalDuplicates: number;
  totalGaps: number;
  totalLostPackets: number;
  totalReordered: number;
  seenSequences: Set<number>; // Sliding window
}

export class SequenceValidator {
  private streamStates: Map<string, StreamSequenceState> = new Map();
  private readonly slidingWindowSize: number = 10000;

  /**
   * Validates incoming sequence number for a specific device/signal stream
   */
  public evaluate(streamKey: string, seq: number): SequenceValidationResult {
    let state = this.streamStates.get(streamKey);

    if (!state) {
      // First packet in stream
      state = {
        lastSequence: seq,
        expectedSequence: seq + 1,
        totalReceived: 1,
        totalDuplicates: 0,
        totalGaps: 0,
        totalLostPackets: 0,
        totalReordered: 0,
        seenSequences: new Set([seq])
      };
      this.streamStates.set(streamKey, state);

      return {
        status: 'IN_ORDER',
        expectedSequence: seq,
        receivedSequence: seq,
        isAcceptable: true
      };
    }

    state.totalReceived++;

    // 1. Duplicate check
    if (state.seenSequences.has(seq)) {
      state.totalDuplicates++;
      return {
        status: 'DUPLICATE',
        expectedSequence: state.expectedSequence,
        receivedSequence: seq,
        isAcceptable: false
      };
    }

    // 2. In-order check
    if (seq === state.expectedSequence) {
      state.lastSequence = seq;
      state.expectedSequence = seq + 1;
      this.addToSeen(state, seq);
      return {
        status: 'IN_ORDER',
        expectedSequence: seq,
        receivedSequence: seq,
        isAcceptable: true
      };
    }

    // 3. Gap detected (packet loss / jump forward)
    if (seq > state.expectedSequence) {
      const gap = seq - state.expectedSequence;
      state.totalGaps++;
      state.totalLostPackets += gap;
      state.lastSequence = seq;
      state.expectedSequence = seq + 1;
      this.addToSeen(state, seq);

      return {
        status: 'GAP_DETECTED',
        expectedSequence: state.expectedSequence - 1 - gap,
        receivedSequence: seq,
        gapSize: gap,
        isAcceptable: true // We accept the event but record the gap
      };
    }

    // 4. Reordered packet (seq < state.expectedSequence, but not seen before)
    if (seq < state.expectedSequence) {
      state.totalReordered++;
      this.addToSeen(state, seq);
      return {
        status: 'REORDERED',
        expectedSequence: state.expectedSequence,
        receivedSequence: seq,
        isAcceptable: true
      };
    }

    return {
      status: 'IN_ORDER',
      expectedSequence: state.expectedSequence,
      receivedSequence: seq,
      isAcceptable: true
    };
  }

  public getStreamStats(streamKey: string): StreamSequenceState | undefined {
    return this.streamStates.get(streamKey);
  }

  public getAllStats(): {
    totalStreams: number;
    totalPackets: number;
    totalDuplicates: number;
    totalLostPackets: number;
    totalReordered: number;
    overallLossRate: number;
    overallDuplicateRate: number;
  } {
    let totalPackets = 0;
    let totalDuplicates = 0;
    let totalLostPackets = 0;
    let totalReordered = 0;

    for (const state of this.streamStates.values()) {
      totalPackets += state.totalReceived;
      totalDuplicates += state.totalDuplicates;
      totalLostPackets += state.totalLostPackets;
      totalReordered += state.totalReordered;
    }

    const totalPotential = totalPackets + totalLostPackets;
    const overallLossRate = totalPotential > 0 ? totalLostPackets / totalPotential : 0;
    const overallDuplicateRate = totalPackets > 0 ? totalDuplicates / totalPackets : 0;

    return {
      totalStreams: this.streamStates.size,
      totalPackets,
      totalDuplicates,
      totalLostPackets,
      totalReordered,
      overallLossRate,
      overallDuplicateRate
    };
  }

  private addToSeen(state: StreamSequenceState, seq: number): void {
    state.seenSequences.add(seq);
    if (state.seenSequences.size > this.slidingWindowSize) {
      // Evict oldest elements from set
      const iter = state.seenSequences.values();
      for (let i = 0; i < 1000; i++) {
        const next = iter.next();
        if (next.done) break;
        state.seenSequences.delete(next.value);
      }
    }
  }

  public reset(): void {
    this.streamStates.clear();
  }
}
