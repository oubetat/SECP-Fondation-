/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-013: Unit Test Suite for Provenance Graph
 */

import { describe, it, expect } from 'vitest';
import {
  ProvenanceGraph,
  ProvenanceGraphBuilder,
  ProvenanceGraphVerifier,
  ProvenanceGraphSerializer,
  ProvenanceGraphIntegrityGate,
  DuplicateNodeError,
  MissingNodeError,
  InvalidSelfLoopError
} from '../index';

describe('PATCH-013 — Provenance Graph Core Tests', () => {
  it('1. Node creation and deterministic identity', () => {
    const builder = new ProvenanceGraphBuilder();
    builder.addNode({
      type: 'DESIGN',
      engineeringIdentityId: 'SECP:DESIGN:BRACKET-001',
      canonicalHash: 'a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890',
      version: '1.0.0'
    });

    const graph = builder.build();
    expect(graph.nodeCount).toBe(1);

    const node = graph.getNodes()[0];
    expect(node.type).toBe('DESIGN');
    expect(node.engineeringIdentityId).toBe('SECP:DESIGN:BRACKET-001');
    expect(node.id).toBeDefined();
    expect(node.id.startsWith('PN-')).toBe(true);
  });

  it('2. Prevent duplicate nodes with same canonical identity', () => {
    const builder = new ProvenanceGraphBuilder();
    builder.addNode({
      type: 'GEOMETRY',
      engineeringIdentityId: 'SECP:GEOMETRY:BRACKET-GEO-1',
      canonicalHash: '1111111111111111111111111111111111111111111111111111111111111111',
      version: '1.0.0'
    });

    expect(() => {
      // Add exact duplicate
      builder.addNode({
        type: 'GEOMETRY',
        engineeringIdentityId: 'SECP:GEOMETRY:BRACKET-GEO-1',
        canonicalHash: '1111111111111111111111111111111111111111111111111111111111111111',
        version: '1.0.0'
      });
      builder.build();
    }).toThrow(DuplicateNodeError);
  });

  it('3. Edge creation and connecting nodes', () => {
    const builder = new ProvenanceGraphBuilder();
    builder.addNode({
      type: 'DESIGN',
      engineeringIdentityId: 'SECP:DESIGN:CAD-1',
      canonicalHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    });
    builder.addNode({
      type: 'GEOMETRY',
      engineeringIdentityId: 'SECP:GEOMETRY:GEO-1',
      canonicalHash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    });

    const nodes = builder.build().getNodes();
    const fromId = nodes[0].id;
    const toId = nodes[1].id;

    const builder2 = new ProvenanceGraphBuilder();
    builder2.addNode({
      type: 'DESIGN',
      engineeringIdentityId: 'SECP:DESIGN:CAD-1',
      canonicalHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    });
    builder2.addNode({
      type: 'GEOMETRY',
      engineeringIdentityId: 'SECP:GEOMETRY:GEO-1',
      canonicalHash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    });
    builder2.addEdge({
      type: 'DERIVED_FROM',
      fromNodeId: fromId,
      toNodeId: toId
    });

    const graph = builder2.build();
    expect(graph.edgeCount).toBe(1);
    expect(graph.getEdges()[0].type).toBe('DERIVED_FROM');
  });

  it('4. Rejection of invalid edge to non-existent node', () => {
    const builder = new ProvenanceGraphBuilder();
    builder.addNode({
      type: 'DESIGN',
      engineeringIdentityId: 'SECP:DESIGN:CAD-1',
      canonicalHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    });

    const nodes = builder.build().getNodes();
    const fromId = nodes[0].id;

    builder.addEdge({
      type: 'DERIVED_FROM',
      fromNodeId: fromId,
      toNodeId: 'PN-NONEXISTENT'
    });

    expect(() => {
      builder.build();
    }).toThrow(MissingNodeError);
  });

  it('5. Rejection of forbidden self-loop edge', () => {
    const builder = new ProvenanceGraphBuilder();
    builder.addNode({
      type: 'DESIGN',
      engineeringIdentityId: 'SECP:DESIGN:CAD-1',
      canonicalHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    });

    const nodes = builder.build().getNodes();
    const fromId = nodes[0].id;

    builder.addEdge({
      type: 'DERIVED_FROM',
      fromNodeId: fromId,
      toNodeId: fromId
    });

    expect(() => {
      builder.build();
    }).toThrow(InvalidSelfLoopError);
  });

  it('6. Deterministic Graph Canonical Hash independent of insertion order', () => {
    // Build Graph A
    const bA = new ProvenanceGraphBuilder();
    bA.addNode({
      type: 'DESIGN',
      engineeringIdentityId: 'SECP:DESIGN:CAD-1',
      canonicalHash: '1111111111111111111111111111111111111111111111111111111111111111',
      version: '1.0.0',
      createdAt: '2026-08-18T00:00:00Z'
    });
    bA.addNode({
      type: 'GEOMETRY',
      engineeringIdentityId: 'SECP:GEOMETRY:GEO-1',
      canonicalHash: '2222222222222222222222222222222222222222222222222222222222222222',
      version: '1.0.0',
      createdAt: '2026-08-18T00:00:00Z'
    });

    const graphA = bA.build();

    // Build Graph B (inserted in reverse order)
    const bB = new ProvenanceGraphBuilder();
    bB.addNode({
      type: 'GEOMETRY',
      engineeringIdentityId: 'SECP:GEOMETRY:GEO-1',
      canonicalHash: '2222222222222222222222222222222222222222222222222222222222222222',
      version: '1.0.0',
      createdAt: '2026-08-18T00:00:00Z'
    });
    bB.addNode({
      type: 'DESIGN',
      engineeringIdentityId: 'SECP:DESIGN:CAD-1',
      canonicalHash: '1111111111111111111111111111111111111111111111111111111111111111',
      version: '1.0.0',
      createdAt: '2026-08-18T00:00:00Z'
    });

    const graphB = bB.build();

    expect(graphA.getGraphHash()).toBe(graphB.getGraphHash());
  });

  it('7. Ancestor and Descendant Traversal', () => {
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
    builder.addNode({
      type: 'MESH',
      engineeringIdentityId: 'SECP:MESH:N3',
      canonicalHash: '3333333333333333333333333333333333333333333333333333333333333333'
    });

    const tempGraph = builder.build();
    const nodes = tempGraph.getNodes();
    const [n1, n2, n3] = nodes;

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
    fullBuilder.addNode({
      type: 'MESH',
      engineeringIdentityId: 'SECP:MESH:N3',
      canonicalHash: '3333333333333333333333333333333333333333333333333333333333333333'
    });

    fullBuilder.addEdge({ type: 'DERIVED_FROM', fromNodeId: n1.id, toNodeId: n2.id });
    fullBuilder.addEdge({ type: 'GENERATED_FROM', fromNodeId: n2.id, toNodeId: n3.id });

    const graph = fullBuilder.build();

    const n3Ancestors = graph.getAncestors(n3.id);
    expect(n3Ancestors.length).toBe(2);

    const n1Descendants = graph.getDescendants(n1.id);
    expect(n1Descendants.length).toBe(2);
  });

  it('8. Impact Analysis correctly identifies downstream affected nodes', () => {
    const builder = new ProvenanceGraphBuilder();
    builder.addNode({
      type: 'GEOMETRY',
      engineeringIdentityId: 'SECP:GEOMETRY:ROOT',
      canonicalHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    });
    builder.addNode({
      type: 'MESH',
      engineeringIdentityId: 'SECP:MESH:CHILD1',
      canonicalHash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    });
    builder.addNode({
      type: 'SIMULATION',
      engineeringIdentityId: 'SECP:SIMULATION:CHILD2',
      canonicalHash: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
    });

    const tempGraph = builder.build();
    const [root, child1, child2] = tempGraph.getNodes();

    const fullBuilder = new ProvenanceGraphBuilder();
    fullBuilder.addNode({
      type: 'GEOMETRY',
      engineeringIdentityId: 'SECP:GEOMETRY:ROOT',
      canonicalHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    });
    fullBuilder.addNode({
      type: 'MESH',
      engineeringIdentityId: 'SECP:MESH:CHILD1',
      canonicalHash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    });
    fullBuilder.addNode({
      type: 'SIMULATION',
      engineeringIdentityId: 'SECP:SIMULATION:CHILD2',
      canonicalHash: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
    });

    fullBuilder.addEdge({ type: 'GENERATED_FROM', fromNodeId: root.id, toNodeId: child1.id });
    fullBuilder.addEdge({ type: 'USES', fromNodeId: child1.id, toNodeId: child2.id });

    const graph = fullBuilder.build();
    const impact = graph.getImpactSet(root.id);

    expect(impact.affectedNodeIds.length).toBe(2);
    expect(impact.affectedNodeIds).toContain(child1.id);
    expect(impact.affectedNodeIds).toContain(child2.id);
  });

  it('9. Serialization round trip preserves equivalence', () => {
    const builder = new ProvenanceGraphBuilder();
    builder.addNode({
      type: 'DESIGN',
      engineeringIdentityId: 'SECP:DESIGN:C1',
      canonicalHash: '1111111111111111111111111111111111111111111111111111111111111111'
    });

    const graph = builder.build();
    const serialized = ProvenanceGraphIntegrityGate.serializeGraph(graph);
    const deserialized = ProvenanceGraphIntegrityGate.deserializeGraph(serialized);

    expect(deserialized.getGraphHash()).toBe(graph.getGraphHash());
    expect(deserialized.nodeCount).toBe(graph.nodeCount);
  });
});
