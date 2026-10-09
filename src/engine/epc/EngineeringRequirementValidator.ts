/**
 * SECP Industrial OS — EPC-002: Engineering Requirement Validator
 * Strict Schema, Dimensional, and Tolerance Validation for EngineeringRequirement.
 */

import { UnitValidator } from '../physics/units/UnitValidator';
import { UnitRegistry } from '../physics/units/Unit';
import { UNIT_DEFINITIONS } from '../units';
import {
  EngineeringRequirement,
  EngineeringRequirementValidationError,
  RequirementPriority,
  RequirementVerificationMethod,
  RequirementValidationMethod,
  RequirementTolerance,
  ToleranceType
} from './EngineeringRequirementTypes';
import { ProofCaseRequirementReference } from './ProofCaseTypes';

export const VALID_PRIORITIES: readonly RequirementPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export const VALID_VERIFICATION_METHODS: readonly RequirementVerificationMethod[] = [
  'ANALYSIS',
  'SIMULATION',
  'INSPECTION',
  'TEST',
  'MEASUREMENT',
  'REVIEW'
];

export const VALID_VALIDATION_METHODS: readonly RequirementValidationMethod[] = [
  'EXPERIMENT',
  'PHYSICAL_TEST',
  'FIELD_TEST',
  'SIMULATION_CORRELATION',
  'PROTOTYPE_TEST',
  'INDEPENDENT_VALIDATION'
];

export const VALID_TOLERANCE_TYPES: readonly ToleranceType[] = [
  'ABSOLUTE',
  'RELATIVE',
  'BOUNDS',
  'EXACT',
  'BAND_PASS'
];

// Additional standard engineering units beyond physics unit engine
const EXTRA_KNOWN_UNITS = new Set<string>([
  '%',
  'dimensionless',
  '1',
  'unitless',
  'count',
  'm/s',
  'm/s^2',
  'm/s²',
  'kg/m^3',
  'N*m',
  'Nm',
  'psi',
  'C',
  'F',
  '°F',
  'deg',
  'rad',
  'rpm',
  'Hz',
  'W',
  'kW',
  'MW',
  'Wh',
  'kWh',
  'J',
  'kJ',
  'MJ',
  'Pa',
  'bar',
  'kPa',
  'MPa',
  'N',
  'kN',
  'MN',
  'kg',
  'g',
  'm',
  'mm',
  'cm',
  'km',
  'inch',
  'ft',
  's',
  'ms',
  'min',
  'h',
  'hr',
  'K',
  '°C',
  'rad/s',
  'deg/s',
  'dB',
  'dBA',
  'dB(A)',
  'ratio',
  'V',
  'mV',
  'kV',
  'A',
  'mA',
  'Ah',
  'mAh'
]);

export class EngineeringRequirementValidator {
  /**
   * Validates a unit string against SECP unit infrastructure.
   */
  public static isUnitValid(unitSymbol: string): boolean {
    if (typeof unitSymbol !== 'string') return false;
    const trimmed = unitSymbol.trim();
    if (trimmed === '') return false;

    // Check physics unit engine (UnitValidator / UnitRegistry)
    if (UnitValidator.verifyUnit(trimmed) || UnitRegistry.has(trimmed)) {
      return true;
    }

    // Check SECP units.ts definitions
    if (trimmed in UNIT_DEFINITIONS) {
      return true;
    }

    // Check additional standard engineering units
    return EXTRA_KNOWN_UNITS.has(trimmed);
  }

  /**
   * Checks dimensional compatibility between parameter name and unit.
   */
  public static isDimensionallyCompatible(parameter: string, unitSymbol: string): boolean {
    const paramLower = parameter.toLowerCase();
    const u = unitSymbol.trim();

    const isDimensionlessUnit = ['%', 'dimensionless', '1', 'ratio', 'count', 'unitless'].includes(u);

    // If parameter represents a ratio, factor, index, count, coefficient, or margin, allow dimensionless units
    if (paramLower.includes('ratio') || paramLower.includes('factor') || paramLower.includes('index') || paramLower.includes('margin') || paramLower.includes('coefficient') || paramLower.includes('merit')) {
      if (isDimensionlessUnit) {
        return true;
      }
    }

    // Frequency / Bandwidth check
    if (paramLower.includes('bandwidth') || paramLower.includes('frequency')) {
      const isFreqUnit = ['Hz', 'kHz', 'MHz', 'GHz', 'rpm', 'rad/s', 'deg/s'].includes(u);
      if (isFreqUnit) return true;
      if (!isFreqUnit && this.isUnitValid(u) && !isDimensionlessUnit) {
        return false;
      }
    }

    // Power check
    if (paramLower.includes('power')) {
      const isPowerUnit = ['W', 'kW', 'MW', 'hp'].includes(u);
      if (isPowerUnit) return true;
    }

    // Energy check
    if (paramLower.includes('energy') || paramLower.includes('capacity')) {
      const isEnergyUnit = ['J', 'kJ', 'MJ', 'Wh', 'kWh', 'Ah', 'mAh'].includes(u);
      if (isEnergyUnit) return true;
    }

    // Speed / Velocity check
    if (paramLower.includes('speed') || paramLower.includes('velocity')) {
      const isSpeedUnit = ['m/s', 'km/h', 'mph', 'knot', 'knots', 'ft/s'].includes(u);
      if (!isSpeedUnit && this.isUnitValid(u) && !isDimensionlessUnit) {
        return false;
      }
    }

    // Mass check
    if (paramLower.includes('mass') || paramLower.includes('weight') || paramLower.includes('payload_mass')) {
      const isMassUnit = ['kg', 'g', 'kilogram', 'gram', 'lb', 'ton'].includes(u) ||
        (UnitRegistry.has(u) && UnitRegistry.get(u).dimension.equals(UnitRegistry.get('kg').dimension));
      if (!isMassUnit && this.isUnitValid(u) && !isDimensionlessUnit) {
        return false;
      }
    }

    // Pressure check
    if (paramLower.includes('pressure') || paramLower.includes('stress')) {
      const isPressureUnit = ['Pa', 'kPa', 'MPa', 'bar', 'pascal', 'kilopascal', 'megapascal', 'psi', 'dB', 'dBA', 'dB(A)'].includes(u) ||
        (UnitRegistry.has(u) && UnitRegistry.get(u).dimension.equals(UnitRegistry.get('Pa').dimension));
      if (!isPressureUnit && this.isUnitValid(u) && !isDimensionlessUnit) {
        return false;
      }
    }

    // Temperature check
    if (paramLower.includes('temperature')) {
      const isTempUnit = ['K', '°C', 'C', '°F', 'F', 'kelvin', 'celsius'].includes(u) ||
        (UnitRegistry.has(u) && UnitRegistry.get(u).dimension.equals(UnitRegistry.get('K').dimension));
      if (!isTempUnit && this.isUnitValid(u) && !isDimensionlessUnit) {
        return false;
      }
    }

    // Length check (exclude bandwidth)
    if (
      paramLower.includes('length') ||
      paramLower.includes('displacement') ||
      paramLower.includes('deflection') ||
      (paramLower.includes('width') && !paramLower.includes('bandwidth')) ||
      paramLower.includes('height') ||
      paramLower.includes('thickness') ||
      paramLower.includes('altitude') ||
      paramLower.includes('radius') ||
      paramLower.includes('ceiling')
    ) {
      const isLengthUnit = ['m', 'mm', 'cm', 'km', 'inch', 'ft', 'meter', 'millimeter', 'centimeter', 'kilometer'].includes(u) ||
        (UnitRegistry.has(u) && UnitRegistry.get(u).dimension.equals(UnitRegistry.get('m').dimension));
      if (!isLengthUnit && this.isUnitValid(u) && !isDimensionlessUnit) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validates a tolerance structure.
   */
  public static validateTolerance(tolerance: unknown): RequirementTolerance {
    if (!tolerance || typeof tolerance !== 'object' || Array.isArray(tolerance)) {
      throw new EngineeringRequirementValidationError(
        'Requirement tolerance must be a non-null object',
        'INVALID_TOLERANCE_STRUCTURE'
      );
    }

    const obj = tolerance as Record<string, unknown>;

    if (obj.type !== undefined && obj.type !== null) {
      if (typeof obj.type !== 'string' || !VALID_TOLERANCE_TYPES.includes(obj.type as ToleranceType)) {
        throw new EngineeringRequirementValidationError(
          `Invalid tolerance type '${obj.type}'. Allowed: ${VALID_TOLERANCE_TYPES.join(', ')}`,
          'INVALID_TOLERANCE_TYPE'
        );
      }
    }

    // Check numeric fields
    const checkNumericField = (name: string, value: unknown, allowNegative: boolean = true) => {
      if (value !== undefined && value !== null) {
        if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
          throw new EngineeringRequirementValidationError(
            `Tolerance field '${name}' must be a finite number`,
            'INVALID_TOLERANCE_NUMERIC'
          );
        }
        if (!allowNegative && value < 0) {
          throw new EngineeringRequirementValidationError(
            `Tolerance field '${name}' must be non-negative`,
            'INVALID_TOLERANCE_NUMERIC'
          );
        }
      }
    };

    checkNumericField('absoluteTolerance', obj.absoluteTolerance, false);
    checkNumericField('relativeTolerance', obj.relativeTolerance, false);
    checkNumericField('lowerBound', obj.lowerBound, true);
    checkNumericField('upperBound', obj.upperBound, true);
    checkNumericField('nominalValue', obj.nominalValue, true);

    // Enforce lowerBound <= upperBound when both provided
    if (typeof obj.lowerBound === 'number' && typeof obj.upperBound === 'number') {
      if (obj.lowerBound > obj.upperBound) {
        throw new EngineeringRequirementValidationError(
          `Invalid tolerance bounds: lowerBound (${obj.lowerBound}) cannot exceed upperBound (${obj.upperBound})`,
          'INVALID_TOLERANCE_BOUNDS'
        );
      }
    }

    return obj as unknown as RequirementTolerance;
  }

  /**
   * Main validation entrypoint for EngineeringRequirement.
   */
  public static validate(candidate: unknown): EngineeringRequirement {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw new EngineeringRequirementValidationError(
        'EngineeringRequirement must be a non-null object',
        'INVALID_REQUIREMENT_STRUCTURE'
      );
    }

    const obj = candidate as Record<string, unknown>;

    // 1. requirementId
    if (obj.requirementId === undefined || obj.requirementId === null) {
      throw new EngineeringRequirementValidationError(
        'EngineeringRequirement missing mandatory field: requirementId',
        'MISSING_REQUIREMENT_ID'
      );
    }
    if (typeof obj.requirementId !== 'string' || obj.requirementId.trim() === '') {
      throw new EngineeringRequirementValidationError(
        'requirementId must be a non-empty string',
        'INVALID_REQUIREMENT_ID'
      );
    }

    // 2. description
    if (obj.description === undefined || obj.description === null) {
      throw new EngineeringRequirementValidationError(
        'EngineeringRequirement missing mandatory field: description',
        'MISSING_DESCRIPTION'
      );
    }
    if (typeof obj.description !== 'string' || obj.description.trim() === '') {
      throw new EngineeringRequirementValidationError(
        'description must be a non-empty string',
        'INVALID_DESCRIPTION'
      );
    }

    // 3. parameter
    if (obj.parameter === undefined || obj.parameter === null) {
      throw new EngineeringRequirementValidationError(
        'EngineeringRequirement missing mandatory field: parameter',
        'MISSING_PARAMETER'
      );
    }
    if (typeof obj.parameter !== 'string' || obj.parameter.trim() === '') {
      throw new EngineeringRequirementValidationError(
        'parameter must be a non-empty string',
        'INVALID_PARAMETER'
      );
    }

    // 4. unit
    if (obj.unit === undefined || obj.unit === null) {
      throw new EngineeringRequirementValidationError(
        'EngineeringRequirement missing mandatory field: unit',
        'MISSING_UNIT'
      );
    }
    if (typeof obj.unit !== 'string' || obj.unit.trim() === '') {
      throw new EngineeringRequirementValidationError(
        'unit must be a non-empty string',
        'INVALID_UNIT'
      );
    }
    if (!this.isUnitValid(obj.unit)) {
      throw new EngineeringRequirementValidationError(
        `Invalid or unsupported engineering unit symbol: '${obj.unit}'`,
        'INVALID_UNIT'
      );
    }
    if (!this.isDimensionallyCompatible(obj.parameter, obj.unit)) {
      throw new EngineeringRequirementValidationError(
        `Incompatible dimension between parameter '${obj.parameter}' and unit '${obj.unit}'`,
        'DIMENSIONAL_INCOMPATIBILITY'
      );
    }

    // 5. tolerance
    if (obj.tolerance === undefined || obj.tolerance === null) {
      throw new EngineeringRequirementValidationError(
        'EngineeringRequirement missing mandatory field: tolerance',
        'MISSING_TOLERANCE'
      );
    }
    this.validateTolerance(obj.tolerance);

    // 6. priority
    if (obj.priority === undefined || obj.priority === null) {
      throw new EngineeringRequirementValidationError(
        'EngineeringRequirement missing mandatory field: priority',
        'MISSING_PRIORITY'
      );
    }
    if (typeof obj.priority !== 'string' || !VALID_PRIORITIES.includes(obj.priority as RequirementPriority)) {
      throw new EngineeringRequirementValidationError(
        `Invalid priority '${obj.priority}'. Allowed priorities: ${VALID_PRIORITIES.join(', ')}`,
        'INVALID_PRIORITY'
      );
    }

    // 7. verificationMethod
    if (obj.verificationMethod === undefined || obj.verificationMethod === null) {
      throw new EngineeringRequirementValidationError(
        'EngineeringRequirement missing mandatory field: verificationMethod',
        'MISSING_VERIFICATION_METHOD'
      );
    }
    if (
      typeof obj.verificationMethod !== 'string' ||
      !VALID_VERIFICATION_METHODS.includes(obj.verificationMethod as RequirementVerificationMethod)
    ) {
      throw new EngineeringRequirementValidationError(
        `Invalid verificationMethod '${obj.verificationMethod}'. Allowed: ${VALID_VERIFICATION_METHODS.join(', ')}`,
        'INVALID_VERIFICATION_METHOD'
      );
    }

    // 8. validationMethod
    if (obj.validationMethod === undefined || obj.validationMethod === null) {
      throw new EngineeringRequirementValidationError(
        'EngineeringRequirement missing mandatory field: validationMethod',
        'MISSING_VALIDATION_METHOD'
      );
    }
    if (
      typeof obj.validationMethod !== 'string' ||
      !VALID_VALIDATION_METHODS.includes(obj.validationMethod as RequirementValidationMethod)
    ) {
      throw new EngineeringRequirementValidationError(
        `Invalid validationMethod '${obj.validationMethod}'. Allowed: ${VALID_VALIDATION_METHODS.join(', ')}`,
        'INVALID_VALIDATION_METHOD'
      );
    }

    return obj as unknown as EngineeringRequirement;
  }

  /**
   * Converts an EngineeringRequirement into a ProofCaseRequirementReference for EPC-001 integration.
   */
  public static toProofCaseRequirementReference(req: EngineeringRequirement): ProofCaseRequirementReference {
    const validated = this.validate(req);
    return {
      requirementId: validated.requirementId,
      title: validated.description,
      category: validated.category || validated.parameter,
      revision: validated.revision || 'v1.0.0',
      status: 'DEFINED'
    };
  }
}
