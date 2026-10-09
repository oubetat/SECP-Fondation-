import { describe, it, expect } from 'vitest';
import { createKinematicBody } from '../KinematicBody';
import { KinematicJoint, IDEALIZED_JOINT_DOF } from '../KinematicJointModel';
import { KinematicJointEvaluator, invertRigidTransform, multiplyTransforms } from '../KinematicJoint';

function makeFrame(origin = { x: 0, y: 0, z: 0 }, primary = { x: 0, y: 0, z: 1 }, secondary = { x: 1, y: 0, z: 0 }) {
  return {
    origin,
    primaryAxis: primary,
    secondaryAxis: secondary,
  };
}

describe('KinematicJoint Mathematical Unit Tests', () => {
  it('TEST 02: should verify idealized joint DOF definitions', () => {
    expect(IDEALIZED_JOINT_DOF.FIXED).toBe(0);
    expect(IDEALIZED_JOINT_DOF.REVOLUTE).toBe(1);
    expect(IDEALIZED_JOINT_DOF.PRISMATIC).toBe(1);
    expect(IDEALIZED_JOINT_DOF.CYLINDRICAL).toBe(2);
    expect(IDEALIZED_JOINT_DOF.PLANAR).toBe(3);
    expect(IDEALIZED_JOINT_DOF.BALL).toBe(3);
    expect(IDEALIZED_JOINT_DOF.UNIVERSAL).toBe(2);
  });

  it('TEST 03 & 04: should compute exact REVOLUTE joint transform around Z-axis', () => {
    const joint: KinematicJoint = {
      jointId: 'J_REV_1',
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

    const T = KinematicJointEvaluator.computeRelativeTransform(joint, 90);

    // After 90 deg rotation around Z: X axis becomes Y axis
    expect(T[0][0]).toBeCloseTo(0, 5);
    expect(T[0][1]).toBeCloseTo(-1, 5);
    expect(T[1][0]).toBeCloseTo(1, 5);
    expect(T[1][1]).toBeCloseTo(0, 5);
    expect(T[2][2]).toBeCloseTo(1, 5);
    expect(T[0][3]).toBeCloseTo(0, 5);
    expect(T[1][3]).toBeCloseTo(0, 5);
    expect(T[2][3]).toBeCloseTo(0, 5);
  });

  it('TEST 05 & 06: should compute PRISMATIC joint transform along defined axis without orthogonal drift', () => {
    const joint: KinematicJoint = {
      jointId: 'J_PRISM_1',
      assemblyId: 'ASSY-1',
      parentBodyId: 'B1',
      childBodyId: 'B2',
      jointType: 'PRISMATIC',
      parentFrame: makeFrame({ x: 0, y: 0, z: 0 }),
      childFrame: makeFrame({ x: 0, y: 0, z: 0 }),
      parameters: { axis: { x: 0, y: 1, z: 0 } }, // translate along Y
      position: 25.5,
      tolerance: 1e-4,
      enabled: true,
      suppressed: false,
      createdAt: new Date().toISOString(),
    };

    const T = KinematicJointEvaluator.computeRelativeTransform(joint, 25.5);

    // Translation along Y must be exactly 25.5, and X & Z translation must be 0
    expect(T[0][3]).toBeCloseTo(0, 5);
    expect(T[1][3]).toBeCloseTo(25.5, 5);
    expect(T[2][3]).toBeCloseTo(0, 5);

    // Rotation must remain pure identity
    expect(T[0][0]).toBeCloseTo(1, 5);
    expect(T[1][1]).toBeCloseTo(1, 5);
    expect(T[2][2]).toBeCloseTo(1, 5);
  });

  it('TEST 07: should compute CYLINDRICAL joint with independent rotation and translation', () => {
    const joint: KinematicJoint = {
      jointId: 'J_CYL_1',
      assemblyId: 'ASSY-1',
      parentBodyId: 'B1',
      childBodyId: 'B2',
      jointType: 'CYLINDRICAL',
      parentFrame: makeFrame({ x: 0, y: 0, z: 0 }),
      childFrame: makeFrame({ x: 0, y: 0, z: 0 }),
      parameters: { axis: { x: 0, y: 0, z: 1 } },
      position: [45, 12.0], // [qR = 45 deg, qT = 12 mm along Z]
      tolerance: 1e-4,
      enabled: true,
      suppressed: false,
      createdAt: new Date().toISOString(),
    };

    const T = KinematicJointEvaluator.computeRelativeTransform(joint, [45, 12.0]);

    expect(T[2][3]).toBeCloseTo(12.0, 5);
    expect(T[0][0]).toBeCloseTo(Math.cos((45 * Math.PI) / 180), 5);
    expect(T[1][0]).toBeCloseTo(Math.sin((45 * Math.PI) / 180), 5);
  });

  it('TEST 08: should compute PLANAR joint with 2 translational DOF and 1 rotational DOF', () => {
    const joint: KinematicJoint = {
      jointId: 'J_PLANE_1',
      assemblyId: 'ASSY-1',
      parentBodyId: 'B1',
      childBodyId: 'B2',
      jointType: 'PLANAR',
      parentFrame: makeFrame({ x: 0, y: 0, z: 0 }),
      childFrame: makeFrame({ x: 0, y: 0, z: 0 }),
      parameters: { planeNormal: { x: 0, y: 0, z: 1 } },
      position: [10, -5, 30], // [u=10, v=-5, theta=30 deg]
      tolerance: 1e-4,
      enabled: true,
      suppressed: false,
      createdAt: new Date().toISOString(),
    };

    const T = KinematicJointEvaluator.computeRelativeTransform(joint, [10, -5, 30]);

    expect(T[0][3]).toBeCloseTo(10, 5);
    expect(T[1][3]).toBeCloseTo(-5, 5);
    expect(T[2][3]).toBeCloseTo(0, 5); // Must remain strictly on plane Z=0
  });

  it('TEST 09: should compute BALL joint with 3 rotational DOF and zero translation', () => {
    const joint: KinematicJoint = {
      jointId: 'J_BALL_1',
      assemblyId: 'ASSY-1',
      parentBodyId: 'B1',
      childBodyId: 'B2',
      jointType: 'BALL',
      parentFrame: makeFrame({ x: 0, y: 0, z: 0 }),
      childFrame: makeFrame({ x: 0, y: 0, z: 0 }),
      parameters: {},
      position: { rx: 15, ry: 30, rz: -45 },
      tolerance: 1e-4,
      enabled: true,
      suppressed: false,
      createdAt: new Date().toISOString(),
    };

    const T = KinematicJointEvaluator.computeRelativeTransform(joint);

    expect(T[0][3]).toBeCloseTo(0, 5);
    expect(T[1][3]).toBeCloseTo(0, 5);
    expect(T[2][3]).toBeCloseTo(0, 5);
  });

  it('TEST 10: should validate joint limits and report limit violations', () => {
    const joint: KinematicJoint = {
      jointId: 'J_REV_LIM',
      assemblyId: 'ASSY-1',
      parentBodyId: 'B1',
      childBodyId: 'B2',
      jointType: 'REVOLUTE',
      parentFrame: makeFrame(),
      childFrame: makeFrame(),
      parameters: { axis: { x: 0, y: 0, z: 1 } },
      limits: { min: -45, max: 45 },
      position: 0,
      tolerance: 1e-4,
      enabled: true,
      suppressed: false,
      createdAt: new Date().toISOString(),
    };

    const validCheck = KinematicJointEvaluator.validateJointLimits(joint, 30);
    expect(validCheck.valid).toBe(true);

    const exceedMax = KinematicJointEvaluator.validateJointLimits(joint, 60);
    expect(exceedMax.valid).toBe(false);
    expect(exceedMax.violationType).toBe('MAX_LIMIT_EXCEEDED');

    const exceedMin = KinematicJointEvaluator.validateJointLimits(joint, -90);
    expect(exceedMin.valid).toBe(false);
    expect(exceedMin.violationType).toBe('MIN_LIMIT_EXCEEDED');
  });
});
