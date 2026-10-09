import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP2Engine } from '../../../../src/engine/adse/p2/ADSEP2Engine';

describe('ADSE-P2 MBSE Parametric Semantics', () => {
  let p2: ADSEP2Engine;

  beforeEach(() => {
    p2 = ADSEP2Engine.getInstance();
    p2.clear();
  });

  it('registers ConstraintBlocks, ValueProperties, Parameter Bindings and evaluates impact propagation', () => {
    const sys = p2.registry.registerElement({
      mbseId: 'mbse:sys:LAUNCH_VEHICLE',
      elementType: 'System',
      displayName: 'Heavy Lift Vehicle',
      category: 'STRUCTURAL',
      configurationId: 'CFG-001'
    });

    const massProp = p2.parametric.registerValueProperty({
      mbseId: 'mbse:val:VEHICLE_MASS',
      name: 'vehicleMass',
      value: 500000, // kg
      unit: 'kg',
      ownerMbseId: sys.mbseId,
      configurationId: 'CFG-001'
    });

    const thrustProp = p2.parametric.registerValueProperty({
      mbseId: 'mbse:val:TOTAL_THRUST',
      name: 'totalThrust',
      value: 7500000, // N
      unit: 'N',
      ownerMbseId: sys.mbseId,
      configurationId: 'CFG-001'
    });

    const cb = p2.parametric.registerConstraintBlock({
      mbseId: 'mbse:cb:TWR_CONSTRAINT',
      name: 'ThrustToWeightRatioConstraint',
      expression: 'totalThrust >= vehicleMass * 9.81 * 1.2', // TWR >= 1.2
      parameters: [
        { name: 'totalThrust', unit: 'N', valuePropertyMbseId: thrustProp.mbseId },
        { name: 'vehicleMass', unit: 'kg', valuePropertyMbseId: massProp.mbseId }
      ],
      configurationId: 'CFG-001'
    });

    p2.parametric.bindParameter({
      constraintBlockMbseId: cb.mbseId,
      parameterName: 'vehicleMass',
      targetValuePropertyMbseId: massProp.mbseId,
      configurationId: 'CFG-001'
    });

    // Test Impact Analysis when Mass increases significantly
    const impact = p2.parametric.analyzeParameterImpact(massProp.mbseId, 800000); // Mass grows to 800,000 kg
    expect(impact.parameterMbseId).toBe('mbse:val:VEHICLE_MASS');
    expect(impact.oldValue).toBe(500000);
    expect(impact.newValue).toBe(800000);
    expect(impact.affectedNodes.length).toBeGreaterThan(0);
    expect(impact.constraintViolations.length).toBeGreaterThan(0);
    expect(impact.constraintViolations[0]).toContain('CONSTRAINT_VIOLATION');
  });
});
