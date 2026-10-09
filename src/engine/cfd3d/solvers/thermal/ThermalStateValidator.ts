/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-327: Thermal State Validator
 */

export enum ThermalFailureCode {
  NONE = 'NONE',
  NEGATIVE_TEMPERATURE = 'NEGATIVE_TEMPERATURE',
  NAN_DETECTED = 'NAN_DETECTED',
  INFINITY_DETECTED = 'INFINITY_DETECTED',
  INVALID_THERMAL_PROPERTY = 'INVALID_THERMAL_PROPERTY',
  ENERGY_DIVERGENCE = 'ENERGY_DIVERGENCE',
  INCONSISTENT_BOUNDARY = 'INCONSISTENT_BOUNDARY',
  CONTRADICTORY_BOUNDARY = 'CONTRADICTORY_BOUNDARY'
}

export interface ThermalValidationResult {
  valid: boolean;
  error: ThermalFailureCode;
  message: string;
  invalidIndex?: number;
  invalidValue?: number;
}

export class ThermalStateValidator {
  public static validate(
    temperature: number[],
    conductivity: number[],
    specificHeat?: number[],
    density?: number[]
  ): ThermalValidationResult {
    // 1. Validate Temperature Field
    if (!temperature || temperature.length === 0) {
      return {
        valid: false,
        error: ThermalFailureCode.INVALID_THERMAL_PROPERTY,
        message: 'Temperature array is empty or undefined'
      };
    }

    for (let i = 0; i < temperature.length; i++) {
      const T = temperature[i];
      if (Number.isNaN(T)) {
        return {
          valid: false,
          error: ThermalFailureCode.NAN_DETECTED,
          message: `NaN detected in temperature field at index ${i}`,
          invalidIndex: i,
          invalidValue: T
        };
      }
      if (!Number.isFinite(T)) {
        return {
          valid: false,
          error: ThermalFailureCode.INFINITY_DETECTED,
          message: `Non-finite temperature detected at index ${i}: ${T}`,
          invalidIndex: i,
          invalidValue: T
        };
      }
      // Absolute zero boundary protection: T must be strictly positive (> 0 Kelvin)
      if (T <= 0.0) {
        return {
          valid: false,
          error: ThermalFailureCode.NEGATIVE_TEMPERATURE,
          message: `Physical boundary violation: Temperature ${T} K must be strictly positive (> 0 K) at index ${i}`,
          invalidIndex: i,
          invalidValue: T
        };
      }
    }

    // 2. Validate Thermal Conductivity Field
    if (conductivity) {
      for (let i = 0; i < conductivity.length; i++) {
        const k = conductivity[i];
        if (Number.isNaN(k)) {
          return {
            valid: false,
            error: ThermalFailureCode.NAN_DETECTED,
            message: `NaN detected in thermal conductivity at index ${i}`,
            invalidIndex: i,
            invalidValue: k
          };
        }
        if (!Number.isFinite(k)) {
          return {
            valid: false,
            error: ThermalFailureCode.INFINITY_DETECTED,
            message: `Non-finite thermal conductivity detected at index ${i}: ${k}`,
            invalidIndex: i,
            invalidValue: k
          };
        }
        if (k <= 0.0) {
          return {
            valid: false,
            error: ThermalFailureCode.INVALID_THERMAL_PROPERTY,
            message: `Physical violation: Thermal conductivity ${k} W/(m*K) must be strictly positive at index ${i}`,
            invalidIndex: i,
            invalidValue: k
          };
        }
      }
    }

    // 3. Validate Specific Heat Field
    if (specificHeat) {
      for (let i = 0; i < specificHeat.length; i++) {
        const cp = specificHeat[i];
        if (Number.isNaN(cp)) {
          return {
            valid: false,
            error: ThermalFailureCode.NAN_DETECTED,
            message: `NaN detected in specific heat at index ${i}`,
            invalidIndex: i,
            invalidValue: cp
          };
        }
        if (!Number.isFinite(cp)) {
          return {
            valid: false,
            error: ThermalFailureCode.INFINITY_DETECTED,
            message: `Non-finite specific heat detected at index ${i}: ${cp}`,
            invalidIndex: i,
            invalidValue: cp
          };
        }
        if (cp <= 0.0) {
          return {
            valid: false,
            error: ThermalFailureCode.INVALID_THERMAL_PROPERTY,
            message: `Physical violation: Specific heat ${cp} J/(kg*K) must be strictly positive at index ${i}`,
            invalidIndex: i,
            invalidValue: cp
          };
        }
      }
    }

    // 4. Validate Density Field
    if (density) {
      for (let i = 0; i < density.length; i++) {
        const rho = density[i];
        if (Number.isNaN(rho)) {
          return {
            valid: false,
            error: ThermalFailureCode.NAN_DETECTED,
            message: `NaN detected in fluid density at index ${i}`,
            invalidIndex: i,
            invalidValue: rho
          };
        }
        if (!Number.isFinite(rho)) {
          return {
            valid: false,
            error: ThermalFailureCode.INFINITY_DETECTED,
            message: `Non-finite density detected at index ${i}: ${rho}`,
            invalidIndex: i,
            invalidValue: rho
          };
        }
        if (rho <= 0.0) {
          return {
            valid: false,
            error: ThermalFailureCode.INVALID_THERMAL_PROPERTY,
            message: `Physical violation: Fluid density ${rho} kg/m^3 must be strictly positive at index ${i}`,
            invalidIndex: i,
            invalidValue: rho
          };
        }
      }
    }

    return {
      valid: true,
      error: ThermalFailureCode.NONE,
      message: 'Thermal state validated successfully'
    };
  }

  public static validateBoundaryConditions(bcs: any[]): ThermalValidationResult {
    if (!bcs || bcs.length === 0) {
      return {
        valid: false,
        error: ThermalFailureCode.INCONSISTENT_BOUNDARY,
        message: 'No boundary conditions provided for thermal system'
      };
    }
    for (let i = 0; i < bcs.length; i++) {
      const bc = bcs[i];
      if (bc.value !== undefined && (!Number.isFinite(bc.value) || Number.isNaN(bc.value))) {
        return {
          valid: false,
          error: ThermalFailureCode.NAN_DETECTED,
          message: `Invalid numerical value in boundary condition ${bc.id || i}: ${bc.value}`,
          invalidIndex: i
        };
      }
      if (bc.kind === 'FIXED_TEMPERATURE' || bc.kind === 'CONSTANT_TEMPERATURE') {
        if (bc.value <= 0.0) {
          return {
            valid: false,
            error: ThermalFailureCode.NEGATIVE_TEMPERATURE,
            message: `Fixed temperature BC value ${bc.value} K must be strictly positive (> 0 K)`,
            invalidIndex: i,
            invalidValue: bc.value
          };
        }
      }
    }
    return {
      valid: true,
      error: ThermalFailureCode.NONE,
      message: 'Boundary conditions validated'
    };
  }
}
