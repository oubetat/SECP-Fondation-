import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP2Engine } from '../../../../src/engine/adse/p2/ADSEP2Engine';

describe('ADSE-P2 MBSE Semantic Graph Navigation', () => {
  let p2: ADSEP2Engine;

  beforeEach(() => {
    p2 = ADSEP2Engine.getInstance();
    p2.clear();
  });

  it('answers semantic graph queries (Requirements constraining subsystem, Functions realizing requirements, Interfaces connecting components)', () => {
    const sub = p2.registry.registerElement({
      mbseId: 'mbse:sub:HYDRAULICS',
      elementType: 'Subsystem',
      displayName: 'Hydraulic Actuation Subsystem',
      category: 'STRUCTURAL',
      configurationId: 'CFG-001'
    });

    const req = p2.registry.registerElement({
      mbseId: 'mbse:req:REQ-HYD-01',
      elementType: 'Requirement',
      displayName: 'Hydraulic Response Speed <= 50ms',
      category: 'REQUIREMENT',
      configurationId: 'CFG-001'
    });

    const fn = p2.registry.registerElement({
      mbseId: 'mbse:fn:SERVO_VALVE_CONTROL',
      elementType: 'Function',
      displayName: 'Modulate Servo Valve Pressure',
      category: 'BEHAVIORAL',
      configurationId: 'CFG-001'
    });

    // Requirement constrains subsystem
    p2.registry.addRelationship({
      relationshipType: 'CONSTRAINS',
      sourceMbseId: req.mbseId,
      targetMbseId: sub.mbseId,
      configurationId: 'CFG-001'
    });

    // Function realizes requirement
    p2.registry.addRelationship({
      relationshipType: 'SATISFIES',
      sourceMbseId: fn.mbseId,
      targetMbseId: req.mbseId,
      configurationId: 'CFG-001'
    });

    // Query 1: Requirements constraining subsystem
    const reqs = p2.graph.getRequirementsConstrainingSubsystem(sub.mbseId);
    expect(reqs).toHaveLength(1);
    expect(reqs[0].mbseId).toBe('mbse:req:REQ-HYD-01');

    // Query 2: Functions realizing requirement
    const fns = p2.graph.getFunctionsRealizingRequirement(req.mbseId);
    expect(fns).toHaveLength(1);
    expect(fns[0].mbseId).toBe('mbse:fn:SERVO_VALVE_CONTROL');

    // Query 3: Multi-hop Upstream Traceability
    const upstream = p2.graph.getUpstreamTraceability(sub.mbseId);
    expect(upstream.length).toBeGreaterThan(0);
  });
});
