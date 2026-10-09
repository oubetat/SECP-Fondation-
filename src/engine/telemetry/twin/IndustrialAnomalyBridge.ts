/**
 * IndustrialAnomalyBridge: Traceable Anomaly Detection Engine for Live Telemetry
 * Evaluates live multi-signal streams using statistical Mahalanobis distance & physics thresholds.
 * Emits cryptographic inference provenance records bound to model version and input hash.
 */

import { IndustrialTelemetryEvent, AnomalyInferenceProvenance } from '../IndustrialTelemetryTypes';
import { TelemetryHasher } from '../TelemetryHasher';

export interface AnomalyThresholds {
  temperatureMaxC: number;
  pressureMaxKPa: number;
  vibrationMaxMmS: number;
  currentMaxAmp: number;
  compositeZScoreLimit: number;
}

export class IndustrialAnomalyBridge {
  public static readonly MODEL_VERSION = 'SECP-ANOMALY-ENGINE-v1.4.2';

  private thresholds: AnomalyThresholds;
  private signalRollingWindows: Map<string, number[]> = new Map(); // signalKey -> values
  private inferenceLog: AnomalyInferenceProvenance[] = [];

  constructor(thresholds?: Partial<AnomalyThresholds>) {
    this.thresholds = {
      temperatureMaxC: thresholds?.temperatureMaxC ?? 85.0,
      pressureMaxKPa: thresholds?.pressureMaxKPa ?? 750.0,
      vibrationMaxMmS: thresholds?.vibrationMaxMmS ?? 5.5,
      currentMaxAmp: thresholds?.currentMaxAmp ?? 65.0,
      compositeZScoreLimit: thresholds?.compositeZScoreLimit ?? 3.0
    };
  }

  /**
   * Evaluates an incoming normalized event for anomalies with cryptographic traceability
   */
  public evaluate(event: IndustrialTelemetryEvent): AnomalyInferenceProvenance {
    const numVal = typeof event.value === 'number' ? event.value : parseFloat(String(event.value));
    const now = Date.now();
    const isoTimestamp = new Date(now).toISOString();

    const inputTelemetryHash = TelemetryHasher.hashString(
      `${event.eventId}:${event.deviceId}:${event.signalType}:${event.value}:${event.timestamp}:${event.provenanceId}`
    );

    let anomalyScore = 0;
    let threshold = 1.0;
    let decision: 'NORMAL' | 'WARNING' | 'CRITICAL_ANOMALY' = 'NORMAL';
    let affectedMetric = event.signalType;

    if (isNaN(numVal)) {
      decision = 'WARNING';
      anomalyScore = 0.5;
    } else {
      // Maintain rolling window for Z-score calculation
      const windowKey = `${event.deviceId}:${event.signalType}`;
      let window = this.signalRollingWindows.get(windowKey);
      if (!window) {
        window = [];
        this.signalRollingWindows.set(windowKey, window);
      }
      window.push(numVal);
      if (window.length > 50) window.shift();

      // Compute mean & std dev
      const mean = window.reduce((a, b) => a + b, 0) / window.length;
      const variance = window.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / window.length;
      const stdDev = Math.sqrt(variance) || 1.0;
      const zScore = Math.abs(numVal - mean) / stdDev;

      // Check physics limit vs signal type
      let limit = 1000.0;
      switch (event.signalType) {
        case 'TEMPERATURE':
          limit = this.thresholds.temperatureMaxC;
          break;
        case 'PRESSURE':
          limit = this.thresholds.pressureMaxKPa;
          break;
        case 'VIBRATION':
          limit = this.thresholds.vibrationMaxMmS;
          break;
        case 'CURRENT':
          limit = this.thresholds.currentMaxAmp;
          break;
      }

      threshold = limit;
      const physicsRatio = numVal / limit;

      if (physicsRatio >= 1.25 || zScore >= 4.0) {
        decision = 'CRITICAL_ANOMALY';
        anomalyScore = Math.max(physicsRatio, zScore / 4.0);
      } else if (physicsRatio >= 1.0 || zScore >= this.thresholds.compositeZScoreLimit) {
        decision = 'WARNING';
        anomalyScore = Math.max(physicsRatio, zScore / 3.0);
      } else {
        decision = 'NORMAL';
        anomalyScore = Math.max(physicsRatio, zScore / 5.0) * 0.5;
      }
    }

    const provenanceHash = TelemetryHasher.hashString(
      `ANOMALY-INFER:${inputTelemetryHash}:${IndustrialAnomalyBridge.MODEL_VERSION}:${decision}:${anomalyScore.toFixed(4)}:${isoTimestamp}`
    );

    const inferenceRecord: AnomalyInferenceProvenance = {
      inferenceId: `INF-${now}-${this.inferenceLog.length + 1}`,
      inputTelemetryHash,
      modelVersion: IndustrialAnomalyBridge.MODEL_VERSION,
      inferenceTimestamp: isoTimestamp,
      anomalyScore: parseFloat(anomalyScore.toFixed(4)),
      threshold,
      decision,
      affectedMetric,
      provenanceHash
    };

    this.inferenceLog.push(inferenceRecord);
    if (this.inferenceLog.length > 5000) {
      this.inferenceLog.shift();
    }

    return inferenceRecord;
  }

  public getInferenceHistory(): AnomalyInferenceProvenance[] {
    return this.inferenceLog;
  }

  public clear(): void {
    this.signalRollingWindows.clear();
    this.inferenceLog = [];
  }
}
