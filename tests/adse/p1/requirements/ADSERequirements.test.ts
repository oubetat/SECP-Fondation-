import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP1Engine } from '../../../../src/engine/adse/p1/ADSEP1Engine';
import { RevisionEngine } from '../../../../src/engine/revision/RevisionEngine';

describe('ADSE-P1 Requirements Suite', () => {
  let p1: ADSEP1Engine;

  beforeEach(() => {
    p1 = ADSEP1Engine.getInstance();
    p1.clear();
  });

  it('authoritatively creates a requirement and binds it to a SECP Core Revision', () => {
    const req = p1.requirements.createRequirement({
      id: 'REQ-001',
      systemId: 'SYS-001',
      title: 'Power Constraint',
      statement: 'System must operate under 500W.',
      rationale: 'Thermal ceiling',
      source: 'Specs',
      type: 'PERFORMANCE',
      priority: 'HIGH',
      configurationId: 'CONF-A',
      verificationIntentIds: [],
      constraintIds: []
    }, 'Engineer Alpha');

    expect(req.version).toBe(1);
    expect(req.status).toBe('DRAFT');
    expect(req.revisionId).toContain('REV-');

    // Verify SECP Core Binding
    const revision = p1.revisionEngine.getRevision(req.revisionId);
    expect(revision).toBeDefined();
    expect(revision?.entityId).toBe('REQ-001');
    expect(revision?.content.title).toBe('Power Constraint');
  });

  it('forces a new revision on requirement update', () => {
    const req = p1.requirements.createRequirement({
      id: 'REQ-UPD-01',
      systemId: 'SYS-001',
      title: 'Initial',
      statement: 'Initial stmt',
      rationale: 'N/A',
      source: 'User',
      type: 'FUNCTIONAL',
      priority: 'LOW',
      configurationId: 'CONF-A',
      verificationIntentIds: [],
      constraintIds: []
    }, 'Engineer');

    const updated = p1.requirements.updateRequirement('REQ-UPD-01', {
      statement: 'Improved stmt'
    }, 'Engineer', 'Technical refinement');

    expect(updated.version).toBe(2);
    expect(updated.revisionId).not.toBe(req.revisionId);

    const history = p1.revisionEngine.getRevisionHistory('REQ-UPD-01');
    expect(history.length).toBe(2);
    expect(history[1].parentRevisionId).toBe(req.revisionId);
  });

  it('enforces immutability for baselined requirements', () => {
    p1.requirements.createRequirement({
      id: 'REQ-LOCK-01',
      systemId: 'SYS-001',
      title: 'Fixed',
      statement: 'Immutable stmt',
      rationale: 'Locked',
      source: 'Contract',
      type: 'SAFETY',
      priority: 'CRITICAL',
      configurationId: 'CONF-A',
      verificationIntentIds: [],
      constraintIds: []
    }, 'Admin');

    p1.requirements.setStatus('REQ-LOCK-01', 'BASELINED', 'Admin');

    expect(() => p1.requirements.updateRequirement('REQ-LOCK-01', {
      statement: 'illegal change'
    }, 'Attacker', 'Bypass')).toThrow('IMMUTABLE_REQUIREMENT');
  });
});
