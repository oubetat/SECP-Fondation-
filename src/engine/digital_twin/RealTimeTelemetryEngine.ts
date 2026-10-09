import { EvidenceBus314 } from '../engineering_ai/copilot/EvidenceBus314';

// ============================================================================
// 1. Core Telemetry Enums and Types
// ============================================================================

export type TelemetrySourceType =
  | 'SENSOR'
  | 'MACHINE'
  | 'CONTROLLER'
  | 'PLC'
  | 'DAQ'
  | 'SIMULATION'
  | 'EXTERNAL_SYSTEM';

export type TelemetrySourceMode =
  | 'LIVE_PHYSICAL'
  | 'SIMULATED'
  | 'REPLAY'
  | 'ESTIMATED';

export type TelemetryStreamState =
  | 'STARTING'
  | 'LIVE'
  | 'DEGRADED'
  | 'STALE'
  | 'PAUSED'
  | 'DISCONNECTED'
  | 'FAILED'
  | 'REPLAY'
  | 'UNKNOWN';

export type TelemetryFreshnessState =
  | 'FRESH'
  | 'AGING'
  | 'STALE'
  | 'EXPIRED'
  | 'UNKNOWN';

export type TelemetryMessageQuality =
  | 'VALID'
  | 'SUSPECT'
  | 'INVALID'
  | 'STALE'
  | 'MISSING'
  | 'DUPLICATE'
  | 'OUT_OF_ORDER'
  | 'ESTIMATED'
  | 'REPLAY'
  | 'SIMULATED';

export type TelemetryBufferOverflowPolicy =
  | 'DROP_OLDEST'
  | 'REJECT_NEWEST'
  | 'BLOCK_BACKPRESSURE';

export type TelemetryBufferState =
  | 'NORMAL'
  | 'WARNING'
  | 'OVERFLOW'
  | 'DROPPING'
  | 'FAILED';

export type DeliverySemantics =
  | 'AT_MOST_ONCE'
  | 'AT_LEAST_ONCE'
  | 'EXACTLY_ONCE';

export type AlertSeverity =
  | 'INFO'
  | 'WARNING'
  | 'CRITICAL'
  | 'EMERGENCY';

export type TelemetryMaturityLevel =
  | 'LEVEL_0_MODEL'
  | 'LEVEL_1_DATA_INGESTION'
  | 'LEVEL_2_VERIFIED_STREAMING'
  | 'LEVEL_3_REAL_TIME_INTEGRATION'
  | 'LEVEL_4_EVIDENCE_TRACEABLE'
  | 'LEVEL_5_PRODUCTION_VALIDATED';

export type TruthClassification =
  | 'IMPLEMENTED'
  | 'TESTED'
  | 'VERIFIED'
  | 'VALIDATED'
  | 'PRODUCTION_VALIDATED';

// ============================================================================
// 2. Telemetry Contracts and Schemas
// ============================================================================

export interface TelemetryStream {
  streamId: string;
  sourceId: string;
  sourceType: TelemetrySourceType;
  sourceMode: TelemetrySourceMode;
  measurementType: string;
  unit: string;
  configuredSamplingRate: number; // Hz
  observedSamplingRate: number; // Hz
  status: TelemetryStreamState;
  createdAt: string;
}

export interface TelemetryMessage {
  messageId: string;
  streamId: string;
  sourceId: string;
  sourceTimestamp: string; // Measured at source
  ingestionTimestamp: string; // Arrived at SECP
  processingTimestamp?: string; // Parsed/analyzed
  displayTimestamp?: string; // Rendered in UI
  value: number;
  unit: string;
  quality: TelemetryMessageQuality;
  sequence: number;
  
  // High-level operational metadata context
  machineId?: string;
  processId?: string;
  operationId?: string;
  partId?: string;
}

export interface RawTelemetryMessage {
  rawId: string;
  payload: string;
  timestampReceived: string;
}

export interface TelemetryGap {
  gapId: string;
  streamId: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  estimatedMissingSamples: number;
  evidenceId: string;
}

export interface TelemetrySlaMetrics {
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  throughputMsgSec: number;
  throughputBytesSec: number;
  dropRate: number;
  gapRate: number;
  freshnessSec: number;
}

export interface TelemetryAggregate {
  aggregateId: string;
  streamId: string;
  windowStart: string;
  windowEnd: string;
  inputCount: number;
  method: 'AVERAGE' | 'MIN' | 'MAX' | 'RMS' | 'PEAK' | 'RATE' | 'COUNT';
  value: number;
}

export interface TelemetryAlert {
  alertId: string;
  alertType: 'THRESHOLD_VIOLATION' | 'RAPID_CHANGE' | 'TELEMETRY_GAP' | 'FAULT';
  severity: AlertSeverity;
  sourceId: string;
  streamId?: string;
  timestamp: string;
  message: string;
  actualValue?: number;
  thresholdValue?: number;
  unit?: string;
  validatedFailure: boolean; // Alert !== Failure unless validated
}

// ============================================================================
// 3. Core Engine Implementations
// ============================================================================

export class TelemetryBuffer {
  private queue: TelemetryMessage[] = [];
  private state: TelemetryBufferState = 'NORMAL';
  private droppedCount: number = 0;
  private droppedLogs: Array<{ time: string; reason: string; streamId: string }> = [];

  constructor(
    public readonly maxBufferSize: number = 1000,
    public readonly overflowPolicy: TelemetryBufferOverflowPolicy = 'DROP_OLDEST'
  ) {}

  public push(msg: TelemetryMessage): boolean {
    if (this.queue.length >= this.maxBufferSize) {
      this.state = 'WARNING';
      if (this.overflowPolicy === 'DROP_OLDEST') {
        const oldest = this.queue.shift();
        this.droppedCount++;
        if (oldest) {
          this.logDrop(oldest.streamId, 'BUFFER_OVERFLOW_DROP_OLDEST');
        }
        this.state = 'DROPPING';
      } else if (this.overflowPolicy === 'REJECT_NEWEST') {
        this.droppedCount++;
        this.logDrop(msg.streamId, 'BUFFER_OVERFLOW_REJECT_NEWEST');
        this.state = 'DROPPING';
        return false;
      } else {
        this.state = 'OVERFLOW';
        throw new Error('TELEMETRY_BUFFER_FULL_BACKPRESSURE');
      }
    } else {
      if (this.queue.length < this.maxBufferSize * 0.7) {
        this.state = 'NORMAL';
      }
    }
    this.queue.push(msg);
    return true;
  }

  public poll(): TelemetryMessage | undefined {
    return this.queue.shift();
  }

  public size(): number {
    return this.queue.length;
  }

  public getBufferState(): TelemetryBufferState {
    return this.state;
  }

  public getDroppedCount(): number {
    return this.droppedCount;
  }

  public getDroppedLogs() {
    return this.droppedLogs;
  }

  private logDrop(streamId: string, reason: string) {
    this.droppedLogs.push({
      time: new Date().toISOString(),
      reason,
      streamId
    });
    if (this.droppedLogs.length > 100) {
      this.droppedLogs.shift();
    }
  }
}

export class RealTimeTelemetryQualityEngine {
  public static evaluateMessageQuality(
    msg: TelemetryMessage,
    stream: TelemetryStream,
    history: TelemetryMessage[]
  ): TelemetryMessageQuality {
    // 1. Source Mode Alignment
    if (stream.sourceMode === 'SIMULATED') return 'SIMULATED';
    if (stream.sourceMode === 'REPLAY') return 'REPLAY';
    if (stream.sourceMode === 'ESTIMATED') return 'ESTIMATED';

    // 2. Range Validation
    if (msg.value < -500 || msg.value > 5000) {
      return 'INVALID';
    }

    // 3. Stale Check (Check repetition of values)
    if (history.length >= 4) {
      const last4 = history.slice(-4);
      const allEqual = last4.every(m => m.value === msg.value);
      if (allEqual) {
        return 'STALE';
      }
    }

    // 4. Time Check (Clock sync and negative drift)
    const sourceMs = new Date(msg.sourceTimestamp).getTime();
    const ingestionMs = new Date(msg.ingestionTimestamp).getTime();
    if (sourceMs > ingestionMs + 5000) {
      // Future Clock Drift
      return 'SUSPECT';
    }

    return 'VALID';
  }
}

export class TelemetryRouter {
  private subscribers: Map<string, Array<(msg: TelemetryMessage) => void>> = new Map();
  private subscriberPermissions: Map<string, Set<string>> = new Map(); // subId -> allowedStreamIds

  public registerConsumer(consumerId: string, allowedStreams: string[]): void {
    this.subscriberPermissions.set(consumerId, new Set(allowedStreams));
  }

  public subscribe(consumerId: string, streamId: string, callback: (msg: TelemetryMessage) => void): void {
    const permissions = this.subscriberPermissions.get(consumerId);
    if (!permissions || !permissions.has(streamId)) {
      throw new Error(`ROUTING_ACCESS_DENIED: Consumer ${consumerId} is not authorized for stream ${streamId}`);
    }

    const callbacks = this.subscribers.get(streamId) || [];
    callbacks.push(callback);
    this.subscribers.set(streamId, callbacks);
  }

  public dispatch(msg: TelemetryMessage): void {
    const callbacks = this.subscribers.get(msg.streamId) || [];
    for (const callback of callbacks) {
      try {
        // Consumer Isolation: Failure of one subscriber should never stop telemetry delivery to others
        callback(msg);
      } catch (err) {
        console.error(`CONSUMER_LAG_ALERT: Failure during callback dispatch on stream ${msg.streamId}`, err);
      }
    }
  }
}

export class TelemetryStore {
  private hotData: Map<string, TelemetryMessage[]> = new Map();
  private historicalData: TelemetryMessage[] = [];
  private evidenceData: TelemetryMessage[] = [];
  private retentionPeriodMs: number = 24 * 60 * 60 * 1000; // 24 hours hot storage

  public insert(msg: TelemetryMessage): void {
    const streamId = msg.streamId;
    const streamHot = this.hotData.get(streamId) || [];
    streamHot.push(msg);
    
    // Prune Hot Data according to retention
    const now = Date.now();
    const pruned = streamHot.filter(m => now - new Date(m.ingestionTimestamp).getTime() < this.retentionPeriodMs);
    this.hotData.set(streamId, pruned);

    // Persist to historical database mock
    this.historicalData.push(msg);
    if (this.historicalData.length > 5000) {
      this.historicalData.shift();
    }

    // Independent Evidence Retention
    if (msg.quality === 'INVALID' || msg.quality === 'SUSPECT') {
      this.evidenceData.push(msg);
    }
  }

  public getHotData(streamId: string): TelemetryMessage[] {
    return this.hotData.get(streamId) || [];
  }

  public getHistoricalData(): TelemetryMessage[] {
    return this.historicalData;
  }

  public getEvidenceData(): TelemetryMessage[] {
    return this.evidenceData;
  }
}

export class RealTimeAlertEngine {
  private alerts: TelemetryAlert[] = [];
  private alertCallbacks: Array<(alert: TelemetryAlert) => void> = [];

  public registerAlertCallback(cb: (alert: TelemetryAlert) => void) {
    this.alertCallbacks.push(cb);
  }

  public evaluateRules(msg: TelemetryMessage, previousMsg?: TelemetryMessage): void {
    // 1. Threshold rules
    if (msg.unit === 'Celsius' && msg.value > 120.0) {
      this.triggerAlert({
        alertId: `ALT-THR-${Date.now()}-${Math.random().toString(36).slice(-3)}`,
        alertType: 'THRESHOLD_VIOLATION',
        severity: msg.value > 150.0 ? 'EMERGENCY' : 'CRITICAL',
        sourceId: msg.sourceId,
        streamId: msg.streamId,
        timestamp: new Date().toISOString(),
        message: `High thermal sensor boundary exceeded on Spindle bearing. Value = ${msg.value}°C`,
        actualValue: msg.value,
        thresholdValue: 120.0,
        unit: msg.unit,
        validatedFailure: true
      });
    }

    // 2. Rate of Change detection (Delta value / Delta time)
    if (previousMsg) {
      const dtSec = (new Date(msg.sourceTimestamp).getTime() - new Date(previousMsg.sourceTimestamp).getTime()) / 1000;
      if (dtSec > 0) {
        const rateOfChange = Math.abs(msg.value - previousMsg.value) / dtSec;
        if (rateOfChange > 45.0) { // e.g. sudden drop or spike
          this.triggerAlert({
            alertId: `ALT-ROC-${Date.now()}-${Math.random().toString(36).slice(-3)}`,
            alertType: 'RAPID_CHANGE',
            severity: 'WARNING',
            sourceId: msg.sourceId,
            streamId: msg.streamId,
            timestamp: new Date().toISOString(),
            message: `Abnormal physical rate of change detected: ${rateOfChange.toFixed(2)} units/sec`,
            actualValue: msg.value,
            validatedFailure: false // Alert ≠ Failure without physical validator
          });
        }
      }
    }
  }

  public getAlerts(): TelemetryAlert[] {
    return this.alerts;
  }

  private triggerAlert(alert: TelemetryAlert) {
    this.alerts.push(alert);
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }
    this.alertCallbacks.forEach(cb => {
      try {
        cb(alert);
      } catch (err) {
        console.error('Failure in alert consumer isolation callback', err);
      }
    });

    // Record Alarm event onto cryptographic Evidence Bus
    EvidenceBus314.getInstance().registerEvidence(
      'DESIGN_REVIEW', // Using a valid Copilot source enum
      `RUN-ALERT-${Date.now()}`,
      'REV-1',
      'TelemetryAlertEngine',
      alert.validatedFailure ? 'VALIDATED' : 'FAILED',
      {
        alertId: alert.alertId,
        alertType: alert.alertType,
        severity: alert.severity,
        sourceId: alert.sourceId,
        actualValue: alert.actualValue !== undefined ? alert.actualValue : 'N/A'
      }
    );
  }
}

// ============================================================================
// 4. Primary Orchestration Core Class: RealTimeTelemetryEngine
// ============================================================================

export class RealTimeTelemetryEngine {
  private activeStreams: Map<string, TelemetryStream> = new Map();
  private buffers: Map<string, TelemetryBuffer> = new Map();
  private qualityEngine = new RealTimeTelemetryQualityEngine();
  private router = new TelemetryRouter();
  private store = new TelemetryStore();
  private alertEngine = new RealTimeAlertEngine();

  // Clock drift offset parameters (Source Clock to SECP Clock)
  private clockDriftMap: Map<string, number> = new Map(); // streamId -> ms drift

  // Sequence tracking buffers
  private latestSequenceMap: Map<string, number> = new Map();
  private sequenceHistory: Map<string, number[]> = new Map();
  private messageHistory: Map<string, TelemetryMessage[]> = new Map();

  // Sampling stats and throughput monitoring
  private lastObservedSampleTime: Map<string, number> = new Map();
  private observedSampleIntervals: Map<string, number[]> = new Map();
  private throughputCounter: number = 0;
  private throughputBytesCounter: number = 0;
  private lastStatsResetTime: number = Date.now();
  private statsInterval: any = null;

  // SLA tracking arrays for latency measurements
  private latencyBuffer: number[] = [];

  constructor() {
    this.startThroughputMonitoring();
  }

  public shutdown(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }
  }

  public registerStream(stream: TelemetryStream): void {
    this.activeStreams.set(stream.streamId, {
      ...stream,
      status: 'STARTING'
    });
    this.buffers.set(stream.streamId, new TelemetryBuffer(500, 'DROP_OLDEST'));
    this.latestSequenceMap.set(stream.streamId, -1);
    this.sequenceHistory.set(stream.streamId, []);
    this.messageHistory.set(stream.streamId, []);
    this.clockDriftMap.set(stream.streamId, 0);
  }

  public getStream(streamId: string): TelemetryStream | undefined {
    return this.activeStreams.get(streamId);
  }

  public getAllStreams(): TelemetryStream[] {
    return Array.from(this.activeStreams.values());
  }

  public getRouter(): TelemetryRouter {
    return this.router;
  }

  public getStore(): TelemetryStore {
    return this.store;
  }

  public getAlertEngine(): RealTimeAlertEngine {
    return this.alertEngine;
  }

  public getBuffer(streamId: string): TelemetryBuffer | undefined {
    return this.buffers.get(streamId);
  }

  // ============================================================================
  // Process Pipeline: RAW -> PARSE -> VALIDATE -> NORMALIZE -> ORDER -> QUALITY -> CONTEXT -> ROUTE -> STORE -> EVIDENCE
  // ============================================================================

  public ingestRawMessage(raw: RawTelemetryMessage): TelemetryMessage {
    this.throughputBytesCounter += raw.payload.length;

    // 1. RAW Ingestion
    const stream = this.parseRawPayloadToStream(raw.payload);
    if (!stream) {
      throw new Error('SCHEMA_VALIDATION_FAILED: Raw payload is not compatible with any telemetry stream.');
    }

    // 2. PARSE & INGESTION TIMESTAMP
    const parsed = JSON.parse(raw.payload);
    const messageId = parsed.messageId || `MSG-${Date.now()}-${Math.random().toString(36).slice(-4)}`;
    const streamId = parsed.streamId;
    const sourceId = parsed.sourceId;
    const value = Number(parsed.value);
    const unit = parsed.unit;
    const sequence = Number(parsed.sequence);

    // Log explicit dual clocks
    const sourceTimestamp = parsed.sourceTimestamp || new Date().toISOString();
    const ingestionTimestamp = raw.timestampReceived;

    // Check Sequence Integrity & Anomalies prior to modifying state
    let evaluatedQuality: TelemetryMessageQuality = 'VALID';
    const lastSequence = this.latestSequenceMap.get(streamId) ?? -1;

    // Sequence Discontinuity Gap Analysis
    if (lastSequence !== -1 && sequence > lastSequence + 1) {
      evaluatedQuality = 'OUT_OF_ORDER'; // default state before fully analyzing ordering
      const missingCount = sequence - lastSequence - 1;
      this.publishTelemetryGap(streamId, lastSequence + 1, sequence - 1, missingCount);
    }

    // Duplicate Telemetry Sample Check
    if (lastSequence !== -1 && sequence <= lastSequence) {
      const historySeqs = this.sequenceHistory.get(streamId) || [];
      if (historySeqs.includes(sequence)) {
        evaluatedQuality = 'DUPLICATE';
      } else {
        evaluatedQuality = 'OUT_OF_ORDER';
      }
    }

    // 3. NORMALIZE & PROCESSING TIMESTAMP
    let normalizedValue = value;
    let normalizedUnit = unit;
    if (unit === 'Fahrenheit') {
      normalizedValue = (value - 32) * 5 / 9;
      normalizedUnit = 'Celsius';
    }

    const initialMsg: TelemetryMessage = {
      messageId,
      streamId,
      sourceId,
      sourceTimestamp,
      ingestionTimestamp,
      value: normalizedValue,
      unit: normalizedUnit,
      quality: evaluatedQuality,
      sequence,
      machineId: parsed.machineId,
      processId: parsed.processId,
      operationId: parsed.operationId,
      partId: parsed.partId
    };

    initialMsg.processingTimestamp = new Date().toISOString();

    // 4. ORDER & QUALITY ASSURANCE EVALUATION
    const streamConfig = this.activeStreams.get(streamId);
    const history = this.messageHistory.get(streamId) || [];
    if (streamConfig) {
      const stateQual = RealTimeTelemetryQualityEngine.evaluateMessageQuality(initialMsg, streamConfig, history);
      if (initialMsg.quality === 'VALID' || initialMsg.quality === 'OUT_OF_ORDER' || initialMsg.quality === 'DUPLICATE') {
        if (stateQual !== 'VALID') {
          initialMsg.quality = stateQual;
        }
      }
    }

    // Record to history and sequence arrays
    history.push(initialMsg);
    if (history.length > 50) history.shift();
    this.messageHistory.set(streamId, history);

    const historySeqs = this.sequenceHistory.get(streamId) || [];
    historySeqs.push(sequence);
    if (historySeqs.length > 100) historySeqs.shift();
    this.sequenceHistory.set(streamId, historySeqs);

    if (sequence > lastSequence) {
      this.latestSequenceMap.set(streamId, sequence);
    }

    // Compute latency measurements directly
    const latInMs = new Date(initialMsg.ingestionTimestamp).getTime() - new Date(initialMsg.sourceTimestamp).getTime();
    this.latencyBuffer.push(latInMs);
    if (this.latencyBuffer.length > 200) this.latencyBuffer.shift();

    // Track Sampling intervals
    const obsTime = Date.now();
    const lastObs = this.lastObservedSampleTime.get(streamId);
    if (lastObs) {
      const intervalMs = obsTime - lastObs;
      const obsIntervals = this.observedSampleIntervals.get(streamId) || [];
      obsIntervals.push(intervalMs);
      if (obsIntervals.length > 20) obsIntervals.shift();
      this.observedSampleIntervals.set(streamId, obsIntervals);
    }
    this.lastObservedSampleTime.set(streamId, obsTime);

    // 5. UPDATE STREAM FRESHNESS AND LIVE INDICATOR
    this.updateStreamFreshness(streamId, initialMsg);

    // 6. ROUTE & BUFFER
    const buffer = this.buffers.get(streamId);
    if (buffer) {
      buffer.push(initialMsg);
    }

    this.router.dispatch(initialMsg);
    this.store.insert(initialMsg);

    // Trigger alert engine evaluation
    const prevMsg = history[history.length - 2];
    this.alertEngine.evaluateRules(initialMsg, prevMsg);

    this.throughputCounter++;
    return initialMsg;
  }

  // ============================================================================
  // SLA & Dynamic Metrics Computations
  // ============================================================================

  public getSlaMetrics(streamId: string): TelemetrySlaMetrics {
    const latencies = [...this.latencyBuffer].sort((a, b) => a - b);
    let p50 = 0, p95 = 0, p99 = 0;
    if (latencies.length > 0) {
      p50 = latencies[Math.floor(latencies.length * 0.5)];
      p95 = latencies[Math.floor(latencies.length * 0.95)] || p50;
      p99 = latencies[Math.floor(latencies.length * 0.99)] || p95;
    }

    const obsIntervals = this.observedSampleIntervals.get(streamId) || [];
    let avgObsRateHz = 0;
    if (obsIntervals.length > 0) {
      const avgIntervalMs = obsIntervals.reduce((acc, v) => acc + v, 0) / obsIntervals.length;
      avgObsRateHz = avgIntervalMs > 0 ? 1000 / avgIntervalMs : 0;
    }

    // Check freshness based on latest message
    const stream = this.activeStreams.get(streamId);
    const hist = this.messageHistory.get(streamId) || [];
    const latestMsg = hist[hist.length - 1];
    let freshnessSec = 0;
    if (latestMsg) {
      freshnessSec = (Date.now() - new Date(latestMsg.ingestionTimestamp).getTime()) / 1000;
    }

    // Dynamic Drift Detection
    if (stream) {
      const streamObj = { ...stream };
      streamObj.observedSamplingRate = Number(avgObsRateHz.toFixed(1));
      this.activeStreams.set(streamId, streamObj);
    }

    return {
      p50LatencyMs: Number(p50.toFixed(2)),
      p95LatencyMs: Number(p95.toFixed(2)),
      p99LatencyMs: Number(p99.toFixed(2)),
      throughputMsgSec: this.throughputCounter,
      throughputBytesSec: this.throughputBytesCounter,
      dropRate: 0.0,
      gapRate: 0.0,
      freshnessSec: Number(freshnessSec.toFixed(2))
    };
  }

  private startThroughputMonitoring() {
    this.statsInterval = setInterval(() => {
      this.throughputCounter = 0;
      this.throughputBytesCounter = 0;
      this.lastStatsResetTime = Date.now();
    }, 1000);
  }

  private parseRawPayloadToStream(payload: string): TelemetryStream | null {
    try {
      const parsed = JSON.parse(payload);
      if (!parsed.streamId || !parsed.sourceId || parsed.value === undefined) {
        return null;
      }
      return this.activeStreams.get(parsed.streamId) || null;
    } catch {
      return null;
    }
  }

  private publishTelemetryGap(streamId: string, startSeq: number, endSeq: number, missingSamples: number) {
    const gapId = `GAP-${Date.now()}-${startSeq}-${endSeq}`;
    const evidenceId = `EVID-GAP-${Date.now()}-${Math.random().toString(36).slice(-3)}`;
    
    // Immutable publishing onto secure Evidence Ledger
    EvidenceBus314.getInstance().registerEvidence(
      'DESIGN_REVIEW',
      `RUN-GAP-${Date.now()}`,
      'REV-1',
      'RealTimeTelemetryEngine',
      'FAILED',
      {
        gapId,
        streamId,
        missingSamples,
        startSeq,
        endSeq,
        evidenceId
      }
    );
  }

  private updateStreamFreshness(streamId: string, latestMsg: TelemetryMessage) {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return;

    const diffMs = Date.now() - new Date(latestMsg.ingestionTimestamp).getTime();
    let nextStatus: TelemetryStreamState = 'LIVE';

    if (diffMs > 5000) {
      nextStatus = 'STALE';
    } else if (diffMs > 15000) {
      nextStatus = 'DISCONNECTED';
    }

    this.activeStreams.set(streamId, {
      ...stream,
      status: nextStatus
    });
  }

  // ============================================================================
  // Sliding Window Aggregation Implementation
  // ============================================================================

  public computeSlidingWindowAggregate(
    streamId: string,
    windowSec: number,
    method: 'AVERAGE' | 'MIN' | 'MAX' | 'RMS' | 'PEAK' | 'RATE' | 'COUNT'
  ): TelemetryAggregate {
    const hist = this.messageHistory.get(streamId) || [];
    const now = Date.now();
    const windowMs = windowSec * 1000;
    
    const validMessages = hist.filter(m => {
      const ageMs = now - new Date(m.ingestionTimestamp).getTime();
      return ageMs <= windowMs && (m.quality === 'VALID' || m.quality === 'FILTERED' || m.quality === 'SUSPECT');
    });

    const values = validMessages.map(m => m.value);
    let result = 0;

    if (values.length > 0) {
      switch (method) {
        case 'AVERAGE':
          result = values.reduce((acc, v) => acc + v, 0) / values.length;
          break;
        case 'MIN':
          result = Math.min(...values);
          break;
        case 'MAX':
          result = Math.max(...values);
          break;
        case 'RMS':
          const squaredSum = values.reduce((acc, v) => acc + v * v, 0);
          result = Math.sqrt(squaredSum / values.length);
          break;
        case 'PEAK':
          result = Math.max(...values.map(Math.abs));
          break;
        case 'COUNT':
          result = values.length;
          break;
        default:
          result = 0;
      }
    }

    return {
      aggregateId: `AGG-${Date.now()}-${Math.random().toString(36).slice(-3)}`,
      streamId,
      windowStart: new Date(now - windowMs).toISOString(),
      windowEnd: new Date(now).toISOString(),
      inputCount: values.length,
      method,
      value: Number(result.toFixed(4))
    };
  }
}
