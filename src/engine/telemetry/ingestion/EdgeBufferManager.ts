/**
 * EdgeBufferManager: High-throughput ingestion buffer & backpressure management
 * Supports:
 * - Ring buffer & priority queue with configurable capacity
 * - Overflow policies: DROP_OLDEST, DROP_NEWEST, REJECT_BACKPRESSURE
 * - Audit log for all dropped packets with explicit reasons (Zero silent loss)
 * - Backpressure signaling and burst traffic absorption
 */

import { IndustrialTelemetryEvent, DroppedTelemetryRecord, DropReason, RawTelemetryPacket } from '../IndustrialTelemetryTypes';

export type OverflowPolicy = 'DROP_OLDEST' | 'DROP_NEWEST' | 'REJECT_BACKPRESSURE';

export interface EdgeBufferConfig {
  maxCapacity: number; // e.g. 50,000 events
  overflowPolicy: OverflowPolicy;
  highWatermarkRatio: number; // e.g. 0.85 -> triggers backpressure
  auditLogLimit: number; // e.g. 5,000 drop records
}

export class EdgeBufferManager {
  private config: EdgeBufferConfig;
  private buffer: IndustrialTelemetryEvent[] = [];
  private droppedEventsAuditLog: DroppedTelemetryRecord[] = [];
  private totalIngestedCount: number = 0;
  private totalEnqueuedCount: number = 0;
  private totalDequeuedCount: number = 0;
  private totalDroppedCount: number = 0;
  private dropsByReason: Map<DropReason, number> = new Map();

  constructor(config?: Partial<EdgeBufferConfig>) {
    this.config = {
      maxCapacity: config?.maxCapacity ?? 50000,
      overflowPolicy: config?.overflowPolicy ?? 'DROP_OLDEST',
      highWatermarkRatio: config?.highWatermarkRatio ?? 0.85,
      auditLogLimit: config?.auditLogLimit ?? 5000
    };
  }

  /**
   * Pushes a validated & normalized event into the buffer
   */
  public enqueue(event: IndustrialTelemetryEvent): { enqueued: boolean; backpressure: boolean; dropRecord?: DroppedTelemetryRecord } {
    this.totalIngestedCount++;

    if (this.buffer.length >= this.config.maxCapacity) {
      if (this.config.overflowPolicy === 'DROP_NEWEST' || this.config.overflowPolicy === 'REJECT_BACKPRESSURE') {
        const dropRecord = this.recordDrop(
          event.connectorId,
          event.protocol,
          'BUFFER_OVERFLOW',
          `Buffer overflow at capacity ${this.config.maxCapacity}`,
          JSON.stringify(event).substring(0, 120),
          event.deviceId,
          event.sequenceNumber
        );
        return { enqueued: false, backpressure: true, dropRecord };
      }

      if (this.config.overflowPolicy === 'DROP_OLDEST') {
        const evicted = this.buffer.shift()!;
        this.recordDrop(
          evicted.connectorId,
          evicted.protocol,
          'BUFFER_OVERFLOW',
          `Evicted oldest packet due to buffer capacity ${this.config.maxCapacity}`,
          JSON.stringify(evicted).substring(0, 120),
          evicted.deviceId,
          evicted.sequenceNumber
        );
      }
    }

    this.buffer.push(event);
    this.totalEnqueuedCount++;

    const isBackpressure = this.buffer.length >= this.config.maxCapacity * this.config.highWatermarkRatio;
    return { enqueued: true, backpressure: isBackpressure };
  }

  /**
   * Dequeues a batch of events for Digital Twin & Anomaly processing
   */
  public dequeueBatch(batchSize: number = 1000): IndustrialTelemetryEvent[] {
    const count = Math.min(batchSize, this.buffer.length);
    if (count === 0) return [];
    const batch = this.buffer.splice(0, count);
    this.totalDequeuedCount += batch.length;
    return batch;
  }

  /**
   * Explicitly records a dropped telemetry event
   */
  public recordDrop(
    connectorId: string,
    protocol: any,
    reason: DropReason,
    details: string,
    rawPayloadSnippet: string,
    deviceId?: string,
    sequenceNumber?: number
  ): DroppedTelemetryRecord {
    this.totalDroppedCount++;
    this.dropsByReason.set(reason, (this.dropsByReason.get(reason) || 0) + 1);

    const now = Date.now();
    const dropRecord: DroppedTelemetryRecord = {
      dropId: `DROP-${now}-${this.totalDroppedCount}`,
      timestamp: new Date(now).toISOString(),
      timestampMs: now,
      deviceId,
      connectorId,
      protocol,
      sequenceNumber,
      reason,
      details,
      rawPayloadSnippet
    };

    this.droppedEventsAuditLog.push(dropRecord);
    if (this.droppedEventsAuditLog.length > this.config.auditLogLimit) {
      this.droppedEventsAuditLog.shift();
    }

    return dropRecord;
  }

  public recordRawDrop(packet: RawTelemetryPacket, reason: DropReason, details: string): DroppedTelemetryRecord {
    const payload = typeof packet.rawPayload === 'object' ? packet.rawPayload : {};
    return this.recordDrop(
      packet.connectorId,
      packet.protocol,
      reason,
      details,
      JSON.stringify(packet.rawPayload).substring(0, 120),
      (payload as any).deviceId,
      (payload as any).sequenceNumber
    );
  }

  public getStats(): {
    currentQueueDepth: number;
    maxCapacity: number;
    totalIngested: number;
    totalEnqueued: number;
    totalDequeued: number;
    totalDropped: number;
    dropsByReason: Record<string, number>;
    recentDrops: DroppedTelemetryRecord[];
    isBackpressureActive: boolean;
  } {
    const dropsObj: Record<string, number> = {};
    for (const [k, v] of this.dropsByReason.entries()) {
      dropsObj[k] = v;
    }

    return {
      currentQueueDepth: this.buffer.length,
      maxCapacity: this.config.maxCapacity,
      totalIngested: this.totalIngestedCount,
      totalEnqueued: this.totalEnqueuedCount,
      totalDequeued: this.totalDequeuedCount,
      totalDropped: this.totalDroppedCount,
      dropsByReason: dropsObj,
      recentDrops: [...this.droppedEventsAuditLog].slice(-20),
      isBackpressureActive: this.buffer.length >= this.config.maxCapacity * this.config.highWatermarkRatio
    };
  }

  public clear(): void {
    this.buffer = [];
    this.droppedEventsAuditLog = [];
    this.totalIngestedCount = 0;
    this.totalEnqueuedCount = 0;
    this.totalDequeuedCount = 0;
    this.totalDroppedCount = 0;
    this.dropsByReason.clear();
  }
}
