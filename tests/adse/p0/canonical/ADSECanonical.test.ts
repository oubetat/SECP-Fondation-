import { describe, it, expect } from 'vitest';
import { ADSEEngine } from '../../../../src/engine/adse/p0/ADSEEngine';

describe('ADSE-P0 Canonical Model Suite', () => {
  it('ensures ADSE binds to SECP Core Canonical Revisions without creating duplicate models', async () => {
    const adse = ADSEEngine.getInstance();
    const res = await adse.executeRepresentativePath({
      systemId: 'SYS-CANON-01',
      requirementId: 'REQ-CANON-01',
      engineeringObjectId: 'ENG-OBJ-CANON-01',
      pluginId: 'secp-plugin-aerospace',
      executionKind: 'mach-flow',
      parameters: { altitudeM: 5000, velocityMs: 200 },
      actor: 'System Architect'
    });

    expect(res.envelope.revisionHash).toBeDefined();
    expect(res.envelope.geometryHash).toBeDefined();
    expect(res.gateResults.CANONICAL_BIND.passed).toBe(true);
  });
});
