import { 
  TelemetryReading, 
  TelemetryQuality, 
  TelemetryContract, 
  MachineDigitalTwinContract 
} from "./types";

export class MachineTelemetryAdapter {
  private contract: MachineDigitalTwinContract;
  private sensorCalibrationDb: Map<string, { validUntil: number; revision: number; status: "VALID" | "EXPIRED" }> = new Map();
  private lastProcessedTimestamps: Map<string, number> = new Map();
  private processedSequences: Set<string> = new Set();
  private ingestionBuffer: TelemetryReading[] = [];

  constructor(contract: MachineDigitalTwinContract) {
    this.contract = contract;
    this.initializeStandardCalibrations();
  }

  private initializeStandardCalibrations(): void {
    const future = Date.now() + 365 * 24 * 3600 * 1000;
    this.sensorCalibrationDb.set("ENC_X", { validUntil: future, revision: 1, status: "VALID" });
    this.sensorCalibrationDb.set("ENC_Y", { validUntil: future, revision: 1, status: "VALID" });
    this.sensorCalibrationDb.set("ENC_Z", { validUntil: future, revision: 1, status: "VALID" });
    this.sensorCalibrationDb.set("ENC_A", { validUntil: future, revision: 1, status: "VALID" });
    this.sensorCalibrationDb.set("ENC_C", { validUntil: future, revision: 1, status: "VALID" });
    this.sensorCalibrationDb.set("SPINDLE_TACH", { validUntil: future, revision: 1, status: "VALID" });
    this.sensorCalibrationDb.set("TEMP_SPINDLE", { validUntil: future, revision: 1, status: "VALID" });
    this.sensorCalibrationDb.set("ACCEL_SPINDLE", { validUntil: future, revision: 1, status: "VALID" });
  }

  public setSensorCalibration(sensorId: string, validUntil: number, status: "VALID" | "EXPIRED" = "VALID"): void {
    this.sensorCalibrationDb.set(sensorId, { validUntil, revision: 1, status });
  }

  public ingestReading(rawReading: Partial<TelemetryReading>): { accepted: boolean; reading?: TelemetryReading; reason?: string } {
    const now = Date.now();
    const sourceTs = rawReading.sourceTimestamp ?? now;
    const sensorId = rawReading.sensorId || "UNKNOWN_SENSOR";

    // 1. Check duplicate
    const seqKey = `${sensorId}_${rawReading.sequence ?? 0}_${sourceTs}`;
    if (this.processedSequences.has(seqKey)) {
      return { accepted: false, reason: "DUPLICATE_TELEMETRY" };
    }

    // 2. Validate numeric values against NaN / Infinity
    if (typeof rawReading.value === "number") {
      if (isNaN(rawReading.value) || !isFinite(rawReading.value)) {
        return { accepted: false, reason: "INVALID_NUMERIC_VALUE" };
      }
    }

    // 3. Unit validation
    const validUnits = ["mm", "deg", "rpm", "degC", "bar", "g", "mm/min", "none", "bool", "state"];
    if (!rawReading.unit || !validUnits.includes(rawReading.unit)) {
      return { accepted: false, reason: "INVALID_OR_MISSING_UNIT" };
    }

    // 4. Calibration Check
    const cal = this.sensorCalibrationDb.get(sensorId);
    let isCalValid = true;
    if (cal) {
      if (cal.status === "EXPIRED" || cal.validUntil < now) {
        isCalValid = false;
      }
    }

    // 5. Freshness / Staleness check
    let quality = rawReading.quality || TelemetryQuality.VALID;
    const age = now - sourceTs;
    if (age > this.contract.synchronizationPolicy.stalenessThresholdMS) {
      quality = TelemetryQuality.STALE;
    } else if (!isCalValid) {
      quality = TelemetryQuality.ESTIMATED;
    }

    const normalizedReading: TelemetryReading = {
      sensorId,
      sourceTimestamp: sourceTs,
      ingestionTimestamp: rawReading.ingestionTimestamp ?? now,
      processingTimestamp: now,
      value: rawReading.value ?? 0,
      unit: rawReading.unit,
      quality,
      source: rawReading.source || "OPC_UA",
      sequence: rawReading.sequence ?? (this.processedSequences.size + 1),
      sensorRevision: rawReading.sensorRevision ?? 1,
      calibrationValid: isCalValid
    };

    this.processedSequences.add(seqKey);
    this.ingestionBuffer.push(normalizedReading);

    return { accepted: true, reading: normalizedReading };
  }

  public getOrderedReadings(): TelemetryReading[] {
    // Sort buffer by sourceTimestamp and sequence (Reconciliation of out-of-order packets)
    const sorted = [...this.ingestionBuffer].sort((a, b) => {
      if (a.sourceTimestamp !== b.sourceTimestamp) {
        return a.sourceTimestamp - b.sourceTimestamp;
      }
      return a.sequence - b.sequence;
    });

    this.ingestionBuffer = [];
    return sorted;
  }

  public clearBuffer(): void {
    this.ingestionBuffer = [];
  }
}
