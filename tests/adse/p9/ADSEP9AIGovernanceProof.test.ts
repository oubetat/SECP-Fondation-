import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP9CommunicationEngine } from '../../../src/engine/adse/p9/ADSEP9CommunicationEngine';
import { RevisionEngine } from '../../../src/engine/revision/RevisionEngine';
import { CoreExecutionAuthority } from '../../../src/engine/execution/CoreExecutionAuthority';
import { DigitalThreadRegistry } from '../../../src/engine/adse/p4/DigitalThreadRegistry';
import { MBSEElementRegistry } from '../../../src/engine/adse/p2/MBSEElementRegistry';
import { MBSEBehavioralEngine } from '../../../src/engine/adse/p2/MBSEBehavioralEngine';

describe('ADSE-P9 Communications AI Governance Proof', () => {
  let p9: ADSEP9CommunicationEngine;
  let revisionEngine: RevisionEngine;
  let behavioralEngine: MBSEBehavioralEngine;
  let digitalThread: DigitalThreadRegistry;

  beforeEach(() => {
    revisionEngine = new RevisionEngine();
    behavioralEngine = new MBSEBehavioralEngine(new MBSEElementRegistry());
    digitalThread = new DigitalThreadRegistry(revisionEngine);
    CoreExecutionAuthority.clear();
    CoreExecutionAuthority.initialize(revisionEngine);
    p9 = new ADSEP9CommunicationEngine(revisionEngine, behavioralEngine, digitalThread);
  });

  it('PROVES that AI proposed configurations cannot bypass authority and trigger parallel truth failures', async () => {
    // 1. An AI tries to propose and register a communication system directly into the registry,
    // bypassing the orchestrator's authoritative authorizeCommunicationSystem method
    const proposalId = 'SYS-PROPOSAL-01';
    
    // Registering as a PROPOSED (AI Recommendation) state
    p9.registry.registerSystem({
      id: `COMM-${proposalId}`,
      systemId: proposalId,
      p3ArchitectureId: 'arch:proposed-01',
      p4NodeId: 'thread:node:proposed-01',
      displayName: 'AI Recommended Communication Topology',
      configurationId: 'CONF-01',
      authorityState: 'PROPOSED', // AI state
      lifecycleState: 'DRAFT'
    });

    // 2. Perform Forensic Audit
    const audit = p9.forensics.performAudit();
    
    // The forensic audit MUST fail because an un-authorized PROPOSED system is in the registry!
    expect(audit.overallStatus).toBe('FAIL');
    expect(audit.gates.find(g => g.gateId === 'P9-G01-NO-PARALLEL-TRUTH')?.status).toBe('FAIL');
    expect(audit.gates.find(g => g.gateId === 'P9-G01-NO-PARALLEL-TRUTH')?.finding).toContain('Parallel Truth Detected');
  });

  it('PROVES that AI proposed configurations cannot run authorized executions or publish results', async () => {
    const proposalId = 'SYS-PROPOSAL-02';
    
    p9.registry.registerSystem({
      id: `COMM-${proposalId}`,
      systemId: proposalId,
      p3ArchitectureId: 'arch:proposed-02',
      p4NodeId: 'thread:node:proposed-02',
      displayName: 'AI Recommendation 2',
      configurationId: 'CONF-01',
      authorityState: 'PROPOSED',
      lifecycleState: 'DRAFT'
    });

    const sysId = `COMM-${proposalId}`;

    // Verify V20 (Result Binding) or evaluation blocks or flags this as NOT_APPLICABLE/FAIL
    const gates = p9.verification.evaluateAllGates(sysId);
    
    // Any execution result binding gate or truth closure gate must fail on a Proposed AI system
    // since no valid execution has been sealed by Core Execution Authority for proposed states
    const executionGate = gates.find(g => g.gateName === 'P9-V19_EXECUTION_INTEGRITY');
    expect(executionGate?.verdict).toBe('NOT_APPLICABLE'); // Cannot run execution/provide proofs on recommendation

    const closureGate = gates.find(g => g.gateName === 'P9-V40_TRUTH_CLOSURE');
    expect(closureGate?.verdict).toBe('FAIL'); // Blocked from final closure!
  });
});
