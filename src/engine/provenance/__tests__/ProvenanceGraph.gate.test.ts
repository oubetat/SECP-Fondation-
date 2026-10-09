/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-013: Provenance Graph Integrity Gate Test File
 */

import { describe, it, expect } from 'vitest';
import {
  ProvenanceGraphBuilder,
  ProvenanceGraphIntegrityGate
} from '../index';

describe('PATCH-013 — Acceptance Gate Test Suite', () => {
  it('Evaluates Gate for valid provenance graph and outputs real report', () => {
    const builder = new ProvenanceGraphBuilder();
    builder.addNode({
      type: 'DESIGN',
      engineeringIdentityId: 'SECP:DESIGN:BRACKET-001',
      canonicalHash: '1111111111111111111111111111111111111111111111111111111111111111',
      version: '1.0.0'
    });
    builder.addNode({
      type: 'GEOMETRY',
      engineeringIdentityId: 'SECP:GEOMETRY:BRACKET-GEO-1',
      canonicalHash: '2222222222222222222222222222222222222222222222222222222222222222',
      version: '1.0.0'
    });

    const tempGraph = builder.build();
    const [node1, node2] = tempGraph.getNodes();

    const fullBuilder = new ProvenanceGraphBuilder();
    fullBuilder.addNode({
      type: 'DESIGN',
      engineeringIdentityId: 'SECP:DESIGN:BRACKET-001',
      canonicalHash: '1111111111111111111111111111111111111111111111111111111111111111',
      version: '1.0.0'
    });
    fullBuilder.addNode({
      type: 'GEOMETRY',
      engineeringIdentityId: 'SECP:GEOMETRY:BRACKET-GEO-1',
      canonicalHash: '2222222222222222222222222222222222222222222222222222222222222222',
      version: '1.0.0'
    });
    fullBuilder.addEdge({
      type: 'DERIVED_FROM',
      fromNodeId: node1.id,
      toNodeId: node2.id
    });

    const graph = fullBuilder.build();
    const result = ProvenanceGraphIntegrityGate.evaluateGate(graph);

    expect(result.passed).toBe(true);
    expect(result.verificationResult.status).toBe('PASS');
    expect(result.evidenceReport.patchId).toBe('PATCH-013');
    expect(result.evidenceReport.artifactType).toBe('PROVENANCE_GRAPH');
    expect(result.evidenceReport.nodeCount).toBe(2);
    expect(result.evidenceReport.edgeCount).toBe(1);
    expect(result.evidenceReport.graphHash).toBeDefined();
  });
});
