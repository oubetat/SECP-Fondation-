import { createHash } from 'crypto';
import { SensorRegistry } from './SensorRegistry';
import { Sensor, CalibrationCertificate, Measurement, SensorDiagnosticState } from './types';
import { DigitalThreadRegistry } from '../p4/DigitalThreadRegistry';

export class MeasurementEngine {
  private registry: SensorRegistry;
  private digitalThread: DigitalThreadRegistry;

  constructor(registry: SensorRegistry, digitalThread: DigitalThreadRegistry) {
    this.registry = registry;
    this.digitalThread = digitalThread;
  }

  /**
   * P10.2 & P10.4: Processes raw sensor voltage acquisition into calibrated engineering values
   * with complete uncertainty boundaries.
   */
  public acquireCalibratedMeasurement(params: {
    measurementId: string;
    sensorId: string;
    rawValue: number;
    unit: string;
    timestamp: string;
    acquisitionContext: string;
    configurationId: string;
  }): Measurement {
    const sensor = this.registry.getSensor(params.sensorId);
    if (!sensor) {
      throw new Error(`SENSOR_NOT_FOUND: Sensor '${params.sensorId}' is not registered.`);
    }

    const cal = this.registry.getCalibrationForSensor(params.sensorId);
    if (!cal) {
      throw new Error(`UNBOUND_CALIBRATION: Sensor '${params.sensorId}' has no valid calibration certificates registered.`);
    }

    // 1. Process Physical/Calibrated Conversion: Value = gain * rawValue + offset
    const value = cal.gain * params.rawValue + cal.offset;

    // 2. Assess Calibration Expiry
    const now = new Date(params.timestamp).toISOString();
    let diagnosticState = SensorDiagnosticState.VALID;
    if (now > cal.expiresAt || sensor.calibrationState === 'EXPIRED') {
      diagnosticState = SensorDiagnosticState.CALIBRATION_EXPIRED;
    }

    // 3. Compute Measurement Uncertainty
    // Standard gaussian combined uncertainty = Sensor Base Uncertainty + Calibration Offset Uncertainty
    const baseUncertainty = sensor.uncertaintyModel.value;
    const uncertainty = Number((baseUncertainty * (diagnosticState === SensorDiagnosticState.CALIBRATION_EXPIRED ? 2.5 : 1.0)).toFixed(4));

    // 4. Traceable Evidence Origin Hash Generation
    const rawPayload = JSON.stringify({
      sensorId: params.sensorId,
      rawValue: params.rawValue,
      calibratedValue: value,
      unit: params.unit,
      timestamp: params.timestamp,
      calibrationId: cal.id,
      uncertainty,
      configurationId: params.configurationId
    });
    const evidenceHash = createHash('sha256').update(rawPayload).digest('hex');

    const measurement: Measurement = {
      measurementId: params.measurementId,
      value,
      rawValue: params.rawValue,
      unit: params.unit,
      timestamp: params.timestamp,
      uncertainty,
      sensorId: params.sensorId,
      calibrationId: cal.id,
      configurationId: params.configurationId,
      acquisitionContext: params.acquisitionContext,
      evidenceHash,
      diagnosticState
    };

    this.registry.registerMeasurement(measurement);

    // Register Digital Thread Node for Measurement
    const mNodeId = `thread:measurement:${measurement.measurementId}`;
    if (!this.digitalThread.getNode(mNodeId)) {
      this.digitalThread.registerNode({
        nodeId: mNodeId,
        nodeType: 'Evidence',
        canonicalId: measurement.measurementId,
        authoritySource: 'P10_MEASUREMENT_ENGINE',
        displayName: `Calibrated Measurement ${measurement.measurementId} (${measurement.value} ± ${measurement.uncertainty} ${measurement.unit})`,
        configurationId: params.configurationId,
        revisionId: 'REV-R1'
      });

      // Link to Sensor node
      const sNodeId = `thread:sensor:${params.sensorId}`;
      if (this.digitalThread.getNode(sNodeId)) {
        this.digitalThread.registerEdge({
          edgeId: `thread:edge:${sNodeId}->${mNodeId}`,
          edgeType: 'IMPLEMENTED_BY',
          sourceNodeId: sNodeId,
          targetNodeId: mNodeId,
          authoritySource: 'P10_MEASUREMENT_ENGINE',
          configurationId: params.configurationId
        });
      }
    }

    return measurement;
  }

  /**
   * P10.4: Evaluates physical verification bounds including confidence uncertainty.
   * Checks if Measurement satisfies Requirement bounds.
   */
  public evaluateVerificationBounds(params: {
    requirementTarget: number;
    requirementTolerance: number;
    measuredValue: number;
    measuredUncertainty: number;
  }): { passed: boolean; margin: number; overlapPercent: number } {
    const reqMin = params.requirementTarget - params.requirementTolerance;
    const reqMax = params.requirementTarget + params.requirementTolerance;

    const mMin = params.measuredValue - params.measuredUncertainty;
    const mMax = params.measuredValue + params.measuredUncertainty;

    // Strict overlap logic: measurement bounds must fit entirely within requirement bounds
    const passed = mMin >= reqMin && mMax <= reqMax;
    const margin = passed 
      ? Math.min(mMin - reqMin, reqMax - mMax)
      : -Math.max(reqMin - mMin, mMax - reqMax);

    return {
      passed,
      margin,
      overlapPercent: passed ? 100 : 0
    };
  }
}
