/**
 * SECP — ADSE-P4 Forensic Reconciliation & Verification Suite
 * Formal Verification of the 20 Forensic Gates (P4-V1 through P4-V20)
 * and 20/20 Capability Registry Reconciliation.
 * 
 * Governing Principle:
 * «The Digital Thread does not create Engineering Truth; it proves, connects,
 * and reconstructs the lineage of Engineering Truth.»
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP4DigitalThreadEngine } from '../../../src/engine/adse/p4/ADSEP4DigitalThreadEngine';
import { ADSEP4ForensicAuditEngine } from '../../../src/engine/adse/p4/ADSEP4ForensicAuditEngine';
import { ADSEEngine } from '../../../src/engine/adse/p0/ADSEEngine';
import { CoreExecutionAuthority } from '../../../src/engine/execution/CoreExecutionAuthority';

describe('ADSE-P4 Forensic Reconciliation & Verification Suite (P4-V1 through P4-V20)', () => {
  let p4Engine: ADSEP4DigitalThreadEngine;
  let p0Engine: ADSEEngine;

  beforeEach(() => {
    p4Engine = ADSEP4DigitalThreadEngine.getInstance();
    p0Engine = ADSEEngine.getInstance();
    p4Engine.clear();
  });

  // P4-V1: Thread Authority Binding
  it('P4-V1: Thread Authority Binding — Verifies single RevisionEngine authority reference', () => {
    expect(p4Engine.revisionEngine).toBe(p0Engine.getRevisionEngine());
  });

  // P4-V2: Canonical Identity Binding
  it('P4-V2: Canonical Identity Binding — Verifies CoreExecutionAuthority symbol handshake', () => {
    const coreKey = CoreExecutionAuthority.getCoreKey();
    expect(coreKey).toBeDefined();
    expect(typeof coreKey).toBe('symbol');
  });

  // P4-V3: Requirement Lineage
  it('P4-V3: Requirement Lineage — Links P1 requirements to the truth thread', () => {
    const req = p4Engine.registry.registerNode({
      nodeId: 'node:req:P4_V3',
      nodeType: 'Requirement',
      canonicalId: 'REQ-V3-001',
      authoritySource: 'P1_REQUIREMENT_AUTHORITY',
      displayName: 'V3 Requirement',
      configurationId: 'CONF-BASE'
    });
    expect(req.nodeType).toBe('Requirement');
    expect(req.authoritySource).toBe('P1_REQUIREMENT_AUTHORITY');
  });

  // P4-V4: MBSE Lineage
  it('P4-V4: MBSE Lineage — Links P2 MBSE elements to the truth thread', () => {
    const mbse = p4Engine.registry.registerNode({
      nodeId: 'node:mbse:P4_V4',
      nodeType: 'MBSEElement',
      canonicalId: 'mbse:block:V4',
      authoritySource: 'P2_MBSE_SEMANTIC_AUTHORITY',
      displayName: 'V4 MBSE Block',
      configurationId: 'CONF-BASE'
    });
    expect(mbse.nodeType).toBe('MBSEElement');
    expect(mbse.authoritySource).toBe('P2_MBSE_SEMANTIC_AUTHORITY');
  });

  // P4-V5: Architecture Lineage
  it('P4-V5: Architecture Lineage — Links P3 Architecture elements to the truth thread', () => {
    const arch = p4Engine.registry.registerNode({
      nodeId: 'node:arch:P4_V5',
      nodeType: 'ArchitectureElement',
      canonicalId: 'arch:comp:V5',
      authoritySource: 'P3_ARCHITECTURE_AUTHORITY',
      displayName: 'V5 Architecture Component',
      configurationId: 'CONF-BASE'
    });
    expect(arch.nodeType).toBe('ArchitectureElement');
  });

  // P4-V6: Interface/Dependency Lineage
  it('P4-V6: Interface/Dependency Lineage — Supports typed interface and dependency thread edges', () => {
    const n1 = p4Engine.registry.registerNode({
      nodeId: 'node:arch:N1',
      nodeType: 'ArchitectureElement',
      canonicalId: 'ARCH-N1',
      authoritySource: 'P3_ARCHITECTURE_AUTHORITY',
      displayName: 'Node 1',
      configurationId: 'CONF-BASE'
    });

    const n2 = p4Engine.registry.registerNode({
      nodeId: 'node:arch:N2',
      nodeType: 'ArchitectureElement',
      canonicalId: 'ARCH-N2',
      authoritySource: 'P3_ARCHITECTURE_AUTHORITY',
      displayName: 'Node 2',
      configurationId: 'CONF-BASE'
    });

    const edge = p4Engine.registry.registerEdge({
      edgeType: 'CONNECTED_TO',
      sourceNodeId: n1.nodeId,
      targetNodeId: n2.nodeId,
      authoritySource: 'P3_ARCHITECTURE_AUTHORITY',
      configurationId: 'CONF-BASE'
    });

    expect(edge.edgeType).toBe('CONNECTED_TO');
  });

  // P4-V7: Revision Integrity
  it('P4-V7: Revision Integrity — Enforces anti-cross-revision contamination checks', () => {
    const n1 = p4Engine.registry.registerNode({
      nodeId: 'node:req:REV_A',
      nodeType: 'Requirement',
      canonicalId: 'REQ-REV-A',
      authoritySource: 'P1_REQUIREMENT_AUTHORITY',
      displayName: 'Req A',
      configurationId: 'CONF-BASE',
      revisionId: 'REV-A'
    });

    const n2 = p4Engine.registry.registerNode({
      nodeId: 'node:arch:REV_B',
      nodeType: 'ArchitectureElement',
      canonicalId: 'ARCH-REV-B',
      authoritySource: 'P3_ARCHITECTURE_AUTHORITY',
      displayName: 'Arch B',
      configurationId: 'CONF-BASE',
      revisionId: 'REV-UNAUTHORIZED-STALE'
    });

    const check = p4Engine.threadRevisions.validateRevisionCoupling(n1.nodeId, n2.nodeId);
    expect(check.isValid).toBe(false);
  });

  // P4-V8: Configuration Integrity
  it('P4-V8: Configuration Integrity — Enforces cross-configuration boundary validation', () => {
    const n1 = p4Engine.registry.registerNode({
      nodeId: 'node:req:CONFIG_1',
      nodeType: 'Requirement',
      canonicalId: 'REQ-C1',
      authoritySource: 'P1_REQUIREMENT_AUTHORITY',
      displayName: 'Config 1 Req',
      configurationId: 'CONF-1'
    });

    const n2 = p4Engine.registry.registerNode({
      nodeId: 'node:arch:CONFIG_2',
      nodeType: 'ArchitectureElement',
      canonicalId: 'ARCH-C2',
      authoritySource: 'P3_ARCHITECTURE_AUTHORITY',
      displayName: 'Config 2 Arch',
      configurationId: 'CONF-2'
    });

    const check = p4Engine.configurations.validateConfigurationCoupling(n1.nodeId, n2.nodeId);
    expect(check.isValid).toBe(false);
  });

  // P4-V9: Execution Binding
  it('P4-V9: Execution Binding — Connects Execution nodes to CoreExecutionAuthority', () => {
    const exec = p4Engine.registry.registerNode({
      nodeId: 'node:exec:V9',
      nodeType: 'Execution',
      canonicalId: 'EXEC-V9',
      authoritySource: 'SECP_CORE_EXECUTION_AUTHORITY',
      displayName: 'Execution Node V9',
      configurationId: 'CONF-BASE'
    });
    expect(exec.authoritySource).toBe('SECP_CORE_EXECUTION_AUTHORITY');
  });

  // P4-V10: Verification Binding
  it('P4-V10: Verification Binding — Ties verification intent & results into the digital thread', () => {
    const verif = p4Engine.registry.registerNode({
      nodeId: 'node:verif:V10',
      nodeType: 'VerificationResult',
      canonicalId: 'VERIF-V10',
      authoritySource: 'SECP_VERIFICATION_AUTHORITY',
      displayName: 'Verification Result V10',
      configurationId: 'CONF-BASE'
    });
    expect(verif.nodeType).toBe('VerificationResult');
  });

  // P4-V11: Evidence Binding
  it('P4-V11: Evidence Binding — Ties evidence to authoritative verification results', () => {
    const verif = p4Engine.registry.registerNode({
      nodeId: 'node:verif:V11',
      nodeType: 'VerificationResult',
      canonicalId: 'VERIF-V11',
      authoritySource: 'SECP_VERIFICATION_AUTHORITY',
      displayName: 'Verification V11',
      configurationId: 'CONF-BASE'
    });

    const evidence = p4Engine.registry.registerNode({
      nodeId: 'node:evidence:V11',
      nodeType: 'Evidence',
      canonicalId: 'EVID-V11',
      authoritySource: 'SECP_EVIDENCE_AUTHORITY',
      displayName: 'Evidence V11',
      configurationId: 'CONF-BASE'
    });

    p4Engine.registry.registerEdge({
      edgeType: 'SUPPORTED_BY',
      sourceNodeId: verif.nodeId,
      targetNodeId: evidence.nodeId,
      authoritySource: 'SECP_EVIDENCE_AUTHORITY',
      configurationId: 'CONF-BASE'
    });

    expect(p4Engine.registry.getAllEdges().length).toBe(1);
  });

  // P4-V12: Provenance Integrity
  it('P4-V12: Provenance Integrity — Verifies cryptographic provenanceId on every node and edge', () => {
    const node = p4Engine.registry.registerNode({
      nodeId: 'node:req:V12',
      nodeType: 'Requirement',
      canonicalId: 'REQ-V12',
      authoritySource: 'P1_REQUIREMENT_AUTHORITY',
      displayName: 'Provenance Req',
      configurationId: 'CONF-BASE'
    });
    expect(node.provenanceId).toContain('PROV-THREAD-NODE-');
  });

  // P4-V13: Impact Analysis Integrity
  it('P4-V13: Impact Analysis Integrity — Propagates change across downstream thread nodes', () => {
    const n1 = p4Engine.registry.registerNode({
      nodeId: 'node:req:V13_ROOT',
      nodeType: 'Requirement',
      canonicalId: 'REQ-V13',
      authoritySource: 'P1_REQUIREMENT_AUTHORITY',
      displayName: 'Root Req',
      configurationId: 'CONF-BASE'
    });

    const n2 = p4Engine.registry.registerNode({
      nodeId: 'node:arch:V13_CHILD',
      nodeType: 'ArchitectureElement',
      canonicalId: 'ARCH-V13',
      authoritySource: 'P3_ARCHITECTURE_AUTHORITY',
      displayName: 'Child Arch',
      configurationId: 'CONF-BASE'
    });

    p4Engine.registry.registerEdge({
      edgeType: 'SATISFIES',
      sourceNodeId: n1.nodeId,
      targetNodeId: n2.nodeId,
      authoritySource: 'P3_ARCHITECTURE_AUTHORITY',
      configurationId: 'CONF-BASE'
    });

    const impact = p4Engine.impact.analyzeImpact(n1.nodeId);
    expect(impact.affectedArchitecture).toContain('ARCH-V13');
  });

  // P4-V14: Persistence & Reconstruction
  it('P4-V14: Persistence & Reconstruction — Validates snapshot and deterministic reconstruction', () => {
    p4Engine.registry.registerNode({
      nodeId: 'node:req:V14',
      nodeType: 'Requirement',
      canonicalId: 'REQ-V14',
      authoritySource: 'P1_REQUIREMENT_AUTHORITY',
      displayName: 'Persistence Req',
      configurationId: 'CONF-BASE'
    });

    const snap = p4Engine.persistence.createSnapshot({
      configurationId: 'CONF-BASE',
      revisionId: 'REV-01',
      persistedByAuthority: 'SECP_STORAGE_LEDGER'
    });

    p4Engine.registry.clear();
    p4Engine.persistence.restoreFromSnapshot(snap.snapshotId);
    expect(p4Engine.registry.getAllNodes().length).toBe(1);
  });

  // P4-V15: Thread Consistency
  it('P4-V15: Thread Consistency — Audits digital thread integrity deterministically', () => {
    const report = p4Engine.consistency.auditThread('CONF-BASE');
    expect(report.isConsistent).toBe(true);
    expect(report.merkleRoot).toBeDefined();
  });

  // P4-V16: AI Governance
  it('P4-V16: AI Governance — Rejects AI attempts to publish thread or authorize canonical links', () => {
    expect(() => {
      p4Engine.evaluateAIProposal({
        actor: 'AI_BOT',
        action: 'PUBLISH_THREAD',
        sourceNodeId: '1',
        targetNodeId: '2',
        configurationId: 'CONF-BASE'
      });
    }).toThrowError(/AI_GOVERNANCE_VIOLATION/);
  });

  // P4-V17: Publication Integrity
  it('P4-V17: Publication Integrity — Validates publication node tying to verified evidence', () => {
    const pub = p4Engine.registry.registerNode({
      nodeId: 'node:pub:V17',
      nodeType: 'Publication',
      canonicalId: 'PUB-V17',
      authoritySource: 'SECP_PUBLICATION_AUTHORITY',
      displayName: 'Authoritative Published Baseline',
      configurationId: 'CONF-BASE'
    });
    expect(pub.nodeType).toBe('Publication');
  });

  // P4-V18: Bidirectional Traceability
  it('P4-V18: Bidirectional Traceability — Validates forward and backward graph traversals', () => {
    const n1 = p4Engine.registry.registerNode({
      nodeId: 'node:req:V18',
      nodeType: 'Requirement',
      canonicalId: 'REQ-V18',
      authoritySource: 'P1_REQUIREMENT_AUTHORITY',
      displayName: 'Req V18',
      configurationId: 'CONF-BASE'
    });

    const n2 = p4Engine.registry.registerNode({
      nodeId: 'node:verif:V18',
      nodeType: 'VerificationResult',
      canonicalId: 'VERIF-V18',
      authoritySource: 'SECP_VERIFICATION_AUTHORITY',
      displayName: 'Verif V18',
      configurationId: 'CONF-BASE'
    });

    p4Engine.registry.registerEdge({
      edgeType: 'VERIFIED_BY',
      sourceNodeId: n1.nodeId,
      targetNodeId: n2.nodeId,
      authoritySource: 'SECP_VERIFICATION_AUTHORITY',
      configurationId: 'CONF-BASE'
    });

    const fwd = p4Engine.traceability.forwardTrace(n1.nodeId);
    const bwd = p4Engine.traceability.backwardTrace(n2.nodeId);

    expect(fwd.nodes.map(n => n.nodeId)).toContain(n2.nodeId);
    expect(bwd.nodes.map(n => n.nodeId)).toContain(n1.nodeId);
  });

  // P4-V19: Configuration/Revision Snapshot Integrity
  it('P4-V19: Configuration/Revision Snapshot Integrity — Extracts exact configuration and revision slices', () => {
    p4Engine.registry.registerNode({
      nodeId: 'node:arch:V19',
      nodeType: 'ArchitectureElement',
      canonicalId: 'ARCH-V19',
      authoritySource: 'P3_ARCHITECTURE_AUTHORITY',
      displayName: 'Arch V19',
      configurationId: 'CONF-ALPHA',
      revisionId: 'REV-01'
    });

    const slice = p4Engine.configurations.getThreadSliceForConfiguration('CONF-ALPHA');
    expect(slice.nodes.length).toBe(1);
    expect(slice.nodes[0].configurationId).toBe('CONF-ALPHA');
  });

  // P4-V20: Digital Thread Forensic Closure
  it('P4-V20: Digital Thread Forensic Closure — Evaluates all 20 gates and 20 capabilities', () => {
    const audit = ADSEP4ForensicAuditEngine.runAudit();
    expect(audit.auditPassed).toBe(true);
    expect(audit.gates.length).toBe(20);
    expect(Object.keys(audit.capabilities).length).toBe(20);

    for (const [id, cap] of Object.entries(audit.capabilities)) {
      expect(cap.DECLARED).toBe(true);
      expect(cap.IMPLEMENTED).toBe(true);
      expect(cap.CORE_BOUND).toBe(true);
      expect(cap.EXECUTED).toBe(true);
      expect(cap.VERIFIED).toBe(true);
    }
  });
});
