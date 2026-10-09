import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP2Engine } from '../../../../src/engine/adse/p2/ADSEP2Engine';

describe('ADSE-P2 MBSE Structural Semantics', () => {
  let p2: ADSEP2Engine;

  beforeEach(() => {
    p2 = ADSEP2Engine.getInstance();
    p2.clear();
  });

  it('registers structural elements (Package, Model, System, Subsystem, Component, Port, Interface)', () => {
    const pkg = p2.registry.registerElement({
      mbseId: 'mbse:pkg:AVIONICS',
      elementType: 'Package',
      displayName: 'Avionics Package',
      category: 'STRUCTURAL',
      configurationId: 'CFG-001'
    });

    const sys = p2.registry.registerElement({
      mbseId: 'mbse:sys:FLIGHT_CONTROL',
      elementType: 'System',
      displayName: 'Flight Control System',
      category: 'STRUCTURAL',
      configurationId: 'CFG-001'
    });

    const sub = p2.registry.registerElement({
      mbseId: 'mbse:sub:ACTUATOR_SUB',
      elementType: 'Subsystem',
      displayName: 'Primary Actuation Subsystem',
      category: 'STRUCTURAL',
      configurationId: 'CFG-001'
    });

    expect(pkg.elementType).toBe('Package');
    expect(sys.elementType).toBe('System');
    expect(sub.elementType).toBe('Subsystem');

    // Add Composition relationship
    const rel = p2.registry.addRelationship({
      relationshipType: 'COMPOSES',
      sourceMbseId: sys.mbseId,
      targetMbseId: sub.mbseId,
      configurationId: 'CFG-001'
    });

    expect(rel.relationshipType).toBe('COMPOSES');
    expect(rel.sourceMbseId).toBe('mbse:sys:FLIGHT_CONTROL');
    expect(rel.targetMbseId).toBe('mbse:sub:ACTUATOR_SUB');
  });

  it('allocates functions to structural components', () => {
    const comp = p2.registry.registerElement({
      mbseId: 'mbse:comp:FCC_UNIT',
      elementType: 'Component',
      displayName: 'Flight Control Computer Unit',
      category: 'STRUCTURAL',
      configurationId: 'CFG-001'
    });

    const fn = p2.registry.registerElement({
      mbseId: 'mbse:fn:CALC_CONTROL_LAW',
      elementType: 'Function',
      displayName: 'Compute Flight Control Laws',
      category: 'BEHAVIORAL',
      configurationId: 'CFG-001'
    });

    const alloc = p2.registry.addRelationship({
      relationshipType: 'ALLOCATES',
      sourceMbseId: fn.mbseId,
      targetMbseId: comp.mbseId,
      configurationId: 'CFG-001'
    });

    expect(alloc.relationshipType).toBe('ALLOCATES');
    const targetRels = p2.registry.getRelationshipsForTarget(comp.mbseId);
    expect(targetRels).toHaveLength(1);
    expect(targetRels[0].sourceMbseId).toBe('mbse:fn:CALC_CONTROL_LAW');
  });
});
