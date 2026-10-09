import { describe, it, expect } from 'vitest';
import { ADSEEngine } from '../../../../src/engine/adse/p0/ADSEEngine';

describe('ADSE-P0 Plugin Lifecycle Suite (M0 -> M10)', () => {
  it('tracks capability maturity in the Capability Register across M0 -> M10 levels', () => {
    const adse = ADSEEngine.getInstance();
    const caps = adse.getAllCapabilities();
    expect(caps.length).toBeGreaterThan(0);

    const aeroCap = adse.getCapability('ADSE-AERO-FLOW-001');
    expect(aeroCap).toBeDefined();
    expect(aeroCap?.maturity).toBe('M10');
    expect(aeroCap?.coreBound).toBe(true);
    expect(aeroCap?.canonicalBound).toBe(true);
    expect(aeroCap?.published).toBe(true);
  });
});
