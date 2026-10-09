import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP1Engine } from '../../../../src/engine/adse/p1/ADSEP1Engine';
import { CoreExecutionAuthority } from '../../../../src/engine/execution/CoreExecutionAuthority';

describe('ADSE-P1 Verification Intent Suite', () => {
  let p1: ADSEP1Engine;

  beforeEach(() => {
    p1 = ADSEP1Engine.getInstance();
    p1.clear();
    CoreExecutionAuthority.initialize(p1.revisionEngine);
  });

  it('binds verification intent to authoritative Core evidence', async () => {
    p1.requirements.createRequirement({ id: 'R1', systemId: 'S1', title: 'T', statement: 'S', rationale: 'R', source: 'S', type: 'PERFORMANCE', priority: 'HIGH', configurationId: 'C', verificationIntentIds: [], constraintIds: [] }, 'A');
    const intent = p1.verification.createIntent({ id: 'INT-01', systemId: 'S1', requirementId: 'R1', method: 'SIMULATION', successCriteria: 'Mach > 1.0' });

    expect(intent.status).toBe('PENDING');

    // Execute representative core path to get evidence
    const envelope = await CoreExecutionAuthority.execute({
      pluginId: 'secp-plugin-aerospace',
      pluginVersion: '1.4.0',
      engineeringObjectId: 'R1',
      executionKind: 'mach-flow',
      parameters: { altitudeM: 11000, velocityMs: 400 }
    });

    p1.verification.bindEvidence('INT-01', envelope.executionId);

    const updated = p1.verification.getIntent('INT-01');
    expect(updated?.status).toBe('VERIFIED');
    expect(updated?.evidenceLeafHash).toBe(envelope.evidenceLeaf.leafHash);
  });
});
