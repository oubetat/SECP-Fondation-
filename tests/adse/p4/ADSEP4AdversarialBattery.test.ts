/**
 * SECP — ADSE-P4 Digital Thread Adversarial Testing Battery
 * Verifies that all illegal, forged, unverified, or contaminated states fail deterministically.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP4DigitalThreadEngine } from '../../../src/engine/adse/p4/ADSEP4DigitalThreadEngine';

describe('ADSE-P4 Adversarial Testing Battery', () => {
  let p4: ADSEP4DigitalThreadEngine;

  beforeEach(() => {
    p4 = ADSEP4DigitalThreadEngine.getInstance();
    p4.clear();
  });

  it('ADV-1: should reject duplicate node identity registration', () => {
    p4.registry.registerNode({
      nodeId: 'node:REQ-DUPLICATE',
      nodeType: 'Requirement',
      canonicalId: 'REQ-DUP-01',
      authoritySource: 'P1_REQUIREMENT_AUTHORITY',
      displayName: 'Original Requirement',
      configurationId: 'CONF-BASE'
    });

    expect(() => {
      p4.registry.registerNode({
        nodeId: 'node:REQ-DUPLICATE',
        nodeType: 'Requirement',
        canonicalId: 'REQ-DUP-01',
        authoritySource: 'P1_REQUIREMENT_AUTHORITY',
        displayName: 'Duplicate Attempt',
        configurationId: 'CONF-BASE'
      });
    }).toThrowError(/already exists/);
  });

  it('ADV-2: should detect and flag cross-configuration contamination', () => {
    const nodeA = p4.registry.registerNode({
      nodeId: 'node:req:CONF_ALPHA_ONLY',
      nodeType: 'Requirement',
      canonicalId: 'REQ-ALPHA',
      authoritySource: 'P1_REQUIREMENT_AUTHORITY',
      displayName: 'Secret Alpha Config Requirement',
      configurationId: 'CONF-ALPHA'
    });

    const nodeB = p4.registry.registerNode({
      nodeId: 'node:arch:CONF_BETA_ONLY',
      nodeType: 'ArchitectureElement',
      canonicalId: 'ARCH-BETA',
      authoritySource: 'P3_ARCHITECTURE_AUTHORITY',
      displayName: 'Private Beta Subsystem',
      configurationId: 'CONF-BETA'
    });

    // Coupling check must fail between incompatible configs
    const coupling = p4.configurations.validateConfigurationCoupling(nodeA.nodeId, nodeB.nodeId);
    expect(coupling.isValid).toBe(false);
    expect(coupling.reason).toContain('CROSS_CONFIGURATION_CONTAMINATION');
  });

  it('ADV-3: should detect and flag cross-revision contamination', () => {
    const nodeA = p4.registry.registerNode({
      nodeId: 'node:req:REV_AUTHORIZED',
      nodeType: 'Requirement',
      canonicalId: 'REQ-01',
      authoritySource: 'P1_REQUIREMENT_AUTHORITY',
      displayName: 'Baseline Req',
      configurationId: 'CONF-BASE',
      revisionId: 'REV-01'
    });

    const nodeB = p4.registry.registerNode({
      nodeId: 'node:arch:REV_UNAUTHORIZED',
      nodeType: 'ArchitectureElement',
      canonicalId: 'ARCH-01',
      authoritySource: 'P3_ARCHITECTURE_AUTHORITY',
      displayName: 'Forged Arch',
      configurationId: 'CONF-BASE',
      revisionId: 'REV-UNAUTHORIZED-MUTATION'
    });

    const coupling = p4.threadRevisions.validateRevisionCoupling(nodeA.nodeId, nodeB.nodeId);
    expect(coupling.isValid).toBe(false);
    expect(coupling.reason).toContain('CROSS_REVISION_CONTAMINATION');
  });

  it('ADV-4: should reject AI attempts to publish thread or authorize links without human authority', () => {
    expect(() => {
      p4.evaluateAIProposal({
        actor: 'AI_AGENT_AUTONOMOUS',
        action: 'PUBLISH_THREAD',
        sourceNodeId: 'node:1',
        targetNodeId: 'node:2',
        configurationId: 'CONF-BASE'
      });
    }).toThrowError(/AI_GOVERNANCE_VIOLATION/);

    expect(() => {
      p4.evaluateAIProposal({
        actor: 'COPILOT_ASSISTANT',
        action: 'CREATE_CANONICAL_LINK',
        sourceNodeId: 'node:1',
        targetNodeId: 'node:2',
        configurationId: 'CONF-BASE'
      });
    }).toThrowError(/AI_GOVERNANCE_VIOLATION/);

    // Human actor succeeds
    const approved = p4.evaluateAIProposal({
      actor: 'CHIEF_SYSTEMS_ENGINEER',
      action: 'PUBLISH_THREAD',
      sourceNodeId: 'node:1',
      targetNodeId: 'node:2',
      configurationId: 'CONF-BASE'
    });
    expect(approved.approved).toBe(true);
  });

  it('ADV-5: should detect orphan nodes and unsupported evidence in forensic audit', () => {
    // 1. Orphan component node
    p4.registry.registerNode({
      nodeId: 'node:arch:ORPHAN_RADAR',
      nodeType: 'ArchitectureElement',
      canonicalId: 'ARCH-RADAR-ORPHAN',
      authoritySource: 'P3_ARCHITECTURE_AUTHORITY',
      displayName: 'Unanchored Radar Sensor',
      configurationId: 'CONF-BASE'
    });

    // 2. Unsupported evidence node (no incoming verification)
    p4.registry.registerNode({
      nodeId: 'node:evidence:FLOATING_PROOF',
      nodeType: 'Evidence',
      canonicalId: 'EVID-UNSUPPORTED',
      authoritySource: 'SECP_EVIDENCE_AUTHORITY',
      displayName: 'Floating Unverified Test Report',
      configurationId: 'CONF-BASE'
    });

    const audit = p4.consistency.auditThread('CONF-BASE');
    expect(audit.isConsistent).toBe(false);
    expect(audit.criticalCount).toBeGreaterThan(0);
    expect(audit.findings.some(f => f.category === 'UNSUPPORTED_EVIDENCE')).toBe(true);
  });
});
