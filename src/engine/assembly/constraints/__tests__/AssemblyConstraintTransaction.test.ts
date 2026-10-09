import { describe, it, expect } from 'vitest';
import { AssemblyConstraintState } from '../AssemblyConstraintState';
import { AssemblyConstraintTransaction } from '../AssemblyConstraintTransaction';
import { AssemblyComponentPose, AssemblyConstraint } from '../AssemblyConstraintModel';

describe('AssemblyConstraintTransaction', () => {
  const defaultPose = (id: string, px = 0): AssemblyComponentPose => ({
    instanceId: id,
    position: { x: px, y: 0, z: 0 },
    orientation: { x: 0, y: 0, z: 0 },
    transform: [
      [1, 0, 0, px],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ],
    degreesOfFreedom: {
      initialDOF: 6,
      remainingDOF: 6,
      constrainedDOF: 0,
      redundantDOF: 0,
      conflictingDOF: 0,
      unconstrainedDirections: ['tx', 'ty', 'tz', 'rx', 'ry', 'rz'],
    },
  });

  const dummyRef = (compId: string) => ({
    componentId: compId,
    topologyType: 'FACE' as const,
    topologyIndex: 0,
    geometricSignature: 'sig',
    cachedPoint: { x: 0, y: 0, z: 0 },
    cachedNormal: { x: 0, y: 0, z: 1 },
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

  it('TEST 13: should rollback state completely on solver failure without committing partial state changes', () => {
    const state = new AssemblyConstraintState('ASSY-1', 'REV-0');
    const compA = defaultPose('comp1', 0);
    const compB = defaultPose('comp2', 10);

    state.addComponent(compA);
    state.addComponent(compB);
    state.setGroundedComponent('comp1');

    // Add conflicting constraints: distance 10 and distance 20 on same reference
    const c1 = makeConstraint('C1', 'comp1', 'comp2', 'DISTANCE', 10);
    const c2 = makeConstraint('C2', 'comp1', 'comp2', 'DISTANCE', 20);

    state.addConstraint(c1);
    state.addConstraint(c2);

    const tx = new AssemblyConstraintTransaction(state);
    tx.begin();

    const result = tx.solve();

    expect(result.status).toBe('CONFLICT');
    // Verify that active state is rolled back and position is unchanged
    const currentA = tx.getActiveState().getComponent('comp1')!;
    const currentB = tx.getActiveState().getComponent('comp2')!;

    expect(currentA.position.x).toBe(0);
    expect(currentB.position.x).toBe(10);
  });

  it('TEST 17 & 18: should generate revision lineages and generate Engineering Evidence on success', () => {
    const state = new AssemblyConstraintState('ASSY-1', 'REV-0');
    const compA = defaultPose('comp1', 0);
    const compB = defaultPose('comp2', 12);

    state.addComponent(compA);
    state.addComponent(compB);
    state.setGroundedComponent('comp1');

    const c1 = makeConstraint('C1', 'comp1', 'comp2', 'DISTANCE', 10);
    state.addConstraint(c1);

    const tx = new AssemblyConstraintTransaction(state);
    tx.begin();

    const result = tx.solve();
    expect(result.status).toBe('CONVERGED_WITH_REMAINING_DOF');

    const revision = tx.commit(result);

    // TEST 17: Lineage check
    expect(revision.parentRevisionId).toBe('REV-0');
    expect(revision.revisionId).not.toBe('REV-0');
    expect(revision.solverStatus).toBe('CONVERGED_WITH_REMAINING_DOF');

    // TEST 18: Evidence existence check
    expect(revision.evidenceId).toBeDefined();
    expect(revision.evidenceId.startsWith('EVI-')).toBe(true);
  });
});
