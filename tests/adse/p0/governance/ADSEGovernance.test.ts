import { describe, it, expect } from 'vitest';
import { ADSEEngine } from '../../../../src/engine/adse/p0/ADSEEngine';

describe('ADSE-P0 AI Governance Suite', () => {
  it('allows Engineering AI to perform advisory actions like PROPOSE and ANALYZE', () => {
    const adse = ADSEEngine.getInstance();
    const record = adse.evaluateAIProposal({
      actor: 'Engineering AI Advisor',
      requestedAction: 'PROPOSE',
      capabilityId: 'ADSE-AERO-FLOW-001',
      systemId: 'SYS-AERO-001',
      proposedChanges: { alt: 12000 }
    });

    expect(record.approved).toBe(true);
    expect(record.role).toBe('ENGINEERING_AI_ADVISOR');
  });

  it('rejects Engineering AI attempts to perform restricted authority actions like APPROVE or PUBLISH', () => {
    const adse = ADSEEngine.getInstance();
    expect(() => adse.evaluateAIProposal({
      actor: 'Engineering AI Advisor',
      requestedAction: 'APPROVE',
      capabilityId: 'ADSE-AERO-FLOW-001',
      systemId: 'SYS-AERO-001',
      proposedChanges: {}
    })).toThrow('AI_GOVERNANCE_VIOLATION');
  });
});
