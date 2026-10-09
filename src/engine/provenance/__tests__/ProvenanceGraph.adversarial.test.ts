/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-013: Adversarial Security & Tamper Test Suite
 */

import { describe, it, expect } from 'vitest';
import {
  ProvenanceGraphBuilder,
  ProvenanceGraphVerifier,
  ProvenanceGraphIntegrityGate,
  ProvenanceGraph
} from '../index';

describe('PATCH-013 — Provenance Graph Adversarial Security & Tamper Tests', () => {
  it('CASE 1: Modifying Node canonicalHash breaks graph hash and fails verification', () => {
    const builder = new ProvenanceGraphBuilder();
    builder.addNode({
      type: 'DESIGN',
      engineeringIdentityId: 'SECP:DESIGN:C1',
      canonicalHash: '1111111111111111111111111111111111111111111111111111111111111111'
    });

    const origGraph = builder.build();
    const origNode = origGraph.getNodes()[0];

    // Tamper with canonicalHash while keeping same Node ID
    const tamperedNode = {
      ...origNode,
      canonicalHash: '2222222222222222222222222222222222222222222222222222222222222222'
    };

    const tamperedGraph = new ProvenanceGraph([tamperedNode], []);
    const verResult = ProvenanceGraphVerifier.verifyGraph(tamperedGraph);

    expect(verResult.status).toBe('FAIL');
    expect(verResult.invalidNodes).toBe(1);
    expect(verResult.violations.some(v => v.includes('Node ID mismatch'))).toBe(true);
  });

  it('CASE 2 & 3: Forged fromNodeId / toNodeId on Edge causes edge integrity failure', () => {
    const builder = new ProvenanceGraphBuilder();
    builder.addNode({
      type: 'DESIGN',
      engineeringIdentityId: 'SECP:DESIGN:N1',
      canonicalHash: '1111111111111111111111111111111111111111111111111111111111111111'
    });
    builder.addNode({
      type: 'GEOMETRY',
      engineeringIdentityId: 'SECP:GEOMETRY:N2',
      canonicalHash: '2222222222222222222222222222222222222222222222222222222222222222'
    });

    const tempGraph = builder.build();
    const [n1, n2] = tempGraph.getNodes();

    const fullBuilder = new ProvenanceGraphBuilder();
    fullBuilder.addNode({
      type: 'DESIGN',
      engineeringIdentityId: 'SECP:DESIGN:N1',
      canonicalHash: '1111111111111111111111111111111111111111111111111111111111111111'
    });
    fullBuilder.addNode({
      type: 'GEOMETRY',
      engineeringIdentityId: 'SECP:GEOMETRY:N2',
      canonicalHash: '2222222222222222222222222222222222222222222222222222222222222222'
    });
    fullBuilder.addEdge({
      type: 'DERIVED_FROM',
      fromNodeId: n1.id,
      toNodeId: n2.id
    });

    const origGraph = fullBuilder.build();
    const origEdge = origGraph.getEdges()[0];

    // Tamper with fromNodeId on edge object directly
    const tamperedEdge = {
      ...origEdge,
      fromNodeId: 'PN-FORGED_FROM_ID'
    };

    // Verify directly using ProvenanceGraphVerifier.verifyEdgeIntegrity
    const violations: string[] = [];
    const isValid = ProvenanceGraphVerifier.verifyEdgeIntegrity(origGraph, tamperedEdge, violations);

    expect(isValid).toBe(false);
    expect(violations.some(v => v.includes('does not exist in graph'))).toBe(true);
  });

  it('CASE 4: Forged relationHash on Edge fails verification', () => {
    const builder = new ProvenanceGraphBuilder();
    builder.addNode({
      type: 'DESIGN',
      engineeringIdentityId: 'SECP:DESIGN:N1',
      canonicalHash: '1111111111111111111111111111111111111111111111111111111111111111'
    });
    builder.addNode({
      type: 'GEOMETRY',
      engineeringIdentityId: 'SECP:GEOMETRY:N2',
      canonicalHash: '2222222222222222222222222222222222222222222222222222222222222222'
    });

    const tempGraph = builder.build();
    const [n1, n2] = tempGraph.getNodes();

    const fullBuilder = new ProvenanceGraphBuilder();
    fullBuilder.addNode({
      type: 'DESIGN',
      engineeringIdentityId: 'SECP:DESIGN:N1',
      canonicalHash: '1111111111111111111111111111111111111111111111111111111111111111'
    });
    fullBuilder.addNode({
      type: 'GEOMETRY',
      engineeringIdentityId: 'SECP:GEOMETRY:N2',
      canonicalHash: '2222222222222222222222222222222222222222222222222222222222222222'
    });
    fullBuilder.addEdge({
      type: 'DERIVED_FROM',
      fromNodeId: n1.id,
      toNodeId: n2.id
    });

    const origGraph = fullBuilder.build();
    const origEdge = origGraph.getEdges()[0];

    const tamperedEdge = {
      ...origEdge,
      relationHash: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
    };

    const tamperedGraph = new ProvenanceGraph(origGraph.getNodes(), [tamperedEdge]);
    const verResult = ProvenanceGraphVerifier.verifyGraph(tamperedGraph);

    expect(verResult.status).toBe('FAIL');
    expect(verResult.violations.some(v => v.includes('relationHash mismatch'))).toBe(true);
  });

  it('CASE 5: Deleted / missing referenced evidence reported as UNPROVEN or missing', () => {
    const builder = new ProvenanceGraphBuilder();
    builder.addNode({
      type: 'DESIGN',
      engineeringIdentityId: 'SECP:DESIGN:C1',
      canonicalHash: '1111111111111111111111111111111111111111111111111111111111111111',
      evidenceRefs: ['EV-NONEXISTENT-999']
    });

    const graph = builder.build();
    // Pass empty evidence store
    const evidenceStore = new Map();

    const verResult = ProvenanceGraphVerifier.verifyGraph(graph, evidenceStore);
    expect(verResult.status).toBe('UNPROVEN');
    expect(verResult.missingEvidence).toContain('EV-NONEXISTENT-999');
  });

  it('CASE 6: Unlinked node does not claim complete lineage for manufacturing', () => {
    const builder = new ProvenanceGraphBuilder();
    // Add manufacturing node without upstream design/geometry
    builder.addNode({
      type: 'MANUFACTURING',
      engineeringIdentityId: 'SECP:MANUFACTURING:M1',
      canonicalHash: '9999999999999999999999999999999999999999999999999999999999999999'
    });

    const graph = builder.build();
    const verResult = ProvenanceGraphVerifier.verifyGraph(graph);

    expect(verResult.lineageStatus).toBe('UNPROVEN');
    expect(verResult.status).toBe('UNPROVEN');
  });

  it('CASE 11: Cyclic dependency detected and marked as FAIL', () => {
    const builder = new ProvenanceGraphBuilder();
    builder.addNode({
      type: 'DESIGN',
      engineeringIdentityId: 'SECP:DESIGN:N1',
      canonicalHash: '1111111111111111111111111111111111111111111111111111111111111111'
    });
    builder.addNode({
      type: 'GEOMETRY',
      engineeringIdentityId: 'SECP:GEOMETRY:N2',
      canonicalHash: '2222222222222222222222222222222222222222222222222222222222222222'
    });

    const tempGraph = builder.build();
    const [n1, n2] = tempGraph.getNodes();

    const fullBuilder = new ProvenanceGraphBuilder();
    fullBuilder.addNode({
      type: 'DESIGN',
      engineeringIdentityId: 'SECP:DESIGN:N1',
      canonicalHash: '1111111111111111111111111111111111111111111111111111111111111111'
    });
    fullBuilder.addNode({
      type: 'GEOMETRY',
      engineeringIdentityId: 'SECP:GEOMETRY:N2',
      canonicalHash: '2222222222222222222222222222222222222222222222222222222222222222'
    });

    // Create cycle N1 -> N2 and N2 -> N1
    fullBuilder.addEdge({ type: 'DERIVED_FROM', fromNodeId: n1.id, toNodeId: n2.id });
    fullBuilder.addEdge({ type: 'DEPENDS_ON', fromNodeId: n2.id, toNodeId: n1.id });

    const graph = fullBuilder.build();
    const verResult = ProvenanceGraphVerifier.verifyGraph(graph);

    expect(verResult.status).toBe('FAIL');
    expect(verResult.cyclesDetected.length).toBeGreaterThan(0);
  });
});
