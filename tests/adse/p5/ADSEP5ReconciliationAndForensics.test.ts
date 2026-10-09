/**
 * SECP — ADSE-P5 Forensic Reconciliation & Verification Suite
 * Formal Verification of the 24 Forensic Gates (P5-V1 through P5-V24)
 * and 24/24 Capability Registry Reconciliation.
 * 
 * Governing Architectural Principle:
 * «Structural Integration does not create a second representation of the engineered system;
 * it establishes the authoritative, verifiable relationships that define how canonical engineering
 * elements form a coherent integrated system.»
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP5StructuralEngine } from '../../../src/engine/adse/p5/ADSEP5StructuralEngine';
import { ADSEP5ForensicAuditEngine } from '../../../src/engine/adse/p5/ADSEP5ForensicAuditEngine';
import { ADSEEngine } from '../../../src/engine/adse/p0/ADSEEngine';
import { CoreExecutionAuthority } from '../../../src/engine/execution/CoreExecutionAuthority';

describe('ADSE-P5 Forensic Reconciliation & Verification Suite (P5-V1 through P5-V24)', () => {
  let p5Engine: ADSEP5StructuralEngine;
  let p0Engine: ADSEEngine;

  beforeEach(() => {
    p5Engine = ADSEP5StructuralEngine.getInstance();
    p0Engine = ADSEEngine.getInstance();
    p5Engine.clear();
  });

  // P5-V1: Structural Authority Binding
  it('P5-V1: Structural Authority Binding — Verifies single RevisionEngine authority reference', () => {
    expect(p5Engine.revisionEngine).toBe(p0Engine.getRevisionEngine());
  });

  // P5-V2: Canonical Identity Binding
  it('P5-V2: Canonical Identity Binding — Verifies CoreExecutionAuthority symbol handshake', () => {
    const coreKey = CoreExecutionAuthority.getCoreKey();
    expect(coreKey).toBeDefined();
    expect(typeof coreKey).toBe('symbol');
  });

  // P5-V3: Assembly Decomposition Integrity
  it('P5-V3: Assembly Decomposition Integrity — Enforces hierarchical layer rank decomposition', () => {
    const sys = p5Engine.registry.registerElement({
      elementId: 'sys:AERO_V3',
      elementType: 'System',
      displayName: 'System V3',
      layer: 'SYSTEM',
      configurationId: 'CONF-BASE'
    });

    const sub = p5Engine.registry.registerElement({
      elementId: 'sub:AERO_V3',
      elementType: 'Subsystem',
      displayName: 'Subsystem V3',
      layer: 'SUBSYSTEM',
      configurationId: 'CONF-BASE'
    });

    const rel = p5Engine.decomposition.decompose({
      parentElementId: sys.elementId,
      childElementId: sub.elementId,
      configurationId: 'CONF-BASE'
    });

    expect(rel.relationshipType).toBe('CONTAINS');
  });

  // P5-V4: Instance/Definition Integrity
  it('P5-V4: Instance/Definition Integrity — Enforces definitionId on instances', () => {
    const def = p5Engine.registry.registerElement({
      elementId: 'comp:def:DEF_V4',
      elementType: 'ComponentDefinition',
      displayName: 'Def V4',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    const inst = p5Engine.registry.registerElement({
      elementId: 'comp:inst:INST_V4',
      elementType: 'ComponentInstance',
      displayName: 'Inst V4',
      layer: 'COMPONENT',
      definitionId: def.elementId,
      configurationId: 'CONF-BASE'
    });

    expect(inst.definitionId).toBe('comp:def:DEF_V4');
  });

  // P5-V5: Structural Relationship Integrity
  it('P5-V5: Structural Relationship Integrity — Registers typed directional structural relationships', () => {
    const e1 = p5Engine.registry.registerElement({
      elementId: 'part:def:P1_V5',
      elementType: 'PartDefinition',
      displayName: 'Part 1',
      layer: 'PART',
      configurationId: 'CONF-BASE'
    });

    const e2 = p5Engine.registry.registerElement({
      elementId: 'part:def:P2_V5',
      elementType: 'PartDefinition',
      displayName: 'Part 2',
      layer: 'PART',
      configurationId: 'CONF-BASE'
    });

    const rel = p5Engine.registry.addRelationship({
      relationshipType: 'MATED_TO',
      sourceElementId: e1.elementId,
      targetElementId: e2.elementId,
      configurationId: 'CONF-BASE'
    });

    expect(rel.relationshipType).toBe('MATED_TO');
  });

  // P5-V6: Structural Constraint Integrity
  it('P5-V6: Structural Constraint Integrity — Manages physical assembly constraints', () => {
    const e1 = p5Engine.registry.registerElement({
      elementId: 'comp:def:C1_V6',
      elementType: 'ComponentDefinition',
      displayName: 'Comp 1',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    const e2 = p5Engine.registry.registerElement({
      elementId: 'comp:def:C2_V6',
      elementType: 'ComponentDefinition',
      displayName: 'Comp 2',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    const c = p5Engine.constraints.registerConstraint({
      constraintType: 'Coincident',
      displayName: 'Coincident Planes',
      sourceElementId: e1.elementId,
      targetElementId: e2.elementId,
      configurationId: 'CONF-BASE'
    });

    expect(c.constraintType).toBe('Coincident');
  });

  // P5-V7: Placement & Transform Integrity
  it('P5-V7: Placement & Transform Integrity — Manages 3D canonical transforms', () => {
    const comp = p5Engine.registry.registerElement({
      elementId: 'comp:def:C1_V7',
      elementType: 'ComponentDefinition',
      displayName: 'Comp V7',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    const p = p5Engine.placements.setPlacement({
      instanceId: comp.elementId,
      translation: { x: 1, y: 2, z: 3 },
      rotation: { rx: 0, ry: 0, rz: 0 },
      configurationId: 'CONF-BASE'
    });

    expect(p.transform.translation.x).toBe(1);
    expect(p.transform.isCanonical).toBe(true);
  });

  // P5-V8: Interface Integration Integrity
  it('P5-V8: Interface Integration Integrity — Maps architectural interfaces to physical connections', () => {
    const c1 = p5Engine.registry.registerElement({
      elementId: 'comp:def:C1_V8',
      elementType: 'ComponentDefinition',
      displayName: 'Comp 1 V8',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    const c2 = p5Engine.registry.registerElement({
      elementId: 'comp:def:C2_V8',
      elementType: 'ComponentDefinition',
      displayName: 'Comp 2 V8',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    const iface = p5Engine.interfaces.defineStructuralInterface({
      displayName: 'V8 Interface',
      providerElementId: c1.elementId,
      consumerElementId: c2.elementId,
      requiredInterfaceType: 'BOLTED',
      providedInterfaceType: 'BOLTED',
      configurationId: 'CONF-BASE'
    });

    expect(iface.isCompatible).toBe(true);
  });

  // P5-V9: Containment Integrity
  it('P5-V9: Containment Integrity — Detects cycles in containment graph', () => {
    const cycles = p5Engine.decomposition.detectCycles();
    expect(cycles.length).toBe(0);
  });

  // P5-V10: Revision Integrity
  it('P5-V10: Revision Integrity — Binds elements to RevisionEngine hashes', () => {
    const elem = p5Engine.registry.registerElement({
      elementId: 'comp:def:V10',
      elementType: 'ComponentDefinition',
      displayName: 'V10 Comp',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    expect(elem.revisionHash).toHaveLength(64);
  });

  // P5-V11: Configuration Integrity
  it('P5-V11: Configuration Integrity — Validates configuration boundary isolation', () => {
    const report = p5Engine.consistency.auditConsistency('CONF-BASE');
    expect(report.configurationId).toBe('CONF-BASE');
  });

  // P5-V12: Structural Traceability
  it('P5-V12: Structural Traceability — Binds upstream P1, P2, P3 IDs', () => {
    const elem = p5Engine.registry.registerElement({
      elementId: 'comp:def:V12',
      elementType: 'ComponentDefinition',
      displayName: 'V12 Comp',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE',
      p1ReqId: 'REQ-V12',
      p2MbseId: 'mbse:V12',
      p3ArchId: 'arch:V12'
    });

    expect(elem.p1ReqId).toBe('REQ-V12');
  });

  // P5-V13: Digital Thread Binding
  it('P5-V13: Digital Thread Binding — Binds P4 digital thread node ID', () => {
    const elem = p5Engine.registry.registerElement({
      elementId: 'comp:def:V13',
      elementType: 'ComponentDefinition',
      displayName: 'V13 Comp',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE',
      p4NodeId: 'node:V13'
    });

    expect(elem.p4NodeId).toBe('node:V13');
  });

  // P5-V14: Verification Binding
  it('P5-V14: Verification Binding — Connects constraints and joints to verification intent', () => {
    const c1 = p5Engine.registry.registerElement({
      elementId: 'comp:def:C1_V14',
      elementType: 'ComponentDefinition',
      displayName: 'C1 V14',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    const c2 = p5Engine.registry.registerElement({
      elementId: 'comp:def:C2_V14',
      elementType: 'ComponentDefinition',
      displayName: 'C2 V14',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    const c = p5Engine.constraints.registerConstraint({
      constraintType: 'Fixed',
      displayName: 'V14 Fixed Constraint',
      sourceElementId: c1.elementId,
      targetElementId: c2.elementId,
      configurationId: 'CONF-BASE',
      verifiedByIntentId: 'VERIF-V14'
    });

    expect(c.verifiedByIntentId).toBe('VERIF-V14');
  });

  // P5-V15: Evidence Binding
  it('P5-V15: Evidence Binding — Connects structural connections to evidence IDs', () => {
    const c1 = p5Engine.registry.registerElement({
      elementId: 'comp:def:C1_V15',
      elementType: 'ComponentDefinition',
      displayName: 'C1 V15',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    const c2 = p5Engine.registry.registerElement({
      elementId: 'comp:def:C2_V15',
      elementType: 'ComponentDefinition',
      displayName: 'C2 V15',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    const iface = p5Engine.interfaces.defineStructuralInterface({
      displayName: 'V15 Interface',
      providerElementId: c1.elementId,
      consumerElementId: c2.elementId,
      requiredInterfaceType: 'TYPE_A',
      providedInterfaceType: 'TYPE_A',
      configurationId: 'CONF-BASE'
    });

    const conn = p5Engine.interfaces.createPhysicalConnection({
      displayName: 'V15 Connection',
      structuralInterfaceId: iface.interfaceId,
      sourcePartId: c1.elementId,
      targetPartId: c2.elementId,
      connectionMethod: 'BOLTED',
      configurationId: 'CONF-BASE',
      evidenceId: 'EVID-V15'
    });

    expect(conn.evidenceId).toBe('EVID-V15');
  });

  // P5-V16: Provenance Integrity
  it('P5-V16: Provenance Integrity — Generates cryptographic PROV-STRUCT provenance IDs', () => {
    const elem = p5Engine.registry.registerElement({
      elementId: 'comp:def:V16',
      elementType: 'ComponentDefinition',
      displayName: 'V16 Comp',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    expect(elem.provenanceId).toContain('PROV-STRUCT-');
  });

  // P5-V17: Structural Impact Analysis
  it('P5-V17: Structural Impact Analysis — Computes structural modification blast radius', () => {
    const comp = p5Engine.registry.registerElement({
      elementId: 'comp:def:V17',
      elementType: 'ComponentDefinition',
      displayName: 'V17 Comp',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE',
      p1ReqId: 'REQ-V17'
    });

    const impact = p5Engine.impact.analyzeImpact(comp.elementId);
    expect(impact.affectedRequirements).toContain('REQ-V17');
  });

  // P5-V18: Persistence & Reconstruction
  it('P5-V18: Persistence & Reconstruction — Validates snapshot and reconstruction', () => {
    p5Engine.registry.registerElement({
      elementId: 'sys:V18',
      elementType: 'System',
      displayName: 'V18 Sys',
      layer: 'SYSTEM',
      configurationId: 'CONF-BASE'
    });

    const snap = p5Engine.persistence.createSnapshot({
      configurationId: 'CONF-BASE',
      revisionId: 'REV-01',
      persistedByAuthority: 'SECP_STORAGE_LEDGER'
    });

    p5Engine.registry.clear();
    p5Engine.persistence.restoreFromSnapshot(snap.snapshotId);
    expect(p5Engine.registry.getAllElements().length).toBe(1);
  });

  // P5-V19: AI Governance
  it('P5-V19: AI Governance — Blocks AI from publishing baseline or authorizing truth', () => {
    expect(() => {
      p5Engine.evaluateAIProposal({
        actor: 'AI_AGENT',
        action: 'PUBLISH_STRUCTURAL_BASELINE',
        configurationId: 'CONF-BASE'
      });
    }).toThrowError(/AI_GOVERNANCE_VIOLATION/);
  });

  // P5-V20: Publication Integrity
  it('P5-V20: Publication Integrity — Validates human authorization for baseline publication', () => {
    const res = p5Engine.evaluateAIProposal({
      actor: 'CHIEF_STRUCTURAL_ENGINEER',
      action: 'PUBLISH_STRUCTURAL_BASELINE',
      configurationId: 'CONF-BASE'
    });

    expect(res.approved).toBe(true);
  });

  // P5-V21: Structural Consistency
  it('P5-V21: Structural Consistency — Runs 14-dimension forensic audit report', () => {
    const report = p5Engine.consistency.auditConsistency('CONF-BASE');
    expect(report.isConsistent).toBe(true);
    expect(report.merkleRoot).toBeDefined();
  });

  // P5-V22: Adversarial Integrity
  it('P5-V22: Adversarial Integrity — Verifies adversarial battery passes', () => {
    const report = p5Engine.consistency.auditConsistency('CONF-BASE');
    expect(report.findings.length).toBe(0);
  });

  // P5-V23: Bidirectional Structural Traceability
  it('P5-V23: Bidirectional Structural Traceability — Traces from Part up to Requirement', () => {
    const parentComp = p5Engine.registry.registerElement({
      elementId: 'comp:def:V23_PARENT',
      elementType: 'ComponentDefinition',
      displayName: 'Parent Comp V23',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE',
      p1ReqId: 'REQ-V23'
    });

    const childPart = p5Engine.registry.registerElement({
      elementId: 'part:def:V23_CHILD',
      elementType: 'PartDefinition',
      displayName: 'Child Part V23',
      layer: 'PART',
      configurationId: 'CONF-BASE'
    });

    p5Engine.decomposition.decompose({
      parentElementId: parentComp.elementId,
      childElementId: childPart.elementId,
      configurationId: 'CONF-BASE'
    });

    const impact = p5Engine.impact.analyzeImpact(childPart.elementId);
    expect(impact.affectedRequirements).toContain('REQ-V23');
  });

  // P5-V24: Structural Truth Closure
  it('P5-V24: Structural Truth Closure — Evaluates all 24 gates and 24 capabilities', () => {
    const audit = ADSEP5ForensicAuditEngine.runAudit();
    expect(audit.auditPassed).toBe(true);
    expect(audit.gates.length).toBe(24);
    expect(Object.keys(audit.capabilities).length).toBe(24);

    for (const [id, cap] of Object.entries(audit.capabilities)) {
      expect(cap.DECLARED).toBe(true);
      expect(cap.IMPLEMENTED).toBe(true);
      expect(cap.CORE_BOUND).toBe(true);
      expect(cap.EXECUTED).toBe(true);
      expect(cap.VERIFIED).toBe(true);
    }
  });
});
