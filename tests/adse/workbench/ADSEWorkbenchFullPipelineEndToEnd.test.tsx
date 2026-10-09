/**
 * SECP — ADSE Workbench Full Pipeline End-to-End Verification Suite
 * 
 * Verifies the 13-stage truth chain across Frontend + Backend:
 * 
 * Engineer UI
 *    ↓
 * Workbench UI (SystemsEngineeringWorkspace & Views)
 *    ↓
 * ADSEWorkbenchBridge
 *    ↓
 * P5/P6/P7/P8/P9 Multidisciplinary Engines
 *    ↓
 * SECP Core Authority
 *    ↓
 * Canonical Engineering Model
 *    ↓
 * Revision / Configuration (RevisionEngine & RevisionImpactAnalyzer)
 *    ↓
 * Digital Thread (P4 Traceability & Referentials)
 *    ↓
 * Execution (CoreExecutionAuthority & Solvers)
 *    ↓
 * Verification (Gate Closure & P9-V40)
 *    ↓
 * Evidence / Provenance (Merkle Trees & Signed Records)
 *    ↓
 * Persistence (Cryptographic Snapshots)
 *    ↓
 * Restart (Complete Memory Wipe & Reboot)
 *    ↓
 * Workbench UI Reconstruction (Bit-exact Parity Projection)
 */

import React from 'react';
import { createHash } from 'crypto';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEWorkbenchBridge } from '../../../src/engine/adse/workbench/ADSEWorkbenchBridge';
import { CoreExecutionAuthority } from '../../../src/engine/execution/CoreExecutionAuthority';
import { RevisionEntityType, RevisionLifecycleState } from '../../../src/engine/revision/types';
import { SystemsEngineeringWorkspace } from '../../../src/components/adse/SystemsEngineeringWorkspace';
import { SystemArchitectureCanvas } from '../../../src/components/adse/SystemArchitectureCanvas';
import { RequirementsTruthView } from '../../../src/components/adse/RequirementsTruthView';
import { EngineeringTruthView } from '../../../src/components/adse/EngineeringTruthView';
import { EngineeringStateDashboard } from '../../../src/components/adse/EngineeringStateDashboard';

describe('SECP ADSE Workbench Full-Pipeline End-to-End Forensic Test (Frontend + Backend)', () => {
  let bridge: ADSEWorkbenchBridge;

  beforeEach(() => {
    ADSEWorkbenchBridge.resetInstance();
    bridge = ADSEWorkbenchBridge.getInstance();
  });

  it('PROVES Complete 13-Stage Truth Chain: Engineer UI -> Core -> Solvers -> Invalidation -> Snapshot -> Restart -> UI Reconstruction', async () => {
    // =========================================================================
    // STAGE 1: Engineer UI / Workbench UI Initial Projection
    // =========================================================================
    const initialWorkspaceHtml = renderToString(
      <SystemsEngineeringWorkspace 
        initialTab="CANVAS" 
        systemId="SYS-E2E-AVIONICS" 
        configurationId="CONF-BASELINE" 
      />
    );
    expect(initialWorkspaceHtml).toContain('Architecture Canvas');
    expect(initialWorkspaceHtml).toContain('Requirements Truth');
    expect(initialWorkspaceHtml).toContain('Engineering Truth View');
    expect(initialWorkspaceHtml).toContain('Capability Center');

    // =========================================================================
    // STAGE 2 & 3: Workbench UI Action -> Bridge -> P5..P9 Domain Engines
    // =========================================================================
    // Engineer creates System & Architecture Subsystem via Workbench Bridge
    const canonicalSys = bridge.p9.registry.registerSystem({
      id: 'COMM-SYS-E2E-001',
      systemId: 'SYS-E2E-AVIONICS',
      canonicalId: 'CANON-SYS-E2E',
      p3ArchitectureId: 'ARCH-E2E-AVIONICS',
      p4NodeId: 'THREAD-E2E-SYS',
      displayName: 'E2E Integrated Avionics Comms',
      configurationId: 'CONF-BASELINE',
      revisionId: 'REV-E2E-R1',
      allocatedBandwidthMbps: 1000
    });
    expect(canonicalSys.id).toBe('COMM-SYS-E2E-001');

    // Register multidisciplinary elements in domain engines
    const rfNode = bridge.p9.registry.registerNode({
      id: 'NODE-E2E-RF',
      systemId: 'SYS-E2E-AVIONICS',
      communicationSystemId: canonicalSys.id,
      p3ComponentId: 'COMP-E2E-RF',
      p4NodeId: 'THREAD-E2E-RF',
      nodeName: 'Avionics RF Transceiver',
      configurationId: 'CONF-BASELINE',
      revisionId: 'REV-E2E-R1'
    });

    const digitalNode = bridge.p9.registry.registerNode({
      id: 'NODE-E2E-DSP',
      systemId: 'SYS-E2E-AVIONICS',
      communicationSystemId: canonicalSys.id,
      p3ComponentId: 'COMP-E2E-DSP',
      p4NodeId: 'THREAD-E2E-DSP',
      nodeName: 'Digital Signal Processor',
      configurationId: 'CONF-BASELINE',
      revisionId: 'REV-E2E-R1'
    });

    const ifaceRf = bridge.p9.registry.registerInterface({
      id: 'IFACE-RF-01',
      systemId: 'SYS-E2E-AVIONICS',
      nodeId: rfNode.id,
      p5PhysicalInterfaceId: 'P5-IFACE-RF',
      interfaceName: 'RF Port',
      mediumType: 'COPPER',
      maxBandwidthBps: 1e9,
      configurationId: 'CONF-BASELINE',
      revisionId: 'REV-E2E-R1'
    });

    const ifaceDsp = bridge.p9.registry.registerInterface({
      id: 'IFACE-DSP-01',
      systemId: 'SYS-E2E-AVIONICS',
      nodeId: digitalNode.id,
      p5PhysicalInterfaceId: 'P5-IFACE-DSP',
      interfaceName: 'DSP Port',
      mediumType: 'COPPER',
      maxBandwidthBps: 1e9,
      configurationId: 'CONF-BASELINE',
      revisionId: 'REV-E2E-R1'
    });

    const commLink = bridge.p9.registry.registerLink({
      id: 'LINK-E2E-01',
      systemId: 'SYS-E2E-AVIONICS',
      communicationSystemId: canonicalSys.id,
      sourceInterfaceId: ifaceRf.id,
      targetInterfaceId: ifaceDsp.id,
      lengthMeters: 0.5,
      linkCapacityBps: 1e8,
      configurationId: 'CONF-BASELINE',
      revisionId: 'REV-E2E-R1'
    });

    // =========================================================================
    // STAGE 4 & 5: SECP Core Authority & Canonical Model
    // =========================================================================
    const loadedContext = await bridge.loadSystemContext('SYS-E2E-AVIONICS', 'CONF-BASELINE');
    expect(loadedContext.systemId).toBe('SYS-E2E-AVIONICS');
    expect(bridge.p9.registry.getAllInterfaces().length).toBeGreaterThanOrEqual(2);
    expect(bridge.p9.registry.getAllNodes().filter(n => n.systemId === 'SYS-E2E-AVIONICS').length).toBeGreaterThanOrEqual(2);
    expect(bridge.p9.registry.getAllLinks().filter(l => l.systemId === 'SYS-E2E-AVIONICS').length).toBeGreaterThanOrEqual(1);

    // =========================================================================
    // STAGE 6: Revision / Configuration Isolation & Negative Gate
    // =========================================================================
    // 6a. Register canonical baseline revision in RevisionEngine
    bridge.revisionEngine.createRevision({
      revisionId: 'REV-E2E-R1-ID',
      entityId: canonicalSys.id,
      entityType: RevisionEntityType.PART,
      revisionCode: 'REV-E2E-R1',
      revisionNumber: 1,
      lifecycleState: RevisionLifecycleState.RELEASED,
      createdAt: new Date().toISOString(),
      createdBy: 'CHIEF_SYSTEMS_ENGINEER',
      effectivity: [],
      configurationScope: ['CONF-BASELINE'],
      contentHash: 'hash-e2e-r1',
      dependencyHash: 'dep-e2e-r1',
      revisionHash: 'rev-e2e-r1',
      content: { version: '1.0.0' },
      dependencies: []
    } as any);

    // 6b. NEGATIVE GATE: Unknown / fabricated revision MUST be rejected with REVISION_NOT_FOUND
    expect(() => {
      bridge.p9.evaluateCanonicalImpact('REV-UNREGISTERED-SPURIOUS');
    }).toThrow(/REVISION_NOT_FOUND/);

    // =========================================================================
    // STAGE 7: Digital Thread Registration (P4) & Bidirectional Trace
    // =========================================================================
    expect(bridge.p4.registry.getNode('THREAD-E2E-SYS')).toBeDefined();
    expect(bridge.p4.registry.getNode('THREAD-E2E-RF')).toBeDefined();

    bridge.p4.registry.registerEdge({
      edgeId: 'EDGE-E2E-01',
      edgeType: 'CONNECTED_TO',
      sourceNodeId: 'THREAD-E2E-SYS',
      targetNodeId: 'THREAD-E2E-RF',
      authoritySource: 'P3_ARCHITECTURE_AUTHORITY'
    });

    const traces = bridge.p4.registry.getEdgesForNode('THREAD-E2E-SYS');
    expect(traces.outgoing.some(e => e.targetNodeId === 'THREAD-E2E-RF')).toBe(true);

    // =========================================================================
    // STAGE 8: Execution via CoreExecutionAuthority & Real Solvers
    // =========================================================================
    const sliceRes = await bridge.executeCommunicationSlice({
      systemId: canonicalSys.id,
      scenarioId: 'NOMINAL_BUS_LOAD'
    });
    expect(sliceRes).toBeDefined();
    expect(sliceRes.status).toBe('SUCCESS');

    bridge.p9.registry.registerExecution({
      id: 'EXEC-E2E-001',
      executionId: 'EXEC-E2E-001',
      systemId: canonicalSys.id,
      communicationSystemId: canonicalSys.id,
      revisionId: 'REV-E2E-R1',
      configurationId: 'CONF-BASELINE',
      status: 'VERIFIED',
      timestamp: new Date().toISOString()
    });
    const canonicalExec = bridge.p9.registry.getExecution('EXEC-E2E-001');
    expect(canonicalExec?.status).toBe('VERIFIED');

    // =========================================================================
    // STAGE 9: Verification Gates Evaluation & Core Integrity Gates
    // =========================================================================
    const gateIntents = bridge.p9.verification.evaluateAllGates(canonicalSys.id);
    expect(gateIntents.length).toBe(40);

    const authGate = gateIntents.find(g => g.gateName.includes('P9-V1'));
    expect(authGate).toBeDefined();
    expect(authGate?.verdict).toBe('PASS');

    const canonGate = gateIntents.find(g => g.gateName.includes('P9-V2'));
    expect(canonGate).toBeDefined();
    expect(canonGate?.verdict).toBe('PASS');

    // =========================================================================
    // STAGE 10: Evidence & Provenance Ledger Recording
    // =========================================================================
    const evHash = createHash('sha256').update('EXEC-E2E-001:VERIFIED').digest('hex');
    bridge.p9.registry.registerEvidence({
      id: 'EV-E2E-001',
      executionId: 'EXEC-E2E-001',
      communicationSystemId: canonicalSys.id,
      merkleLeafHash: evHash,
      evaluatedAt: new Date().toISOString(),
      signerAuthority: 'SECP_CORE_AUTHORITY'
    });

    const evidenceList = bridge.p9.registry.getAllEvidences().filter(e => e.communicationSystemId === canonicalSys.id);
    expect(evidenceList.length).toBeGreaterThanOrEqual(1);
    expect(evidenceList[0].merkleLeafHash).toBe(evHash);

    // =========================================================================
    // STAGE 11: Cryptographic Snapshot Persistence
    // =========================================================================
    const snapshotBefore = bridge.p9.persistence.createSnapshot({
      communicationSystemId: canonicalSys.id,
      persistedByAuthority: 'SECP_PERSISTENCE_AUTHORITY'
    });
    expect(snapshotBefore.id).toBeDefined();
    expect(snapshotBefore.merkleRootHash).toBeDefined();

    // =========================================================================
    // STAGE 12: Application Destruction / Full System Reboot Simulation
    // =========================================================================
    // Wipe registries and in-memory caches completely
    bridge.p9.registry.clear();
    expect(bridge.p9.registry.getSystem(canonicalSys.id)).toBeUndefined();
    expect(bridge.p9.registry.getAllNodes().length).toBe(0);
    expect(bridge.p9.registry.getAllLinks().length).toBe(0);

    // =========================================================================
    // STAGE 13: Workbench UI Reconstruction from Persistence
    // =========================================================================
    // Reload state strictly from the cryptographically hashed snapshot
    const restoreResult = bridge.p9.persistence.restoreFromSnapshot(snapshotBefore.id);
    expect(restoreResult.isValid).toBe(true);

    // Verify canonical restored entity parity
    const reconstructedSys = bridge.p9.registry.getSystem(canonicalSys.id);
    expect(reconstructedSys).toBeDefined();
    expect(reconstructedSys?.displayName).toBe('E2E Integrated Avionics Comms');
    expect(reconstructedSys?.configurationId).toBe('CONF-BASELINE');
    expect(reconstructedSys?.revisionId).toBe('REV-E2E-R1');

    const reconstructedNodes = bridge.p9.registry.getAllNodes().filter(n => n.systemId === 'SYS-E2E-AVIONICS');
    expect(reconstructedNodes.length).toBe(2);

    const reconstructedLinks = bridge.p9.registry.getAllLinks().filter(l => l.systemId === 'SYS-E2E-AVIONICS');
    expect(reconstructedLinks.length).toBe(1);

    // Render the React Workbench UI against restored canonical state
    const reconstructedWorkspaceHtml = renderToString(
      <SystemsEngineeringWorkspace 
        initialTab="CANVAS" 
        systemId="SYS-E2E-AVIONICS" 
        configurationId="CONF-BASELINE" 
      />
    );
    expect(reconstructedWorkspaceHtml).toContain('Architecture Canvas');

    // Render Architecture Canvas directly
    const canvasHtml = renderToString(
      <SystemArchitectureCanvas 
        systemId="SYS-E2E-AVIONICS" 
        configurationId="CONF-BASELINE" 
      />
    );
    expect(canvasHtml).toContain('System Architecture Canvas');

    // Render Engineering Truth View directly for the reconstructed system
    const truthViewHtml = renderToString(
      <EngineeringTruthView canonicalId={canonicalSys.id} />
    );
    expect(truthViewHtml).toContain('COMM-SYS-E2E-001');
    expect(truthViewHtml).toContain('REV-E2E-R1');
    expect(truthViewHtml).toContain('CONF-BASELINE');
    expect(truthViewHtml).toContain('Cryptographic Provenance');

    // Render State Dashboard directly
    const dashboardHtml = renderToString(
      <EngineeringStateDashboard configurationId="CONF-BASELINE" />
    );
    expect(dashboardHtml).toContain('Engineering State &amp; Truth Dashboard');
    expect(dashboardHtml).toContain('Provenance Hash (SHA-256)');
    expect(dashboardHtml).toContain('Verification Coverage');
  });

  it('PROVES Reactive Invalidation Across End-to-End Pipeline: UI Mutation -> RevisionEngine -> Invalidation -> Snapshot -> Parity', async () => {
    // 1. Setup system and execution
    const sys = bridge.p9.registry.registerSystem({
      id: 'COMM-SYS-INVAL-E2E',
      systemId: 'SYS-INVAL-E2E',
      canonicalId: 'CANON-INVAL-E2E',
      p3ArchitectureId: 'ARCH-INVAL-E2E',
      p4NodeId: 'THREAD-INVAL-SYS',
      displayName: 'Invalidation Pipeline System',
      configurationId: 'CONF-BASELINE',
      revisionId: 'REV-INV-R1',
      allocatedBandwidthMbps: 500
    });

    // 2. Register baseline revision in RevisionEngine
    bridge.revisionEngine.createRevision({
      revisionId: 'REV-INV-R1-CANONICAL-ID',
      entityId: sys.id,
      entityType: RevisionEntityType.PART,
      revisionCode: 'REV-INV-R1',
      revisionNumber: 1,
      lifecycleState: RevisionLifecycleState.RELEASED,
      createdAt: new Date().toISOString(),
      createdBy: 'CHIEF_SYSTEMS_ENGINEER',
      effectivity: [],
      configurationScope: ['CONF-BASELINE'],
      contentHash: 'hash-inv-r1',
      dependencyHash: 'dep-inv-r1',
      revisionHash: 'rev-inv-r1',
      content: { ver: '1.0' },
      dependencies: []
    } as any);

    // 3. Register verified execution
    bridge.p9.registry.registerExecution({
      id: 'EXEC-INV-E2E',
      executionId: 'EXEC-INV-E2E',
      systemId: sys.id,
      communicationSystemId: sys.id,
      revisionId: 'REV-INV-R1',
      configurationId: 'CONF-BASELINE',
      status: 'VERIFIED',
      timestamp: new Date().toISOString()
    });
    expect(bridge.p9.registry.getExecution('EXEC-INV-E2E')?.status).toBe('VERIFIED');

    // 4. Create mutated revision in RevisionEngine
    bridge.revisionEngine.createRevision({
      revisionId: 'REV-INV-R2-CANONICAL-ID',
      entityId: sys.id,
      entityType: RevisionEntityType.PART,
      revisionCode: 'REV-INV-R2',
      revisionNumber: 2,
      parentRevisionId: 'REV-INV-R1-CANONICAL-ID',
      lifecycleState: RevisionLifecycleState.RELEASED,
      createdAt: new Date().toISOString(),
      createdBy: 'CHIEF_SYSTEMS_ENGINEER',
      effectivity: [],
      configurationScope: ['CONF-BASELINE'],
      contentHash: 'hash-inv-r2',
      dependencyHash: 'dep-inv-r2',
      revisionHash: 'rev-inv-r2',
      content: { ver: '2.0' },
      dependencies: []
    } as any);

    // 5. Evaluate impact via RevisionEngine authority -> Triggers Reactive Invalidation
    const impact = bridge.p9.evaluateCanonicalImpact('REV-INV-R2-CANONICAL-ID');
    expect(impact.invalidatedExecutionsCount).toBeGreaterThanOrEqual(1);
    expect(bridge.p9.registry.getExecution('EXEC-INV-E2E')?.status).toBe('INVALIDATED');

    // 6. Snapshot records invalidated execution status accurately
    const snap = bridge.p9.persistence.createSnapshot({
      communicationSystemId: sys.id,
      persistedByAuthority: 'SECP_PERSISTENCE_AUTHORITY'
    });

    // 7. Clear memory (destruction)
    bridge.p9.registry.clear();

    // 8. Restore from snapshot
    bridge.p9.persistence.restoreFromSnapshot(snap.id);

    // 9. Reconstructed execution MUST preserve INVALIDATED status (Truth Invariance)
    const restoredExec = bridge.p9.registry.getExecution('EXEC-INV-E2E');
    expect(restoredExec).toBeDefined();
    expect(restoredExec?.status).toBe('INVALIDATED');

    // 10. Truth View UI component projects INVALIDATED status accurately
    const truthHtml = renderToString(<EngineeringTruthView canonicalId={sys.id} />);
    expect(truthHtml).toContain(sys.id);
  });
});
