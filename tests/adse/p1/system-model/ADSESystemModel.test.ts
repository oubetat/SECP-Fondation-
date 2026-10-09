import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP1Engine } from '../../../../src/engine/adse/p1/ADSEP1Engine';

describe('ADSE-P1 System Model Suite', () => {
  let p1: ADSEP1Engine;

  beforeEach(() => {
    p1 = ADSEP1Engine.getInstance();
    p1.clear();
  });

  it('builds a hierarchical system model bound to SECP Core', () => {
    const sys = p1.systemModel.createSystem('SYS-UAV-01', 'UAV System', 'Next-gen drone', 'CONF-2026', 'Architect');
    
    p1.systemModel.createSubsystem('SYS-UAV-01', { id: 'SUB-PROP-01', name: 'Propulsion', description: 'Motors and ESCs' });
    p1.systemModel.createFunction('SYS-UAV-01', { id: 'FUNC-THRUST', name: 'Generate Thrust', description: 'Convert power to lift', inputs: ['PWM'], outputs: ['Newtons'] });
    p1.systemModel.createComponentReference('SYS-UAV-01', { id: 'COMP-MOTOR-01', name: 'Brushless Motor', subsystemId: 'SUB-PROP-01', engineeringObjectId: 'MOTOR-CAD-REF-001' });

    const system = p1.systemModel.getSystem('SYS-UAV-01');
    expect(system?.subsystems).toContain('SUB-PROP-01');
    expect(system?.functions).toContain('FUNC-THRUST');
    expect(system?.components).toContain('COMP-MOTOR-01');

    // Check Revision binding
    expect(system?.revisionId).toBeDefined();
    const rev = p1.revisionEngine.getRevision(system!.revisionId);
    expect(rev).toBeDefined();
  });

  it('prevents parallel system models via collision detection', () => {
    p1.systemModel.createSystem('SYS-X', 'X', 'X', 'C', 'A');
    expect(() => p1.systemModel.createSystem('SYS-X', 'X', 'X', 'C', 'A')).toThrow('SYSTEM_EXISTS');
  });
});
