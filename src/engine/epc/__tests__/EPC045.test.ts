/**
 * SECP Industrial OS — EPC-045 Unit Test Suite
 * Tests for Inverse Kinematics solver, Jacobian evaluation, Damped Least Squares convergence,
 * forward kinematics closure, joint limits, singularity detection, determinism, and signed evidence.
 */

import { describe, it, expect } from 'vitest';
import { RobotKinematicChainManager } from '../robot/RobotKinematicChainManager';
import { RobotForwardKinematicsEngine } from '../robot/RobotForwardKinematicsEngine';
import { RobotInverseKinematicsEngine } from '../robot/RobotInverseKinematicsEngine';
import { RobotKinematicJacobian } from '../robot/RobotKinematicJacobian';
import { EPC045Verifier } from '../robot/EPC045Verifier';
import { EvidenceIntegrityService } from '../evidence/EvidenceIntegrityService';

describe('EPC-045: Inverse Kinematics Verification Battery', () => {
  const chainManager = new RobotKinematicChainManager();
  const fkEngine = new RobotForwardKinematicsEngine(chainManager);
  const ikEngine = new RobotInverseKinematicsEngine(chainManager);

  it('IK-001: solves single/multi-joint position sub-chain', () => {
    const fkSingle = fkEngine.computeFromChainManager({ J1_BASE: 30 });
    const targetPose = {
      position: fkSingle.endEffectorPosition,
      positionOnly: true
    };

    const res = ikEngine.solve({
      robotId: chainManager.robotId,
      configurationId: 'TEST-IK-001',
      kinematicChainId: chainManager.chainId,
      baseFrame: 'FRAME-WORLD',
      endEffectorFrame: 'FRAME-END-EFFECTOR',
      targetPose,
      initialJointConfiguration: { J1_BASE: 0, J2_SHOULDER: 0, J3_ELBOW: 0, J4_WRIST1: 0, J5_WRIST2: 0, J6_WRIST3: 0 },
      positionTolerance: 1e-3,
      revision: chainManager.revision,
      solverConfiguration: { maxIterations: 80 }
    });

    expect(res.positionError).toBeLessThanOrEqual(1e-3);
    expect(res.convergenceStatus).toBe('CONVERGED');
  });

  it('IK-002: verifies 6-DOF multi-joint serial chain', () => {
    const joints = chainManager.getJoints();
    expect(joints.length).toBe(6);
    expect(joints.every((j) => j.jointType === 'REVOLUTE')).toBe(true);

    const jacResult = RobotKinematicJacobian.computeGeometricJacobian(joints, {
      J1_BASE: 0,
      J2_SHOULDER: 0,
      J3_ELBOW: 0,
      J4_WRIST1: 0,
      J5_WRIST2: 0,
      J6_WRIST3: 0
    });

    expect(jacResult.J.length).toBe(6);
    expect(jacResult.J[0].length).toBe(6);
  });

  it('IK-003: converges to known reachable target pose within tolerance', () => {
    const qKnown = { J1_BASE: 25, J2_SHOULDER: -20, J3_ELBOW: 40, J4_WRIST1: 15, J5_WRIST2: -30, J6_WRIST3: 45 };
    const fkKnown = fkEngine.computeFromChainManager(qKnown);

    const res = ikEngine.solve({
      robotId: chainManager.robotId,
      configurationId: 'TEST-IK-003',
      kinematicChainId: chainManager.chainId,
      baseFrame: 'FRAME-WORLD',
      endEffectorFrame: 'FRAME-END-EFFECTOR',
      targetPose: {
        position: fkKnown.endEffectorPosition,
        rotationMatrix: fkKnown.endEffectorOrientation.rotationMatrix,
        positionOnly: false
      },
      initialJointConfiguration: { J1_BASE: 0, J2_SHOULDER: 0, J3_ELBOW: 0, J4_WRIST1: 0, J5_WRIST2: 0, J6_WRIST3: 0 },
      positionTolerance: 1e-3,
      orientationTolerance: 1e-3,
      revision: chainManager.revision,
      solverConfiguration: { maxIterations: 120 }
    });

    expect(res.convergenceStatus).toBe('CONVERGED');
    expect(res.positionError).toBeLessThanOrEqual(1e-3);
    expect(res.orientationError).toBeLessThanOrEqual(1e-3);
  });

  it('IK-004: detects and rejects unreachable targets outside workspace', () => {
    const unreachableTarget = {
      position: { x: 8000, y: 8000, z: 8000 },
      positionOnly: true
    };

    const res = ikEngine.solve({
      robotId: chainManager.robotId,
      configurationId: 'TEST-IK-004',
      kinematicChainId: chainManager.chainId,
      baseFrame: 'FRAME-WORLD',
      endEffectorFrame: 'FRAME-END-EFFECTOR',
      targetPose: unreachableTarget,
      positionTolerance: 1e-3,
      revision: chainManager.revision,
      solverConfiguration: { maxIterations: 20 }
    });

    expect(['UNREACHABLE', 'NOT_CONVERGED']).toContain(res.convergenceStatus);
    expect(res.forwardKinematicsVerification.passed).toBe(false);
  });

  it('IK-005: enforces physical joint limits strictly', () => {
    const qKnown = { J1_BASE: 45, J2_SHOULDER: -30, J3_ELBOW: 20, J4_WRIST1: 0, J5_WRIST2: 15, J6_WRIST3: 0 };
    const fk = fkEngine.computeFromChainManager(qKnown);

    const res = ikEngine.solve({
      robotId: chainManager.robotId,
      configurationId: 'TEST-IK-005',
      kinematicChainId: chainManager.chainId,
      baseFrame: 'FRAME-WORLD',
      endEffectorFrame: 'FRAME-END-EFFECTOR',
      targetPose: {
        position: fk.endEffectorPosition,
        rotationMatrix: fk.endEffectorOrientation.rotationMatrix
      },
      positionTolerance: 1e-3,
      orientationTolerance: 1e-3,
      revision: chainManager.revision
    });

    const joints = chainManager.getJoints();
    for (const j of joints) {
      const qVal = res.finalJointConfiguration[j.jointId];
      expect(qVal).toBeGreaterThanOrEqual(j.limits.minimumPosition - 1e-4);
      expect(qVal).toBeLessThanOrEqual(j.limits.maximumPosition + 1e-4);
    }
    expect(res.constraintStatus).toBe('SATISFIED');
  });

  it('IK-006: converges from multiple distinct initial guesses', () => {
    const qTarget = { J1_BASE: 20, J2_SHOULDER: -15, J3_ELBOW: 30, J4_WRIST1: 10, J5_WRIST2: -20, J6_WRIST3: 25 };
    const fk = fkEngine.computeFromChainManager(qTarget);

    const seedA = { J1_BASE: 0, J2_SHOULDER: 0, J3_ELBOW: 0, J4_WRIST1: 0, J5_WRIST2: 0, J6_WRIST3: 0 };
    const seedB = { J1_BASE: -20, J2_SHOULDER: 15, J3_ELBOW: 10, J4_WRIST1: -10, J5_WRIST2: 15, J6_WRIST3: -10 };

    const resA = ikEngine.solve({
      robotId: chainManager.robotId,
      configurationId: 'TEST-IK-006A',
      kinematicChainId: chainManager.chainId,
      baseFrame: 'FRAME-WORLD',
      endEffectorFrame: 'FRAME-END-EFFECTOR',
      targetPose: { position: fk.endEffectorPosition, rotationMatrix: fk.endEffectorOrientation.rotationMatrix },
      initialJointConfiguration: seedA,
      positionTolerance: 1e-3,
      orientationTolerance: 1e-3,
      revision: chainManager.revision
    });

    const resB = ikEngine.solve({
      robotId: chainManager.robotId,
      configurationId: 'TEST-IK-006B',
      kinematicChainId: chainManager.chainId,
      baseFrame: 'FRAME-WORLD',
      endEffectorFrame: 'FRAME-END-EFFECTOR',
      targetPose: { position: fk.endEffectorPosition, rotationMatrix: fk.endEffectorOrientation.rotationMatrix },
      initialJointConfiguration: seedB,
      positionTolerance: 1e-3,
      orientationTolerance: 1e-3,
      revision: chainManager.revision
    });

    expect(resA.convergenceStatus).toBe('CONVERGED');
    expect(resB.convergenceStatus).toBe('CONVERGED');
  });

  it('IK-007 & IK-008: verifies position error and orientation error are within numerical tolerances', () => {
    const qKnown = { J1_BASE: 30, J2_SHOULDER: -25, J3_ELBOW: 50, J4_WRIST1: -10, J5_WRIST2: 20, J6_WRIST3: -30 };
    const fk = fkEngine.computeFromChainManager(qKnown);

    const res = ikEngine.solve({
      robotId: chainManager.robotId,
      configurationId: 'TEST-IK-007-008',
      kinematicChainId: chainManager.chainId,
      baseFrame: 'FRAME-WORLD',
      endEffectorFrame: 'FRAME-END-EFFECTOR',
      targetPose: { position: fk.endEffectorPosition, rotationMatrix: fk.endEffectorOrientation.rotationMatrix },
      positionTolerance: 1e-3,
      orientationTolerance: 1e-3,
      revision: chainManager.revision
    });

    expect(res.positionError).toBeLessThanOrEqual(1e-3);
    expect(res.orientationError).toBeLessThanOrEqual(1e-3);
  });

  it('IK-009: verifies complete forward kinematics round-trip closure', () => {
    const qKnown = { J1_BASE: 15, J2_SHOULDER: -10, J3_ELBOW: 25, J4_WRIST1: 5, J5_WRIST2: -15, J6_WRIST3: 20 };
    const fkTarget = fkEngine.computeFromChainManager(qKnown);

    const ikRes = ikEngine.solve({
      robotId: chainManager.robotId,
      configurationId: 'TEST-IK-009',
      kinematicChainId: chainManager.chainId,
      baseFrame: 'FRAME-WORLD',
      endEffectorFrame: 'FRAME-END-EFFECTOR',
      targetPose: { position: fkTarget.endEffectorPosition, rotationMatrix: fkTarget.endEffectorOrientation.rotationMatrix },
      positionTolerance: 1e-3,
      orientationTolerance: 1e-3,
      revision: chainManager.revision
    });

    expect(ikRes.forwardKinematicsVerification.passed).toBe(true);
    expect(ikRes.forwardKinematicsVerification.positionPassed).toBe(true);
    expect(ikRes.forwardKinematicsVerification.orientationPassed).toBe(true);

    // Independent closure test
    const fkRecovered = fkEngine.computeFromChainManager(ikRes.finalJointConfiguration);
    const posDist = Math.sqrt(
      Math.pow(fkRecovered.endEffectorPosition.x - fkTarget.endEffectorPosition.x, 2) +
      Math.pow(fkRecovered.endEffectorPosition.y - fkTarget.endEffectorPosition.y, 2) +
      Math.pow(fkRecovered.endEffectorPosition.z - fkTarget.endEffectorPosition.z, 2)
    );
    expect(posDist).toBeLessThanOrEqual(1e-3);
  });

  it('IK-010: discovers alternative solutions and applies selection criterion', () => {
    const qKnown = { J1_BASE: 30, J2_SHOULDER: -20, J3_ELBOW: 40, J4_WRIST1: 15, J5_WRIST2: -30, J6_WRIST3: 45 };
    const fk = fkEngine.computeFromChainManager(qKnown);

    const multiRes = ikEngine.solveWithMultiStart({
      robotId: chainManager.robotId,
      configurationId: 'TEST-IK-010',
      kinematicChainId: chainManager.chainId,
      baseFrame: 'FRAME-WORLD',
      endEffectorFrame: 'FRAME-END-EFFECTOR',
      targetPose: { position: fk.endEffectorPosition, rotationMatrix: fk.endEffectorOrientation.rotationMatrix },
      positionTolerance: 1e-3,
      orientationTolerance: 1e-3,
      revision: chainManager.revision,
      solverConfiguration: {
        solutionCriterion: 'MINIMUM_DISPLACEMENT'
      }
    });

    expect(multiRes.convergenceStatus).toBe('CONVERGED');
    expect(multiRes.selectedSolutionCriterion).toBe('MINIMUM_DISPLACEMENT');
    expect(multiRes.alternativeSolutions.length).toBeGreaterThanOrEqual(1);
  });

  it('IK-011: guarantees bit-identical reproducibility on repeated runs', () => {
    const qKnown = { J1_BASE: 10, J2_SHOULDER: -5, J3_ELBOW: 15, J4_WRIST1: 0, J5_WRIST2: -10, J6_WRIST3: 10 };
    const fk = fkEngine.computeFromChainManager(qKnown);

    const run1 = ikEngine.solve({
      robotId: chainManager.robotId,
      configurationId: 'TEST-IK-011-1',
      kinematicChainId: chainManager.chainId,
      baseFrame: 'FRAME-WORLD',
      endEffectorFrame: 'FRAME-END-EFFECTOR',
      targetPose: { position: fk.endEffectorPosition, rotationMatrix: fk.endEffectorOrientation.rotationMatrix },
      positionTolerance: 1e-3,
      revision: chainManager.revision
    });

    const run2 = ikEngine.solve({
      robotId: chainManager.robotId,
      configurationId: 'TEST-IK-011-2',
      kinematicChainId: chainManager.chainId,
      baseFrame: 'FRAME-WORLD',
      endEffectorFrame: 'FRAME-END-EFFECTOR',
      targetPose: { position: fk.endEffectorPosition, rotationMatrix: fk.endEffectorOrientation.rotationMatrix },
      positionTolerance: 1e-3,
      revision: chainManager.revision
    });

    const joints = chainManager.getJoints();
    for (const j of joints) {
      expect(run1.finalJointConfiguration[j.jointId]).toBe(run2.finalJointConfiguration[j.jointId]);
    }
  });

  it('IK-012: rejects invalid inputs (NaNs, zero-quaternion, degenerate matrices)', () => {
    const nanPos = {
      position: { x: NaN, y: 100, z: 200 }
    };
    const resNaN = ikEngine.solve({
      robotId: chainManager.robotId,
      configurationId: 'TEST-IK-012-NAN',
      kinematicChainId: chainManager.chainId,
      baseFrame: 'FRAME-WORLD',
      endEffectorFrame: 'FRAME-END-EFFECTOR',
      targetPose: nanPos,
      revision: chainManager.revision
    });
    expect(resNaN.convergenceStatus).toBe('INVALID_INPUT');

    const zeroQuat = {
      position: { x: 500, y: 0, z: 450 },
      quaternion: { w: 0, x: 0, y: 0, z: 0 }
    };
    const resQuat = ikEngine.solve({
      robotId: chainManager.robotId,
      configurationId: 'TEST-IK-012-QUAT',
      kinematicChainId: chainManager.chainId,
      baseFrame: 'FRAME-WORLD',
      endEffectorFrame: 'FRAME-END-EFFECTOR',
      targetPose: zeroQuat,
      revision: chainManager.revision
    });
    expect(resQuat.convergenceStatus).toBe('INVALID_INPUT');
  });

  it('IK-013: verifies numerical stability and smooth continuity under small perturbations', () => {
    const qKnown = { J1_BASE: 20, J2_SHOULDER: -15, J3_ELBOW: 30, J4_WRIST1: 10, J5_WRIST2: -20, J6_WRIST3: 25 };
    const fk = fkEngine.computeFromChainManager(qKnown);

    const baseRes = ikEngine.solve({
      robotId: chainManager.robotId,
      configurationId: 'TEST-IK-013-BASE',
      kinematicChainId: chainManager.chainId,
      baseFrame: 'FRAME-WORLD',
      endEffectorFrame: 'FRAME-END-EFFECTOR',
      targetPose: { position: fk.endEffectorPosition, rotationMatrix: fk.endEffectorOrientation.rotationMatrix },
      positionTolerance: 1e-3,
      revision: chainManager.revision
    });

    const perturbedPose = {
      position: {
        x: fk.endEffectorPosition.x + 0.5,
        y: fk.endEffectorPosition.y,
        z: fk.endEffectorPosition.z
      },
      rotationMatrix: fk.endEffectorOrientation.rotationMatrix
    };

    const perturbedRes = ikEngine.solve({
      robotId: chainManager.robotId,
      configurationId: 'TEST-IK-013-PERTURB',
      kinematicChainId: chainManager.chainId,
      baseFrame: 'FRAME-WORLD',
      endEffectorFrame: 'FRAME-END-EFFECTOR',
      targetPose: perturbedPose,
      initialJointConfiguration: baseRes.finalJointConfiguration,
      positionTolerance: 1e-3,
      revision: chainManager.revision
    });

    expect(perturbedRes.convergenceStatus).toBe('CONVERGED');
    // Solution should be very close to baseRes
    let maxDiff = 0;
    for (const j of chainManager.getJoints()) {
      const diff = Math.abs(perturbedRes.finalJointConfiguration[j.jointId] - baseRes.finalJointConfiguration[j.jointId]);
      if (diff > maxDiff) maxDiff = diff;
    }
    expect(maxDiff).toBeLessThan(5.0); // Smooth continuity
  });

  it('IK-014: computes singularity diagnostics and manipulability index', () => {
    const joints = chainManager.getJoints();
    const jac = RobotKinematicJacobian.computeGeometricJacobian(joints, {
      J1_BASE: 0,
      J2_SHOULDER: -20,
      J3_ELBOW: 40,
      J4_WRIST1: 0,
      J5_WRIST2: -20,
      J6_WRIST3: 0
    });

    const diag = RobotKinematicJacobian.analyzeSingularity(jac.J);
    expect(diag.manipulabilityIndex).toBeGreaterThan(0);
    expect(isFinite(diag.conditionNumber)).toBe(true);
    expect(diag.rank).toBeGreaterThanOrEqual(1);

    // Also verify singularity detection at straight outstretched boundary (q = 0)
    const jacSingular = RobotKinematicJacobian.computeGeometricJacobian(joints, {
      J1_BASE: 0,
      J2_SHOULDER: 0,
      J3_ELBOW: 0,
      J4_WRIST1: 0,
      J5_WRIST2: 0,
      J6_WRIST3: 0
    });
    const diagSingular = RobotKinematicJacobian.analyzeSingularity(jacSingular.J);
    expect(diagSingular.isNearSingular).toBe(true);
  });

  it('IK-015 & IK-016: generates signed evidence package and verifies EPC-011 provenance', () => {
    const pkg = EPC045Verifier.generateEvidencePackage();
    expect(pkg.epcId).toBe('EPC-045');
    expect(pkg.verdict).toBe('PASS');
    expect(pkg.evidenceHash).toBeDefined();
    expect(pkg.evidenceHash.length).toBe(64);
    expect(pkg.provenance).toBeDefined();
    expect(pkg.provenance.actor).toBe('SECP-IK-Position-Solver-Engine');
    expect(pkg.provenance.source).toBe('EPC-045');
    expect(pkg.traceability.evidenceHash).toBe(pkg.evidenceHash);

    // Verify hash integrity
    const computedHash = EvidenceIntegrityService.computeHash({
      epcId: pkg.epcId,
      robotId: pkg.robotId,
      robotRevision: pkg.robotRevision,
      kinematicChainId: pkg.kinematicChainId,
      targetPose: pkg.targetPose,
      initialJointConfiguration: pkg.initialJointConfiguration,
      finalJointConfiguration: pkg.finalJointConfiguration,
      jointLimits: pkg.jointLimits,
      solverMethod: pkg.solverMethod,
      solverConfiguration: pkg.solverConfiguration,
      positionTolerance: pkg.positionTolerance,
      orientationTolerance: pkg.orientationTolerance,
      iterations: pkg.iterations,
      finalPose: pkg.finalPose,
      positionError: pkg.positionError,
      orientationError: pkg.orientationError,
      totalError: pkg.totalError,
      convergenceStatus: pkg.convergenceStatus,
      constraintStatus: pkg.constraintStatus,
      singularityStatus: pkg.singularityStatus,
      alternativeSolutionsCount: pkg.alternativeSolutionsCount,
      selectedSolutionCriterion: pkg.selectedSolutionCriterion,
      forwardKinematicsVerification: pkg.forwardKinematicsVerification,
      testResults: pkg.testResults,
      timestamp: pkg.timestamp,
      provenance: pkg.provenance
    });

    expect(computedHash).toBe(pkg.evidenceHash);
  });

  it('executes full EPC-045 formal gate report with 100% PASS rate', () => {
    const gateReport = EPC045Verifier.verify();
    expect(gateReport.epc).toBe('EPC-045');
    expect(gateReport.verdict).toBe('PASS');
    expect(gateReport.summary.failedChecks).toBe(0);
    expect(gateReport.summary.passedChecks).toBe(16);
    expect(gateReport.evidenceHash.length).toBe(64);
  });
});
