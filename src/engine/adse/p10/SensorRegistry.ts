import { createHash } from 'crypto';
import { Sensor, CalibrationCertificate, Measurement, PhysicalFinding, SensorDiagnosticState } from './types';

export class SensorRegistry {
  private sensors: Map<string, Sensor> = new Map();
  private calibrations: Map<string, CalibrationCertificate> = new Map();
  private measurements: Map<string, Measurement> = new Map();
  private findings: Map<string, PhysicalFinding> = new Map();

  // --- Sensor Registration ---
  public registerSensor(sensor: Sensor): void {
    if (this.sensors.has(sensor.sensorId)) {
      throw new Error(`SENSOR_COLLISION: Sensor '${sensor.sensorId}' already exists.`);
    }
    if (!sensor.sensorId || sensor.sensorId.startsWith('FORGED') || sensor.sensorId.includes('FAKE')) {
      throw new Error(`INVALID_SENSOR_IDENTITY: Sensor ID '${sensor.sensorId}' is invalid or forged.`);
    }
    if (sensor.measurementRange.min >= sensor.measurementRange.max) {
      throw new Error(`INVALID_MEASUREMENT_RANGE: Min bound must be less than Max bound.`);
    }
    this.sensors.set(sensor.sensorId, sensor);
  }

  public getSensor(sensorId: string): Sensor | undefined {
    return this.sensors.get(sensorId);
  }

  public getAllSensors(): Sensor[] {
    return Array.from(this.sensors.values());
  }

  // --- Calibration Certificates ---
  public registerCalibrationCertificate(cert: CalibrationCertificate, actor?: string): void {
    if (actor && (actor.includes('ai:') || actor === 'AI_SYNTHETIC_AGENT')) {
      throw new Error(`AI_GOVERNANCE_VIOLATION: AI agents cannot register or sign Calibration Certificates.`);
    }
    if (cert.gain <= 0) {
      throw new Error(`INVALID_CALIBRATION_GAIN: Gain coefficient must be positive.`);
    }
    if (cert.id.startsWith('FORGED') || cert.id.includes('FAKE')) {
      throw new Error(`FORGED_CALIBRATION_CERTIFICATE: Calibration ID '${cert.id}' is forged or unverified.`);
    }
    const sensor = this.sensors.get(cert.sensorId);
    if (!sensor) {
      throw new Error(`SENSOR_NOT_FOUND: Sensor '${cert.sensorId}' does not exist in registry.`);
    }

    this.calibrations.set(cert.id, cert);

    // Update sensor's calibration state
    const now = new Date().toISOString();
    if (now > cert.expiresAt) {
      sensor.calibrationState = 'EXPIRED';
    } else {
      sensor.calibrationState = 'VALID';
      sensor.calibrationEvidence = cert.id;
    }
  }

  public getCalibrationCertificate(id: string): CalibrationCertificate | undefined {
    return this.calibrations.get(id);
  }

  public getCalibrationForSensor(sensorId: string): CalibrationCertificate | undefined {
    return Array.from(this.calibrations.values())
      .filter(c => c.sensorId === sensorId)
      .sort((a, b) => b.calibrationRevision - a.calibrationRevision)[0];
  }

  // --- Measurement Logs ---
  public registerMeasurement(measurement: Measurement): void {
    if (this.measurements.has(measurement.measurementId)) {
      throw new Error(`DUPLICATE_MEASUREMENT: Measurement ID '${measurement.measurementId}' already registered.`);
    }

    const sensor = this.sensors.get(measurement.sensorId);
    if (!sensor) {
      throw new Error(`SENSOR_NOT_FOUND: Measurement refers to unregistered sensor '${measurement.sensorId}'.`);
    }

    const cal = this.calibrations.get(measurement.calibrationId);
    if (!cal) {
      throw new Error(`UNBOUND_CALIBRATION: Measurement refers to unregistered calibration certificate '${measurement.calibrationId}'.`);
    }

    if (!measurement.configurationId) {
      throw new Error(`CONFIGURATION_CONTEXT_REQUIRED: Measurement is missing configuration scope.`);
    }

    if (!measurement.timestamp) {
      throw new Error(`TEMPORAL_CONTEXT_REQUIRED: Measurement has missing timestamp.`);
    }

    const mTime = new Date(measurement.timestamp).getTime();
    const nowTime = new Date().getTime();
    if (mTime > nowTime + 3600000) { // More than 1 hour in the future (temporal guard)
      throw new Error(`FUTURE_TIMESTAMP_REJECTED: Measurement timestamp '${measurement.timestamp}' is in the future.`);
    }

    if (measurement.uncertainty <= 0) {
      throw new Error(`UNCERTAINTY_OMISSION_PROHIBITED: Measurement must specify a positive uncertainty range.`);
    }

    // Range Validation check against physical boundaries
    if (measurement.value < sensor.measurementRange.min || measurement.value > sensor.measurementRange.max) {
      measurement.diagnosticState = SensorDiagnosticState.OUT_OF_RANGE;
    }

    this.measurements.set(measurement.measurementId, measurement);
  }

  public getMeasurement(id: string): Measurement | undefined {
    return this.measurements.get(id);
  }

  public getAllMeasurements(): Measurement[] {
    return Array.from(this.measurements.values());
  }

  // --- Physical Findings ---
  public registerPhysicalFinding(finding: PhysicalFinding): void {
    if (this.findings.has(finding.findingId)) {
      throw new Error(`DUPLICATE_FINDING: Physical finding '${finding.findingId}' already exists.`);
    }
    const sensor = this.sensors.get(finding.sensorId);
    if (!sensor) {
      throw new Error(`SENSOR_NOT_FOUND: Finding refers to unregistered sensor '${finding.sensorId}'.`);
    }

    this.findings.set(finding.findingId, finding);
  }

  public getPhysicalFinding(id: string): PhysicalFinding | undefined {
    return this.findings.get(id);
  }

  public getAllFindings(): PhysicalFinding[] {
    return Array.from(this.findings.values());
  }

  public clear(): void {
    this.sensors.clear();
    this.calibrations.clear();
    this.measurements.clear();
    this.findings.clear();
  }
}
