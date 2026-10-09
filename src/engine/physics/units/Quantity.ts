/**
 * SECP Industrial OS v2 — Quantity Model
 * PATCH-043: Units & Dimensions Engine
 */

import { Dimension } from './Dimension';
import { Unit, UnitRegistry } from './Unit';

export class Quantity {
  constructor(
    public readonly value: number,
    public readonly unit: Unit
  ) {
    if (isNaN(value) || !isFinite(value)) {
      throw new Error(`Invalid numeric value for Quantity: ${value}`);
    }
  }

  public get dimension(): Dimension {
    return this.unit.dimension;
  }

  /**
   * Convert to target unit. Dimensions must match.
   */
  public convertTo(targetUnitOrSymbol: Unit | string): Quantity {
    const targetUnit = typeof targetUnitOrSymbol === 'string' ? UnitRegistry.get(targetUnitOrSymbol) : targetUnitOrSymbol;

    if (!this.dimension.equals(targetUnit.dimension)) {
      throw new Error(`Incompatible dimensions: ${this.dimension.toString()} vs ${targetUnit.dimension.toString()}`);
    }

    // baseValue = value * scale + offset
    const baseValue = this.value * this.unit.scale + this.unit.offset;
    // targetValue = (baseValue - targetOffset) / targetScale
    const targetValue = (baseValue - targetUnit.offset) / targetUnit.scale;

    return new Quantity(targetValue, targetUnit);
  }

  /**
   * Add another quantity. Dimensions must match.
   */
  public add(other: Quantity): Quantity {
    if (!this.dimension.equals(other.dimension)) {
      throw new Error(`Cannot add incompatible dimensions: ${this.dimension.toString()} and ${other.dimension.toString()}`);
    }

    const otherInMyUnits = other.convertTo(this.unit);
    // Note: For addition with offsets (like Celsius), we usually add delta, 
    // but standard quantity addition treats them as absolute.
    // SECP Rule: If units have offsets (Temperature), standard addition is physically ambiguous.
    // We treat it as value addition in current unit for now, but usually temperatures are not added.
    return new Quantity(this.value + otherInMyUnits.value, this.unit);
  }

  public subtract(other: Quantity): Quantity {
    if (!this.dimension.equals(other.dimension)) {
      throw new Error(`Cannot subtract incompatible dimensions: ${this.dimension.toString()} and ${other.dimension.toString()}`);
    }

    const otherInMyUnits = other.convertTo(this.unit);
    return new Quantity(this.value - otherInMyUnits.value, this.unit);
  }

  public multiply(other: Quantity): Quantity {
    const newVal = this.value * other.value;
    const newDim = this.dimension.multiply(other.dimension);
    
    // We need a way to represent composite units. 
    // For now, we create an anonymous unit or find one in registry.
    // In this patch, we'll try to find a matching unit if it exists, else we stay in SI derived.
    const newScale = this.unit.scale * other.unit.scale;
    const newOffset = 0; // Offsets are not preserved in multiplication (physically correct for Temp)
    
    const compositeUnit: Unit = {
      id: `composite_${Math.random()}`,
      symbol: `${this.unit.symbol}*${other.unit.symbol}`,
      name: 'Composite Unit',
      dimension: newDim,
      scale: newScale,
      offset: newOffset,
      system: 'OTHER',
      aliases: []
    };

    return new Quantity(newVal, compositeUnit);
  }

  public divide(other: Quantity): Quantity {
    if (other.value === 0) throw new Error('Division by zero in Quantity');
    const newVal = this.value / other.value;
    const newDim = this.dimension.divide(other.dimension);
    
    const compositeUnit: Unit = {
      id: `composite_${Math.random()}`,
      symbol: `${this.unit.symbol}/${other.unit.symbol}`,
      name: 'Composite Unit',
      dimension: newDim,
      scale: this.unit.scale / other.unit.scale,
      offset: 0,
      system: 'OTHER',
      aliases: []
    };

    return new Quantity(newVal, compositeUnit);
  }

  public equals(other: Quantity, tolerance: number = 1e-9): boolean {
    if (!this.dimension.equals(other.dimension)) return false;
    const otherInMyUnits = other.convertTo(this.unit);
    return Math.abs(this.value - otherInMyUnits.value) <= tolerance;
  }

  public toString(): string {
    return `${this.value} ${this.unit.symbol}`;
  }
}
