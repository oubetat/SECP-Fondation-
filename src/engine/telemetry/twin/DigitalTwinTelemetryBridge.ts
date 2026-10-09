/**
 * DigitalTwinTelemetryBridge: Bridges live industrial telemetry events into DigitalTwinState
 * Supports:
 * - Strict channel isolation (LIVE vs TEST-HARNESS vs SIMULATED vs OFFLINE)
 * - Quality filtering (Rejects BAD / INVALID quality from polluting physics state)
 * - State update ledger with cryptographic update provenance digests
 * - Bidirectional sync with DigitalTwinEngine
 */

import { IndustrialTelemetryEvent, TelemetryDataSource } from '../IndustrialTelemetryTypes';
import { DigitalTwinEngine, DigitalTwinState, TelemetryReading } from '../../digitalTwinEngine';
import { TelemetryHasher } from '../TelemetryHasher';

export interface TwinStateUpdateRecord {
  updateId: string;
  timestamp: string;
  source: TelemetryDataSource;
  appliedEventsCount: number;
  healthScore: number;
  status: string;
  provenanceHash: string;
}

export class DigitalTwinTelemetryBridge {
  private activeState: DigitalTwinState;
  private currentSourceMode: TelemetryDataSource = 'LIVE';
  private updateHistory: TwinStateUpdateRecord[] = [];
  private liveReadingBuffer: Partial<TelemetryReading> = {};

  constructor(initialState?: DigitalTwinState, sourceMode: TelemetryDataSource = 'LIVE') {
    this.activeState = initialState || DigitalTwinEngine.createInitialState();
    this.currentSourceMode = sourceMode;
  }

  public setSourceMode(mode: TelemetryDataSource): void {
    this.currentSourceMode = mode;
  }

  public getSourceMode(): TelemetryDataSource {
    return this.currentSourceMode;
  }

  public getState(): DigitalTwinState {
    return this.activeState;
  }

  public getUpdateHistory(): TwinStateUpdateRecord[] {
    return this.updateHistory;
  }

  /**
   * Applies an incoming normalized IndustrialTelemetryEvent to the Digital Twin
   */
  public applyEvent(event: IndustrialTelemetryEvent): {
    applied: boolean;
    reason?: string;
    state?: DigitalTwinState;
    updateRecord?: TwinStateUpdateRecord;
  } {
    // 1. Channel Isolation Check
    if (event.source !== this.currentSourceMode) {
      return {
        applied: false,
        reason: `Channel isolation violation: Event source '${event.source}' does not match active twin mode '${this.currentSourceMode}'`
      };
    }

    // 2. Data Quality Policy Check (Section 10)
    if (event.quality === 'BAD' || event.quality === 'INVALID') {
      return {
        applied: false,
        reason: `Quality policy rejected: Telemetry event marked with quality '${event.quality}' cannot update physical state`
      };
    }

    // 3. Map canonical signal to TelemetryReading fields
    let updatedField: keyof Omit<TelemetryReading, 'timestamp'> | undefined;
    const numVal = typeof event.value === 'number' ? event.value : parseFloat(String(event.value));

    if (!isNaN(numVal)) {
      switch (event.signalType) {
        case 'TEMPERATURE':
          this.liveReadingBuffer.temperatureC = numVal;
          updatedField = 'temperatureC';
          break;
        case 'PRESSURE':
          this.liveReadingBuffer.pressureKPa = numVal;
          updatedField = 'pressureKPa';
          break;
        case 'RPM':
          this.liveReadingBuffer.rpm = Math.round(numVal);
          updatedField = 'rpm';
          break;
        case 'VIBRATION':
          this.liveReadingBuffer.vibrationMmS = numVal;
          updatedField = 'vibrationMmS';
          break;
        case 'CURRENT':
          this.liveReadingBuffer.currentAmp = numVal;
          updatedField = 'currentAmp';
          break;
        case 'FLOW':
          this.liveReadingBuffer.flowLMin = numVal;
          updatedField = 'flowLMin';
          break;
      }
    }

    if (!updatedField) {
      return { applied: false, reason: `Signal type ${event.signalType} not mapped to primary physical twin metrics` };
    }

    // Construct full TelemetryReading snapshot
    const currentSnapshot: TelemetryReading = {
      timestamp: event.timestamp,
      temperatureC: this.liveReadingBuffer.temperatureC ?? this.activeState.currentTelemetry.temperatureC,
      pressureKPa: this.liveReadingBuffer.pressureKPa ?? this.activeState.currentTelemetry.pressureKPa,
      rpm: this.liveReadingBuffer.rpm ?? this.activeState.currentTelemetry.rpm,
      vibrationMmS: this.liveReadingBuffer.vibrationMmS ?? this.activeState.currentTelemetry.vibrationMmS,
      currentAmp: this.liveReadingBuffer.currentAmp ?? this.activeState.currentTelemetry.currentAmp,
      flowLMin: this.liveReadingBuffer.flowLMin ?? this.activeState.currentTelemetry.flowLMin
    };

    // Re-evaluate health and alerts
    const healthEval = DigitalTwinEngine.evaluateHealth(currentSnapshot);

    this.activeState.currentTelemetry = currentSnapshot;
    this.activeState.healthScore = healthEval.healthScore;
    this.activeState.status = healthEval.status;
    this.activeState.cadThermalColorMapHex = healthEval.cadColorHex;
    this.activeState.alerts = healthEval.newAlerts;

    // Append to history (capped at 100 entries)
    this.activeState.telemetryHistory.push(currentSnapshot);
    if (this.activeState.telemetryHistory.length > 100) {
      this.activeState.telemetryHistory.shift();
    }

    const now = Date.now();
    const provenanceHash = TelemetryHasher.hashString(
      `TWIN-UPDATE:${event.provenanceId}:${currentSnapshot.temperatureC}:${currentSnapshot.pressureKPa}:${currentSnapshot.vibrationMmS}:${this.activeState.healthScore}`
    );

    const updateRecord: TwinStateUpdateRecord = {
      updateId: `TWIN-UPD-${now}-${this.updateHistory.length + 1}`,
      timestamp: new Date(now).toISOString(),
      source: event.source,
      appliedEventsCount: 1,
      healthScore: this.activeState.healthScore,
      status: this.activeState.status,
      provenanceHash
    };

    this.updateHistory.push(updateRecord);
    if (this.updateHistory.length > 1000) {
      this.updateHistory.shift();
    }

    return {
      applied: true,
      state: this.activeState,
      updateRecord
    };
  }

  public reset(): void {
    this.activeState = DigitalTwinEngine.createInitialState();
    this.updateHistory = [];
    this.liveReadingBuffer = {};
  }
}
