import { describe, it, expect } from 'vitest';
import { AssemblyConstraintState } from '../AssemblyConstraintState';
import { AssemblyConstraintSolver } from '../AssemblyConstraintSolver';
import { AssemblyComponentPose, AssemblyConstraint } from '../AssemblyConstraintModel';
import { AssemblySolverDiagnostics } from '../AssemblySolverDiagnostics';
import { AssemblyConstraintValidator } from '../AssemblyConstraintValidator';

describe('AssemblyConstraintSolver', () => {
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

  const makeConstraint = (id: string, compA: string, compB: string, type: any, offset = 0, angle = 0): AssemblyConstraint => ({
    constraintId: id,
    assemblyId: 'ASSY-1',
    parentRevisionId: 'REV-0',
    componentA: compA,
    componentB: compB,
    geometryReferenceA: dummyRef(compA),
    geometryReferenceB: dummyRef(compB),
    constraintType: type,
    parameters: { offsetMm: offset, angleDeg: angle },
    tolerance: 1e-4,
    suppressed: false,
    enabled: true,
    priority: 1,
    createdBy: 'test',
    createdAt: new Date().toISOString(),
  });

  it('TEST 01 & 09: should verify 6 DOF for a free component and under-constrained assembly status', () => {
    const state = new AssemblyConstraintState('ASSY-1', 'REV-0');
    const compA = defaultPose('comp1', 0);
    const compB = defaultPose('comp2', 10);

    state.addComponent(compA);
    state.addComponent(compB);
    state.setGroundedComponent('comp1');

    // Calculate DOF
    const dofResult = AssemblySolverDiagnostics.analyzeDegreesOfFreedom(
      state.getAllComponents(),
      [],
      state.getGroundedComponent()
    );

    // comp1 is grounded -> 0 remaining DOF
    expect(dofResult.componentDOFs['comp1'].remainingDOF).toBe(0);
    // comp2 is free -> 6 remaining DOF
    expect(dofResult.componentDOFs['comp2'].remainingDOF).toBe(6);
    expect(dofResult.totalAssemblyDOF).toBe(6);

    // Solve empty constraints -> Converged with remaining DOF
    const result = AssemblyConstraintSolver.solve(state);
    expect(result.status).toBe('CONVERGED_WITH_REMAINING_DOF');
    expect(result.totalAssemblyDOF).toBe(6);
  });

  it('TEST 02: should verify FIXED constraint behavior locks all DOF', () => {
    const state = new AssemblyConstraintState('ASSY-1', 'REV-0');
    const compA = defaultPose('comp1', 0);
    const compB = defaultPose('comp2', 10);

    state.addComponent(compA);
    state.addComponent(compB);
    state.setGroundedComponent('comp1');

    const fc = makeConstraint('C1', 'comp1', 'comp2', 'FIXED');
    state.addConstraint(fc);

    const result = AssemblyConstraintSolver.solve(state);
    expect(result.status).toBe('CONVERGED');
    expect(result.totalAssemblyDOF).toBe(0);
    
    // comp2 pose should match grounded comp1 pose
    expect(result.solvedPoses['comp2'].position.x).toBe(0);
  });

  it('TEST 03: should solve COINCIDENT (planar mate) constraints', () => {
    const state = new AssemblyConstraintState('ASSY-1', 'REV-0');
    const compA = defaultPose('comp1', 0);
    const compB = defaultPose('comp2', 10);

    state.addComponent(compA);
    state.addComponent(compB);
    state.setGroundedComponent('comp1');

    const cc = makeConstraint('C1', 'comp1', 'comp2', 'COINCIDENT');
    state.addConstraint(cc);

    const result = AssemblyConstraintSolver.solve(state);
    expect(result.status).toBe('CONVERGED_WITH_REMAINING_DOF');
    
    // Position check (along Normal z alignment): z should match
    expect(result.solvedPoses['comp2'].position.z).toBeCloseTo(0, 4);
    expect(result.solvedPoses['comp2'].degreesOfFreedom.remainingDOF).toBe(3); // locks tz, rx, ry
  });

  it('TEST 04: should solve CONCENTRIC constraints', () => {
    const state = new AssemblyConstraintState('ASSY-1', 'REV-0');
    const compA = defaultPose('comp1', 0);
    const compB = defaultPose('comp2', 10);

    state.addComponent(compA);
    state.addComponent(compB);
    state.setGroundedComponent('comp1');

    const conc = makeConstraint('C1', 'comp1', 'comp2', 'CONCENTRIC');
    state.addConstraint(conc);

    const result = AssemblyConstraintSolver.solve(state);
    expect(result.status).toBe('CONVERGED_WITH_REMAINING_DOF');
    
    // locks radial tx, ty, and tilt rx, ry -> tz and rz remain free (2 DOF remaining)
    expect(result.solvedPoses['comp2'].position.x).toBeCloseTo(0, 3);
    expect(result.solvedPoses['comp2'].position.y).toBeCloseTo(0, 3);
    expect(result.solvedPoses['comp2'].degreesOfFreedom.remainingDOF).toBe(2);
  });

  it('TEST 05: should solve DISTANCE constraints with non-zero values', () => {
    const state = new AssemblyConstraintState('ASSY-1', 'REV-0');
    const compA = defaultPose('comp1', 0);
    const compB = defaultPose('comp2', 10);

    state.addComponent(compA);
    state.addComponent(compB);
    state.setGroundedComponent('comp1');

    // Face distance target 15
    const dist = makeConstraint('C1', 'comp1', 'comp2', 'DISTANCE', 15);
    state.addConstraint(dist);

    const result = AssemblyConstraintSolver.solve(state);
    expect(result.status).toBe('CONVERGED_WITH_REMAINING_DOF');
    // Normal is z, distance along Normal z should be 15
    expect(Math.abs(result.solvedPoses['comp2'].position.z)).toBeCloseTo(15, 3);
  });

  it('TEST 06: should solve ANGLE constraints', () => {
    const state = new AssemblyConstraintState('ASSY-1', 'REV-0');
    const compA = defaultPose('comp1', 0);
    const compB = defaultPose('comp2', 10);

    state.addComponent(compA);
    state.addComponent(compB);
    state.setGroundedComponent('comp1');

    const ang = makeConstraint('C1', 'comp1', 'comp2', 'ANGLE', 0, 45);
    ang.geometryReferenceA.cachedNormal = { x: 1, y: 0, z: 0 };
    ang.geometryReferenceB.cachedNormal = { x: 1, y: 0, z: 0 };
    state.addConstraint(ang);

    const result = AssemblyConstraintSolver.solve(state);
    expect(result.status).toBe('CONVERGED_WITH_REMAINING_DOF');
    expect(Math.abs(result.solvedPoses['comp2'].orientation.z) % 360).toBeCloseTo(45, 1);
  });

  it('TEST 07: should solve PARALLEL constraints', () => {
    const state = new AssemblyConstraintState('ASSY-1', 'REV-0');
    const compA = defaultPose('comp1', 0);
    const compB = defaultPose('comp2', 10);
    compB.orientation = { x: 5, y: 5, z: 0 }; // slight tilt

    state.addComponent(compA);
    state.addComponent(compB);
    state.setGroundedComponent('comp1');

    const par = makeConstraint('C1', 'comp1', 'comp2', 'PARALLEL');
    state.addConstraint(par);

    const result = AssemblyConstraintSolver.solve(state);
    expect(result.status).toBe('CONVERGED_WITH_REMAINING_DOF');
    expect(result.solvedPoses['comp2'].orientation.x).toBeCloseTo(0, 3);
    expect(result.solvedPoses['comp2'].orientation.y).toBeCloseTo(0, 3);
  });

  it('TEST 08: should solve PERPENDICULAR constraints', () => {
    const state = new AssemblyConstraintState('ASSY-1', 'REV-0');
    const compA = defaultPose('comp1', 0);
    const compB = defaultPose('comp2', 10);

    state.addComponent(compA);
    state.addComponent(compB);
    state.setGroundedComponent('comp1');

    const perp = makeConstraint('C1', 'comp1', 'comp2', 'PERPENDICULAR');
    perp.geometryReferenceA.cachedNormal = { x: 1, y: 0, z: 0 };
    perp.geometryReferenceB.cachedNormal = { x: 1, y: 0, z: 0 };
    state.addConstraint(perp);

    const result = AssemblyConstraintSolver.solve(state);
    expect(result.status).toBe('CONVERGED_WITH_REMAINING_DOF');
    expect(Math.abs(result.solvedPoses['comp2'].orientation.z) % 360).toBeCloseTo(90, 1);
  });

  it('TEST 14: should verify deterministic replay of identical input sequences producing equivalent outputs', () => {
    const state1 = new AssemblyConstraintState('ASSY-1', 'REV-0');
    const state2 = new AssemblyConstraintState('ASSY-1', 'REV-0');

    const comp1_A = defaultPose('comp1', 0);
    const comp1_B = defaultPose('comp2', 10);
    state1.addComponent(comp1_A);
    state1.addComponent(comp1_B);
    state1.setGroundedComponent('comp1');
    state1.addConstraint(makeConstraint('C1', 'comp1', 'comp2', 'DISTANCE', 15));

    const comp2_A = defaultPose('comp1', 0);
    const comp2_B = defaultPose('comp2', 10);
    state2.addComponent(comp2_A);
    state2.addComponent(comp2_B);
    state2.setGroundedComponent('comp1');
    state2.addConstraint(makeConstraint('C1', 'comp1', 'comp2', 'DISTANCE', 15));

    const res1 = AssemblyConstraintSolver.solve(state1);
    const res2 = AssemblyConstraintSolver.solve(state2);

    const hash1 = AssemblyConstraintSolver.computeDeterministicHashes(
      Object.values(res1.solvedPoses),
      state1.getAllConstraints()
    );
    const hash2 = AssemblyConstraintSolver.computeDeterministicHashes(
      Object.values(res2.solvedPoses),
      state2.getAllConstraints()
    );

    expect(hash1.componentPoseHash).toBe(hash2.componentPoseHash);
    expect(hash1.constraintSetHash).toBe(hash2.constraintSetHash);
  });

  it('TEST 15: should reject invalid rotation matrices', () => {
    const state = new AssemblyConstraintState('ASSY-1', 'REV-0');
    const compA = defaultPose('comp1', 0);
    // Malform rotation matrix: determinant !== 1
    compA.transform = [
      [2, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];

    state.addComponent(compA);

    const validation = AssemblyConstraintValidator.validatePoses(state.getAllComponents());
    expect(validation.valid).toBe(false);
    expect(validation.reason).toContain('rotation matrix is invalid');
  });

  it('TEST 16: should reject NaN/Infinity values injected into translation elements', () => {
    const state = new AssemblyConstraintState('ASSY-1', 'REV-0');
    const compA = defaultPose('comp1', NaN); // Inject NaN

    state.addComponent(compA);

    const validation = AssemblyConstraintValidator.validatePoses(state.getAllComponents());
    expect(validation.valid).toBe(false);
    expect(validation.reason).toContain('translation contains NaN or Infinity');
  });
});
