/**
 * SECP Industrial OS — EPC-044: Forward Kinematics Verification Test Suite
 * Comprehensive engineering test battery for Industrial Robotic Arm Forward Kinematics.
 */

import { describe, it, expect } from 'vitest';
import { RobotKinematicChainManager } from '../robot/RobotKinematicChainManager';
import { RobotForwardKinematicsEngine } from '../robot/RobotForwardKinematicsEngine';
import { RobotKinematicIndependentVerifier } from '../robot/RobotKinematicIndependentVerifier';
import { EPC044Verifier } from '../robot/EPC044Verifier';
import { KinematicJointDefinition } from '../robot/RobotKinematicTypes';
import { TransformMatrix } from '../../assembly/graph/TransformMatrix';

describe('EPC-044 — Industrial Robotic Arm Forward Kinematics', () => {
  it('TEST-044-001: Single revolute joint forward kinematics', () => {
    const singleRevoluteJoint: KinematicJointDefinition = {
      jointId: 'TEST_REV_1',
      jointType: 'REVOLUTE',
      parentLinkId: 'BASE',
      childLinkId: 'LINK_1',
      axis: { x: 0, y: 0, z: 1 },
      referenceFrame: 'BASE_FRAME',
      dofId: 'DOF_1',
      limits: { minimumPosition: -180, maximumPosition: 180 },
      originTransform: TransformMatrix.translation(0, 0, 100),
      state: { position: 90, velocity: 0, acceleration: 0 },
      revision: 'REV-A'
    };

    const fkEngine = new RobotForwardKinematicsEngine();
    const result = fkEngine.compute({
      robotId: 'SINGLE-REV-ROBOT',
      configurationId: 'CFG-01',
      kinematicChainId: 'CHAIN-01',
      baseFrame: 'BASE_FRAME',
      jointDefinitions: [singleRevoluteJoint],
      jointStates: { TEST_REV_1: 90 },
      endEffectorFrame: 'LINK_1_FRAME',
      unitSystem: 'SI_MM_DEG',
      revision: 'REV-A'
    });

    expect(result.calculationStatus).toBe('VALID');
    expect(result.endEffectorPosition).toEqual({ x: 0, y: 0, z: 100 });
    // 90 deg rotation around Z turns X axis into Y axis
    expect(result.endEffectorOrientation.eulerZYXDeg.z).toBeCloseTo(90, 2);
  });

  it('TEST-044-002: Single prismatic joint forward kinematics', () => {
    const singlePrismaticJoint: KinematicJointDefinition = {
      jointId: 'TEST_PRISM_1',
      jointType: 'PRISMATIC',
      parentLinkId: 'BASE',
      childLinkId: 'LINK_1',
      axis: { x: 0, y: 0, z: 1 },
      referenceFrame: 'BASE_FRAME',
      dofId: 'DOF_1',
      limits: { minimumPosition: 0, maximumPosition: 500 },
      originTransform: TransformMatrix.translation(0, 0, 50),
      state: { position: 150, velocity: 0, acceleration: 0 },
      revision: 'REV-A'
    };

    const fkEngine = new RobotForwardKinematicsEngine();
    const result = fkEngine.compute({
      robotId: 'SINGLE-PRISM-ROBOT',
      configurationId: 'CFG-02',
      kinematicChainId: 'CHAIN-02',
      baseFrame: 'BASE_FRAME',
      jointDefinitions: [singlePrismaticJoint],
      jointStates: { TEST_PRISM_1: 150 },
      endEffectorFrame: 'LINK_1_FRAME',
      unitSystem: 'SI_MM_DEG',
      revision: 'REV-A'
    });

    expect(result.calculationStatus).toBe('VALID');
    expect(result.endEffectorPosition).toEqual({ x: 0, y: 0, z: 200 }); // 50 + 150
  });

  it('TEST-044-003: Multi-joint chain sequential transformation composition', () => {
    const chainMgr = new RobotKinematicChainManager();
    const fkEngine = new RobotForwardKinematicsEngine(chainMgr);

    const result = fkEngine.computeFromChainManager({
      J1_BASE: 0,
      J2_SHOULDER: 0,
      J3_ELBOW: 0,
      J4_WRIST1: 0,
      J5_WRIST2: 0,
      J6_WRIST3: 0
    });

    expect(result.calculationStatus).toBe('VALID');
    expect(result.transformationSequence.length).toBe(6);
    // Home pose position for default 6DOF arm: Z = 200 (base) + 250 (shoulder) = 450, X = 450 (elbow) + 400 (wrist1) + 120 (wrist2) + 80 (wrist3) = 1050
    expect(result.endEffectorPosition.x).toBeCloseTo(1050, 1);
    expect(result.endEffectorPosition.y).toBeCloseTo(0, 1);
    expect(result.endEffectorPosition.z).toBeCloseTo(450, 1);
  });

  it('TEST-044-004: Rotation composition across revolute joints', () => {
    const chainMgr = new RobotKinematicChainManager();
    const fkEngine = new RobotForwardKinematicsEngine(chainMgr);

    const result = fkEngine.computeFromChainManager({
      J1_BASE: 90,
      J2_SHOULDER: 0,
      J3_ELBOW: 0,
      J4_WRIST1: 0,
      J5_WRIST2: 0,
      J6_WRIST3: 0
    });

    expect(result.calculationStatus).toBe('VALID');
    // J1 rotated 90 deg around Z: arm extended in +Y direction instead of +X
    expect(result.endEffectorPosition.x).toBeCloseTo(0, 1);
    expect(result.endEffectorPosition.y).toBeCloseTo(1050, 1);
    expect(result.endEffectorPosition.z).toBeCloseTo(450, 1);
  });

  it('TEST-044-005: Translation composition', () => {
    const chainMgr = new RobotKinematicChainManager();
    const fkEngine = new RobotForwardKinematicsEngine(chainMgr);

    const result = fkEngine.computeFromChainManager();
    const seq = result.transformationSequence;

    // Verify cumulative translations along step sequence
    expect(seq[0].accumulatedTransform[2][3]).toBeCloseTo(250, 1); // J1_BASE
    expect(seq[1].accumulatedTransform[2][3]).toBeCloseTo(450, 1); // J2_SHOULDER (+200 in Z)
  });

  it('TEST-044-006: Mixed rotation and translation composition', () => {
    const chainMgr = new RobotKinematicChainManager();
    const fkEngine = new RobotForwardKinematicsEngine(chainMgr);

    const result = fkEngine.computeFromChainManager({
      J1_BASE: 45,
      J2_SHOULDER: -45,
      J3_ELBOW: 45,
      J4_WRIST1: 0,
      J5_WRIST2: -45,
      J6_WRIST3: 180
    });

    expect(result.calculationStatus).toBe('VALID');
    expect(TransformMatrix.isValidTransform(result.homogeneousTransform)).toBe(true);
  });

  it('TEST-044-007: Home configuration verification', () => {
    const chainMgr = new RobotKinematicChainManager();
    const fkEngine = new RobotForwardKinematicsEngine(chainMgr);

    const result = fkEngine.computeFromChainManager();
    expect(result.calculationStatus).toBe('VALID');
    expect(result.baseFrame).toBe('FRAME-WORLD');
    expect(result.endEffectorFrame).toBe('FRAME-END-EFFECTOR');
  });

  it('TEST-044-008: Multiple joint arbitrary configuration', () => {
    const chainMgr = new RobotKinematicChainManager();
    const fkEngine = new RobotForwardKinematicsEngine(chainMgr);

    const result = fkEngine.computeFromChainManager({
      J1_BASE: 30,
      J2_SHOULDER: -15,
      J3_ELBOW: 45,
      J4_WRIST1: -90,
      J5_WRIST2: 60,
      J6_WRIST3: -120
    });

    expect(result.calculationStatus).toBe('VALID');
    expect(result.endEffectorOrientation.quaternion.w).toBeDefined();
  });

  it('TEST-044-009: Joint-limit boundary configuration', () => {
    const chainMgr = new RobotKinematicChainManager();
    const fkEngine = new RobotForwardKinematicsEngine(chainMgr);

    // Set J1 at maximum limit (+170 deg)
    const result = fkEngine.computeFromChainManager({ J1_BASE: 170 });
    expect(result.calculationStatus).toBe('VALID');
    expect(result.jointConfiguration['J1_BASE'].isWithinLimits).toBe(true);
  });

  it('TEST-044-010: Out-of-bounds joint configuration detection', () => {
    const chainMgr = new RobotKinematicChainManager();
    const fkEngine = new RobotForwardKinematicsEngine(chainMgr);

    // Set J1 beyond maximum limit (+250 deg vs max +170 deg)
    const result = fkEngine.computeFromChainManager({ J1_BASE: 250 });
    expect(result.calculationStatus).toBe('INVALID_LIMITS');
    expect(result.jointConfiguration['J1_BASE'].isWithinLimits).toBe(false);
  });

  it('TEST-044-011: Independent reference mathematical comparison', () => {
    const chainMgr = new RobotKinematicChainManager();
    const fkEngine = new RobotForwardKinematicsEngine(chainMgr);
    const joints = chainMgr.getJoints();

    const secpResult = fkEngine.computeFromChainManager({
      J1_BASE: 30,
      J2_SHOULDER: -20,
      J3_ELBOW: 40,
      J4_WRIST1: 15,
      J5_WRIST2: -30,
      J6_WRIST3: 45
    });

    const comparison = RobotKinematicIndependentVerifier.verifyResult(secpResult, joints);

    expect(comparison.passed).toBe(true);
    expect(comparison.positionError).toBeLessThanOrEqual(secpResult.positionTolerance);
    expect(comparison.orientationError).toBeLessThanOrEqual(secpResult.orientationTolerance);
  });

  it('TEST-044-012: Deterministic repeated execution', () => {
    const chainMgr = new RobotKinematicChainManager();
    const fkEngine = new RobotForwardKinematicsEngine(chainMgr);
    const cfg = { J1_BASE: 12, J2_SHOULDER: -25, J3_ELBOW: 35 };

    const run1 = fkEngine.computeFromChainManager(cfg);
    const run2 = fkEngine.computeFromChainManager(cfg);
    const run3 = fkEngine.computeFromChainManager(cfg);

    expect(run1.endEffectorPosition).toEqual(run2.endEffectorPosition);
    expect(run2.endEffectorPosition).toEqual(run3.endEffectorPosition);
    expect(run1.homogeneousTransform).toEqual(run3.homogeneousTransform);
  });

  it('TEST-044-013: Configuration traceability model', () => {
    const chainMgr = new RobotKinematicChainManager();
    const fkEngine = new RobotForwardKinematicsEngine(chainMgr);

    const result = fkEngine.computeFromChainManager();
    expect(result.robotId).toBe('ROB-6DOF-IND-01');
    expect(result.kinematicChainId).toBe('CHAIN-ROBOT-6DOF');
    expect(result.robotRevision).toBe('REV-A');
  });

  it('TEST-044-014: Cryptographic evidence package generation', () => {
    const evidencePkg = EPC044Verifier.generateEvidencePackage();

    expect(evidencePkg.epcId).toBe('EPC-044');
    expect(evidencePkg.verdict).toBe('PASS');
    expect(evidencePkg.evidenceHash).toBeDefined();
    expect(evidencePkg.evidenceHash.length).toBe(64); // SHA-256 length
    expect(evidencePkg.continuityTest.isContinuous).toBe(true);
    expect(evidencePkg.determinismTest.isDeterministic).toBe(true);
  });

  it('TEST-044-015: Numerical tolerance enforcement', () => {
    const chainMgr = new RobotKinematicChainManager();
    const fkEngine = new RobotForwardKinematicsEngine(chainMgr);

    const result = fkEngine.computeFromChainManager();
    expect(result.positionTolerance).toBe(1e-5);
    expect(result.orientationTolerance).toBe(1e-5);
  });

  it('TEST-044-016: EPC-044 Gate Verifier Report', () => {
    const gateReport = EPC044Verifier.verify();

    expect(gateReport.epc).toBe('EPC-044');
    expect(gateReport.verdict).toBe('PASS');
    expect(gateReport.summary.failedChecks).toBe(0);
    expect(gateReport.summary.passedChecks).toBe(gateReport.summary.totalChecks);
  });
});
