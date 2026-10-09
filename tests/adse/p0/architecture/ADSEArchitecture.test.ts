import { describe, it, expect } from 'vitest';
import { ADSEEngine } from '../../../../src/engine/adse/p0/ADSEEngine';

describe('ADSE-P0 Architecture Suite', () => {
  it('establishes ADSE as a Systems Engineering layer on top of SECP Core', () => {
    const adse = ADSEEngine.getInstance();
    expect(adse).toBeDefined();

    const sys = adse.createSystem('SYS-TEST-001', 'Test Systems Engine');
    expect(sys.systemId).toBe('SYS-TEST-001');
    expect(sys.requirements).toBeDefined();
    expect(sys.interfaces).toBeDefined();
  });

  it('prevents duplicate system collisions', () => {
    const adse = ADSEEngine.getInstance();
    expect(() => adse.createSystem('SYS-TEST-001', 'Duplicate')).toThrow('SYSTEM_COLLISION');
  });
});
