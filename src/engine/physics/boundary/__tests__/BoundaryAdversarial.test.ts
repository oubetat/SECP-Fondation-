/**
 * SECP Industrial OS v2 — Boundary Condition Adversarial Tests
 * PATCH-045: Boundary Condition Framework
 */

import { describe, it, expect } from 'vitest';
import { CanonicalBoundaryCondition, BoundaryConditionSet } from '../BoundaryTypes';
import { BoundaryValidator } from '../BoundaryValidator';
import { Quantity, UnitRegistry, Dimension } from '../../units/index';
import { PhysicsDomain } from '../../PhysicsTypes';

describe('PATCH-045: Boundary Condition Adversarial', () => {

  const velocityUnit = { id: 'm/s', symbol: 'm/s', name: 'Meters per second', dimension: Dimension.VELOCITY, scale: 1, offset: 0, system: 'SI' as const, aliases: [] };
  const tempUnit = UnitRegistry.get('K');

  it('rejects cross-domain misuse (e.g. STRUCTURAL BC in FLUID set)', () => {
    const bc: CanonicalBoundaryCondition = {
      boundaryConditionId: 'BC-ADV-1',
      type: 'FIXED_SUPPORT', // Structural type
      target: { targetId: 'FACE-1', kind: 'FACE' },
      physicsDomain: PhysicsDomain.FLUID, // Wrong domain
      revision: '1.0'
    };
    const result = BoundaryValidator.validateBoundaryCondition(bc);
    expect(result.valid).toBe(false);
    expect(result.status).toBe('CROSS_DOMAIN_MISUSE');
  });

  it('rejects negative absolute temperature', () => {
    const bc: CanonicalBoundaryCondition = {
      boundaryConditionId: 'BC-ADV-2',
      type: 'PRESCRIBED_TEMPERATURE',
      target: { targetId: 'FACE-1', kind: 'FACE' },
      physicsDomain: PhysicsDomain.THERMAL,
      revision: '1.0',
      value: { type: 'CONSTANT', value: new Quantity(-10, tempUnit) } // Invalid Kelvin
    };
    const result = BoundaryValidator.validateBoundaryCondition(bc);
    expect(result.valid).toBe(false);
    expect(result.status).toBe('INVALID');
    expect(result.errors.some(e => e.includes('negative absolute temperature'))).toBe(true);
  });

  it('rejects NaN values', () => {
    expect(() => {
      new Quantity(NaN, velocityUnit);
    }).toThrow('Invalid numeric value');
  });

  it('rejects unsorted table inputs', () => {
    const bc: CanonicalBoundaryCondition = {
      boundaryConditionId: 'BC-ADV-4',
      type: 'VELOCITY_INLET',
      target: { targetId: 'FACE-1', kind: 'FACE' },
      physicsDomain: PhysicsDomain.FLUID,
      revision: '1.0',
      value: { 
        type: 'TABLE', 
        independentVariable: 'TIME', 
        interpolation: 'LINEAR',
        points: [
          { input: new Quantity(2, UnitRegistry.get('s')), output: new Quantity(10, velocityUnit) },
          { input: new Quantity(1, UnitRegistry.get('s')), output: new Quantity(20, velocityUnit) } // Unsorted
        ]
      }
    };
    const result = BoundaryValidator.validateBoundaryCondition(bc);
    expect(result.valid).toBe(false);
    expect(result.status).toBe('INVALID');
    expect(result.errors.some(e => e.includes('monotonically increasing'))).toBe(true);
  });

});
