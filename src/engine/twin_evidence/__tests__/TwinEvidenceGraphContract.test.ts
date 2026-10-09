import { describe, it, expect } from 'vitest';
import { TwinEvidenceGraphEngine } from '../TwinEvidenceGraphEngine';

describe('TwinEvidenceGraph Canonical Contract Verification', () => {
  it('allows constructing a "VERIFIES" edge through the canonical API', () => {
    const engine = new TwinEvidenceGraphEngine('TEST-TWIN');
    
    engine.addNode('N1', 'MODEL', 'M1', 'v1', 'SOURCE', '2026-01-01T00:00:00Z');
    engine.addNode('N2', 'VERIFICATION_RESULT', 'V1', 'v1', 'SOURCE', '2026-01-01T00:00:00Z');
    
    // This should now compile and run without type errors
    const edge = engine.addEdge('E1', 'N2', 'N1', 'VERIFIES');
    
    expect(edge.edgeType).toBe('VERIFIES');
    expect(engine.graph.edges.get('E1')).toBeDefined();
    expect(engine.graph.edges.get('E1')?.edgeType).toBe('VERIFIES');
  });

  it('preserves source/target direction for "VERIFIES" relation', () => {
    const engine = new TwinEvidenceGraphEngine('TEST-TWIN');
    engine.addNode('VERIFIER', 'VERIFICATION_RESULT', 'V1', 'v1', 'SOURCE', '2026-01-01T00:00:00Z');
    engine.addNode('SUBJECT', 'MODEL', 'M1', 'v1', 'SOURCE', '2026-01-01T00:00:00Z');
    
    engine.addEdge('E-VERIF', 'VERIFIER', 'SUBJECT', 'VERIFIES');
    
    const edge = engine.graph.edges.get('E-VERIF');
    expect(edge?.fromNodeId).toBe('VERIFIER');
    expect(edge?.toNodeId).toBe('SUBJECT');
  });

  it('participates in canonical graph Merkle identity correctly', () => {
    const engine = new TwinEvidenceGraphEngine('TEST-TWIN');
    engine.addNode('N1', 'MODEL', 'M1', 'v1', 'SOURCE', '2026-01-01T00:00:00Z');
    engine.addNode('N2', 'VERIFICATION_RESULT', 'V1', 'v1', 'SOURCE', '2026-01-01T00:00:00Z');
    
    const initialRoot = engine.graph.rootHash;
    engine.addEdge('E1', 'N2', 'N1', 'VERIFIES');
    
    const postEdgeRoot = engine.graph.rootHash;
    expect(postEdgeRoot).not.toBe(initialRoot);
    expect(postEdgeRoot.length).toBe(64);
  });
});
