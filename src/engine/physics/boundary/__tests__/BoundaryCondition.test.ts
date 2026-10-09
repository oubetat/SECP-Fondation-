/**
 * SECP Industrial OS v2 — Boundary Condition Tests
 * PATCH-045: Boundary Condition Framework
 */

import { describe, it, expect } from 'vitest';
import { CanonicalBoundaryCondition, BoundaryConditionSet } from '../BoundaryTypes';
import { BoundaryValidator } from '../BoundaryValidator';
import { BoundaryConditionGate045 } from '../BoundaryConditionGate045';
import { Quantity, UnitRegistry, Dimension } from '../../units/index';
import { PhysicsDomain } from '../../PhysicsTypes';

describe('PATCH-045: Boundary Condition Framework', () => {

  const velocityUnit = { id: 'm/s', symbol: 'm/s', name: 'Meters per second', dimension: Dimension.VELOCITY, scale: 1, offset: 0, system: 'SI' as const, aliases: [] };
  const pressureUnit = UnitRegistry.get('Pa');
  const tempUnit = UnitRegistry.get('K');

  it('validates a valid VELOCITY_INLET', () => {
    const bc: CanonicalBoundaryCondition = {
      boundaryConditionId: 'BC-001',
      type: 'VELOCITY_INLET',
      target: { targetId: 'FACE-1', kind: 'FACE' },
      physicsDomain: PhysicsDomain.FLUID,
      revision: '1.0',
      value: { type: 'CONSTANT', value: new Quantity(10, velocityUnit) }
    };
    const result = BoundaryValidator.validateBoundaryCondition(bc);
    expect(result.valid).toBe(true);
  });

  it('rejects VELOCITY_INLET with incorrect dimension', () => {
    const bc: CanonicalBoundaryCondition = {
      boundaryConditionId: 'BC-002',
      type: 'VELOCITY_INLET',
      target: { targetId: 'FACE-2', kind: 'FACE' },
      physicsDomain: PhysicsDomain.FLUID,
      revision: '1.0',
      value: { type: 'CONSTANT', value: new Quantity(10, pressureUnit) } // WRONG
    };
    const result = BoundaryValidator.validateBoundaryCondition(bc);
    expect(result.valid).toBe(false);
    expect(result.status).toBe('DIMENSION_MISMATCH');
  });

  it('accepts valid FIXED_SUPPORT without a value', () => {
    const bc: CanonicalBoundaryCondition = {
      boundaryConditionId: 'BC-003',
      type: 'FIXED_SUPPORT',
      target: { targetId: 'FACE-3', kind: 'FACE' },
      physicsDomain: PhysicsDomain.STRUCTURAL,
      revision: '1.0'
    };
    const result = BoundaryValidator.validateBoundaryCondition(bc);
    expect(result.valid).toBe(true);
  });

  it('detects duplicate BCs on the same target', () => {
    const set: BoundaryConditionSet = {
      setId: 'SET-1',
      modelId: 'MOD-1',
      physicsDomain: PhysicsDomain.FLUID,
      revision: '1',
      boundaryConditions: [
        {
          boundaryConditionId: 'BC-001',
          type: 'VELOCITY_INLET',
          target: { targetId: 'FACE-1', kind: 'FACE' },
          physicsDomain: PhysicsDomain.FLUID,
          revision: '1.0',
          value: { type: 'CONSTANT', value: new Quantity(10, velocityUnit) }
        },
        {
          boundaryConditionId: 'BC-001', // DUPLICATE ID
          type: 'PRESSURE_INLET',
          target: { targetId: 'FACE-1', kind: 'FACE' },
          physicsDomain: PhysicsDomain.FLUID,
          revision: '1.0',
          value: { type: 'CONSTANT', value: new Quantity(1e5, pressureUnit) }
        }
      ]
    };
    const result = BoundaryValidator.detectConflicts(set);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Duplicate BCs detected'))).toBe(true);
  });

  it('detects conflicting BC types on the same target', () => {
    const set: BoundaryConditionSet = {
      setId: 'SET-1',
      modelId: 'MOD-1',
      physicsDomain: PhysicsDomain.FLUID,
      revision: '1',
      boundaryConditions: [
        {
          boundaryConditionId: 'BC-001',
          type: 'VELOCITY_INLET',
          target: { targetId: 'FACE-1', kind: 'FACE' },
          physicsDomain: PhysicsDomain.FLUID,
          revision: '1.0',
          value: { type: 'CONSTANT', value: new Quantity(10, velocityUnit) }
        },
        {
          boundaryConditionId: 'BC-002', 
          type: 'PRESSURE_INLET',
          target: { targetId: 'FACE-1', kind: 'FACE' },
          physicsDomain: PhysicsDomain.FLUID,
          revision: '1.0',
          value: { type: 'CONSTANT', value: new Quantity(1e5, pressureUnit) }
        }
      ]
    };
    const result = BoundaryValidator.detectConflicts(set);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Conflicting multiple boundary conditions'))).toBe(true);
  });

  it('generates a deterministic canonical hash independent of BC order', () => {
    const bc1: CanonicalBoundaryCondition = { boundaryConditionId: 'BC-1', type: 'WALL', target: { targetId: 'FACE-1', kind: 'FACE' }, physicsDomain: PhysicsDomain.FLUID, revision: '1' };
    const bc2: CanonicalBoundaryCondition = { boundaryConditionId: 'BC-2', type: 'WALL', target: { targetId: 'FACE-2', kind: 'FACE' }, physicsDomain: PhysicsDomain.FLUID, revision: '1' };
    
    const set1: BoundaryConditionSet = { setId: 'S1', modelId: 'M1', physicsDomain: PhysicsDomain.FLUID, boundaryConditions: [bc1, bc2], revision: '1' };
    const set2: BoundaryConditionSet = { setId: 'S1', modelId: 'M1', physicsDomain: PhysicsDomain.FLUID, boundaryConditions: [bc2, bc1], revision: '1' };

    const hash1 = BoundaryValidator.calculateCanonicalHash(set1);
    const hash2 = BoundaryValidator.calculateCanonicalHash(set2);

    expect(hash1).toBe(hash2);
  });

  it('passes BoundaryConditionGate045', () => {
    const bc: CanonicalBoundaryCondition = {
      boundaryConditionId: 'BC-001',
      type: 'VELOCITY_INLET',
      target: { targetId: 'FACE-1', kind: 'FACE' },
      physicsDomain: PhysicsDomain.FLUID,
      revision: '1.0',
      value: { type: 'CONSTANT', value: new Quantity(10, velocityUnit) }
    };
    const set: BoundaryConditionSet = { setId: 'S1', modelId: 'M1', physicsDomain: PhysicsDomain.FLUID, boundaryConditions: [bc], revision: '1' };
    
    const result = BoundaryConditionGate045.evaluate(set);
    expect(result.status).toBe('PASS');
    expect(result.capabilities.SOLVER_INTEGRATION).toBe('UNPROVEN');
  });

});
