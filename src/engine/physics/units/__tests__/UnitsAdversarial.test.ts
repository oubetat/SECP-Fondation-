/**
 * SECP Industrial OS v2 — Units Adversarial Tests
 * PATCH-043: Units & Dimensions Engine
 */

import { describe, it, expect } from 'vitest';
import { UnitRegistry, Dimension, Quantity } from '../index';

describe('PATCH-043: Units Adversarial Tests', () => {

  it('rejects duplicate unit symbols', () => {
    expect(() => {
      UnitRegistry.register({
        id: 'dup_meter',
        symbol: 'm', // Already exists
        name: 'Duplicate Meter',
        dimension: Dimension.LENGTH,
        scale: 1,
        offset: 0,
        system: 'SI',
        aliases: []
      });
    }).toThrow('already registered');
  });

  it('rejects incompatible arithmetic (m + s)', () => {
    const q1 = new Quantity(1, UnitRegistry.get('m'));
    const q2 = new Quantity(1, UnitRegistry.get('s'));
    expect(() => q1.add(q2)).toThrow('incompatible dimensions');
  });

  it('handles NaN and Infinity in Quantities', () => {
    expect(() => new Quantity(NaN, UnitRegistry.get('m'))).toThrow('Invalid numeric value');
    expect(() => new Quantity(Infinity, UnitRegistry.get('m'))).toThrow('Invalid numeric value');
  });

  it('detects dimension spoofing via mismatched unit-dimension association', () => {
    // Creating a rogue unit that claims to be length but has mass dimension
    const rogueUnit = {
      id: 'rogue',
      symbol: 'rogue',
      name: 'Rogue Unit',
      dimension: Dimension.MASS, // LIED!
      scale: 1,
      offset: 0,
      system: 'OTHER' as const,
      aliases: []
    };
    
    const q = new Quantity(10, rogueUnit);
    expect(q.dimension.equals(Dimension.LENGTH)).toBe(false);
    expect(q.dimension.equals(Dimension.MASS)).toBe(true);
  });

  it('verifies that scale 0 is dangerous (Potential implementation flaw check)', () => {
     const zeroScaleUnit = {
      id: 'zero',
      symbol: 'zero',
      name: 'Zero Unit',
      dimension: Dimension.LENGTH,
      scale: 0, // Should probably be caught or handle division correctly
      offset: 0,
      system: 'OTHER' as const,
      aliases: []
    };
    
    const q = new Quantity(10, UnitRegistry.get('m'));
    // Conversion to zero scale should fail due to division by zero
    expect(() => q.convertTo(zeroScaleUnit)).toThrow();
  });

});
