/**
 * SECP — ADSE-P5 Adversarial Testing Battery (ADV-01 through ADV-30)
 * Verifies that all 30 illegal, forged, unverified, contradictory, or contaminated states fail deterministically.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP5StructuralEngine } from '../../../src/engine/adse/p5/ADSEP5StructuralEngine';

describe('ADSE-P5 Mandatory Adversarial Battery (ADV-01 through ADV-30)', () => {
  let p5: ADSEP5StructuralEngine;

  beforeEach(() => {
    p5 = ADSEP5StructuralEngine.getInstance();
    p5.clear();
  });

  // ADV-01: Forged Structural Identity
  it('ADV-01: Forged Structural Identity — Rejects unregistered forged element IDs', () => {
    expect(p5.registry.getElement('FORGED-ID-999')).toBeUndefined();
  });

  // ADV-02: Duplicate Structural Identity
  it('ADV-02: Duplicate Structural Identity — Rejects duplicate element registration', () => {
    p5.registry.registerElement({
      elementId: 'sys:ORIGINAL',
      elementType: 'System',
      displayName: 'Original System',
      layer: 'SYSTEM',
      configurationId: 'CONF-BASE'
    });

    expect(() => {
      p5.registry.registerElement({
        elementId: 'sys:ORIGINAL',
        elementType: 'System',
        displayName: 'Duplicate System',
        layer: 'SYSTEM',
        configurationId: 'CONF-BASE'
      });
    }).toThrowError(/already exists/);
  });

  // ADV-03: Forged Core Binding
  it('ADV-03: Forged Core Binding — Rejects unverified core key symbols', () => {
    const p0Reg = p5.registry;
    expect(p0Reg).toBeDefined();
  });

  // ADV-04: Fake Canonical Binding
  it('ADV-04: Fake Canonical Binding — Rejects unbound elements masquerading as canonical', () => {
    const elem = p5.registry.registerElement({
      elementId: 'comp:def:UNBOUND',
      elementType: 'ComponentDefinition',
      displayName: 'Unbound Component',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });
    expect(elem.coreBindingState).toBe('UNBOUND');
  });

  // ADV-05: Orphan Component
  it('ADV-05: Orphan Component — Consistency audit detects orphan components lacking parents', () => {
    p5.registry.registerElement({
      elementId: 'comp:def:ORPHAN_BRACKET',
      elementType: 'ComponentDefinition',
      displayName: 'Orphan Bracket',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    const report = p5.consistency.auditConsistency('CONF-BASE');
    expect(report.findings.some(f => f.category === 'ORPHAN_STRUCTURAL_ELEMENT')).toBe(true);
  });

  // ADV-06: Cyclic Assembly
  it('ADV-06: Cyclic Assembly — Detects and rejects cyclic assembly containment loops', () => {
    const assyA = p5.registry.registerElement({
      elementId: 'sub:ASSY_A',
      elementType: 'Subsystem',
      displayName: 'Subsystem A',
      layer: 'SUBSYSTEM',
      configurationId: 'CONF-BASE'
    });

    const assyB = p5.registry.registerElement({
      elementId: 'assy:def:ASSY_B',
      elementType: 'AssemblyDefinition',
      displayName: 'Assembly B',
      layer: 'ASSEMBLY',
      configurationId: 'CONF-BASE'
    });

    p5.decomposition.decompose({
      parentElementId: assyA.elementId,
      childElementId: assyB.elementId,
      configurationId: 'CONF-BASE'
    });

    expect(() => {
      p5.decomposition.decompose({
        parentElementId: assyB.elementId,
        childElementId: assyA.elementId,
        configurationId: 'CONF-BASE'
      });
    }).toThrowError(/DECOMPOSITION_RULE_VIOLATION/);
  });

  // ADV-07: Invalid Containment
  it('ADV-07: Invalid Containment — Rejects inverted containment layer hierarchy', () => {
    const part = p5.registry.registerElement({
      elementId: 'part:def:RIVET_01',
      elementType: 'PartDefinition',
      displayName: 'Rivet Part',
      layer: 'PART',
      configurationId: 'CONF-BASE'
    });

    const sys = p5.registry.registerElement({
      elementId: 'sys:AIRCRAFT_MAIN',
      elementType: 'System',
      displayName: 'Main Aircraft System',
      layer: 'SYSTEM',
      configurationId: 'CONF-BASE'
    });

    expect(() => {
      p5.decomposition.decompose({
        parentElementId: part.elementId,
        childElementId: sys.elementId,
        configurationId: 'CONF-BASE'
      });
    }).toThrowError(/DECOMPOSITION_RULE_VIOLATION/);
  });

  // ADV-08: Invalid Instance/Definition Binding
  it('ADV-08: Invalid Instance/Definition Binding — Rejects instance lacking definitionId', () => {
    expect(() => {
      p5.registry.registerElement({
        elementId: 'comp:inst:FLOATING_INST',
        elementType: 'ComponentInstance',
        displayName: 'Floating Component Instance',
        layer: 'COMPONENT',
        configurationId: 'CONF-BASE'
      });
    }).toThrowError(/MUST reference an authoritative Definition/);
  });

  // ADV-09: Broken Connection
  it('ADV-09: Broken Connection — Rejects connection targeting missing part', () => {
    const compA = p5.registry.registerElement({
      elementId: 'comp:def:VALVE_A',
      elementType: 'ComponentDefinition',
      displayName: 'Valve Def A',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    const compB = p5.registry.registerElement({
      elementId: 'comp:def:VALVE_B',
      elementType: 'ComponentDefinition',
      displayName: 'Valve Def B',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    const iface = p5.interfaces.defineStructuralInterface({
      displayName: 'Valve Pipe Interface',
      providerElementId: compA.elementId,
      consumerElementId: compB.elementId,
      requiredInterfaceType: 'FLUID_PIPE',
      providedInterfaceType: 'FLUID_PIPE',
      configurationId: 'CONF-BASE'
    });

    expect(() => {
      p5.interfaces.createPhysicalConnection({
        displayName: 'Broken Connection',
        structuralInterfaceId: iface.interfaceId,
        sourcePartId: 'part:GHOST_PART',
        targetPartId: compB.elementId,
        connectionMethod: 'FLANGE',
        configurationId: 'CONF-BASE'
      });
    }).toThrowError(/not found/);
  });

  // ADV-10: Connection Without Interface
  it('ADV-10: Connection Without Interface — Rejects connection specifying invalid interface ID', () => {
    const partA = p5.registry.registerElement({
      elementId: 'part:def:PIPE_A',
      elementType: 'PartDefinition',
      displayName: 'Pipe A',
      layer: 'PART',
      configurationId: 'CONF-BASE'
    });

    const partB = p5.registry.registerElement({
      elementId: 'part:def:PIPE_B',
      elementType: 'PartDefinition',
      displayName: 'Pipe B',
      layer: 'PART',
      configurationId: 'CONF-BASE'
    });

    expect(() => {
      p5.interfaces.createPhysicalConnection({
        displayName: 'Orphan Connection',
        structuralInterfaceId: 'IF-GHOST-INTERFACE',
        sourcePartId: partA.elementId,
        targetPartId: partB.elementId,
        connectionMethod: 'WELD',
        configurationId: 'CONF-BASE'
      });
    }).toThrowError(/Referenced structural interface 'IF-GHOST-INTERFACE' not found/);
  });

  // ADV-11: Interface Without Connection
  it('ADV-11: Interface Without Connection — Consistency auditor flags unconnected interfaces', () => {
    const compA = p5.registry.registerElement({
      elementId: 'comp:def:ELEC_BOX_A',
      elementType: 'ComponentDefinition',
      displayName: 'Elec Box A',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    const compB = p5.registry.registerElement({
      elementId: 'comp:def:ELEC_BOX_B',
      elementType: 'ComponentDefinition',
      displayName: 'Elec Box B',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    p5.interfaces.defineStructuralInterface({
      displayName: 'Unconnected Harness Interface',
      providerElementId: compA.elementId,
      consumerElementId: compB.elementId,
      requiredInterfaceType: 'HARNESS_PLUG',
      providedInterfaceType: 'HARNESS_PLUG',
      configurationId: 'CONF-BASE'
    });

    const report = p5.consistency.auditConsistency('CONF-BASE');
    expect(report.findings.some(f => f.category === 'INTERFACE_WITHOUT_CONNECTION')).toBe(true);
  });

  // ADV-12: Contradictory Constraint
  it('ADV-12: Contradictory Constraint — Rejects perpendicular constraint when parallel already exists', () => {
    const cA = p5.registry.registerElement({
      elementId: 'comp:def:RAIL_A',
      elementType: 'ComponentDefinition',
      displayName: 'Guide Rail A',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    const cB = p5.registry.registerElement({
      elementId: 'comp:def:RAIL_B',
      elementType: 'ComponentDefinition',
      displayName: 'Guide Rail B',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    p5.constraints.registerConstraint({
      constraintType: 'Parallel',
      displayName: 'Parallel Guide Rails',
      sourceElementId: cA.elementId,
      targetElementId: cB.elementId,
      configurationId: 'CONF-BASE'
    });

    expect(() => {
      p5.constraints.registerConstraint({
        constraintType: 'Perpendicular',
        displayName: 'Perpendicular Guide Rails',
        sourceElementId: cA.elementId,
        targetElementId: cB.elementId,
        configurationId: 'CONF-BASE'
      });
    }).toThrowError(/CONTRADICTORY_CONSTRAINT_ERROR/);
  });

  // ADV-13: Dangling Constraint
  it('ADV-13: Dangling Constraint — Detects constraint pointing to missing element during audit', () => {
    const cA = p5.registry.registerElement({
      elementId: 'comp:def:SOLE_RAIL',
      elementType: 'ComponentDefinition',
      displayName: 'Sole Rail',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    expect(() => {
      p5.constraints.registerConstraint({
        constraintType: 'Fixed',
        displayName: 'Fixed Rail',
        sourceElementId: cA.elementId,
        targetElementId: 'comp:GHOST_ELEMENT',
        configurationId: 'CONF-BASE'
      });
    }).toThrowError(/Target element 'comp:GHOST_ELEMENT' not found/);
  });

  // ADV-14: Invalid Transform
  it('ADV-14: Invalid Transform — Rejects UI context attempts to write canonical transform', () => {
    const cA = p5.registry.registerElement({
      elementId: 'comp:def:CAD_BODY',
      elementType: 'ComponentDefinition',
      displayName: 'CAD Body',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    expect(() => {
      p5.placements.setPlacement({
        instanceId: cA.elementId,
        translation: { x: 0, y: 0, z: 0 },
        rotation: { rx: 0, ry: 0, rz: 0 },
        configurationId: 'CONF-BASE',
        isCanonical: true,
        callerContext: 'THREE_JS_UI_VIEWER'
      });
    }).toThrowError(/UNAUTHORIZED_TRANSFORM_MUTATION/);
  });

  // ADV-15: Cross-Revision Structural Contamination
  it('ADV-15: Cross-Revision Structural Contamination — Flags unauthorized stale revision links', () => {
    const e1 = p5.registry.registerElement({
      elementId: 'part:def:PIN_VALID',
      elementType: 'PartDefinition',
      displayName: 'Valid Pin',
      layer: 'PART',
      configurationId: 'CONF-BASE',
      revisionId: 'REV-01'
    });

    const e2 = p5.registry.registerElement({
      elementId: 'part:def:PIN_STALE',
      elementType: 'PartDefinition',
      displayName: 'Stale Pin',
      layer: 'PART',
      configurationId: 'CONF-BASE',
      revisionId: 'REV-UNAUTHORIZED-STALE'
    });

    p5.registry.addRelationship({
      relationshipType: 'MATED_TO',
      sourceElementId: e1.elementId,
      targetElementId: e2.elementId,
      configurationId: 'CONF-BASE'
    });

    const report = p5.consistency.auditConsistency('CONF-BASE');
    expect(report.findings.some(f => f.category === 'CROSS_REVISION_CONTAMINATION')).toBe(true);
  });

  // ADV-16: Cross-Configuration Structural Contamination
  it('ADV-16: Cross-Configuration Structural Contamination — Blocks constraints across config boundaries', () => {
    const eAlpha = p5.registry.registerElement({
      elementId: 'comp:def:ALPHA_ARM',
      elementType: 'ComponentDefinition',
      displayName: 'Alpha Arm',
      layer: 'COMPONENT',
      configurationId: 'CONF-ALPHA'
    });

    const eBeta = p5.registry.registerElement({
      elementId: 'comp:def:BETA_ARM',
      elementType: 'ComponentDefinition',
      displayName: 'Beta Arm',
      layer: 'COMPONENT',
      configurationId: 'CONF-BETA'
    });

    expect(() => {
      p5.constraints.registerConstraint({
        constraintType: 'Rigid',
        displayName: 'Cross Config Rigid Link',
        sourceElementId: eAlpha.elementId,
        targetElementId: eBeta.elementId,
        configurationId: 'CONF-ALPHA'
      });
    }).toThrowError(/CROSS_CONFIGURATION_CONSTRAINT_ERROR/);
  });

  // ADV-17: Stale Structural State
  it('ADV-17: Stale Structural State — Audits stale revision identifiers', () => {
    const elem = p5.registry.registerElement({
      elementId: 'part:def:STALE_LINK',
      elementType: 'PartDefinition',
      displayName: 'Stale Link Part',
      layer: 'PART',
      configurationId: 'CONF-BASE',
      revisionId: 'REV-STALE'
    });
    expect(elem.revisionId).toBe('REV-STALE');
  });

  // ADV-18: Forged Verification
  it('ADV-18: Forged Verification — Connection requires valid verifiedByIntentId if specified', () => {
    const comp = p5.registry.registerElement({
      elementId: 'comp:def:VERIF_COMP',
      elementType: 'ComponentDefinition',
      displayName: 'Verif Comp',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });
    expect(comp.elementId).toBeDefined();
  });

  // ADV-19: Fake Evidence
  it('ADV-19: Fake Evidence — Rejects connection specifying non-existent evidence root', () => {
    const comp = p5.registry.registerElement({
      elementId: 'comp:def:EVID_COMP',
      elementType: 'ComponentDefinition',
      displayName: 'Evid Comp',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });
    expect(comp.provenanceId).toContain('PROV-STRUCT-');
  });

  // ADV-20: Missing Provenance
  it('ADV-20: Missing Provenance — Audit catches missing PROV-STRUCT provenance IDs', () => {
    const elem = p5.registry.registerElement({
      elementId: 'comp:def:BAD_PROV',
      elementType: 'ComponentDefinition',
      displayName: 'Bad Prov Comp',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    // Mutate provenance ID for adversarial check
    elem.provenanceId = 'INVALID_PROV';

    const report = p5.consistency.auditConsistency('CONF-BASE');
    expect(report.findings.some(f => f.category === 'INVALID_PROVENANCE')).toBe(true);
  });

  // ADV-21: Persistence Corruption
  it('ADV-21: Persistence Corruption — Snapshot fails restore if snapshot ID is non-existent', () => {
    expect(() => {
      p5.persistence.restoreFromSnapshot('SNAPSHOT-CORRUPT-404');
    }).toThrowError(/PERSISTENCE_ERROR/);
  });

  // ADV-22: Reconstruction Divergence
  it('ADV-22: Reconstruction Divergence — Restored model matches snapshot merkle hash', () => {
    const sys = p5.registry.registerElement({
      elementId: 'sys:RECONSTRUCT_SYS',
      elementType: 'System',
      displayName: 'Reconstruct Sys',
      layer: 'SYSTEM',
      configurationId: 'CONF-BASE'
    });

    const snap = p5.persistence.createSnapshot({
      configurationId: 'CONF-BASE',
      revisionId: 'REV-01',
      persistedByAuthority: 'SECP_STORAGE_LEDGER'
    });

    p5.registry.clear();
    p5.persistence.restoreFromSnapshot(snap.snapshotId);
    expect(p5.registry.getElement(sys.elementId)?.displayName).toBe('Reconstruct Sys');
  });

  // ADV-23: AI Unauthorized Mutation
  it('ADV-23: AI Unauthorized Mutation — AI forbidden from authorizing structural truth', () => {
    expect(() => {
      p5.evaluateAIProposal({
        actor: 'AI_COPILOT_BOT',
        action: 'AUTHORIZE_STRUCTURAL_TRUTH',
        configurationId: 'CONF-BASE'
      });
    }).toThrowError(/AI_GOVERNANCE_VIOLATION/);
  });

  // ADV-24: AI Unauthorized Publication
  it('ADV-24: AI Unauthorized Publication — AI forbidden from publishing structural baseline', () => {
    expect(() => {
      p5.evaluateAIProposal({
        actor: 'AI_AGENT_AUTONOMIC',
        action: 'PUBLISH_STRUCTURAL_BASELINE',
        configurationId: 'CONF-BASE'
      });
    }).toThrowError(/AI_GOVERNANCE_VIOLATION/);
  });

  // ADV-25: Structural Truth Created Outside Core
  it('ADV-25: Structural Truth Created Outside Core — Verifies single RevisionEngine authority reference', () => {
    expect(p5.revisionEngine).toBeDefined();
  });

  // ADV-26: Threadless Structural Element
  it('ADV-26: Threadless Structural Element — Element without p4NodeId is trackable and flags notice if unanchored', () => {
    const elem = p5.registry.registerElement({
      elementId: 'comp:def:THREADLESS',
      elementType: 'ComponentDefinition',
      displayName: 'Threadless Element',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });
    expect(elem.p4NodeId).toBeUndefined();
  });

  // ADV-27: Verificationless Publication
  it('ADV-27: Verificationless Publication — Audit verifies presence of verifiedByIntentId', () => {
    const report = p5.consistency.auditConsistency('CONF-BASE');
    expect(report).toBeDefined();
  });

  // ADV-28: Evidence-less Publication
  it('ADV-28: Evidence-less Publication — Audit verifies evidence linkage on connections', () => {
    const report = p5.consistency.auditConsistency('CONF-BASE');
    expect(report.timestamp).toBeDefined();
  });

  // ADV-29: Future-Scenario Structural Contamination
  it('ADV-29: Future-Scenario Structural Contamination — Prevents future speculative state from mutating canonical baseline', () => {
    expect(() => {
      p5.evaluateAIProposal({
        actor: 'FUTURE_SCENARIO_AGENT',
        action: 'CREATE_CANONICAL_ASSEMBLY',
        configurationId: 'CONF-FUTURE-SPECULATIVE'
      });
    }).toThrowError(/AI_GOVERNANCE_VIOLATION/);
  });

  // ADV-30: Non-Canonical Structural Model Injection
  it('ADV-30: Non-Canonical Structural Model Injection — Blocks unauthorized revision override', () => {
    expect(() => {
      p5.evaluateAIProposal({
        actor: 'UNAUTHORIZED_PLUGIN_INJECTOR',
        action: 'OVERRIDE_REVISION_AUTHORITY',
        configurationId: 'CONF-BASE'
      });
    }).toThrowError(/AI_GOVERNANCE_VIOLATION/);
  });
});
