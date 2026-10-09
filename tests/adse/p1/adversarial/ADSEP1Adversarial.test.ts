import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP1Engine } from '../../../../src/engine/adse/p1/ADSEP1Engine';
import { RevisionEngine } from '../../../../src/engine/revision/RevisionEngine';
import { RevisionLifecycleState } from '../../../../src/engine/revision/types';

describe('ADSE-P1 Adversarial Suite', () => {
  let p1: ADSEP1Engine;

  beforeEach(() => {
    p1 = ADSEP1Engine.getInstance();
    p1.clear();
  });

  it('Revision Bypass: prevents updating requirement version without RevisionEngine entry', () => {
    const req = p1.requirements.createRequirement({ id: 'R1', systemId: 'S1', title: 'T', statement: 'S', rationale: 'R', source: 'S', type: 'FUNCTIONAL', priority: 'LOW', configurationId: 'C', verificationIntentIds: [], constraintIds: [] }, 'A');
    
    // Attempt manual modification of in-memory object (simulating state manipulation)
    (req as any).version = 100;
    
    // Now attempt authoritative update
    const updated = p1.requirements.updateRequirement('R1', { statement: 'New' }, 'A', 'Update');
    
    // Valid engine must re-derive state or detect mismatch.
    // Our engine uses the existing version + 1.
    expect(updated.version).toBe(2); 
  });

  it('Duplicate Identity: rejects creating requirement with existing ID', () => {
    p1.requirements.createRequirement({ id: 'DUP', systemId: 'S1', title: 'T', statement: 'S', rationale: 'R', source: 'S', type: 'FUNCTIONAL', priority: 'LOW', configurationId: 'C', verificationIntentIds: [], constraintIds: [] }, 'A');
    expect(() => p1.requirements.createRequirement({ id: 'DUP', systemId: 'S1', title: 'T', statement: 'S', rationale: 'R', source: 'S', type: 'FUNCTIONAL', priority: 'LOW', configurationId: 'C', verificationIntentIds: [], constraintIds: [] }, 'A')).toThrow('REQUIREMENT_COLLISION');
  });

  it('Fake Evidence: rejects binding unsealed core execution envelopes', async () => {
    p1.requirements.createRequirement({ id: 'R1', systemId: 'S1', title: 'T', statement: 'S', rationale: 'R', source: 'S', type: 'PERFORMANCE', priority: 'HIGH', configurationId: 'C', verificationIntentIds: [], constraintIds: [] }, 'A');
    p1.verification.createIntent({ id: 'INT-1', systemId: 'S1', requirementId: 'R1', method: 'TEST', successCriteria: 'P' });

    // Manually registered fake envelope in Core
    const { GenericExecutionRegistry } = await import('../../../../src/engine/execution/GenericExecutionRegistry');
    const fake = { executionId: 'FAKE-EXEC', state: 'UNSEALED', verificationResult: { overallVerdict: 'PASS' } };
    
    // Core registry might hold it (if bypass used), but P1 engine must check seal
    GenericExecutionRegistry.authenticExecutions = new Map([['FAKE-EXEC', fake]]);

    expect(() => p1.verification.bindEvidence('INT-1', 'FAKE-EXEC')).toThrow('UNSEALED_EVIDENCE_REJECTED');
  });
});
