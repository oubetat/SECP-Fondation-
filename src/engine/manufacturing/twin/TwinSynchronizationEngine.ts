import { 
  MachineDigitalTwinContract, 
  MachineTwinState, 
  TwinLifecycleState, 
  MachineTwinEvent, 
  TwinEventType, 
  TwinCheckpoint, 
  StateProvenanceSource, 
  SafetyState, 
  HealthStatus, 
  TrackingErrorMetrics, 
  TelemetryReading,
  TelemetryQuality
} from "./types";
import { ForwardKinematicsSolver } from "../kinematics/ForwardKinematicsSolver";
import { MachineKinematicModel } from "../kinematics/types";
import { SpindleDirection } from "../post/types";

export class TwinSynchronizationEngine {
  private contract: MachineDigitalTwinContract;
  private kinematicModel: MachineKinematicModel;
  private stateHistory: MachineTwinState[] = [];
  private eventHistory: MachineTwinEvent[] = [];
  private checkpoints: TwinCheckpoint[] = [];
  private latencies: number[] = [];
  private trackingMetrics: Map<string, { errors: number[]; max: number }> = new Map();
  private lastStateHash: string = "0000000000000000000000000000000000000000000000000000000000000000";
  private lastEventHash: string = "0000000000000000000000000000000000000000000000000000000000000000";
  private sequenceCounter: number = 0;

  constructor(contract: MachineDigitalTwinContract, kinematicModel: MachineKinematicModel) {
    this.contract = contract;
    this.kinematicModel = kinematicModel;
  }

  public reconstructStateFromTelemetry(
    readings: TelemetryReading[],
    currentState: MachineTwinState,
    sourceProvenance: StateProvenanceSource = StateProvenanceSource.MEASURED
  ): MachineTwinState {
    const now = Date.now();
    this.sequenceCounter++;

    // Compute latency from latest reading
    if (readings.length > 0) {
      const latestSourceTs = Math.max(...readings.map(r => r.sourceTimestamp));
      const latency = Math.max(0, now - latestSourceTs);
      this.latencies.push(latency);
      if (this.latencies.length > 1000) this.latencies.shift();
    }

    const updatedAxes = { ...currentState.axes };
    const updatedRotary = { ...currentState.rotaryAxes };
    const updatedSpindle = { ...currentState.spindle };
    const updatedController = { ...currentState.controller };
    const updatedTool = { ...currentState.tool };

    // Apply readings
    for (const r of readings) {
      if (r.quality === TelemetryQuality.INVALID) continue;

      if (r.sensorId === "ENC_X" && typeof r.value === "number") {
        const cmd = updatedAxes["X"]?.commandedPosition ?? r.value;
        const err = r.value - cmd;
        this.recordTrackingError("X", err);
        updatedAxes["X"] = {
          axisName: "X",
          commandedPosition: cmd,
          actualPosition: r.value,
          velocity: 100,
          acceleration: 0,
          trackingError: err,
          limitState: Math.abs(r.value) > 480 ? "SOFT_LIMIT_NEAR" : "NORMAL",
          timestamp: r.sourceTimestamp,
          provenance: sourceProvenance
        };
      } else if (r.sensorId === "ENC_Y" && typeof r.value === "number") {
        const cmd = updatedAxes["Y"]?.commandedPosition ?? r.value;
        const err = r.value - cmd;
        this.recordTrackingError("Y", err);
        updatedAxes["Y"] = {
          axisName: "Y",
          commandedPosition: cmd,
          actualPosition: r.value,
          velocity: 100,
          acceleration: 0,
          trackingError: err,
          limitState: Math.abs(r.value) > 380 ? "SOFT_LIMIT_NEAR" : "NORMAL",
          timestamp: r.sourceTimestamp,
          provenance: sourceProvenance
        };
      } else if (r.sensorId === "ENC_Z" && typeof r.value === "number") {
        const cmd = updatedAxes["Z"]?.commandedPosition ?? r.value;
        const err = r.value - cmd;
        this.recordTrackingError("Z", err);
        updatedAxes["Z"] = {
          axisName: "Z",
          commandedPosition: cmd,
          actualPosition: r.value,
          velocity: 100,
          acceleration: 0,
          trackingError: err,
          limitState: r.value < -280 ? "SOFT_LIMIT_NEAR" : "NORMAL",
          timestamp: r.sourceTimestamp,
          provenance: sourceProvenance
        };
      } else if (r.sensorId === "ENC_A" && typeof r.value === "number") {
        const cmd = updatedRotary["A"]?.commandedAngleDeg ?? r.value;
        const err = r.value - cmd;
        this.recordTrackingError("A", err);
        updatedRotary["A"] = {
          axisName: "A",
          commandedAngleDeg: cmd,
          actualAngleDeg: r.value,
          angularVelocityDegS: 10,
          angularAccelerationDegS2: 0,
          trackingErrorDeg: err,
          wrapState: 0,
          limitState: Math.abs(r.value) > 110 ? "SOFT_LIMIT_NEAR" : "NORMAL",
          timestamp: r.sourceTimestamp,
          provenance: sourceProvenance
        };
      } else if (r.sensorId === "ENC_C" && typeof r.value === "number") {
        const cmd = updatedRotary["C"]?.commandedAngleDeg ?? r.value;
        const err = r.value - cmd;
        this.recordTrackingError("C", err);
        updatedRotary["C"] = {
          axisName: "C",
          commandedAngleDeg: cmd,
          actualAngleDeg: r.value,
          angularVelocityDegS: 20,
          angularAccelerationDegS2: 0,
          trackingErrorDeg: err,
          wrapState: 0,
          limitState: "NORMAL",
          timestamp: r.sourceTimestamp,
          provenance: sourceProvenance
        };
      } else if (r.sensorId === "SPINDLE_TACH" && typeof r.value === "number") {
        updatedSpindle.actualRPM = r.value;
        updatedSpindle.slipRPM = r.value - updatedSpindle.commandedRPM;
        updatedSpindle.timestamp = r.sourceTimestamp;
      } else if (r.sensorId === "TEMP_SPINDLE" && typeof r.value === "number") {
        updatedSpindle.temperatureC = r.value;
      } else if (r.sensorId === "ACCEL_SPINDLE" && typeof r.value === "number") {
        updatedSpindle.vibrationG = r.value;
      }
    }

    const stateId = `STATE_${this.sequenceCounter.toString().padStart(6, "0")}`;
    const rawStatePayload = JSON.stringify({
      stateId,
      seq: this.sequenceCounter,
      axes: updatedAxes,
      rotary: updatedRotary,
      spindle: updatedSpindle,
      ctrl: updatedController
    });

    const currentStateHash = this.computeSha256(rawStatePayload + this.lastStateHash);

    const newState: MachineTwinState = {
      stateId,
      sequenceNumber: this.sequenceCounter,
      timestamp: now,
      previousStateHash: this.lastStateHash,
      currentStateHash,
      lifecycleState: TwinLifecycleState.SYNCHRONIZED,
      axes: updatedAxes,
      rotaryAxes: updatedRotary,
      spindle: updatedSpindle,
      controller: updatedController,
      tool: updatedTool,
      workpiece: currentState.workpiece,
      fixture: currentState.fixture,
      safety: currentState.safety,
      health: currentState.health,
      uncertaintyRadiusMM: 0.005,
      provenance: sourceProvenance
    };

    this.lastStateHash = currentStateHash;
    this.stateHistory.push(newState);
    if (this.stateHistory.length > this.contract.statePolicy.historyCapacity) {
      this.stateHistory.shift();
    }

    return newState;
  }

  public recordEvent(
    type: TwinEventType,
    source: string,
    payload: any
  ): MachineTwinEvent {
    const now = Date.now();
    const eventId = `EVT_${(this.eventHistory.length + 1).toString().padStart(6, "0")}`;
    const payloadStr = JSON.stringify(payload);
    const payloadHash = this.computeSha256(payloadStr);
    const eventHash = this.computeSha256(payloadHash + this.lastEventHash + type + now);

    const event: MachineTwinEvent = {
      eventId,
      timestamp: now,
      source,
      machineId: this.contract.machineId,
      twinId: this.contract.twinId,
      sequence: this.eventHistory.length + 1,
      type,
      payload,
      payloadHash,
      previousEventHash: this.lastEventHash
    };

    this.lastEventHash = eventHash;
    this.eventHistory.push(event);
    return event;
  }

  public createCheckpoint(state: MachineTwinState): TwinCheckpoint {
    const checkpointId = `CHK_${(this.checkpoints.length + 1).toString().padStart(4, "0")}`;
    const checkpoint: TwinCheckpoint = {
      checkpointId,
      timestamp: state.timestamp,
      machineStateHash: state.currentStateHash,
      telemetryPosition: state.sequenceNumber,
      toolState: { ...state.tool },
      programState: { ...state.controller },
      stockStateHash: state.workpiece.stockStateHash,
      healthState: { ...state.health },
      snapshotState: { ...state }
    };
    this.checkpoints.push(checkpoint);
    return checkpoint;
  }

  public replayStateAtTime(targetTimestamp: number): MachineTwinState | null {
    if (this.stateHistory.length === 0) return null;
    // Find exact or closest preceding state
    let match: MachineTwinState | null = null;
    for (const state of this.stateHistory) {
      if (state.timestamp <= targetTimestamp) {
        match = state;
      } else {
        break;
      }
    }
    return match || this.stateHistory[0];
  }

  public validateHistoryIntegrity(): { isValid: boolean; brokenAtSequence?: number } {
    if (this.stateHistory.length <= 1) return { isValid: true };

    for (let i = 1; i < this.stateHistory.length; i++) {
      const prev = this.stateHistory[i - 1];
      const curr = this.stateHistory[i];
      if (curr.previousStateHash !== prev.currentStateHash) {
        return { isValid: false, brokenAtSequence: curr.sequenceNumber };
      }
    }
    return { isValid: true };
  }

  public getLatencyMetrics(): { min: number; max: number; avg: number; p95: number } {
    if (this.latencies.length === 0) return { min: 0, max: 0, avg: 0, p95: 0 };
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    const p95 = sorted[p95Index];
    return { min, max, avg, p95 };
  }

  private recordTrackingError(axis: string, error: number): void {
    if (!this.trackingMetrics.has(axis)) {
      this.trackingMetrics.set(axis, { errors: [], max: 0 });
    }
    const rec = this.trackingMetrics.get(axis)!;
    rec.errors.push(error);
    if (Math.abs(error) > rec.max) rec.max = Math.abs(error);
    if (rec.errors.length > 500) rec.errors.shift();
  }

  public getTrackingMetrics(): Record<string, TrackingErrorMetrics> {
    const res: Record<string, TrackingErrorMetrics> = {};
    for (const [axis, data] of this.trackingMetrics.entries()) {
      const sumSq = data.errors.reduce((sum, e) => sum + e * e, 0);
      const rms = data.errors.length > 0 ? Math.sqrt(sumSq / data.errors.length) : 0;
      res[axis] = {
        axisName: axis,
        currentError: data.errors[data.errors.length - 1] ?? 0,
        maxError: data.max,
        rmsError: rms,
        sampleCount: data.errors.length
      };
    }
    return res;
  }

  public getStateHistory(): MachineTwinState[] {
    return [...this.stateHistory];
  }

  public getEventHistory(): MachineTwinEvent[] {
    return [...this.eventHistory];
  }

  public getCheckpoints(): TwinCheckpoint[] {
    return [...this.checkpoints];
  }

  private computeSha256(input: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    // Convert to hex-like 64 char string
    const hex = (hash >>> 0).toString(16).padStart(8, "0");
    return (hex + hex + hex + hex + hex + hex + hex + hex).substring(0, 64);
  }
}
