/**
 * SECP — ADSE-P4 Digital Thread Persistence & Reconstruction Proof
 * Validates deterministic state capture, destruction, reload, and integrity verification.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP4DigitalThreadEngine } from '../../../src/engine/adse/p4/ADSEP4DigitalThreadEngine';

describe('ADSE-P4 Persistence & Reconstruction Proof', () => {
  let p4: ADSEP4DigitalThreadEngine;

  beforeEach(() => {
    p4 = ADSEP4DigitalThreadEngine.getInstance();
    p4.clear();
  });

  it('P4.PERSISTENCE: should snapshot, destroy in-memory state, and deterministically reconstruct', () => {
    // 1. Setup rich thread
    const req = p4.registry.registerNode({
      nodeId: 'node:req:PERSIST_REQ',
      nodeType: 'Requirement',
      canonicalId: 'REQ-PERSIST-01',
      authoritySource: 'P1_REQUIREMENT_AUTHORITY',
      displayName: 'Persistence Demonstration Requirement',
      configurationId: 'CONF-PERSIST'
    });

    const arch = p4.registry.registerNode({
      nodeId: 'node:arch:PERSIST_ARCH',
      nodeType: 'ArchitectureElement',
      canonicalId: 'ARCH-PERSIST-01',
      authoritySource: 'P3_ARCHITECTURE_AUTHORITY',
      displayName: 'Persisted Architecture Subsystem',
      configurationId: 'CONF-PERSIST'
    });

    const edge = p4.registry.registerEdge({
      edgeType: 'SATISFIES',
      sourceNodeId: arch.nodeId,
      targetNodeId: req.nodeId,
      authoritySource: 'P3_ARCHITECTURE_AUTHORITY',
      configurationId: 'CONF-PERSIST'
    });

    // 2. Snapshot
    const snapshot = p4.persistence.createSnapshot({
      configurationId: 'CONF-PERSIST',
      revisionId: 'REV-PERSIST-01',
      persistedByAuthority: 'SECP_STORAGE_LEDGER'
    });

    expect(snapshot.snapshotId).toBeDefined();
    expect(snapshot.merkleHash).toHaveLength(64);
    expect(snapshot.nodes.length).toBe(2);
    expect(snapshot.edges.length).toBe(1);

    // 3. Complete Destruction of in-memory maps
    p4.registry.clear();
    expect(p4.registry.getAllNodes().length).toBe(0);
    expect(p4.registry.getAllEdges().length).toBe(0);

    // 4. Deterministic Reconstruction from Snapshot
    const restoreResult = p4.persistence.restoreFromSnapshot(snapshot.snapshotId);
    expect(restoreResult.isValid).toBe(true);
    expect(restoreResult.restoredNodesCount).toBe(2);
    expect(restoreResult.restoredEdgesCount).toBe(1);

    // 5. Verification of restored state
    const restoredReq = p4.registry.getNode(req.nodeId);
    const restoredArch = p4.registry.getNode(arch.nodeId);
    const restoredEdge = p4.registry.getEdge(edge.edgeId);

    expect(restoredReq).toBeDefined();
    expect(restoredReq?.displayName).toBe('Persistence Demonstration Requirement');
    expect(restoredArch).toBeDefined();
    expect(restoredEdge).toBeDefined();
    expect(restoredEdge?.edgeType).toBe('SATISFIES');
  });
});
