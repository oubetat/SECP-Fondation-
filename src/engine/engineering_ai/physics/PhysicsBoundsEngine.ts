import { PhysicsBoundsRecord, QuantityType } from './types';

export class PhysicsBoundsEngine {
  public static verifyPhysicalBounds(
    variableId: string,
    quantityType: QuantityType,
    value: number,
    unit: string
  ): PhysicsBoundsRecord {
    let lowerLimit: number | undefined;
    let upperLimit: number | undefined;
    let isViolation = false;
    let reason = 'Value is within known physical bounds.';

    switch (quantityType) {
      case 'TEMPERATURE':
        lowerLimit = 0; // 0 Kelvin (Absolute Zero)
        if (unit === 'K' || unit === 'Kelvin') {
          if (value < 0) {
            isViolation = true;
            reason = `BOUND_VIOLATION: Absolute temperature (${value} K) cannot be less than Absolute Zero (0 K).`;
          }
        } else if (unit === 'C' || unit === 'Celsius') {
          lowerLimit = -273.15;
          if (value < -273.15) {
            isViolation = true;
            reason = `BOUND_VIOLATION: Temperature (${value} °C) is below Absolute Zero (-273.15 °C).`;
          }
        }
        break;

      case 'DENSITY':
        lowerLimit = 0;
        if (value <= 0) {
          isViolation = true;
          reason = `BOUND_VIOLATION: Density (${value} ${unit}) must be strictly positive.`;
        }
        break;

      case 'VISCOSITY':
        lowerLimit = 0;
        if (value <= 0) {
          isViolation = true;
          reason = `BOUND_VIOLATION: Dynamic viscosity (${value} ${unit}) must be strictly positive.`;
        }
        break;

      case 'PRESSURE':
        // Absolute pressure check
        if (unit.toLowerCase().includes('abs') || unit === 'Pa') {
          lowerLimit = 0;
          if (value < 0) {
            isViolation = true;
            reason = `BOUND_VIOLATION: Absolute pressure (${value} ${unit}) cannot be negative.`;
          }
        }
        break;

      case 'VELOCITY':
        upperLimit = 299792458; // Speed of light c in m/s
        if (Math.abs(value) > 299792458) {
          isViolation = true;
          reason = `BOUND_VIOLATION: Velocity (${value} ${unit}) exceeds the speed of light in vacuum.`;
        }
        break;

      case 'CONDUCTIVITY':
        lowerLimit = 0;
        if (value <= 0) {
          isViolation = true;
          reason = `BOUND_VIOLATION: Thermal conductivity (${value} ${unit}) must be positive.`;
        }
        break;

      default:
        break;
    }

    return {
      recordId: `BOUND-REC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      variableId,
      observedValue: value,
      unit,
      lowerLimit,
      upperLimit,
      verdict: isViolation ? 'BOUND_VIOLATION' : 'WITHIN_PHYSICAL_BOUNDS',
      reasoning: reason
    };
  }
}
