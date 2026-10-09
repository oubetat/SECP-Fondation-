import { describe, it, expect, beforeEach } from 'vitest';
import {
  ParametricDependencyGraph,
  ParametricNode,
  ParametricEdge
} from '../ParametricDependencyGraph';

describe('ParametricDependencyGraph', () => {
  let graph: ParametricDependencyGraph;

  beforeEach(() => {
    graph = new ParametricDependencyGraph();
  });

  it('TEST 1: Create nodes and verify node count', () => {
    graph.addNode({ id: 'P1', type: 'PARAMETER' });
    graph.addNode({ id: 'F1', type: 'FEATURE' });
    expect(graph.snapshot().nodes.length).toBe(2);
  });

  it('TEST 2: Duplicate node rejection', () => {
    graph.addNode({ id: 'P1', type: 'PARAMETER' });
    expect(() => graph.addNode({ id: 'P1', type: 'FEATURE' })).toThrow();
  });

  it('TEST 3: Create dependencies and verify edge count', () => {
    graph.addNode({ id: 'P1', type: 'PARAMETER' });
    graph.addNode({ id: 'F1', type: 'FEATURE' });
    graph.addDependency('P1', 'F1', 'DRIVES');
    expect(graph.snapshot().edges.length).toBe(1);
  });

  it('TEST 4: Duplicate dependency detection', () => {
    graph.addNode({ id: 'P1', type: 'PARAMETER' });
    graph.addNode({ id: 'F1', type: 'FEATURE' });
    const e1 = graph.addDependency('P1', 'F1', 'DRIVES');
    const e2 = graph.addDependency('P1', 'F1', 'DRIVES');
    expect(e1).toBe(e2);
    expect(graph.snapshot().edges.length).toBe(1);
  });

  it('TEST 5: Missing node detection', () => {
    graph.addNode({ id: 'P1', type: 'PARAMETER' });
    graph.addDependency('P1', 'F1', 'DRIVES');
    const validation = graph.validate();
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.type === 'MISSING_NODE')).toBe(true);
  });

  it('TEST 6: Self dependency detection', () => {
    graph.addNode({ id: 'P1', type: 'PARAMETER' });
    graph.addDependency('P1', 'P1', 'DRIVES');
    const validation = graph.validate();
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.type === 'SELF_DEPENDENCY')).toBe(true);
  });

  it('TEST 7: Simple topological ordering', () => {
    graph.addNode({ id: 'P1', type: 'PARAMETER' });
    graph.addNode({ id: 'F1', type: 'FEATURE' });
    graph.addNode({ id: 'G1', type: 'GEOMETRY' });
    graph.addDependency('P1', 'F1', 'DRIVES');
    graph.addDependency('F1', 'G1', 'PRODUCES');
    const order = graph.topologicalOrder();
    expect(order).toEqual(['P1', 'F1', 'G1']);
  });

  it('TEST 8: Multi-branch graph', () => {
    graph.addNode({ id: 'P1', type: 'PARAMETER' });
    graph.addNode({ id: 'FA', type: 'FEATURE' });
    graph.addNode({ id: 'FB', type: 'FEATURE' });
    graph.addNode({ id: 'GA', type: 'GEOMETRY' });
    graph.addNode({ id: 'GB', type: 'GEOMETRY' });
    graph.addDependency('P1', 'FA', 'DRIVES');
    graph.addDependency('P1', 'FB', 'DRIVES');
    graph.addDependency('FA', 'GA', 'PRODUCES');
    graph.addDependency('FB', 'GB', 'PRODUCES');
    
    const roots = graph.getRoots();
    expect(roots).toEqual(['P1']);
    
    const leaves = graph.getLeaves();
    expect(leaves).toEqual(['GA', 'GB']); // alphabetical
  });

  it('TEST 9: Cycle detection', () => {
    graph.addNode({ id: 'A', type: 'FEATURE' });
    graph.addNode({ id: 'B', type: 'FEATURE' });
    graph.addNode({ id: 'C', type: 'FEATURE' });
    graph.addDependency('A', 'B', 'REFERENCES');
    graph.addDependency('B', 'C', 'REFERENCES');
    graph.addDependency('C', 'A', 'REFERENCES');
    
    const validation = graph.validate();
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.type === 'CYCLE')).toBe(true);
    expect(() => graph.topologicalOrder()).toThrow(/cycle/i);
  });

  it('TEST 10: Transitive dependency analysis', () => {
    graph.addNode({ id: 'A', type: 'FEATURE' });
    graph.addNode({ id: 'B', type: 'FEATURE' });
    graph.addNode({ id: 'C', type: 'FEATURE' });
    graph.addDependency('A', 'B', 'REFERENCES');
    graph.addDependency('B', 'C', 'REFERENCES');
    
    const deps = graph.getTransitiveDependencies('C');
    expect(deps).toEqual(['A', 'B']); // A and B are upstream
  });

  it('TEST 11: Transitive dependent analysis', () => {
    graph.addNode({ id: 'A', type: 'FEATURE' });
    graph.addNode({ id: 'B', type: 'FEATURE' });
    graph.addNode({ id: 'C', type: 'FEATURE' });
    graph.addDependency('A', 'B', 'REFERENCES');
    graph.addDependency('B', 'C', 'REFERENCES');
    
    const deps = graph.getTransitiveDependents('A');
    expect(deps).toEqual(['B', 'C']); // B and C are downstream
  });

  it('TEST 12: Parameter impact analysis', () => {
    graph.addNode({ id: 'P1', type: 'PARAMETER' });
    graph.addNode({ id: 'F1', type: 'FEATURE' });
    graph.addNode({ id: 'G1', type: 'GEOMETRY' });
    graph.addNode({ id: 'S1', type: 'SKETCH' });
    graph.addDependency('P1', 'S1', 'DRIVES');
    graph.addDependency('S1', 'F1', 'CONSUMES');
    graph.addDependency('F1', 'G1', 'PRODUCES');
    
    const impact = graph.getParameterImpact('P1');
    expect(impact).toEqual(['F1', 'G1']); // Excludes S1 because it's SKETCH
  });

  it('TEST 13: Insertion-order determinism', () => {
    const g1 = new ParametricDependencyGraph();
    g1.addNode({ id: 'A', type: 'FEATURE' });
    g1.addNode({ id: 'B', type: 'FEATURE' });
    g1.addDependency('A', 'B', 'REFERENCES');
    
    const g2 = new ParametricDependencyGraph();
    g2.addNode({ id: 'B', type: 'FEATURE' }); // Reversed
    g2.addNode({ id: 'A', type: 'FEATURE' });
    g2.addDependency('A', 'B', 'REFERENCES');
    
    expect(g1.snapshot()).toEqual(g2.snapshot());
  });

  it('TEST 14: Impact set determinism', () => {
    graph.addNode({ id: 'A', type: 'FEATURE' });
    graph.addNode({ id: 'B', type: 'FEATURE' });
    graph.addNode({ id: 'C', type: 'FEATURE' });
    graph.addDependency('A', 'C', 'REFERENCES');
    graph.addDependency('A', 'B', 'REFERENCES');
    
    const impact = graph.getImpactSet('A');
    expect(impact).toEqual(['B', 'C']); // deterministic sorting
  });

  it('TEST 15: Large graph sanity test', () => {
    for (let i = 0; i < 1000; i++) {
      graph.addNode({ id: `N${i}`, type: 'FEATURE' });
      if (i > 0) {
        graph.addDependency(`N${i-1}`, `N${i}`, 'REFERENCES');
      }
    }
    const validation = graph.validate();
    expect(validation.valid).toBe(true);
    
    const order = graph.topologicalOrder();
    expect(order.length).toBe(1000);
    expect(order[0]).toBe('N0');
  });
});

describe('ParametricDependencyGraph - Adversarial', () => {
  it('1. Duplicate node IDs', () => {
    const graph = new ParametricDependencyGraph();
    graph.addNode({ id: 'A', type: 'FEATURE' });
    expect(() => graph.addNode({ id: 'A', type: 'FEATURE' })).toThrow();
  });

  it('4. Two-node cycle', () => {
    const graph = new ParametricDependencyGraph();
    graph.addNode({ id: 'A', type: 'FEATURE' });
    graph.addNode({ id: 'B', type: 'FEATURE' });
    graph.addDependency('A', 'B', 'REFERENCES');
    graph.addDependency('B', 'A', 'REFERENCES');
    const v = graph.validate();
    expect(v.valid).toBe(false);
    expect(v.errors.some(e => e.type === 'CYCLE')).toBe(true);
  });

  it('5. Large cycle', () => {
    const graph = new ParametricDependencyGraph();
    for (let i = 0; i < 100; i++) {
      graph.addNode({ id: `N${i}`, type: 'FEATURE' });
      graph.addDependency(`N${i}`, `N${(i + 1) % 100}`, 'REFERENCES');
    }
    const v = graph.validate();
    expect(v.valid).toBe(false);
  });

  it('7. Disconnected graph', () => {
    const graph = new ParametricDependencyGraph();
    graph.addNode({ id: 'A', type: 'FEATURE' });
    graph.addNode({ id: 'B', type: 'FEATURE' });
    const v = graph.validate();
    expect(v.valid).toBe(true);
    expect(graph.getRoots()).toEqual(['A', 'B']);
  });
});
