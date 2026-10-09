/**
 * SECP Physics Engine — Mass Properties Unit Converter
 * Handles explicit, deterministic unit conversions without silent errors.
 */

import { MassProperties, MassPropertiesUnits, Vector3D } from './MassPropertiesTypes';

export class MassPropertiesUnitConverter {
  /**
   * Convert length value between 'm' and 'mm'
   */
  public static convertLength(val: number, from: 'm' | 'mm', to: 'm' | 'mm'): number {
    if (from === to) return val;
    if (from === 'mm' && to === 'm') return val * 0.001;
    if (from === 'm' && to === 'mm') return val * 1000.0;
    throw new Error(`Unsupported length conversion from ${from} to ${to}`);
  }

  /**
   * Convert volume value between 'm³' and 'mm³'
   */
  public static convertVolume(val: number, from: 'm³' | 'mm³', to: 'm³' | 'mm³'): number {
    if (from === to) return val;
    if (from === 'mm³' && to === 'm³') return val * 1e-9;
    if (from === 'm³' && to === 'mm³') return val * 1e9;
    throw new Error(`Unsupported volume conversion from ${from} to ${to}`);
  }

  /**
   * Convert mass value between 'kg' and 'g'
   */
  public static convertMass(val: number, from: 'kg' | 'g', to: 'kg' | 'g'): number {
    if (from === to) return val;
    if (from === 'g' && to === 'kg') return val * 0.001;
    if (from === 'kg' && to === 'g') return val * 1000.0;
    throw new Error(`Unsupported mass conversion from ${from} to ${to}`);
  }

  /**
   * Convert density value between 'kg/m³' and 'g/cm³'
   */
  public static convertDensity(val: number, from: 'kg/m³' | 'g/cm³', to: 'kg/m³' | 'g/cm³'): number {
    if (from === to) return val;
    if (from === 'g/cm³' && to === 'kg/m³') return val * 1000.0;
    if (from === 'kg/m³' && to === 'g/cm³') return val * 0.001;
    throw new Error(`Unsupported density conversion from ${from} to ${to}`);
  }

  /**
   * Convert inertia tensor between 'kg·m²' and 'kg·mm²'
   */
  public static convertInertiaTensor(
    tensor: number[][],
    from: 'kg·m²' | 'kg·mm²',
    to: 'kg·m²' | 'kg·mm²'
  ): number[][] {
    if (from === to) return tensor.map(row => [...row]);
    let factor = 1.0;
    if (from === 'kg·m²' && to === 'kg·mm²') factor = 1e6;
    else if (from === 'kg·mm²' && to === 'kg·m²') factor = 1e-6;
    else throw new Error(`Unsupported inertia conversion from ${from} to ${to}`);

    return tensor.map(row => row.map(v => v * factor));
  }

  /**
   * Convert a complete MassProperties object to target unit system
   */
  public static convertMassProperties(
    props: MassProperties,
    targetUnits: MassPropertiesUnits
  ): MassProperties {
    const mass = this.convertMass(props.mass, props.units.mass, targetUnits.mass);
    const volume = this.convertVolume(props.volume, props.units.volume, targetUnits.volume);
    const density = this.convertDensity(props.density, props.units.density, targetUnits.density);

    const comX = this.convertLength(props.centerOfMass.x, props.units.length, targetUnits.length);
    const comY = this.convertLength(props.centerOfMass.y, props.units.length, targetUnits.length);
    const comZ = this.convertLength(props.centerOfMass.z, props.units.length, targetUnits.length);
    const centerOfMass: Vector3D = { x: comX, y: comY, z: comZ };

    const inertiaTensor = this.convertInertiaTensor(
      props.inertiaTensor,
      props.units.inertia,
      targetUnits.inertia
    );

    return {
      ...props,
      mass,
      volume,
      density,
      centerOfMass,
      inertiaTensor,
      units: { ...targetUnits }
    };
  }
}
