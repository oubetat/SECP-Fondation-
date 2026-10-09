import { describe, it, expect } from 'vitest';
import { AssemblyConstraintGraph } from '../AssemblyConstraintGraph';
import { AssemblyConstraint } from '../AssemblyConstraintModel';

describe('AssemblyConstraintGraph', () => {
  const dummyRef = (compId: string) => ({
    componentId: compId,
    topologyType: 'FACE' as const,
    topologyIndex: 0,
    geometricSignature: 'sig',
  });

  const makeConstraint = (id: string, compA: string, compB: string, type: any, offset = 0): AssemblyConstraint => ({
    constraintId: id,
    assemblyId: 'ASSY-1',
    parentRevisionId: 'REV-0',
    componentA: compA,
    componentB: compB,
    geometryReferenceA: dummyRef(compA),
    geometryReferenceB: dummyRef(compB),
    constraintType: type,
    parameters: { offsetMm: offset },
    tolerance: 1e-4,
    suppressed: false,
    enabled: true,
    priority: 1,
    createdBy: 'test',
    createdAt: new Date().toISOString(),
  });

  it('TEST 10: should insert constraints and correctly detect redundancies', () => {
    const graph = new AssemblyConstraintGraph();
    const c1 = makeConstraint('C1', 'comp1', 'comp2', 'DISTANCE', 10);
    const c2 = makeConstraint('C2', 'comp1', 'comp2', 'DISTANCE', 10); // Redundant

    graph.addConstraint(c1);
    graph.addConstraint(c2);

    const redundancies = graph.detectRedundancies();
    expect(redundancies.length).toBe(1);
    expect(redundancies[0].constraintId).toBe('C2');
  });

  it('TEST 11: should identify conflicting constraints', () => {
    const graph = new AssemblyConstraintGraph();
    const c1 = makeConstraint('C1', 'comp1', 'comp2', 'DISTANCE', 10);
    const c2 = makeConstraint('C2', 'comp1', 'comp2', 'DISTANCE', 20); // Conflicting distance

    graph.addConstraint(c1);
    graph.addConstraint(c2);

    const conflict = graph.detectConflicts();
    expect(conflict).not.toBeNull();
    expect(conflict?.c1.constraintId).toBe('C1');
    expect(conflict?.c2.constraintId).toBe('C2');
  });

  it('should find connected component groups in assembly', () => {
    const graph = new AssemblyConstraintGraph();
    graph.addComponent('comp1');
    graph.addComponent('comp2');
    graph.addComponent('comp3');
    graph.addComponent('comp4');

    const c1 = makeConstraint('C1', 'comp1', 'comp2', 'COINCIDENT');
    const c2 = makeConstraint('C2', 'comp3', 'comp4', 'COINCIDENT');

    graph.addConstraint(c1);
    graph.addConstraint(c2);

    const groups = graph.findConnectedComponents();
    expect(groups.length).toBe(2);
  });
});
