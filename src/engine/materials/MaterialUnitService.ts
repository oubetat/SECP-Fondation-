/**
 * SECP Industrial OS - PATCH-266: Material Database
 * Unit Conversion & SI Normalization Service
 */

import { PropertyName266 } from './MaterialDatabase266Types';

export interface UnitConversionResult {
  canonicalValue: number;
  canonicalUnit: string;
  originalValue: number;
  originalUnit: string;
}

export class MaterialUnitService {
  /**
   * Expected canonical SI unit for each property
   */
  public static readonly CANONICAL_UNITS: Record<PropertyName266, string> = {
    DENSITY: 'kg/m3',
    YOUNGS_MODULUS: 'Pa',
    POISSONS_RATIO: 'dimensionless',
    SHEAR_MODULUS: 'Pa',
    BULK_MODULUS: 'Pa',
    YIELD_STRENGTH: 'Pa',
    ULTIMATE_TENSILE_STRENGTH: 'Pa',
    COMPRESSIVE_STRENGTH: 'Pa',
    SHEAR_STRENGTH: 'Pa',
    THERMAL_CONDUCTIVITY: 'W/(m·K)',
    SPECIFIC_HEAT: 'J/(kg·K)',
    THERMAL_EXPANSION: '1/K',
    MELTING_POINT: 'K',
    SOLIDUS_TEMPERATURE: 'K',
    LIQUIDUS_TEMPERATURE: 'K',
    ELECTRICAL_RESISTIVITY: 'Ohm·m',
    ELECTRICAL_CONDUCTIVITY: 'S/m',
    MAGNETIC_PERMEABILITY: 'H/m',
  };

  /**
   * Normalizes a property value and unit into standard canonical SI units
   */
  public static normalizeToSI(
    propertyName: PropertyName266,
    value: number,
    unit: string
  ): UnitConversionResult {
    const cleanUnit = unit.trim();
    if (!cleanUnit) {
      throw new Error(`NO_UNIT_AMBIGUITY_ERROR: Property '${propertyName}' must have an explicit unit.`);
    }

    const canonicalUnit = this.CANONICAL_UNITS[propertyName] || 'SI';
    let canonicalValue = value;

    // Stress / Modulus / Strength (Canonical: Pa)
    if (['Pa', 'MPa', 'GPa', 'kPa', 'psi', 'ksi', 'bar'].includes(cleanUnit) || canonicalUnit === 'Pa') {
      switch (cleanUnit) {
        case 'Pa': canonicalValue = value; break;
        case 'kPa': canonicalValue = value * 1e3; break;
        case 'MPa': canonicalValue = value * 1e6; break;
        case 'GPa': canonicalValue = value * 1e9; break;
        case 'psi': canonicalValue = value * 6894.757293168; break;
        case 'ksi': canonicalValue = value * 6894757.293168; break;
        case 'bar': canonicalValue = value * 1e5; break;
      }
    }

    // Density (Canonical: kg/m3)
    if (['kg/m3', 'g/cm3', 'lb/in3', 'lb/ft3'].includes(cleanUnit) || canonicalUnit === 'kg/m3') {
      switch (cleanUnit) {
        case 'kg/m3': canonicalValue = value; break;
        case 'g/cm3': canonicalValue = value * 1000; break;
        case 'lb/in3': canonicalValue = value * 27679.90471; break;
        case 'lb/ft3': canonicalValue = value * 16.018463; break;
      }
    }

    // Thermal Conductivity (Canonical: W/(m·K))
    if (['W/(m·K)', 'W/(m·C)', 'Btu/(h·ft·F)'].includes(cleanUnit) || canonicalUnit === 'W/(m·K)') {
      switch (cleanUnit) {
        case 'W/(m·K)':
        case 'W/(m·C)': canonicalValue = value; break;
        case 'Btu/(h·ft·F)': canonicalValue = value * 1.730735; break;
      }
    }

    // Specific Heat (Canonical: J/(kg·K))
    if (['J/(kg·K)', 'J/(kg·C)', 'Btu/(lb·F)'].includes(cleanUnit) || canonicalUnit === 'J/(kg·K)') {
      switch (cleanUnit) {
        case 'J/(kg·K)':
        case 'J/(kg·C)': canonicalValue = value; break;
        case 'Btu/(lb·F)': canonicalValue = value * 4186.8; break;
      }
    }

    // Thermal Expansion (Canonical: 1/K)
    if (['1/K', '1/C', '1/F', 'um/(m·C)', '1e-6/K'].includes(cleanUnit) || canonicalUnit === '1/K') {
      switch (cleanUnit) {
        case '1/K':
        case '1/C': canonicalValue = value; break;
        case '1/F': canonicalValue = value * 1.8; break;
        case 'um/(m·C)':
        case '1e-6/K': canonicalValue = value * 1e-6; break;
      }
    }

    // Temperature (Canonical: K)
    if (['K', 'C', '°C', 'F', '°F'].includes(cleanUnit) || canonicalUnit === 'K') {
      switch (cleanUnit) {
        case 'K': canonicalValue = value; break;
        case 'C':
        case '°C': canonicalValue = value + 273.15; break;
        case 'F':
        case '°F': canonicalValue = (value - 32) * (5 / 9) + 273.15; break;
      }
    }

    // Dimensionless
    if (cleanUnit === 'dimensionless' || cleanUnit === '-' || cleanUnit === '1') {
      canonicalValue = value;
    }

    return {
      canonicalValue,
      canonicalUnit,
      originalValue: value,
      originalUnit: cleanUnit,
    };
  }

  /**
   * Converts canonical SI value to a target display unit system
   */
  public static convertFromSI(
    propertyName: PropertyName266,
    canonicalValue: number,
    targetUnit: string
  ): number {
    const cleanUnit = targetUnit.trim();

    // Pressure/Stress
    if (cleanUnit === 'MPa') return canonicalValue / 1e6;
    if (cleanUnit === 'GPa') return canonicalValue / 1e9;
    if (cleanUnit === 'kPa') return canonicalValue / 1e3;
    if (cleanUnit === 'psi') return canonicalValue / 6894.757293168;
    if (cleanUnit === 'ksi') return canonicalValue / 6894757.293168;

    // Density
    if (cleanUnit === 'g/cm3') return canonicalValue / 1000;
    if (cleanUnit === 'lb/in3') return canonicalValue / 27679.90471;

    // Temperature
    if (cleanUnit === 'C' || cleanUnit === '°C') return canonicalValue - 273.15;
    if (cleanUnit === 'F' || cleanUnit === '°F') return (canonicalValue - 273.15) * 1.8 + 32;

    // Thermal Expansion
    if (cleanUnit === 'um/(m·C)' || cleanUnit === '1e-6/K') return canonicalValue * 1e6;

    return canonicalValue;
  }

  /**
   * Normalizes common unit strings into a canonical internal representation
   */
  public static normalizeUnitString(unit: string): string {
    const u = unit.trim();
    if (u === '°C' || u === 'C') return 'C';
    if (u === '°F' || u === 'F') return 'F';
    if (u === 'K') return 'K';
    if (u === 'Pa' || u === 'Pascals') return 'Pa';
    if (u === 'MPa') return 'MPa';
    if (u === 'GPa') return 'GPa';
    if (u === 'kg/m3' || u === 'kg/m^3') return 'kg/m3';
    if (u === 'g/cm3' || u === 'g/cm^3') return 'g/cm3';
    if (u === 'mm' || u === 'millimeter') return 'mm';
    if (u === 'm' || u === 'meter') return 'm';
    if (u === 'in' || u === 'inch') return 'in';
    return u;
  }
}
