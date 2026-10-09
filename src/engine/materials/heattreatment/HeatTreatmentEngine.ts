import { 
  ThermalCycle, 
  HeatTreatmentProcess, 
  TreatedMaterialCondition, 
  HeatTreatmentVerdict,
  HeatTreatmentProcessWindow,
  HeatingStage,
  CoolingStage,
  SoakingStage
} from "./types";

export class HeatTreatmentEngine {
  /**
   * Validates that the thermal cycle has monotonic time, non-negative values,
   * non-empty points, and correct sequence of temperatures.
   */
  public static validateThermalCycle(cycle: ThermalCycle): { valid: boolean; error?: string } {
    const { timePoints, temperaturePoints } = cycle;

    if (timePoints.length === 0 || temperaturePoints.length === 0) {
      return { valid: false, error: "Empty time or temperature points" };
    }

    if (timePoints.length !== temperaturePoints.length) {
      return { valid: false, error: "Mismatched length between time and temperature arrays" };
    }

    for (let i = 0; i < timePoints.length; i++) {
      if (timePoints[i] < 0) {
        return { valid: false, error: "Negative time point detected" };
      }
      if (temperaturePoints[i] <= 0) {
        return { valid: false, error: "Negative or zero temperature point detected" };
      }
      if (Number.isNaN(timePoints[i]) || Number.isNaN(temperaturePoints[i])) {
        return { valid: false, error: "NaN detected in thermal cycle" };
      }
      if (!Number.isFinite(timePoints[i]) || !Number.isFinite(temperaturePoints[i])) {
        return { valid: false, error: "Infinite value detected in thermal cycle" };
      }
    }

    // Monotonicity check
    for (let i = 1; i < timePoints.length; i++) {
      if (timePoints[i] <= timePoints[i - 1]) {
        return { valid: false, error: "Time points must be strictly monotonic" };
      }
    }

    // Validate heating/cooling stages
    for (const stage of cycle.heatingStages) {
      if (stage.duration <= 0 || stage.heatingRate <= 0) {
        return { valid: false, error: "Invalid heating stage parameters" };
      }
      if (stage.startTemperature >= stage.targetTemperature) {
        return { valid: false, error: "Heating stage start temperature must be less than target" };
      }
    }

    for (const stage of cycle.soakingStages) {
      if (stage.soakDuration <= 0 || stage.soakTemperature <= 0) {
        return { valid: false, error: "Invalid soaking stage parameters" };
      }
    }

    for (const stage of cycle.coolingStages) {
      if (stage.coolingRate <= 0) {
        return { valid: false, error: "Invalid cooling stage parameters" };
      }
      if (stage.startTemperature <= stage.endTemperature) {
        return { valid: false, error: "Cooling stage start temperature must be greater than end" };
      }
    }

    return { valid: true };
  }

  /**
   * Computes deterministic fingerprint for a process.
   */
  public static calculateProcessFingerprint(process: HeatTreatmentProcess): string {
    const parts = [
      process.materialId,
      process.materialRevision.toString(),
      process.processType,
      process.initialConditionId,
      process.targetConditionId,
      process.thermalCycle.fingerprint,
      process.equipment.equipmentId,
      process.batchId
    ];
    return "process-fp-" + parts.join("_").replace(/[^a-zA-Z0-9_-]/g, "");
  }

  /**
   * Computes deterministic fingerprint for a material condition.
   */
  public static calculateConditionFingerprint(condition: TreatedMaterialCondition): string {
    const parts = [
      condition.materialId,
      condition.materialRevision.toString(),
      condition.conditionName,
      condition.heatTreatmentHistory.join(","),
      condition.properties.hardness ? `${condition.properties.hardness.value}_${condition.properties.hardness.scale}` : "nohardness",
      condition.properties.yieldStrength ? condition.properties.yieldStrength.toString() : "noyield"
    ];
    return "cond-fp-" + parts.join("_").replace(/[^a-zA-Z0-9_-]/g, "");
  }

  /**
   * Evaluates process window compliance.
   */
  public static evaluateCompliance(
    process: HeatTreatmentProcess,
    window: HeatTreatmentProcessWindow
  ): HeatTreatmentVerdict {
    const cycle = process.thermalCycle;
    const validation = this.validateThermalCycle(cycle);
    if (!validation.valid) {
      return HeatTreatmentVerdict.INVALID;
    }

    // Check if equipment calibration is valid
    if (process.equipment.calibrationStatus !== "VALID") {
      return HeatTreatmentVerdict.INDETERMINATE;
    }

    // Get max temperature reached
    const maxTemp = Math.max(...cycle.temperaturePoints);
    if (maxTemp < window.temperatureRange.min || maxTemp > window.temperatureRange.max) {
      return HeatTreatmentVerdict.NON_COMPLIANT;
    }

    // Get total cycle duration
    const maxTime = Math.max(...cycle.timePoints) - Math.min(...cycle.timePoints);
    if (maxTime < window.timeRange.min || maxTime > window.timeRange.max) {
      return HeatTreatmentVerdict.NON_COMPLIANT;
    }

    // If there's a cooling rate condition, verify it
    if (window.coolingRateRange && cycle.coolingStages.length > 0) {
      const hasMatchingCooling = cycle.coolingStages.some(cooling => 
        cooling.coolingRate >= window.coolingRateRange!.min && cooling.coolingRate <= window.coolingRateRange!.max
      );
      if (!hasMatchingCooling) {
        return HeatTreatmentVerdict.NON_COMPLIANT;
      }
    }

    return HeatTreatmentVerdict.COMPLIANT;
  }
}
