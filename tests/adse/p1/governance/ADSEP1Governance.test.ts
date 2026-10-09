import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP1Engine } from '../../../../src/engine/adse/p1/ADSEP1Engine';

describe('ADSE-P1 AI Governance Suite', () => {
  let p1: ADSEP1Engine;

  beforeEach(() => {
    p1 = ADSEP1Engine.getInstance();
    p1.clear();
  });

  it('allows AI to suggest requirements', () => {
    const proposal = p1.evaluateAIProposal({
      actor: 'Engineering AI Copilot',
      action: 'CREATE_REQUIREMENT',
      proposedData: { id: 'AI-REQ-01', title: 'AI Suggested' }
    });

    expect(proposal.status).toBe('PROPOSED');
    expect(proposal.approved).toBe(false); // Propose mode
  });

  it('blocks AI from baselining requirements (Authority Violation)', () => {
    expect(() => p1.evaluateAIProposal({
      actor: 'AI Assistant',
      action: 'BASELINE_REQUIREMENT',
      proposedData: { id: 'REQ-01' }
    })).toThrow('AI_GOVERNANCE_VIOLATION');
  });

  it('blocks AI from changing system configurations (Authority Violation)', () => {
    expect(() => p1.evaluateAIProposal({
      actor: 'AI Assistant',
      action: 'CHANGE_SYSTEM_CONFIGURATION',
      proposedData: { configId: 'PROD' }
    })).toThrow('AI_GOVERNANCE_VIOLATION');
  });
});
