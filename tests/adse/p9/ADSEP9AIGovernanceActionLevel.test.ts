/**
 * SECP — ADSE-P9 AI Governance Action-Level Forensic Proof Suite
 * 
 * Absolute Governance Rule:
 * «AI may propose. AI may analyze. AI may not authorize, mutate, verify,
 *  publish, promote, or bypass canonical engineering authority.»
 * 
 * Verifies 15 Action-Level Adversarial Cases:
 * - AI-GOV-01: Canonical Mutation
 * - AI-GOV-02: Canonical Delete
 * - AI-GOV-03: Execution Authorization
 * - AI-GOV-04: Publication (PROPOSED -> PUBLISHED)
 * - AI-GOV-05: PROPOSED -> VERIFIED
 * - AI-GOV-06: PROPOSED -> RELEASED
 * - AI-GOV-07: Revision Creation Bypass
 * - AI-GOV-08: Revision Mutation Bypass
 * - AI-GOV-09: Revision Promotion Bypass
 * - AI-GOV-10: Configuration Mutation Bypass
 * - AI-GOV-11: Cross-Configuration Injection
 * - AI-GOV-12: AI-Generated Fake Verification
 * - AI-GOV-13: AI-Generated Fake Evidence
 * - AI-GOV-14: AI-Generated Fake Provenance
 * - AI-GOV-15: AI Attempt to Promote Its Own Proposal
 * - AI-GOV-16: Persistence Reconstruction State Invariance Proof
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { ADSEP9CommunicationEngine } from '../../../src/engine/adse/p9/ADSEP9CommunicationEngine';
import { RevisionEngine } from '../../../src/engine/revision/RevisionEngine';
import { CoreExecutionAuthority } from '../../../src/engine/execution/CoreExecutionAuthority';
import { DigitalThreadRegistry } from '../../../src/engine/adse/p4/DigitalThreadRegistry';
import { MBSEElementRegistry } from '../../../src/engine/adse/p2/MBSEElementRegistry';
import { MBSEBehavioralEngine } from '../../../src/engine/adse/p2/MBSEBehavioralEngine';
import { RevisionEntityType, RevisionLifecycleState } from '../../../src/engine/revision/types';
import { ADSEP9EngineeringAuthority, CommunicationSystem } from '../../../src/engine/adse/p9/types';
import { createHash } from 'crypto';

describe('ADSE-P9 AI Governance Action-Level Forensic Proof Suite', () => {
  let p9: ADSEP9CommunicationEngine;
  let revisionEngine: RevisionEngine;
  let behavioralEngine: MBSEBehavioralEngine;
  let digitalThread: DigitalThreadRegistry;
  let canonicalSys: CommunicationSystem;

  const validHumanAuthority: ADSEP9EngineeringAuthority = {
    actor: 'Lead-Systems-Engineer-42',
    role: 'CHIEF_COMMUNICATIONS_ARCHITECT',
    signatureToken: 'sig-secp-auth-valid-999',
    delegationId: 'DEL-CHIEF-01'
  };

  function captureSnapshot(engine: ADSEP9CommunicationEngine, sysId: string) {
    const snap = engine.persistence.createSnapshot({
      communicationSystemId: sysId,
      persistedByAuthority: 'SECP_PERSISTENCE_AUTHORITY'
    });
    const sys = engine.registry.getSystem(sysId);
    const nodes = engine.registry.getAllNodes().filter(n => n.communicationSystemId === sysId);
    const interfaces = engine.registry.getAllInterfaces().filter(i => nodes.some(n => n.id === i.nodeId));
    const links = engine.registry.getAllLinks().filter(l => l.communicationSystemId === sysId);
    const flows = engine.registry.getAllDataFlows().filter(f => f.communicationSystemId === sysId);
    const threadEdges = engine.registry['digitalThread'].getEdgesForNode(sys?.p4NodeId || '');

    return {
      merkleRoot: snap.merkleRootHash,
      canonicalSystem: JSON.stringify(sys),
      nodesHash: createHash('sha256').update(JSON.stringify(nodes)).digest('hex'),
      interfacesHash: createHash('sha256').update(JSON.stringify(interfaces)).digest('hex'),
      linksHash: createHash('sha256').update(JSON.stringify(links)).digest('hex'),
      flowsHash: createHash('sha256').update(JSON.stringify(flows)).digest('hex'),
      threadEdgesHash: createHash('sha256').update(JSON.stringify(threadEdges)).digest('hex'),
      revisionId: sys?.revisionId,
      configurationId: sys?.configurationId,
      lifecycleState: sys?.lifecycleState,
      isPublished: sys?.isPublished
    };
  }

  function assertUnchanged(before: ReturnType<typeof captureSnapshot>, after: ReturnType<typeof captureSnapshot>) {
    expect(after.merkleRoot).toBe(before.merkleRoot);
    expect(after.canonicalSystem).toBe(before.canonicalSystem);
    expect(after.nodesHash).toBe(before.nodesHash);
    expect(after.interfacesHash).toBe(before.interfacesHash);
    expect(after.linksHash).toBe(before.linksHash);
    expect(after.flowsHash).toBe(before.flowsHash);
    expect(after.threadEdgesHash).toBe(before.threadEdgesHash);
    expect(after.revisionId).toBe(before.revisionId);
    expect(after.configurationId).toBe(before.configurationId);
    expect(after.lifecycleState).toBe(before.lifecycleState);
    expect(after.isPublished).toBe(before.isPublished);
  }

  beforeAll(() => {
    revisionEngine = new RevisionEngine();
    behavioralEngine = new MBSEBehavioralEngine(new MBSEElementRegistry());
    digitalThread = new DigitalThreadRegistry(revisionEngine);
    CoreExecutionAuthority.initialize(revisionEngine);
  });

  beforeEach(async () => {
    revisionEngine = new RevisionEngine();
    behavioralEngine = new MBSEBehavioralEngine(new MBSEElementRegistry());
    digitalThread = new DigitalThreadRegistry(revisionEngine);
    CoreExecutionAuthority.clear();
    CoreExecutionAuthority.initialize(revisionEngine);
    p9 = new ADSEP9CommunicationEngine(revisionEngine, behavioralEngine, digitalThread);

    // Setup active architecture revision
    revisionEngine.createRevision({
      entityId: 'arch:node:AVIONICS-P9',
      entityType: RevisionEntityType.TOPOLOGY,
      author: 'Lead-Systems-Engineer-42',
      reason: 'Authoritative P9 Communications Baseline',
      lifecycle: RevisionLifecycleState.APPROVED
    });

    canonicalSys = await p9.authorizeCommunicationSystem({
      systemId: 'SYS-AVIONICS-01',
      architectureId: 'arch:node:AVIONICS-P9',
      p4NodeId: 'thread:node:avionics-01',
      configId: 'CONF-MAIN-BASELINE'
    });

    // Populate standard canonical topology
    const nodeA = p9.registry.registerNode({
      id: 'NODE-AV-01',
      systemId: 'SYS-AVIONICS-01',
      communicationSystemId: canonicalSys.id,
      p3ComponentId: 'comp:fcc-01',
      p4NodeId: 'thread:node:fcc-01',
      nodeName: 'Flight Control Computer A',
      processingDelayMs: 0.5,
      bufferCapacityBytes: 65536,
      configurationId: 'CONF-MAIN-BASELINE',
      revisionId: canonicalSys.revisionId
    });

    const nodeB = p9.registry.registerNode({
      id: 'NODE-AV-02',
      systemId: 'SYS-AVIONICS-01',
      communicationSystemId: canonicalSys.id,
      p3ComponentId: 'comp:actuator-01',
      p4NodeId: 'thread:node:actuator-01',
      nodeName: 'Flight Surface Actuator Controller',
      processingDelayMs: 0.2,
      bufferCapacityBytes: 32768,
      configurationId: 'CONF-MAIN-BASELINE',
      revisionId: canonicalSys.revisionId
    });

    const ifaceA = p9.registry.registerInterface({
      id: 'IFACE-AV-01',
      systemId: 'SYS-AVIONICS-01',
      nodeId: nodeA.id,
      interfaceName: 'Eth-Port-1',
      mediumType: 'COPPER_TWISTED_PAIR',
      maxBandwidthBps: 100e6,
      configurationId: 'CONF-MAIN-BASELINE',
      revisionId: canonicalSys.revisionId
    });

    const ifaceB = p9.registry.registerInterface({
      id: 'IFACE-AV-02',
      systemId: 'SYS-AVIONICS-01',
      nodeId: nodeB.id,
      interfaceName: 'Eth-Port-1',
      mediumType: 'COPPER_TWISTED_PAIR',
      maxBandwidthBps: 100e6,
      configurationId: 'CONF-MAIN-BASELINE',
      revisionId: canonicalSys.revisionId
    });

    p9.registry.registerLink({
      id: 'LINK-AV-01',
      systemId: 'SYS-AVIONICS-01',
      communicationSystemId: canonicalSys.id,
      sourceInterfaceId: ifaceA.id,
      targetInterfaceId: ifaceB.id,
      lengthMeters: 12.5,
      linkCapacityBps: 100e6,
      configurationId: 'CONF-MAIN-BASELINE',
      revisionId: canonicalSys.revisionId
    });

    p9.registry.registerDataFlow({
      id: 'FLOW-AV-01',
      systemId: 'SYS-AVIONICS-01',
      communicationSystemId: canonicalSys.id,
      flowName: 'FlightControlTelemetry',
      sourceNodeId: nodeA.id,
      destinationNodeId: nodeB.id,
      protocol: 'ETHERNET_IP',
      messageRateHz: 100,
      messageSizeBytes: 512,
      maxLatencyMs: 5.0,
      priority: 'CRITICAL_REALTIME',
      configurationId: 'CONF-MAIN-BASELINE',
      revisionId: canonicalSys.revisionId
    });
  });

  // --- 1. AI-GOV-01: Canonical Mutation Attempt ---
  it('PROVES AI-GOV-01: AI Proposal cannot directly mutate canonical Communication System', () => {
    const before = captureSnapshot(p9, canonicalSys.id);

    // AI attempts direct mutation through real production updateSystem path
    expect(() => {
      p9.registry.updateSystem(
        canonicalSys.id,
        {
          displayName: 'AI_FORGED_SYSTEM_NAME',
          p3ArchitectureId: 'arch:forged-bypass'
        },
        { actor: 'AI_AGENT_PROMPT_INJECTOR' }
      );
    }).toThrow(/AI_GOVERNANCE_VIOLATION/);

    const after = captureSnapshot(p9, canonicalSys.id);
    assertUnchanged(before, after);
  });

  // --- 2. AI-GOV-02: Canonical Delete Attempt ---
  it('PROVES AI-GOV-02: AI Proposal cannot delete canonical communication entity', () => {
    const before = captureSnapshot(p9, canonicalSys.id);

    // AI attempts deletion through real deleteSystem production path
    expect(() => {
      p9.registry.deleteSystem(canonicalSys.id, { actor: 'AI_COPILOT_DELETE_AGENT' });
    }).toThrow(/AI_GOVERNANCE_VIOLATION/);

    const after = captureSnapshot(p9, canonicalSys.id);
    assertUnchanged(before, after);
    expect(p9.registry.getSystem(canonicalSys.id)).toBeDefined();
  });

  // --- 3. AI-GOV-03: Execution Authorization Attempt ---
  it('PROVES AI-GOV-03: AI cannot authorize or dispatch CoreExecutionAuthority execution', () => {
    const before = captureSnapshot(p9, canonicalSys.id);

    // AI attempts to authorize solver execution without human authority
    expect(() => {
      p9.governance.authorizeAndExecute({
        systemId: canonicalSys.id,
        executionKind: 'communication-analysis',
        scenarioId: 'SCEN-AI-FORGED',
        parameters: { trafficMultiplier: 2.0 },
        actor: 'AI_COPILOT_SOLVER_RUNNER'
      });
    }).toThrow(/AI_EXECUTION_UNAUTHORIZED/);

    const after = captureSnapshot(p9, canonicalSys.id);
    assertUnchanged(before, after);
    expect(p9.registry.getAllExecutions().length).toBe(0);
  });

  // --- 4. AI-GOV-04: Publication (PROPOSED -> PUBLISHED) ---
  it('PROVES AI-GOV-04: AI Proposal cannot publish authoritative engineering state', () => {
    const before = captureSnapshot(p9, canonicalSys.id);

    // AI attempts direct publication
    expect(() => {
      p9.publishCommunicationSystem(canonicalSys.id, {
        actor: 'AI_AUTOPUBLISHER_AGENT',
        role: 'HUMAN_SYSTEMS_ENGINEER' as any,
        signatureToken: 'fake-ai-token'
      });
    }).toThrow(/PUBLICATION_AUTHORITY_VIOLATION/);

    const after = captureSnapshot(p9, canonicalSys.id);
    assertUnchanged(before, after);
    expect(p9.registry.getSystem(canonicalSys.id)?.isPublished).toBe(false);
  });

  // --- 5. AI-GOV-05: PROPOSED -> VERIFIED ---
  it('PROVES AI-GOV-05: AI Proposal cannot declare itself VERIFIED without independent verification authority', () => {
    const before = captureSnapshot(p9, canonicalSys.id);

    // AI attempts to declare verification directly
    expect(() => {
      p9.governance.declareVerification(canonicalSys.id, {
        actor: 'AI_SYNTHETIC_VERIFIER',
        role: 'HUMAN_SYSTEMS_ENGINEER' as any,
        signatureToken: 'fake-ai-token'
      });
    }).toThrow(/VERIFICATION_AUTHORITY_VIOLATION/);

    const after = captureSnapshot(p9, canonicalSys.id);
    assertUnchanged(before, after);
    expect(p9.registry.getSystem(canonicalSys.id)?.verificationStatus).toBe('UNVERIFIED');
  });

  // --- 6. AI-GOV-06: PROPOSED -> RELEASED ---
  it('PROVES AI-GOV-06: AI Proposal cannot transition directly PROPOSED -> RELEASED', () => {
    const before = captureSnapshot(p9, canonicalSys.id);

    // AI attempts direct promotion to RELEASED
    expect(() => {
      p9.promoteLifecycleState(canonicalSys.id, 'RELEASED', {
        actor: 'AI_LIFECYCLE_BYPASS_BOT',
        role: 'HUMAN_SYSTEMS_ENGINEER' as any,
        signatureToken: 'fake-ai-token'
      });
    }).toThrow(/LIFECYCLE_AUTHORITY_VIOLATION|PUBLICATION_AUTHORITY_VIOLATION/);

    const after = captureSnapshot(p9, canonicalSys.id);
    assertUnchanged(before, after);
    expect(p9.registry.getSystem(canonicalSys.id)?.lifecycleState).toBe('RELEASED'); // initialized as baseline, unchanged
  });

  // --- 7. AI-GOV-07: Revision Creation Bypass ---
  it('PROVES AI-GOV-07: AI cannot create authoritative revisions outside RevisionEngine', () => {
    const before = captureSnapshot(p9, canonicalSys.id);

    const proposal = p9.submitAIProposal({
      proposalId: 'PROP-REV-CREATE-01',
      action: 'BYPASS_REVISION',
      actor: 'AI_REVISION_FORGER',
      systemId: canonicalSys.id,
      configurationId: 'CONF-MAIN-BASELINE',
      revisionId: 'REV-FORGED-01',
      proposedData: { reason: 'AI suggested revision' }
    });

    expect(() => {
      p9.evaluateAIProposal(proposal);
    }).toThrow(/AI_GOVERNANCE_VIOLATION/);

    const after = captureSnapshot(p9, canonicalSys.id);
    assertUnchanged(before, after);
    expect(proposal.status).toBe('REJECTED');
  });

  // --- 8. AI-GOV-08: Revision Mutation Bypass ---
  it('PROVES AI-GOV-08: AI cannot mutate revision state or target locked revision', () => {
    const before = captureSnapshot(p9, canonicalSys.id);

    expect(() => {
      p9.registry.updateSystem(
        canonicalSys.id,
        { revisionId: 'REV-LOCKED-FORGED' },
        { actor: 'AI_COPILOT_MUTATOR' }
      );
    }).toThrow(/AI_GOVERNANCE_VIOLATION/);

    const after = captureSnapshot(p9, canonicalSys.id);
    assertUnchanged(before, after);
  });

  // --- 9. AI-GOV-09: Revision Promotion Bypass ---
  it('PROVES AI-GOV-09: AI cannot promote revision R1 -> R2 without authorized change management workflow', () => {
    const before = captureSnapshot(p9, canonicalSys.id);

    const proposal = p9.submitAIProposal({
      proposalId: 'PROP-REV-PROMOTE-02',
      action: 'PROMOTE_PROPOSAL',
      actor: 'AI_AUTONOMOUS_PROMOTER',
      systemId: canonicalSys.id,
      configurationId: 'CONF-MAIN-BASELINE',
      revisionId: canonicalSys.revisionId,
      proposedData: { targetRevision: 'REV-B' }
    });

    expect(() => {
      p9.evaluateAIProposal(proposal);
    }).toThrow(/AI_GOVERNANCE_VIOLATION/);

    const after = captureSnapshot(p9, canonicalSys.id);
    assertUnchanged(before, after);
  });

  // --- 10. AI-GOV-10: Configuration Mutation Bypass ---
  it('PROVES AI-GOV-10: AI cannot mutate configuration binding or active configuration', () => {
    const before = captureSnapshot(p9, canonicalSys.id);

    expect(() => {
      p9.registry.updateSystem(
        canonicalSys.id,
        { configurationId: 'CONF-FORGED-ALT' },
        { actor: 'AI_CONFIG_INJECTOR' }
      );
    }).toThrow(/AI_GOVERNANCE_VIOLATION/);

    const after = captureSnapshot(p9, canonicalSys.id);
    assertUnchanged(before, after);
  });

  // --- 11. AI-GOV-11: Cross-Configuration Injection ---
  it('PROVES AI-GOV-11: Cross-configuration entity injection is blocked', () => {
    const before = captureSnapshot(p9, canonicalSys.id);

    expect(() => {
      p9.registry.registerNode({
        id: 'NODE-CROSS-CONF',
        systemId: 'SYS-AVIONICS-01',
        communicationSystemId: canonicalSys.id,
        p3ComponentId: 'comp:cross-01',
        p4NodeId: 'thread:node:cross-01',
        nodeName: 'Cross Config Node',
        processingDelayMs: 0.1,
        bufferCapacityBytes: 1024,
        configurationId: 'CONF-UNAUTHORIZED-ALT',
        revisionId: canonicalSys.revisionId
      });
    }).toThrow(/CONFIGURATION_MISMATCH_VIOLATION/);

    const after = captureSnapshot(p9, canonicalSys.id);
    assertUnchanged(before, after);
    expect(p9.registry.getNode('NODE-CROSS-CONF')).toBeUndefined();
  });

  // --- 12. AI-GOV-12: AI-Generated Fake Verification ---
  it('PROVES AI-GOV-12: AI cannot register fake verification intents', () => {
    const before = captureSnapshot(p9, canonicalSys.id);

    expect(() => {
      p9.registry.registerVerification(
        {
          id: 'VERIF-AI-FAKE-01',
          communicationSystemId: canonicalSys.id,
          gateName: 'P9-V36_AI_GOVERNANCE',
          verdict: 'PASS',
          evaluatedAt: new Date().toISOString(),
          evidenceHash: 'FAKE_HASH_VALUE',
          reasons: ['AI declared verification pass']
        },
        { actor: 'AI_AGENT_FABRICATOR' }
      );
    }).toThrow(/AI_GOVERNANCE_VIOLATION|FORGED_VERIFICATION_REJECTED/);

    const after = captureSnapshot(p9, canonicalSys.id);
    assertUnchanged(before, after);
  });

  // --- 13. AI-GOV-13: AI-Generated Fake Evidence ---
  it('PROVES AI-GOV-13: AI cannot register fake evidence without real Core execution', () => {
    const before = captureSnapshot(p9, canonicalSys.id);

    expect(() => {
      p9.registry.registerEvidence(
        {
          id: 'EVID-AI-FAKE-01',
          executionId: 'NON_EXISTENT_EXECUTION_ID',
          evidenceType: 'SYNTHETIC_AI_EVIDENCE',
          merkleLeafHash: 'FAKE_MERKLE_LEAF',
          signedByAuthority: 'AI_SYNTHESIS_BOT',
          createdAt: new Date().toISOString()
        },
        { actor: 'AI_AGENT_EVIDENCE_FABRICATOR' }
      );
    }).toThrow(/AI_GOVERNANCE_VIOLATION|FORGED_EVIDENCE_REJECTED/);

    const after = captureSnapshot(p9, canonicalSys.id);
    assertUnchanged(before, after);
  });

  // --- 14. AI-GOV-14: AI-Generated Fake Provenance ---
  it('PROVES AI-GOV-14: AI cannot register systems with forged origin provenance', () => {
    const before = captureSnapshot(p9, canonicalSys.id);

    expect(() => {
      p9.registry.registerSystem({
        id: 'SYS-UNVERIFIED-PROV-01',
        systemId: 'SYS-FAKE-PROV',
        p3ArchitectureId: 'arch:node:AVIONICS-P9',
        p4NodeId: 'thread:node:fake-prov',
        displayName: 'Fake Provenance System',
        configurationId: 'CONF-MAIN-BASELINE',
        provenance: {
          originHash: 'FORGED_ORIGIN_PROVENANCE_HASH',
          createdBy: 'AI_SYNTHETIC_ORIGIN',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      });
    }).toThrow(/FORGED_PROVENANCE_REJECTED/);

    const after = captureSnapshot(p9, canonicalSys.id);
    assertUnchanged(before, after);
    expect(p9.registry.getSystem('SYS-UNVERIFIED-PROV-01')).toBeUndefined();
  });

  // --- 15. AI-GOV-15: AI Attempt to Promote Its Own Proposal ---
  it('PROVES AI-GOV-15: AI cannot self-promote or authorize its own proposals', () => {
    const before = captureSnapshot(p9, canonicalSys.id);

    const proposal = p9.submitAIProposal({
      proposalId: 'PROP-SELF-PROMOTE-01',
      action: 'PROPOSE_TOPOLOGY',
      actor: 'AI_TOPOLOGY_SUGGESTOR',
      systemId: canonicalSys.id,
      configurationId: 'CONF-MAIN-BASELINE',
      revisionId: canonicalSys.revisionId,
      proposedData: { suggestedLinkRate: 1e9 }
    });

    expect(proposal.status).toBe('PROPOSED');
    expect(proposal.isAuthorized).toBe(false);

    // AI attempts to authorize its own proposal
    expect(() => {
      p9.authorizeProposal(proposal.proposalId, {
        actor: 'AI_SELF_PROMOTER_BOT',
        role: 'HUMAN_SYSTEMS_ENGINEER' as any,
        signatureToken: 'fake-ai-sig'
      });
    }).toThrow(/AI_GOVERNANCE_VIOLATION/);

    expect(proposal.status).toBe('PROPOSED');
    expect(proposal.isAuthorized).toBe(false);

    // Official human engineer authorizes proposal
    const authorized = p9.authorizeProposal(proposal.proposalId, validHumanAuthority);
    expect(authorized.status).toBe('APPROVED');
    expect(authorized.isAuthorized).toBe(true);
    expect(authorized.authorizedBy?.actor).toBe(validHumanAuthority.actor);

    const after = captureSnapshot(p9, canonicalSys.id);
    assertUnchanged(before, after);
  });

  // --- 16. AI-GOV-16: Persistence Reconstruction State Invariance Proof ---
  it('PROVES AI-GOV-16: Persistence-Level Proof (Snapshot -> Destroy -> Reload -> Reconstruct Bit-Exact Parity)', () => {
    const snapBefore = p9.persistence.createSnapshot({
      communicationSystemId: canonicalSys.id,
      persistedByAuthority: 'SECP_PERSISTENCE_AUTHORITY'
    });

    // Destroy runtime instance
    p9.registry.clear();
    expect(p9.registry.getAllSystems().length).toBe(0);
    expect(p9.registry.getAllNodes().length).toBe(0);

    // Reload from cryptographic snapshot
    const restoreRes = p9.persistence.restoreFromSnapshot(snapBefore.id);
    expect(restoreRes.isValid).toBe(true);
    expect(restoreRes.reconstructedSystemId).toBe(canonicalSys.id);

    const reconstructedSys = p9.registry.getSystem(canonicalSys.id)!;
    expect(reconstructedSys).toBeDefined();
    expect(reconstructedSys.id).toBe(canonicalSys.id);
    expect(reconstructedSys.systemId).toBe(canonicalSys.systemId);
    expect(reconstructedSys.configurationId).toBe(canonicalSys.configurationId);
    expect(reconstructedSys.revisionId).toBe(canonicalSys.revisionId);

    // Reconstruct nodes parity
    const reconstructedNodes = p9.registry.getAllNodes().filter(n => n.communicationSystemId === canonicalSys.id);
    expect(reconstructedNodes.length).toBe(2);
    expect(reconstructedNodes.map(n => n.id).sort()).toEqual(['NODE-AV-01', 'NODE-AV-02']);

    const reconstructedLinks = p9.registry.getAllLinks().filter(l => l.communicationSystemId === canonicalSys.id);
    expect(reconstructedLinks.length).toBe(1);
    expect(reconstructedLinks[0].id).toBe('LINK-AV-01');

    const reconstructedFlows = p9.registry.getAllDataFlows().filter(f => f.communicationSystemId === canonicalSys.id);
    expect(reconstructedFlows.length).toBe(1);
    expect(reconstructedFlows[0].id).toBe('FLOW-AV-01');

    // Re-verify Gate V34 (Persistence/Reconstruction) on reconstructed state
    const gates = p9.verification.evaluateAllGates(reconstructedSys.id);
    const gateV34 = gates.find(g => g.gateName === 'P9-V34_PERSISTENCE_RECONSTRUCTION');
    expect(gateV34?.verdict).toBe('PASS');

    // Re-verify Gate V36 (AI Governance) on reconstructed state
    const gateV36 = gates.find(g => g.gateName === 'P9-V36_AI_GOVERNANCE');
    expect(gateV36?.verdict).toBe('PASS');
  });

  // --- 17. AI-GOV-17: Gate V36 Negative Evaluation Proof ---
  it('PROVES AI-GOV-17: Gate V36 evaluates to FAIL when entity is in PROPOSED authorityState or AI createdBy', () => {
    // Deliberately set authorityState to PROPOSED on system
    const origState = canonicalSys.authorityState;
    try {
      canonicalSys.authorityState = 'PROPOSED';
      const gates = p9.verification.evaluateAllGates(canonicalSys.id);
      const gateV36 = gates.find(g => g.gateName === 'P9-V36_AI_GOVERNANCE');
      expect(gateV36?.verdict).toBe('FAIL');
      expect(gateV36?.reasons[0]).toContain('AI Governance Violation');
    } finally {
      canonicalSys.authorityState = origState;
    }

    // Now verify it returns to PASS
    const restoredGates = p9.verification.evaluateAllGates(canonicalSys.id);
    const restoredGateV36 = restoredGates.find(g => g.gateName === 'P9-V36_AI_GOVERNANCE');
    expect(restoredGateV36?.verdict).toBe('PASS');
  });
});
