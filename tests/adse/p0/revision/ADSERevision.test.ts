import { describe, it, expect } from 'vitest';
import { ADSEEngine } from '../../../../src/engine/adse/p0/ADSEEngine';

describe('ADSE-P0 Revision Suite', () => {
  it('integrates ADSE systems with SECP Core RevisionEngine for versioning & baselines', () => {
    const adse = ADSEEngine.getInstance();
    const revEngine = adse.getRevisionEngine();
    expect(revEngine).toBeDefined();

    const { code, number } = revEngine.generateNextRevisionCode('PART-X');
    expect(code).toBe('A');
    expect(number).toBe(1);
  });
});
