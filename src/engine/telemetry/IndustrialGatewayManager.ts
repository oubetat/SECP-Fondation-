/**
 * SECP-102.4: Production Industrial Edge IIoT Gateway & Ingestion Manager
 * Serves as the central operational coordinator for the SECP Industrial Connectivity Core:
 * - Manages protocol connectors (OPC-UA, MQTT, Modbus TCP/RTU, MTConnect)
 * - State machine lifecycle: DISCONNECTED -> CONNECTING -> CONNECTED -> DEGRADED -> DISCONNECTED
 * - Validates schema, timestamps, sequence numbers, physical ranges, and source channel isolation
 * - Propagates normalized events to DigitalTwinTelemetryBridge, IndustrialAnomalyBridge, and IndustrialRulEngine
 * - Enforces zero silent loss with EdgeBufferManager queue & audit logging
 */

import {
  IndustrialTelemetryEvent,
  RawTelemetryPacket,
  TelemetryDataSource
} from './IndustrialTelemetryTypes';
import { IIndustrialProtocolConnector, ConnectorHealthStatus } from './IndustrialProtocolConnector';
import { TelemetryNormalizer } from './ingestion/TelemetryNormalizer';
import { EdgeBufferManager } from './ingestion/EdgeBufferManager';
import { DigitalTwinTelemetryBridge } from './twin/DigitalTwinTelemetryBridge';
import { IndustrialAnomalyBridge } from './twin/IndustrialAnomalyBridge';
import { IndustrialRulEngine } from './twin/IndustrialRulEngine';

export type GatewayState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'DEGRADED';

export interface GatewayPerformanceMetrics {
  totalIngestedCount: number;
  totalNormalizedCount: number;
  totalRejectedCount: number;
  totalDroppedCount: number;
  currentThroughputEventsPerSec: number;
  averageLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  activeConnectorsCount: number;
  queueDepth: number;
  maxQueueCapacity: number;
  isBackpressureActive: boolean;
  activeMode: TelemetryDataSource;
  gatewayState: GatewayState;
}

export class IndustrialGatewayManager {
  private static instance: IndustrialGatewayManager | null = null;

  private state: GatewayState = 'CONNECTED';
  private connectors: Map<string, IIndustrialProtocolConnector> = new Map();
  private deviceSequenceTracker: Map<string, number> = new Map();
  private normalizer: TelemetryNormalizer;
  private bufferManager: EdgeBufferManager;
  private digitalTwinBridge: DigitalTwinTelemetryBridge;
  private anomalyBridge: IndustrialAnomalyBridge;
  private rulEngine: IndustrialRulEngine;

  private activeMode: TelemetryDataSource = 'LIVE';
  private latencySamplesMs: number[] = [];
  private totalIngestedCount: number = 0;
  private totalNormalizedCount: number = 0;
  private totalRejectedCount: number = 0;
  private startTimeMs: number = Date.now();

  constructor() {
    this.normalizer = new TelemetryNormalizer();
    this.bufferManager = new EdgeBufferManager({ maxCapacity: 50000, overflowPolicy: 'DROP_OLDEST' });
    this.digitalTwinBridge = new DigitalTwinTelemetryBridge(undefined, 'LIVE');
    this.anomalyBridge = new IndustrialAnomalyBridge();
    this.rulEngine = new IndustrialRulEngine();
  }

  public static getInstance(): IndustrialGatewayManager {
    if (!this.instance) {
      this.instance = new IndustrialGatewayManager();
    }
    return this.instance;
  }

  public getState(): GatewayState {
    return this.state;
  }

  public transitionState(nextState: GatewayState): void {
    const validTransitions: Record<GatewayState, GatewayState[]> = {
      DISCONNECTED: ['CONNECTING'],
      CONNECTING: ['CONNECTED', 'DISCONNECTED'],
      CONNECTED: ['DEGRADED', 'DISCONNECTED'],
      DEGRADED: ['CONNECTED', 'DISCONNECTED']
    };

    const allowed = validTransitions[this.state];
    if (!allowed || !allowed.includes(nextState)) {
      throw new Error(`INVALID_STATE_TRANSITION: Cannot transition from ${this.state} to ${nextState}`);
    }

    this.state = nextState;
  }

  public setMode(mode: TelemetryDataSource): void {
    this.activeMode = mode;
    this.digitalTwinBridge.setSourceMode(mode);
  }

  public getMode(): TelemetryDataSource {
    return this.activeMode;
  }

  public registerConnector(connector: IIndustrialProtocolConnector): void {
    this.connectors.set(connector.connectorId, connector);
    connector.onPacketReceived(packet => {
      this.ingestPacket(packet);
    });
  }

  public getConnector(connectorId: string): IIndustrialProtocolConnector | undefined {
    return this.connectors.get(connectorId);
  }

  public getAllConnectorStatuses(): ConnectorHealthStatus[] {
    const statuses: ConnectorHealthStatus[] = [];
    for (const conn of this.connectors.values()) {
      statuses.push(conn.health());
    }
    return statuses;
  }

  /**
   * Ingests a raw telemetry packet through the pipeline
   */
  public ingestPacket(packet: RawTelemetryPacket): {
    success: boolean;
    event?: IndustrialTelemetryEvent;
    rejectReason?: string;
  } {
    const startMs = performance.now();
    this.totalIngestedCount++;

    if (this.state === 'DISCONNECTED') {
      this.totalRejectedCount++;
      return { success: false, rejectReason: 'GATEWAY_DISCONNECTED' };
    }

    // Strict Anti-Tamper Guard: Require explicit source tagging
    if (this.activeMode === 'LIVE' && packet.source !== 'LIVE') {
      this.totalRejectedCount++;
      this.bufferManager.recordRawDrop(
        packet,
        'SECURITY_VIOLATION',
        `Channel isolation: Packet source '${packet.source}' rejected in LIVE mode`
      );
      return { success: false, rejectReason: `Channel isolation violation` };
    }

    // 1. Normalization & Validation Pipeline
    const normRes = this.normalizer.normalize(packet);
    if (normRes.rejected || !normRes.event) {
      this.totalRejectedCount++;
      this.bufferManager.recordRawDrop(
        packet,
        normRes.rejectCode || 'SCHEMA_MISMATCH',
        normRes.rejectReason || 'Validation failed'
      );
      return { success: false, rejectReason: normRes.rejectReason };
    }

    const event = normRes.event;

    // 2. Monotonic Sequence Verification per Device
    const prevSeq = this.deviceSequenceTracker.get(event.deviceId);
    if (prevSeq !== undefined) {
      if (event.sequenceNumber <= prevSeq) {
        this.totalRejectedCount++;
        this.bufferManager.recordRawDrop(
          packet,
          'DUPLICATE',
          `Sequence error: Received sequence ${event.sequenceNumber} <= last seen ${prevSeq} for device ${event.deviceId}`
        );
        return { success: false, rejectReason: 'DUPLICATE_OR_OUT_OF_ORDER_SEQUENCE' };
      }
    }
    this.deviceSequenceTracker.set(event.deviceId, event.sequenceNumber);

    this.totalNormalizedCount++;

    // 3. Queue into EdgeBufferManager
    const enqueueRes = this.bufferManager.enqueue(event);
    if (!enqueueRes.enqueued) {
      this.totalRejectedCount++;
      if (this.state === 'CONNECTED') {
        this.state = 'DEGRADED';
      }
      return { success: false, rejectReason: 'Buffer overflow' };
    }

    // 4. Process into Twin, Anomaly, & RUL engines
    this.digitalTwinBridge.applyEvent(event);
    this.anomalyBridge.evaluate(event);
    this.rulEngine.predictRul(event);

    // Track latency
    const elapsedMs = performance.now() - startMs;
    this.latencySamplesMs.push(elapsedMs);
    if (this.latencySamplesMs.length > 5000) {
      this.latencySamplesMs.shift();
    }

    return { success: true, event };
  }

  /**
   * Ingests a high-throughput batch of packets
   */
  public ingestBatch(packets: RawTelemetryPacket[]): {
    normalizedCount: number;
    rejectedCount: number;
    throughputPerSec: number;
  } {
    const startTime = Date.now();
    let norm = 0;
    let rej = 0;

    for (const p of packets) {
      const res = this.ingestPacket(p);
      if (res.success) norm++;
      else rej++;
    }

    const elapsedSec = Math.max(0.001, (Date.now() - startTime) / 1000);
    const throughputPerSec = Math.round(packets.length / elapsedSec);

    return {
      normalizedCount: norm,
      rejectedCount: rej,
      throughputPerSec
    };
  }

  public getPerformanceMetrics(): GatewayPerformanceMetrics {
    const sortedLatency = [...this.latencySamplesMs].sort((a, b) => a - b);
    const count = sortedLatency.length;

    const p50 = count > 0 ? sortedLatency[Math.floor(count * 0.5)] : 0;
    const p95 = count > 0 ? sortedLatency[Math.floor(count * 0.95)] : 0;
    const p99 = count > 0 ? sortedLatency[Math.floor(count * 0.99)] : 0;
    const avg = count > 0 ? sortedLatency.reduce((a, b) => a + b, 0) / count : 0;

    const elapsedSec = Math.max(1, (Date.now() - this.startTimeMs) / 1000);
    const bufferStats = this.bufferManager.getStats();

    return {
      totalIngestedCount: this.totalIngestedCount,
      totalNormalizedCount: this.totalNormalizedCount,
      totalRejectedCount: this.totalRejectedCount,
      totalDroppedCount: bufferStats.totalDropped,
      currentThroughputEventsPerSec: Math.round(this.totalNormalizedCount / elapsedSec),
      averageLatencyMs: parseFloat(avg.toFixed(3)),
      p50LatencyMs: parseFloat(p50.toFixed(3)),
      p95LatencyMs: parseFloat(p95.toFixed(3)),
      p99LatencyMs: parseFloat(p99.toFixed(3)),
      activeConnectorsCount: this.connectors.size,
      queueDepth: bufferStats.currentQueueDepth,
      maxQueueCapacity: bufferStats.maxCapacity,
      isBackpressureActive: bufferStats.isBackpressureActive,
      activeMode: this.activeMode,
      gatewayState: this.state
    };
  }

  public getDigitalTwinState() {
    return this.digitalTwinBridge.getState();
  }

  public getAnomalyInferences() {
    return this.anomalyBridge.getInferenceHistory();
  }

  public getRulPredictions() {
    return this.rulEngine.getPredictionHistory();
  }

  public getBufferStats() {
    return this.bufferManager.getStats();
  }

  public reset(): void {
    this.bufferManager.clear();
    this.digitalTwinBridge.reset();
    this.anomalyBridge.clear();
    this.rulEngine.reset();
    this.deviceSequenceTracker.clear();
    this.latencySamplesMs = [];
    this.totalIngestedCount = 0;
    this.totalNormalizedCount = 0;
    this.totalRejectedCount = 0;
    this.state = 'CONNECTED';
    this.startTimeMs = Date.now();
  }
}
