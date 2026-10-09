import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP2Engine } from '../../../../src/engine/adse/p2/ADSEP2Engine';
import { ADSEP2ForensicAuditEngine } from '../../../../src/engine/adse/p2/ADSEP2ForensicAuditEngine';

describe('ADSE-P2 AI Governance & Forensic Audit Suite', () => {
  let p2: ADSEP2Engine;

  beforeEach(() => {
    p2 = ADSEP2Engine.getInstance();
    p2.clear();
  });

  it('prevents AI Copilot from executing restricted actions directly', () => {
    expect(() => {
      p2.evaluateAIProposal({
        actor: 'AI_COPILOT_AGENT',
        action: 'PUBLISH_MBSE_MODEL',
        proposedData: { modelId: 'MBSE-M1' }
      });
    }).toThrow('AI_GOVERNANCE_VIOLATION');
  });

  it('passes the ADSE-P2 Forensic Closure Audit verifying single-core authority', () => {
    const auditRes = ADSEP2ForensicAuditEngine.runAudit();

    expect(auditRes.p0CoreBindingVerified).toBe(true);
    expect(auditRes.zeroSecondCoreVerified).toBe(true);
    expect(auditRes.aiGovernanceBoundaryVerified).toBe(true);
    expect(auditRes.p2CapabilitiesRegistered).toBe(true);
    expect(auditRes.auditPassed).toBe(true);
    expect(auditRes.merkleRoot).toBeTruthy();
  });
});
