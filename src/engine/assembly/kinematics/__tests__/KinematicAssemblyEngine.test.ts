import { describe, it, expect } from 'vitest';
import { KinematicState } from '../KinematicState';
import { createKinematicBody } from '../KinematicBody';
import { KinematicJoint } from '../KinematicJointModel';
import { KinematicAssemblyEngine } from '../KinematicAssemblyEngine';
import { AssemblyConstraint } from '../../constraints/AssemblyConstraintModel';

function makeFrame(
  origin = { x: 0, y: 0, z: 0 },
  primary = { x: 0, y: 0, z: 1 },
  secondary = { x: 1, y: 0, z: 0 }
) {
  return {
    origin,
    primaryAxis: primary,
    secondaryAxis: secondary,
  };
}

describe('KinematicAssemblyEngine Comprehensive Test Suite', () => {
  it('TEST 01: Single grounded body has zero system motion', () => {
    const state = new KinematicState('ASSY-1', 'REV-0');
    const ground = createKinematicBody('B1', 'comp1', true);
    state.addBody(ground);

    const result = KinematicAssemblyEngine.solveForwardKinematics(state);
    expect(result.status).toBe('CONVERGED');
    expect(result.totalDOF).toBe(0);
    expect(result.remainingDOF).toBe(0);
    expect(result.maximumResidual).toBe(0);
  });

  it('TEST 02 & 03: Ground + revolute joint verifies 1 DOF and exact child rotation transform', () => {
    const state = new KinematicState('ASSY-1', 'REV-0');
    const ground = createKinematicBody('B1', 'comp1', true);
    const link = createKinematicBody('B2', 'comp2', false);

    state.addBody(ground);
    state.addBody(link);

    const joint: KinematicJoint = {
      jointId: 'J_REV',
      assemblyId: 'ASSY-1',
      parentBodyId: 'B1',
      childBodyId: 'B2',
      jointType: 'REVOLUTE',
      parentFrame: makeFrame({ x: 0, y: 0, z: 0 }),
      childFrame: makeFrame({ x: 0, y: 0, z: 0 }),
      parameters: { axis: { x: 0, y: 0, z: 1 } },
      position: 90, // 90 degrees around Z
      tolerance: 1e-4,
      enabled: true,
      suppressed: false,
      createdAt: new Date().toISOString(),
    };
    state.addJoint(joint);

    const result = KinematicAssemblyEngine.solveForwardKinematics(state);
    expect(result.status).toBe('CONVERGED_WITH_REMAINING_DOF');
    expect(result.totalDOF).toBe(6);
    expect(result.constrainedDOF).toBe(5);
    expect(result.remainingDOF).toBe(1);

    const B2Transform = result.bodyTransforms['B2'];
    // 90 deg around Z: X unit vector rotated to Y unit vector
    expect(B2Transform[0][0]).toBeCloseTo(0, 4);
    expect(B2Transform[0][1]).toBeCloseTo(-1, 4);
    expect(B2Transform[1][0]).toBeCloseTo(1, 4);
    expect(B2Transform[1][1]).toBeCloseTo(0, 4);
  });

  it('TEST 05 & 06: Prismatic joint creates translation along defined axis without forbidden orthogonal motion', () => {
    const state = new KinematicState('ASSY-1', 'REV-0');
    const ground = createKinematicBody('B1', 'comp1', true);
    const slider = createKinematicBody('B2', 'comp2', false);

    state.addBody(ground);
    state.addBody(slider);

    const joint: KinematicJoint = {
      jointId: 'J_SLIDE',
      assemblyId: 'ASSY-1',
      parentBodyId: 'B1',
      childBodyId: 'B2',
      jointType: 'PRISMATIC',
      parentFrame: makeFrame(),
      childFrame: makeFrame(),
      parameters: { axis: { x: 1, y: 0, z: 0 } }, // Slide along X
      position: 50.0,
      tolerance: 1e-4,
      enabled: true,
      suppressed: false,
      createdAt: new Date().toISOString(),
    };
    state.addJoint(joint);

    const result = KinematicAssemblyEngine.solveForwardKinematics(state);
    expect(result.status).toBe('CONVERGED_WITH_REMAINING_DOF');
    const B2Transform = result.bodyTransforms['B2'];

    expect(B2Transform[0][3]).toBeCloseTo(50.0, 4); // Translation in X
    expect(B2Transform[1][3]).toBeCloseTo(0, 4);    // No translation in Y
    expect(B2Transform[2][3]).toBeCloseTo(0, 4);    // No translation in Z
  });

  it('TEST 11: Invalid zero-length joint axis is rejected as INVALID', () => {
    const state = new KinematicState('ASSY-1', 'REV-0');
    const ground = createKinematicBody('B1', 'comp1', true);
    const link = createKinematicBody('B2', 'comp2', false);

    state.addBody(ground);
    state.addBody(link);

    const joint: KinematicJoint = {
      jointId: 'J_BAD_AXIS',
      assemblyId: 'ASSY-1',
      parentBodyId: 'B1',
      childBodyId: 'B2',
      jointType: 'REVOLUTE',
      parentFrame: makeFrame(),
      childFrame: makeFrame(),
      parameters: { axis: { x: 0, y: 0, z: 0 } }, // Zero-length axis!
      position: 45,
      tolerance: 1e-4,
      enabled: true,
      suppressed: false,
      createdAt: new Date().toISOString(),
    };
    state.addJoint(joint);

    const result = KinematicAssemblyEngine.solveForwardKinematics(state);
    expect(result.status).toBe('INVALID');
  });

  it('TEST 14 & 15: Forward kinematics chain propagates transforms through multi-body kinematic tree', () => {
    // Ground (B1) -> Revolute (J1) -> Link 1 (B2) -> Prismatic (J2) -> Tool (B3)
    const state = new KinematicState('ASSY-CHAIN', 'REV-0');
    const b1 = createKinematicBody('B1', 'comp1', true);
    const b2 = createKinematicBody('B2', 'comp2', false);
    const b3 = createKinematicBody('B3', 'comp3', false);

    state.addBody(b1);
    state.addBody(b2);
    state.addBody(b3);

    // J1: 90 deg around Z
    const j1: KinematicJoint = {
      jointId: 'J1',
      assemblyId: 'ASSY-CHAIN',
      parentBodyId: 'B1',
      childBodyId: 'B2',
      jointType: 'REVOLUTE',
      parentFrame: makeFrame({ x: 0, y: 0, z: 0 }),
      childFrame: makeFrame({ x: 0, y: 0, z: 0 }),
      parameters: { axis: { x: 0, y: 0, z: 1 } },
      position: 90,
      tolerance: 1e-4,
      enabled: true,
      suppressed: false,
      createdAt: new Date().toISOString(),
    };

    // J2: translate 100 along local X of B2 (which is world Y after 90 deg rotation)
    const j2: KinematicJoint = {
      jointId: 'J2',
      assemblyId: 'ASSY-CHAIN',
      parentBodyId: 'B2',
      childBodyId: 'B3',
      jointType: 'PRISMATIC',
      parentFrame: makeFrame({ x: 0, y: 0, z: 0 }),
      childFrame: makeFrame({ x: 0, y: 0, z: 0 }),
      parameters: { axis: { x: 1, y: 0, z: 0 } },
      position: 100.0,
      tolerance: 1e-4,
      enabled: true,
      suppressed: false,
      createdAt: new Date().toISOString(),
    };

    state.addJoint(j1);
    state.addJoint(j2);

    const result = KinematicAssemblyEngine.solveForwardKinematics(state);
    expect(result.status).toBe('CONVERGED_WITH_REMAINING_DOF');

    const B3Transform = result.bodyTransforms['B3'];
    // In world coords: B3 origin should be at X=0, Y=100, Z=0
    expect(B3Transform[0][3]).toBeCloseTo(0, 4);
    expect(B3Transform[1][3]).toBeCloseTo(100.0, 4);
    expect(B3Transform[2][3]).toBeCloseTo(0, 4);
  });

  it('TEST 16: Closed kinematic loop is detected and returns UNPROVEN', () => {
    // 3-bar closed loop: B1-B2-B3-B1
    const state = new KinematicState('ASSY-LOOP', 'REV-0');
    const b1 = createKinematicBody('B1', 'comp1', true);
    const b2 = createKinematicBody('B2', 'comp2', false);
    const b3 = createKinematicBody('B3', 'comp3', false);

    state.addBody(b1);
    state.addBody(b2);
    state.addBody(b3);

    const j1: KinematicJoint = {
      jointId: 'J1',
      assemblyId: 'ASSY-LOOP',
      parentBodyId: 'B1',
      childBodyId: 'B2',
      jointType: 'REVOLUTE',
      parentFrame: makeFrame(),
      childFrame: makeFrame(),
      parameters: { axis: { x: 0, y: 0, z: 1 } },
      position: 0,
      tolerance: 1e-4,
      enabled: true,
      suppressed: false,
      createdAt: new Date().toISOString(),
    };

    const j2: KinematicJoint = {
      jointId: 'J2',
      assemblyId: 'ASSY-LOOP',
      parentBodyId: 'B2',
      childBodyId: 'B3',
      jointType: 'REVOLUTE',
      parentFrame: makeFrame(),
      childFrame: makeFrame(),
      parameters: { axis: { x: 0, y: 0, z: 1 } },
      position: 0,
      tolerance: 1e-4,
      enabled: true,
      suppressed: false,
      createdAt: new Date().toISOString(),
    };

    const j3: KinematicJoint = {
      jointId: 'J3',
      assemblyId: 'ASSY-LOOP',
      parentBodyId: 'B3',
      childBodyId: 'B1', // Closes cycle back to B1!
      jointType: 'REVOLUTE',
      parentFrame: makeFrame(),
      childFrame: makeFrame(),
      parameters: { axis: { x: 0, y: 0, z: 1 } },
      position: 0,
      tolerance: 1e-4,
      enabled: true,
      suppressed: false,
      createdAt: new Date().toISOString(),
    };

    state.addJoint(j1);
    state.addJoint(j2);
    state.addJoint(j3);

    const result = KinematicAssemblyEngine.solveForwardKinematics(state);
    expect(result.status).toBe('UNPROVEN');
  });

  it('TEST 17: Validates PATCH-030 constraints under kinematic motion', () => {
    const state = new KinematicState('ASSY-CONSTR', 'REV-0');
    const b1 = createKinematicBody('B1', 'comp1', true);
    const b2 = createKinematicBody('B2', 'comp2', false);

    state.addBody(b1);
    state.addBody(b2);

    const joint: KinematicJoint = {
      jointId: 'J1',
      assemblyId: 'ASSY-CONSTR',
      parentBodyId: 'B1',
      childBodyId: 'B2',
      jointType: 'PRISMATIC',
      parentFrame: makeFrame(),
      childFrame: makeFrame(),
      parameters: { axis: { x: 0, y: 0, z: 1 } },
      position: 20.0,
      tolerance: 1e-4,
      enabled: true,
      suppressed: false,
      createdAt: new Date().toISOString(),
    };
    state.addJoint(joint);

    // Add a PATCH-030 distance constraint between B1 and B2 with target offset = 20
    const distanceConstraint: AssemblyConstraint = {
      constraintId: 'C_DIST_1',
      assemblyId: 'ASSY-CONSTR',
      parentRevisionId: 'REV-0',
      componentA: 'B1',
      componentB: 'B2',
      geometryReferenceA: {
        componentId: 'B1',
        topologyType: 'FACE',
        topologyIndex: 0,
        geometricSignature: 'SIG1',
        cachedNormal: { x: 0, y: 0, z: 1 },
        cachedPoint: { x: 0, y: 0, z: 0 },
      },
      geometryReferenceB: {
        componentId: 'B2',
        topologyType: 'FACE',
        topologyIndex: 0,
        geometricSignature: 'SIG2',
        cachedNormal: { x: 0, y: 0, z: 1 },
        cachedPoint: { x: 0, y: 0, z: 0 },
      },
      constraintType: 'DISTANCE',
      parameters: { offsetMm: 20.0 },
      tolerance: 1e-3,
      suppressed: false,
      enabled: true,
      priority: 1,
      createdBy: 'ENGINEER',
      createdAt: new Date().toISOString(),
    };

    const result = KinematicAssemblyEngine.solveForwardKinematics(state, undefined, [distanceConstraint]);
    expect(result.status).toBe('CONVERGED_WITH_REMAINING_DOF');
    expect(result.maximumResidual).toBeLessThan(1e-3);
  });

  it('TEST 19 & 20: Deterministic replay produces equivalent SHA-256 configuration hashes and evidence', () => {
    const state1 = new KinematicState('ASSY-DET', 'REV-0');
    const state2 = new KinematicState('ASSY-DET', 'REV-0');

    const b1_1 = createKinematicBody('B1', 'comp1', true);
    const b2_1 = createKinematicBody('B2', 'comp2', false);
    state1.addBody(b1_1);
    state1.addBody(b2_1);

    const b1_2 = createKinematicBody('B1', 'comp1', true);
    const b2_2 = createKinematicBody('B2', 'comp2', false);
    state2.addBody(b1_2);
    state2.addBody(b2_2);

    const makeJ = () => ({
      jointId: 'J1',
      assemblyId: 'ASSY-DET',
      parentBodyId: 'B1',
      childBodyId: 'B2',
      jointType: 'REVOLUTE' as const,
      parentFrame: makeFrame(),
      childFrame: makeFrame(),
      parameters: { axis: { x: 0, y: 0, z: 1 } },
      position: 33.333333,
      tolerance: 1e-4,
      enabled: true,
      suppressed: false,
      createdAt: '2026-08-19T00:00:00.000Z',
    });

    state1.addJoint(makeJ());
    state2.addJoint(makeJ());

    const res1 = KinematicAssemblyEngine.solveForwardKinematics(state1);
    const res2 = KinematicAssemblyEngine.solveForwardKinematics(state2);

    expect(res1.configurationHash).toBe(res2.configurationHash);
    expect(res1.status).toBe(res2.status);
    expect(res1.bodyTransforms['B2']).toEqual(res2.bodyTransforms['B2']);
    expect(res1.evidenceId).toContain('EVID-KIN-');
  });
});
