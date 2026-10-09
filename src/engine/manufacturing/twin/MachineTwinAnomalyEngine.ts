import { 
  MachineDigitalTwinContract, 
  MachineTwinState, 
  AnomalyRecord, 
  SafetyState, 
  HealthStatus, 
  MachineHealthState, 
  TwinUncertaintyModel,
  TelemetryQuality 
} from "./types";

export class MachineTwinAnomalyEngine {
  private contract: MachineDigitalTwinContract;

  constructor(contract: MachineDigitalTwinContract) {
    this.contract = contract;
  }

  public evaluateAnomalies(
    state: MachineTwinState,
    previousState?: MachineTwinState
  ): {
    anomalies: AnomalyRecord[];
    safetyState: SafetyState;
    healthState: MachineHealthState;
    uncertainty: TwinUncertaintyModel;
  } {
    const anomalies: AnomalyRecord[] = [];
    const timestamp = state.timestamp;

    // 1. Spindle Temperature Check
    const tempThresh = this.contract.healthPolicy.temperatureWarningThresholdC;
    const tempFaultThresh = this.contract.healthPolicy.temperatureFaultThresholdC;
    if (state.spindle.temperatureC > tempThresh) {
      anomalies.push({
        anomalyId: `ANOM_TEMP_${timestamp}`,
        timestamp,
        sensorId: "TEMP_SPINDLE",
        metric: "Spindle Temperature",
        baseline: 25.0,
        actual: state.spindle.temperatureC,
        deviation: state.spindle.temperatureC - 25.0,
        threshold: tempThresh,
        confidence: 0.98,
        thresholdProvenance: `Manufacturer Spindle Spec (Warning: ${tempThresh}°C, Fault: ${tempFaultThresh}°C)`
      });
    }

    // 2. Spindle Vibration Check
    const maxVib = this.contract.healthPolicy.maxVibrationG;
    if (state.spindle.vibrationG > maxVib) {
      anomalies.push({
        anomalyId: `ANOM_VIB_${timestamp}`,
        timestamp,
        sensorId: "ACCEL_SPINDLE",
        metric: "Spindle Vibration",
        baseline: 0.1,
        actual: state.spindle.vibrationG,
        deviation: state.spindle.vibrationG - 0.1,
        threshold: maxVib,
        confidence: 0.95,
        thresholdProvenance: `ISO 10816-3 Vibration Severity Guideline (${maxVib} G)`
      });
    }

    // 3. Axis Tracking Error Checks
    const maxTrack = this.contract.healthPolicy.maxTrackingErrorMM;
    for (const [axisName, axisState] of Object.entries(state.axes)) {
      if (Math.abs(axisState.trackingError) > maxTrack) {
        anomalies.push({
          anomalyId: `ANOM_TRACK_${axisName}_${timestamp}`,
          timestamp,
          sensorId: `ENC_${axisName}`,
          metric: `${axisName}-Axis Tracking Error`,
          baseline: 0.0,
          actual: axisState.trackingError,
          deviation: Math.abs(axisState.trackingError),
          threshold: maxTrack,
          confidence: 0.99,
          thresholdProvenance: `Controller Servo Loop Tolerance (${maxTrack} mm)`
        });
      }
    }

    // 4. Spindle RPM Slip Check
    const maxSlip = this.contract.healthPolicy.maxSpindleRPMSlip;
    if (Math.abs(state.spindle.slipRPM) > maxSlip && state.spindle.commandedRPM > 100) {
      anomalies.push({
        anomalyId: `ANOM_SLIP_${timestamp}`,
        timestamp,
        sensorId: "SPINDLE_TACH",
        metric: "Spindle Speed Slip",
        baseline: 0.0,
        actual: state.spindle.slipRPM,
        deviation: Math.abs(state.spindle.slipRPM),
        threshold: maxSlip,
        confidence: 0.96,
        thresholdProvenance: `Drive Inverter Field-Oriented Control Policy (Max Slip ${maxSlip} RPM)`
      });
    }

    // 5. Safety State Determination
    let safetyState = SafetyState.NORMAL;
    if (state.controller.machineMode === "EMERGENCY_STOP" || state.controller.alarmCodes.some(a => a.includes("ESTOP"))) {
      safetyState = SafetyState.EMERGENCY_STOP;
    } else {
      let hasLimitViolation = false;
      let hasLimitNear = false;

      for (const axis of Object.values(state.axes)) {
        if (axis.limitState === "HARD_LIMIT_TRIPPED" || axis.limitState === "SOFT_LIMIT_EXCEEDED") {
          hasLimitViolation = true;
        } else if (axis.limitState === "SOFT_LIMIT_NEAR") {
          hasLimitNear = true;
        }
      }

      if (hasLimitViolation) {
        safetyState = SafetyState.LIMIT_VIOLATION;
      } else if (hasLimitNear) {
        safetyState = SafetyState.LIMIT_APPROACH;
      } else if (anomalies.length > 0) {
        safetyState = SafetyState.WARNING;
      }
    }

    // 6. Health State Determination
    const axisHealth: Record<string, HealthStatus> = {};
    for (const [axisName, axis] of Object.entries(state.axes)) {
      if (Math.abs(axis.trackingError) > maxTrack * 2) {
        axisHealth[axisName] = HealthStatus.FAULT;
      } else if (Math.abs(axis.trackingError) > maxTrack) {
        axisHealth[axisName] = HealthStatus.DEGRADED;
      } else {
        axisHealth[axisName] = HealthStatus.HEALTHY;
      }
    }

    let spindleHealth = HealthStatus.HEALTHY;
    if (state.spindle.temperatureC > tempFaultThresh || state.spindle.vibrationG > maxVib * 2) {
      spindleHealth = HealthStatus.FAULT;
    } else if (state.spindle.temperatureC > tempThresh || state.spindle.vibrationG > maxVib) {
      spindleHealth = HealthStatus.DEGRADED;
    }

    let toolHealth = HealthStatus.HEALTHY;
    if (state.tool.lifeState === "BROKEN" || state.tool.lifeState === "EXPIRED") {
      toolHealth = HealthStatus.FAULT;
    } else if (state.tool.lifeState === "WORN") {
      toolHealth = HealthStatus.DEGRADED;
    }

    let overallHealth = HealthStatus.HEALTHY;
    const allHealths = [...Object.values(axisHealth), spindleHealth, toolHealth];
    if (allHealths.includes(HealthStatus.FAULT)) {
      overallHealth = HealthStatus.FAULT;
    } else if (allHealths.includes(HealthStatus.DEGRADED)) {
      overallHealth = HealthStatus.DEGRADED;
    }

    const healthState: MachineHealthState = {
      overallHealth,
      axisHealth,
      spindleHealth,
      toolHealth,
      controllerHealth: state.controller.alarmCodes.length > 0 ? HealthStatus.DEGRADED : HealthStatus.HEALTHY,
      sensorHealth: HealthStatus.HEALTHY,
      diagnostics: anomalies.map(a => `${a.metric}: ${a.actual.toFixed(2)} exceeds ${a.threshold.toFixed(2)} (${a.thresholdProvenance})`),
      timestamp
    };

    // 7. Uncertainty Model & Propagation
    const encoderRes = this.contract.uncertaintyPolicy.encoderResolutionMM;
    const sensorTol = this.contract.uncertaintyPolicy.sensorLinearToleranceMM;
    // Spatial combined uncertainty: root sum square of encoder resolution + sensor tolerance + thermal expansion error
    const thermalError = (state.spindle.temperatureC - 20) * 0.0005; // 0.5um per degC above 20C
    const combinedSpatial = Math.sqrt(encoderRes * encoderRes + sensorTol * sensorTol + thermalError * thermalError);

    const uncertainty: TwinUncertaintyModel = {
      sensorLinearUncertaintyMM: sensorTol,
      sensorAngularUncertaintyDeg: this.contract.uncertaintyPolicy.sensorAngularToleranceDeg,
      kinematicTransformationErrorMM: 0.002, // Forward kinematics matrix precision
      clockJitterMS: 1.5,
      combinedSpatialUncertaintyMM: combinedSpatial,
      confidenceScore: isFinite(combinedSpatial) ? Math.max(0.7, 1.0 - combinedSpatial * 10) : 0.5
    };

    return {
      anomalies,
      safetyState,
      healthState,
      uncertainty
    };
  }
}
