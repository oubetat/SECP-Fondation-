/**
 * SECP Industrial OS — EPC-016: Mission & Product Definition Validator
 * Strict input validation rules enforcing positive physical magnitudes,
 * explicit valid units, unique IDs, complete verification/validation methods,
 * and forbidding premature verification status or fake engineering results.
 */

import {
  EPC016InputConfig,
  EPC016ValidationError,
  MissionDefinition,
  OperatingEnvironmentDefinition,
  PayloadDefinition,
  EnduranceDefinition,
  PerformanceRequirementValues,
  MissionAssumption,
  MissionConstraint,
  QuantityWithUnit,
  RangeWithUnit
} from './MissionTypes';
import { EngineeringRequirement } from '../EngineeringRequirementTypes';
import { EngineeringRequirementValidator } from '../EngineeringRequirementValidator';

export const VALID_ENGINEERING_UNITS = new Set<string>([
  // Mass
  'kg', 'g', 'mg', 'tonne',
  // Length / Distance
  'm', 'mm', 'cm', 'km',
  // Speed / Velocity
  'm/s', 'km/h', 'knot', 'knots',
  // Acceleration
  'm/s²', 'm/s^2', 'g',
  // Rotational / Angular
  'deg', 'rad', 'deg/s', 'rad/s', 'rpm',
  // Power
  'W', 'kW', 'mW', 'hp',
  // Energy
  'Wh', 'kWh', 'J', 'kJ', 'MJ',
  // Temperature
  '°C', 'C', 'K', 'degC',
  // Pressure
  'Pa', 'kPa', 'MPa', 'bar', 'hPa', 'mbar', 'atm',
  // Time
  's', 'min', 'h', 'hr', 'ms',
  // Dimensionless / Percent
  '%', 'ratio', 'dimensionless', 'ppm', 'dB', 'count'
]);

export class MissionValidator {
  /**
   * Validates a complete EPC-016 Input Configuration.
   */
  public static validate(config: EPC016InputConfig): void {
    if (!config || typeof config !== 'object') {
      throw new EPC016ValidationError('EPC-016 input configuration cannot be null or undefined', 'NULL_CONFIG');
    }

    // 1. Mission Definition Validation
    this.validateMission(config.mission);

    // 2. Environment Validation
    this.validateEnvironment(config.environment);

    // 3. Payload Validation
    this.validatePayload(config.payload);

    // 4. Endurance Validation
    this.validateEndurance(config.endurance);

    // 5. Performance Requirements Validation
    this.validatePerformance(config.performance);

    // 6. Assumptions & Constraints Validation
    this.validateAssumptions(config.assumptions);
    this.validateConstraints(config.constraints);

    // 7. Custom Requirements & Cross-Requirement Duplicate ID check
    if (config.customRequirements && Array.isArray(config.customRequirements)) {
      const seenIds = new Set<string>();
      for (const req of config.customRequirements) {
        if (!req.requirementId || req.requirementId.trim() === '') {
          throw new EPC016ValidationError('Requirement is missing a requirementId', 'MISSING_REQUIREMENT_ID');
        }
        if (seenIds.has(req.requirementId)) {
          throw new EPC016ValidationError(
            `Duplicate requirement ID detected: ${req.requirementId}`,
            'DUPLICATE_REQUIREMENT_ID',
            { requirementId: req.requirementId }
          );
        }
        seenIds.add(req.requirementId);

        this.validateRequirement(req);
      }
    }
  }

  /**
   * Validates Mission Definition fields.
   */
  public static validateMission(mission: MissionDefinition): void {
    if (!mission || typeof mission !== 'object') {
      throw new EPC016ValidationError('Mission Definition is missing or null', 'MISSING_MISSION');
    }
    if (!mission.missionId || typeof mission.missionId !== 'string' || mission.missionId.trim() === '') {
      throw new EPC016ValidationError('Mission Definition is missing a valid missionId', 'MISSING_MISSION_ID');
    }
    if (!mission.primaryObjective || mission.primaryObjective.trim() === '') {
      throw new EPC016ValidationError('Mission Definition is missing a primary objective', 'MISSING_PRIMARY_OBJECTIVE');
    }

    this.validateQuantity(mission.missionDuration, 'missionDuration', true, ['s', 'min', 'h', 'hr']);
    this.validateQuantity(mission.requiredRange, 'requiredRange', true, ['m', 'km']);
    this.validateQuantity(mission.requiredPayload, 'requiredPayload', true, ['kg', 'g']);
    this.validateQuantity(mission.operatingAltitude, 'operatingAltitude', true, ['m', 'km']);
    this.validateQuantity(mission.operatingSpeed, 'operatingSpeed', true, ['m/s', 'km/h']);
  }

  /**
   * Validates Operating Environment Definition fields.
   */
  public static validateEnvironment(env: OperatingEnvironmentDefinition): void {
    if (!env || typeof env !== 'object') {
      throw new EPC016ValidationError('Operating Environment Definition is missing', 'MISSING_ENVIRONMENT');
    }
    if (!env.environmentProfileId || env.environmentProfileId.trim() === '') {
      throw new EPC016ValidationError('Environment Profile is missing environmentProfileId', 'MISSING_ENVIRONMENT_PROFILE_ID');
    }

    this.validateRange(env.temperatureRange, 'temperatureRange', ['°C', 'C', 'K', 'degC']);
    this.validateRange(env.pressureRange, 'pressureRange', ['Pa', 'kPa', 'bar', 'hPa', 'mbar']);
    this.validateRange(env.humidityRange, 'humidityRange', ['%']);
    if (env.humidityRange.min < 0 || env.humidityRange.max > 100) {
      throw new EPC016ValidationError('Humidity range must be between 0% and 100%', 'INVALID_ENVIRONMENTAL_RANGE');
    }

    this.validateRange(env.windSpeedRange, 'windSpeedRange', ['m/s', 'km/h', 'knot', 'knots']);
    if (env.windSpeedRange.min < 0) {
      throw new EPC016ValidationError('Wind speed cannot be negative', 'INVALID_ENVIRONMENTAL_RANGE');
    }

    this.validateQuantity(env.maximumGust, 'maximumGust', true, ['m/s', 'km/h', 'knot', 'knots']);
    if (env.maximumGust.value < env.windSpeedRange.max) {
      throw new EPC016ValidationError('Maximum gust cannot be less than the maximum sustained wind speed', 'INVALID_ENVIRONMENTAL_RANGE');
    }

    this.validateRange(env.operatingAltitudeRange, 'operatingAltitudeRange', ['m', 'km']);
    if (env.operatingAltitudeRange.min < 0) {
      throw new EPC016ValidationError('Operating altitude cannot be negative', 'INVALID_ENVIRONMENTAL_RANGE');
    }
  }

  /**
   * Validates Payload Definition fields.
   */
  public static validatePayload(payload: PayloadDefinition): void {
    if (!payload || typeof payload !== 'object') {
      throw new EPC016ValidationError('Payload Definition is missing', 'MISSING_PAYLOAD');
    }
    if (!payload.payloadId || payload.payloadId.trim() === '') {
      throw new EPC016ValidationError('Payload Definition is missing payloadId', 'MISSING_PAYLOAD_ID');
    }

    if (!payload.payloadMass || typeof payload.payloadMass !== 'object' || payload.payloadMass.value === undefined || isNaN(payload.payloadMass.value)) {
      throw new EPC016ValidationError("Field 'payloadMass' is missing or not an object", 'MISSING_QUANTITY');
    }
    if (payload.payloadMass.value < 0) {
      throw new EPC016ValidationError('Payload mass cannot be negative', 'NEGATIVE_PAYLOAD_MASS');
    }

    this.validateQuantity(payload.payloadMass, 'payloadMass', true, ['kg', 'g', 'mg']);

    if (!payload.payloadDimensions || typeof payload.payloadDimensions !== 'object') {
      throw new EPC016ValidationError('Payload dimensions missing', 'INVALID_PAYLOAD_DIMENSIONS');
    }
    this.validateUnit(payload.payloadDimensions.unit, ['m', 'mm', 'cm']);
    if (
      payload.payloadDimensions.length <= 0 ||
      payload.payloadDimensions.width <= 0 ||
      payload.payloadDimensions.height <= 0
    ) {
      throw new EPC016ValidationError('Payload dimensions (length, width, height) must be strictly positive', 'INVALID_PAYLOAD_DIMENSIONS');
    }

    this.validateQuantity(payload.payloadPower, 'payloadPower', true, ['W', 'kW', 'mW']);
    this.validateQuantity(payload.payloadDutyCycle, 'payloadDutyCycle', false, ['%']);
    if (payload.payloadDutyCycle.value < 0 || payload.payloadDutyCycle.value > 100) {
      throw new EPC016ValidationError('Payload duty cycle must be between 0% and 100%', 'INVALID_DUTY_CYCLE');
    }

    if (!payload.payloadCG || typeof payload.payloadCG !== 'object') {
      throw new EPC016ValidationError('Payload CG is missing', 'INVALID_PAYLOAD_CG');
    }
    this.validateUnit(payload.payloadCG.unit, ['m', 'mm', 'cm']);

    if (!payload.payloadRequirements || !Array.isArray(payload.payloadRequirements) || payload.payloadRequirements.length === 0) {
      throw new EPC016ValidationError('Payload definition must include at least one payload requirement', 'MISSING_PAYLOAD_REQUIREMENT');
    }

    for (const req of payload.payloadRequirements) {
      this.validateRequirement(req);
    }
  }

  /**
   * Validates Endurance Definition fields.
   */
  public static validateEndurance(endurance: EnduranceDefinition): void {
    if (!endurance || typeof endurance !== 'object') {
      throw new EPC016ValidationError('Endurance Definition is missing', 'MISSING_ENDURANCE');
    }

    this.validateQuantity(endurance.targetEndurance, 'targetEndurance', true, ['s', 'min', 'h', 'hr']);
    this.validateQuantity(endurance.minimumEndurance, 'minimumEndurance', true, ['s', 'min', 'h', 'hr']);
    if (endurance.minimumEndurance.value > endurance.targetEndurance.value) {
      throw new EPC016ValidationError('Minimum endurance cannot exceed target endurance', 'INVALID_ENDURANCE');
    }

    this.validateQuantity(endurance.missionDuration, 'missionDuration', true, ['s', 'min', 'h', 'hr']);
    this.validateQuantity(endurance.batteryCapacity, 'batteryCapacity', true, ['Wh', 'kWh', 'J', 'kJ']);
    this.validateQuantity(endurance.energyConsumptionBudget, 'energyConsumptionBudget', true, ['Wh', 'kWh', 'J', 'kJ']);
    this.validateQuantity(endurance.cruisePowerBudget, 'cruisePowerBudget', true, ['W', 'kW']);
    this.validateQuantity(endurance.hoverPowerBudget, 'hoverPowerBudget', true, ['W', 'kW']);
    this.validateQuantity(endurance.payloadPowerBudget, 'payloadPowerBudget', false, ['W', 'kW']);
  }

  /**
   * Validates Performance Requirements values.
   */
  public static validatePerformance(perf: PerformanceRequirementValues): void {
    if (!perf || typeof perf !== 'object') {
      throw new EPC016ValidationError('Performance Requirements are missing', 'MISSING_PERFORMANCE');
    }

    this.validateQuantity(perf.maximumTakeoffMass, 'maximumTakeoffMass', true, ['kg', 'g']);
    this.validateQuantity(perf.emptyMassTarget, 'emptyMassTarget', true, ['kg', 'g']);
    if (perf.emptyMassTarget.value >= perf.maximumTakeoffMass.value) {
      throw new EPC016ValidationError('Empty mass target must be strictly less than maximum takeoff mass', 'INVALID_MASS_TARGET');
    }

    this.validateQuantity(perf.payloadCapacity, 'payloadCapacity', true, ['kg', 'g']);
    this.validateQuantity(perf.maximumSpeed, 'maximumSpeed', true, ['m/s', 'km/h', 'knot']);
    this.validateQuantity(perf.cruiseSpeed, 'cruiseSpeed', true, ['m/s', 'km/h', 'knot']);
    if (perf.cruiseSpeed.value > perf.maximumSpeed.value) {
      throw new EPC016ValidationError('Cruise speed cannot exceed maximum speed', 'INVALID_SPEED_RANGE');
    }

    this.validateQuantity(perf.climbRate, 'climbRate', true, ['m/s']);
    this.validateQuantity(perf.maximumAltitude, 'maximumAltitude', true, ['m', 'km']);
    this.validateQuantity(perf.missionRange, 'missionRange', true, ['m', 'km']);
    this.validateQuantity(perf.endurance, 'endurance', true, ['s', 'min', 'h', 'hr']);
    this.validateQuantity(perf.hoverTime, 'hoverTime', true, ['s', 'min', 'h', 'hr']);
    this.validateQuantity(perf.maximumWindSpeed, 'maximumWindSpeed', true, ['m/s', 'km/h', 'knot']);
    this.validateQuantity(perf.maximumGust, 'maximumGust', true, ['m/s', 'km/h', 'knot']);
    this.validateQuantity(perf.turningRate, 'turningRate', true, ['deg/s', 'rad/s']);
    this.validateQuantity(perf.accelerationLimit, 'accelerationLimit', true, ['m/s²', 'm/s^2', 'g']);
    this.validateQuantity(perf.landingSpeed, 'landingSpeed', true, ['m/s', 'km/h']);
  }

  /**
   * Validates Assumptions list.
   */
  public static validateAssumptions(assumptions: readonly MissionAssumption[]): void {
    if (!assumptions || !Array.isArray(assumptions)) {
      throw new EPC016ValidationError('Assumptions list must be an array', 'INVALID_ASSUMPTIONS');
    }

    const seen = new Set<string>();
    for (const a of assumptions) {
      if (!a.assumptionId || a.assumptionId.trim() === '') {
        throw new EPC016ValidationError('Assumption missing assumptionId', 'MISSING_ASSUMPTION_ID');
      }
      if (seen.has(a.assumptionId)) {
        throw new EPC016ValidationError(`Duplicate assumption ID: ${a.assumptionId}`, 'DUPLICATE_ASSUMPTION_ID');
      }
      seen.add(a.assumptionId);

      if (!a.description || a.description.trim() === '') {
        throw new EPC016ValidationError(`Assumption ${a.assumptionId} missing description`, 'INVALID_ASSUMPTION');
      }
      if (!a.rationale || a.rationale.trim() === '') {
        throw new EPC016ValidationError(`Assumption ${a.assumptionId} missing rationale`, 'INVALID_ASSUMPTION');
      }
      if (a.unit && a.unit !== 'dimensionless' && a.unit !== '' && !VALID_ENGINEERING_UNITS.has(a.unit)) {
        throw new EPC016ValidationError(`Assumption ${a.assumptionId} has invalid unit: ${a.unit}`, 'INVALID_UNIT');
      }
    }
  }

  /**
   * Validates Constraints list.
   */
  public static validateConstraints(constraints: readonly MissionConstraint[]): void {
    if (!constraints || !Array.isArray(constraints)) {
      throw new EPC016ValidationError('Constraints list must be an array', 'INVALID_CONSTRAINTS');
    }

    const seen = new Set<string>();
    for (const c of constraints) {
      if (!c.constraintId || c.constraintId.trim() === '') {
        throw new EPC016ValidationError('Constraint missing constraintId', 'MISSING_CONSTRAINT_ID');
      }
      if (seen.has(c.constraintId)) {
        throw new EPC016ValidationError(`Duplicate constraint ID: ${c.constraintId}`, 'DUPLICATE_CONSTRAINT_ID');
      }
      seen.add(c.constraintId);

      if (!c.description || c.description.trim() === '') {
        throw new EPC016ValidationError(`Constraint ${c.constraintId} missing description`, 'INVALID_CONSTRAINT');
      }
      if (c.limitValue === undefined || c.limitValue === null || isNaN(c.limitValue)) {
        throw new EPC016ValidationError(`Constraint ${c.constraintId} missing limitValue`, 'INVALID_CONSTRAINT');
      }
      if (c.unit && c.unit !== 'dimensionless' && c.unit !== '' && !VALID_ENGINEERING_UNITS.has(c.unit)) {
        throw new EPC016ValidationError(`Constraint ${c.constraintId} has invalid unit: ${c.unit}`, 'INVALID_UNIT');
      }
    }
  }

  /**
   * Validates an individual EPC-002 Engineering Requirement.
   */
  public static validateRequirement(req: EngineeringRequirement): void {
    if (!req || typeof req !== 'object') {
      throw new EPC016ValidationError('Requirement is missing or null', 'INVALID_REQUIREMENT');
    }
    if (!req.requirementId || req.requirementId.trim() === '') {
      throw new EPC016ValidationError('Requirement missing requirementId', 'MISSING_REQUIREMENT_ID');
    }
    if (!req.parameter || req.parameter.trim() === '') {
      throw new EPC016ValidationError(`Requirement ${req.requirementId} missing parameter`, 'MISSING_PARAMETER');
    }
    if (!req.unit || req.unit.trim() === '') {
      throw new EPC016ValidationError(`Requirement ${req.requirementId} missing unit`, 'INVALID_UNIT');
    }
    if (!VALID_ENGINEERING_UNITS.has(req.unit)) {
      throw new EPC016ValidationError(`Requirement ${req.requirementId} contains invalid unit '${req.unit}'`, 'INVALID_UNIT');
    }
    if (!req.priority) {
      throw new EPC016ValidationError(`Requirement ${req.requirementId} missing priority`, 'MISSING_PRIORITY');
    }
    if (!req.verificationMethod) {
      throw new EPC016ValidationError(`Requirement ${req.requirementId} missing verificationMethod`, 'MISSING_VERIFICATION_METHOD');
    }
    if (!req.validationMethod) {
      throw new EPC016ValidationError(`Requirement ${req.requirementId} missing validationMethod`, 'MISSING_VALIDATION_METHOD');
    }

    // Check premature status
    if (req.metadata?.status === 'VERIFIED' || req.metadata?.status === 'VALIDATED') {
      throw new EPC016ValidationError(
        `Requirement ${req.requirementId} cannot be marked '${req.metadata.status}' in EPC-016 definition phase`,
        'PREMATURE_VERIFICATION_STATUS'
      );
    }

    // Call underlying EPC-002 validator
    EngineeringRequirementValidator.validate(req);
  }

  /**
   * Validates a numeric quantity with an engineering unit.
   */
  public static validateQuantity(
    q: QuantityWithUnit | undefined | null,
    fieldName: string,
    strictlyPositive: boolean = false,
    allowedUnits?: string[]
  ): void {
    if (!q || typeof q !== 'object') {
      throw new EPC016ValidationError(`Field '${fieldName}' is missing or not an object`, 'MISSING_QUANTITY');
    }
    if (q.value === undefined || q.value === null || isNaN(q.value)) {
      throw new EPC016ValidationError(`Field '${fieldName}' contains invalid or undefined numeric value`, 'INVALID_NUMERIC_VALUE');
    }
    if (strictlyPositive && q.value <= 0) {
      throw new EPC016ValidationError(`Field '${fieldName}' must be strictly positive (got ${q.value})`, 'NON_POSITIVE_VALUE');
    }
    if (!strictlyPositive && q.value < 0) {
      throw new EPC016ValidationError(`Field '${fieldName}' cannot be negative (got ${q.value})`, 'NEGATIVE_VALUE');
    }

    this.validateUnit(q.unit, allowedUnits);
  }

  /**
   * Validates a numeric range with an engineering unit.
   */
  public static validateRange(
    range: RangeWithUnit | undefined | null,
    fieldName: string,
    allowedUnits?: string[]
  ): void {
    if (!range || typeof range !== 'object') {
      throw new EPC016ValidationError(`Field '${fieldName}' range is missing`, 'MISSING_RANGE');
    }
    if (range.min === undefined || isNaN(range.min) || range.max === undefined || isNaN(range.max)) {
      throw new EPC016ValidationError(`Field '${fieldName}' has invalid min/max values`, 'INVALID_RANGE_VALUES');
    }
    if (range.min > range.max) {
      throw new EPC016ValidationError(`Field '${fieldName}' range minimum (${range.min}) exceeds maximum (${range.max})`, 'INVALID_ENVIRONMENTAL_RANGE');
    }

    this.validateUnit(range.unit, allowedUnits);
  }

  /**
   * Validates unit string against whitelist.
   */
  public static validateUnit(unit: string | undefined | null, allowedUnits?: string[]): void {
    if (!unit || typeof unit !== 'string' || unit.trim() === '') {
      throw new EPC016ValidationError('Engineering unit is required and cannot be empty', 'INVALID_UNIT');
    }
    const cleanUnit = unit.trim();
    if (!VALID_ENGINEERING_UNITS.has(cleanUnit)) {
      throw new EPC016ValidationError(`Unknown engineering unit '${cleanUnit}'`, 'INVALID_UNIT');
    }
    if (allowedUnits && allowedUnits.length > 0 && !allowedUnits.includes(cleanUnit)) {
      throw new EPC016ValidationError(
        `Unit '${cleanUnit}' is not allowed for this parameter (expected one of: ${allowedUnits.join(', ')})`,
        'INVALID_UNIT'
      );
    }
  }
}
