/**
 * SECP Industrial OS v2 — Initial Condition Adversarial Tests
 * PATCH-046: Initial Condition Framework
 */

import { describe, it, expect } from 'vitest';
import { 
  CanonicalInitialCondition, 
  InitialState, 
  CoordinateSystemReference 
} from '../InitialTypes';
import { InitialValidator } from '../InitialValidator';
import { Quantity, UnitRegistry, Dimension } from '../../units/index';
import { PhysicsDomain } from '../../PhysicsTypes';

describe('PATCH-046: Initial Condition Adversarial', () => {

  const velocityUnit = { id: 'm/s', symbol: 'm/s', name: 'Meters per second', dimension: Dimension.VELOCITY, scale: 1, offset: 0, system: 'SI' as const, aliases: [] };
  const densityUnit = { id: 'kg/m3', symbol: 'kg/m³', name: 'Density', dimension: Dimension.DENSITY, scale: 1, offset: 0, system: 'SI' as const, aliases: [] };
  const pressureUnit = UnitRegistry.get('Pa');
  const tempUnit = UnitRegistry.get('K');

  const globalCoord: CoordinateSystemReference = {
    id: 'CS_GLOBAL',
    type: 'GLOBAL_CARTESIAN'
  };

  it('rejects cross-domain misuse (e.g. INITIAL_STRESS inside FLUID domain)', () => {
    const ic: CanonicalInitialCondition = {
      initialConditionId: 'IC-ADV-CROSS',
      type: 'INITIAL_STRESS', // Structural only
      target: { targetId: 'DOMAIN-1', kind: 'DOMAIN' },
      physicsDomain: PhysicsDomain.FLUID, // Wrong domain
      revision: '1.0',
      value: {
        rank: 'TENSOR',
        tensorType: 'SYMMETRIC_3X3',
        components: {
          xx: new Quantity(1e5, pressureUnit),
          yy: new Quantity(0, pressureUnit),
          zz: new Quantity(0, pressureUnit),
          xy: new Quantity(0, pressureUnit),
          yz: new Quantity(0, pressureUnit),
          zx: new Quantity(0, pressureUnit)
        },
        coordinateSystem: globalCoord
      }
    };
    const res = InitialValidator.validateInitialCondition(ic);
    expect(res.valid).toBe(false);
    expect(res.status).toBe('CROSS_DOMAIN_MISUSE');
    expect(res.errors.some(e => e.includes('Cross-domain misuse'))).toBe(true);
  });

  it('rejects physically invalid negative initial density', () => {
    const ic: CanonicalInitialCondition = {
      initialConditionId: 'IC-ADV-DENS',
      type: 'INITIAL_DENSITY',
      target: { targetId: 'DOMAIN-1', kind: 'DOMAIN' },
      physicsDomain: PhysicsDomain.FLUID,
      revision: '1.0',
      value: {
        rank: 'SCALAR',
        value: new Quantity(-500, densityUnit) // NEGATIVE DENSITY
      }
    };
    const res = InitialValidator.validateInitialCondition(ic);
    expect(res.valid).toBe(false);
    expect(res.status).toBe('INVALID');
    expect(res.errors.some(e => e.includes('negative initial density'))).toBe(true);
  });

  it('rejects physically invalid negative absolute temperature in Kelvin', () => {
    const ic: CanonicalInitialCondition = {
      initialConditionId: 'IC-ADV-TEMP',
      type: 'INITIAL_TEMPERATURE',
      target: { targetId: 'DOMAIN-1', kind: 'DOMAIN' },
      physicsDomain: PhysicsDomain.THERMAL,
      revision: '1.0',
      value: {
        rank: 'SCALAR',
        value: new Quantity(-50, tempUnit) // Below 0 K
      }
    };
    const res = InitialValidator.validateInitialCondition(ic);
    expect(res.valid).toBe(false);
    expect(res.status).toBe('INVALID');
    expect(res.errors.some(e => e.includes('negative absolute initial temperature'))).toBe(true);
  });

  it('rejects vector initial condition with wrong component count', () => {
    const ic: CanonicalInitialCondition = {
      initialConditionId: 'IC-ADV-VEC',
      type: 'INITIAL_VELOCITY',
      target: { targetId: 'DOMAIN-1', kind: 'DOMAIN' },
      physicsDomain: PhysicsDomain.FLUID,
      revision: '1.0',
      value: {
        rank: 'VECTOR',
        // 2 components instead of 3
        components: [
          new Quantity(10, velocityUnit),
          new Quantity(0, velocityUnit)
        ] as any,
        coordinateSystem: globalCoord
      }
    };
    const res = InitialValidator.validateInitialCondition(ic);
    expect(res.valid).toBe(false);
    expect(res.status).toBe('INVALID');
    expect(res.errors.some(e => e.includes('must have exactly 3 components'))).toBe(true);
  });

  it('rejects vector initial condition with missing coordinate system', () => {
    const ic: CanonicalInitialCondition = {
      initialConditionId: 'IC-ADV-NOCS',
      type: 'INITIAL_VELOCITY',
      target: { targetId: 'DOMAIN-1', kind: 'DOMAIN' },
      physicsDomain: PhysicsDomain.FLUID,
      revision: '1.0',
      value: {
        rank: 'VECTOR',
        components: [
          new Quantity(10, velocityUnit),
          new Quantity(0, velocityUnit),
          new Quantity(0, velocityUnit)
        ],
        coordinateSystem: { id: '', type: 'GLOBAL_CARTESIAN' } // Empty ID
      }
    };
    const res = InitialValidator.validateInitialCondition(ic);
    expect(res.valid).toBe(false);
    expect(res.status).toBe('INVALID');
    expect(res.errors.some(e => e.includes('requires a valid coordinateSystem'))).toBe(true);
  });

  it('rejects tensor with missing required symmetric components', () => {
    const ic: CanonicalInitialCondition = {
      initialConditionId: 'IC-ADV-TENS',
      type: 'INITIAL_STRESS',
      target: { targetId: 'DOMAIN-1', kind: 'DOMAIN' },
      physicsDomain: PhysicsDomain.STRUCTURAL,
      revision: '1.0',
      value: {
        rank: 'TENSOR',
        tensorType: 'SYMMETRIC_3X3',
        components: {
          xx: new Quantity(1e5, pressureUnit),
          yy: new Quantity(0, pressureUnit)
          // missing zz, xy, yz, zx
        } as any,
        coordinateSystem: globalCoord
      }
    };
    const res = InitialValidator.validateInitialCondition(ic);
    expect(res.valid).toBe(false);
    expect(res.status).toBe('INVALID');
    expect(res.errors.some(e => e.includes('Missing required symmetric tensor component'))).toBe(true);
  });

  it('rejects unsorted table input points', () => {
    const ic: CanonicalInitialCondition = {
      initialConditionId: 'IC-ADV-TBL',
      type: 'INITIAL_TEMPERATURE',
      target: { targetId: 'DOMAIN-1', kind: 'DOMAIN' },
      physicsDomain: PhysicsDomain.THERMAL,
      revision: '1.0',
      value: {
        rank: 'SCALAR',
        type: 'TABLE',
        independentVariable: 'RADIUS',
        interpolation: 'LINEAR',
        points: [
          { input: new Quantity(0.5, UnitRegistry.get('m')), output: new Quantity(300, tempUnit) },
          { input: new Quantity(0.2, UnitRegistry.get('m')), output: new Quantity(350, tempUnit) } // Unsorted
        ]
      }
    };
    const res = InitialValidator.validateInitialCondition(ic);
    expect(res.valid).toBe(false);
    expect(res.status).toBe('INVALID');
    expect(res.errors.some(e => e.includes('strictly monotonically increasing'))).toBe(true);
  });

  it('rejects empty function expression', () => {
    const ic: CanonicalInitialCondition = {
      initialConditionId: 'IC-ADV-FN',
      type: 'INITIAL_TEMPERATURE',
      target: { targetId: 'DOMAIN-1', kind: 'DOMAIN' },
      physicsDomain: PhysicsDomain.THERMAL,
      revision: '1.0',
      value: {
        rank: 'SCALAR',
        type: 'FUNCTION',
        expression: '   ', // Empty
        parameters: {}
      }
    };
    const res = InitialValidator.validateInitialCondition(ic);
    expect(res.valid).toBe(false);
    expect(res.status).toBe('INVALID');
    expect(res.errors.some(e => e.includes('Function initial condition has empty expression'))).toBe(true);
  });

  it('rejects missing targetId or targetKind', () => {
    const ic: CanonicalInitialCondition = {
      initialConditionId: 'IC-ADV-NOTARGET',
      type: 'INITIAL_TEMPERATURE',
      target: { targetId: '', kind: '' as any },
      physicsDomain: PhysicsDomain.THERMAL,
      revision: '1.0',
      value: {
        rank: 'SCALAR',
        value: new Quantity(300, tempUnit)
      }
    };
    const res = InitialValidator.validateInitialCondition(ic);
    expect(res.valid).toBe(false);
    expect(res.status).toBe('MISSING_DATA');
    expect(res.errors.some(e => e.includes('Missing targetId'))).toBe(true);
  });

});
