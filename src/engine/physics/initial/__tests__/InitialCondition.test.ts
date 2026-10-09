/**
 * SECP Industrial OS v2 — Initial Condition Tests
 * PATCH-046: Initial Condition Framework
 */

import { describe, it, expect } from 'vitest';
import { 
  CanonicalInitialCondition, 
  InitialState, 
  CoordinateSystemReference,
  SimulationConditionSet
} from '../InitialTypes';
import { InitialValidator } from '../InitialValidator';
import { InitialConditionGate046 } from '../InitialConditionGate046';
import { Quantity, UnitRegistry, Dimension } from '../../units/index';
import { PhysicsDomain } from '../../PhysicsTypes';
import { BoundaryConditionSet } from '../../boundary/BoundaryTypes';

describe('PATCH-046: Initial Condition Framework', () => {

  const velocityUnit = { id: 'm/s', symbol: 'm/s', name: 'Meters per second', dimension: Dimension.VELOCITY, scale: 1, offset: 0, system: 'SI' as const, aliases: [] };
  const densityUnit = { id: 'kg/m3', symbol: 'kg/m³', name: 'Density', dimension: Dimension.DENSITY, scale: 1, offset: 0, system: 'SI' as const, aliases: [] };
  const pressureUnit = UnitRegistry.get('Pa');
  const tempUnit = UnitRegistry.get('K');
  const lengthUnit = UnitRegistry.get('m');

  const globalCoord: CoordinateSystemReference = {
    id: 'CS_GLOBAL',
    type: 'GLOBAL_CARTESIAN'
  };

  it('validates a valid scalar INITIAL_TEMPERATURE (Thermal)', () => {
    const ic: CanonicalInitialCondition = {
      initialConditionId: 'IC-TEMP-1',
      type: 'INITIAL_TEMPERATURE',
      target: { targetId: 'DOMAIN-1', kind: 'DOMAIN' },
      physicsDomain: PhysicsDomain.THERMAL,
      revision: '1.0',
      value: {
        rank: 'SCALAR',
        value: new Quantity(293.15, tempUnit)
      }
    };
    const res = InitialValidator.validateInitialCondition(ic);
    expect(res.valid).toBe(true);
  });

  it('validates a valid vector INITIAL_VELOCITY (CFD/Fluid)', () => {
    const ic: CanonicalInitialCondition = {
      initialConditionId: 'IC-VEL-1',
      type: 'INITIAL_VELOCITY',
      target: { targetId: 'DOMAIN-1', kind: 'DOMAIN' },
      physicsDomain: PhysicsDomain.FLUID,
      revision: '1.0',
      value: {
        rank: 'VECTOR',
        components: [
          new Quantity(1.0, velocityUnit),
          new Quantity(0.0, velocityUnit),
          new Quantity(0.0, velocityUnit)
        ],
        componentNames: ['u', 'v', 'w'],
        coordinateSystem: globalCoord
      }
    };
    const res = InitialValidator.validateInitialCondition(ic);
    expect(res.valid).toBe(true);
  });

  it('validates a valid tensor INITIAL_STRESS (Structural)', () => {
    const ic: CanonicalInitialCondition = {
      initialConditionId: 'IC-STRESS-1',
      type: 'INITIAL_STRESS',
      target: { targetId: 'VOL-1', kind: 'VOLUME' },
      physicsDomain: PhysicsDomain.STRUCTURAL,
      revision: '1.0',
      value: {
        rank: 'TENSOR',
        tensorType: 'SYMMETRIC_3X3',
        components: {
          xx: new Quantity(1e6, pressureUnit),
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
    expect(res.valid).toBe(true);
  });

  it('rejects dimensional mismatch (e.g. Pressure unit for Velocity)', () => {
    const ic: CanonicalInitialCondition = {
      initialConditionId: 'IC-MISMATCH-1',
      type: 'INITIAL_VELOCITY',
      target: { targetId: 'DOMAIN-1', kind: 'DOMAIN' },
      physicsDomain: PhysicsDomain.FLUID,
      revision: '1.0',
      value: {
        rank: 'VECTOR',
        components: [
          new Quantity(100, pressureUnit), // WRONG
          new Quantity(0, pressureUnit),
          new Quantity(0, pressureUnit)
        ],
        coordinateSystem: globalCoord
      }
    };
    const res = InitialValidator.validateInitialCondition(ic);
    expect(res.valid).toBe(false);
    expect(res.status).toBe('DIMENSION_MISMATCH');
    expect(res.errors.some(e => e.includes('Dimensional mismatch'))).toBe(true);
  });

  it('detects conflicting initial conditions on the same target and type', () => {
    const state: InitialState = {
      stateId: 'STATE-1',
      modelId: 'MODEL-1',
      physicsDomain: PhysicsDomain.FLUID,
      revision: '1.0',
      conditions: [
        {
          initialConditionId: 'IC-P1',
          type: 'INITIAL_PRESSURE',
          target: { targetId: 'DOMAIN-1', kind: 'DOMAIN' },
          physicsDomain: PhysicsDomain.FLUID,
          revision: '1.0',
          value: { rank: 'SCALAR', value: new Quantity(101325, pressureUnit) }
        },
        {
          initialConditionId: 'IC-P2',
          type: 'INITIAL_PRESSURE', // Conflict: duplicate pressure on DOMAIN-1
          target: { targetId: 'DOMAIN-1', kind: 'DOMAIN' },
          physicsDomain: PhysicsDomain.FLUID,
          revision: '1.0',
          value: { rank: 'SCALAR', value: new Quantity(200000, pressureUnit) }
        }
      ]
    };
    const res = InitialValidator.validateInitialState(state);
    expect(res.valid).toBe(false);
    expect(res.status).toBe('CONFLICTING');
    expect(res.errors.some(e => e.includes('Conflicting multiple initial conditions'))).toBe(true);
  });

  it('evaluates completeness against required condition types', () => {
    const state: InitialState = {
      stateId: 'STATE-CFD',
      modelId: 'MODEL-1',
      physicsDomain: PhysicsDomain.FLUID,
      revision: '1.0',
      conditions: [
        {
          initialConditionId: 'IC-P1',
          type: 'INITIAL_PRESSURE',
          target: { targetId: 'DOMAIN-1', kind: 'DOMAIN' },
          physicsDomain: PhysicsDomain.FLUID,
          revision: '1.0',
          value: { rank: 'SCALAR', value: new Quantity(101325, pressureUnit) }
        }
      ]
    };
    // CFD requires both velocity and pressure
    const res = InitialValidator.validateInitialState(state, ['INITIAL_PRESSURE', 'INITIAL_VELOCITY']);
    expect(res.valid).toBe(true);
    expect(res.status).toBe('INCOMPLETE');
    expect(res.warnings.some(w => w.includes('incomplete for required fields: INITIAL_VELOCITY'))).toBe(true);
  });

  it('generates a deterministic canonical hash independent of condition array order', () => {
    const ic1: CanonicalInitialCondition = {
      initialConditionId: 'IC-1',
      type: 'INITIAL_TEMPERATURE',
      target: { targetId: 'D1', kind: 'DOMAIN' },
      physicsDomain: PhysicsDomain.THERMAL,
      revision: '1.0',
      value: { rank: 'SCALAR', value: new Quantity(300, tempUnit) }
    };
    const ic2: CanonicalInitialCondition = {
      initialConditionId: 'IC-2',
      type: 'INITIAL_TEMPERATURE',
      target: { targetId: 'D2', kind: 'DOMAIN' },
      physicsDomain: PhysicsDomain.THERMAL,
      revision: '1.0',
      value: { rank: 'SCALAR', value: new Quantity(350, tempUnit) }
    };

    const stateA: InitialState = {
      stateId: 'ST-1',
      modelId: 'M-1',
      physicsDomain: PhysicsDomain.THERMAL,
      revision: '1.0',
      conditions: [ic1, ic2]
    };

    const stateB: InitialState = {
      stateId: 'ST-1',
      modelId: 'M-1',
      physicsDomain: PhysicsDomain.THERMAL,
      revision: '1.0',
      conditions: [ic2, ic1] // Reordered
    };

    const hashA = InitialValidator.calculateCanonicalHash(stateA);
    const hashB = InitialValidator.calculateCanonicalHash(stateB);
    expect(hashA).toBe(hashB);
  });

  it('preserves clean separation in SimulationConditionSet', () => {
    const state: InitialState = {
      stateId: 'ST-1',
      modelId: 'M-1',
      physicsDomain: PhysicsDomain.FLUID,
      revision: '1.0',
      conditions: [
        {
          initialConditionId: 'IC-1',
          type: 'INITIAL_PRESSURE',
          target: { targetId: 'D1', kind: 'DOMAIN' },
          physicsDomain: PhysicsDomain.FLUID,
          revision: '1.0',
          value: { rank: 'SCALAR', value: new Quantity(101325, pressureUnit) }
        }
      ]
    };

    const bcSet: BoundaryConditionSet = {
      setId: 'BCS-1',
      modelId: 'M-1',
      physicsDomain: PhysicsDomain.FLUID,
      revision: '1.0',
      boundaryConditions: [
        {
          boundaryConditionId: 'BC-1',
          type: 'WALL',
          target: { targetId: 'FACE-WALL', kind: 'FACE' },
          physicsDomain: PhysicsDomain.FLUID,
          revision: '1.0'
        }
      ]
    };

    const simSet: SimulationConditionSet = {
      simulationConditionSetId: 'SIM-SET-1',
      modelId: 'M-1',
      physicsDomain: PhysicsDomain.FLUID,
      initialState: state,
      boundaryConditionSet: bcSet,
      revision: '1.0'
    };

    const hash = InitialValidator.calculateSimulationConditionSetHash(simSet);
    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
    expect(hash.length).toBe(64); // SHA-256

    const gateRes = InitialConditionGate046.evaluate(state, simSet);
    expect(gateRes.status).toBe('PASS');
    expect(gateRes.capabilities.SEPARATION_FROM_BOUNDARY_CONDITIONS).toBe(true);
    expect(gateRes.capabilities.SOLVER_INTEGRATION).toBe('UNPROVEN');
  });

});
