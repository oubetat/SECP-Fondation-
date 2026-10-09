/**
 * SECP Industrial OS — EPC-042: Robot Degrees of Freedom Verifier
 * Comprehensive acceptance gate verifier executing TEST-01 through TEST-14
 * for the Degrees of Freedom proof case of the Industrial Robotic Arm.
 */

import { RobotDOFManager } from './RobotDOFManager';
import { EPC042GateReport } from './RobotDOFTypes';
import { RobotJointDesignEngine } from './RobotJointDesignEngine';
import { EvidenceIntegrityService } from '../evidence/EvidenceIntegrityService';

export class EPC042Verifier {
  /**
   * Executes complete verification battery for EPC-042
   */
  public static verify(): EPC042GateReport {
    const checks: Record<string, { passed: boolean; message: string }> = {};

    // -----------------------------------------------------------------------
    // TEST-01: Fixed Joint (FIXED -> 0 DOF)
    // -----------------------------------------------------------------------
    try {
      const manager = new RobotDOFManager();
      const fixedJoint = RobotJointDesignEngine.createDefaultJoint('J_FIXED', 'FIXED');
      manager.addJoint(fixedJoint);

      const mappings = manager.getJointDOFMappings().find(m => m.jointId === 'J_FIXED');
      const passed = mappings !== undefined && mappings.declaredDOF === 0 && mappings.activeDOF === 0;
      checks['TEST-01: Fixed Joint Mapping'] = {
        passed,
        message: passed ? 'FIXED joint correctly maps to 0 DOFs' : `Expected 0 DOFs, got ${mappings?.declaredDOF}`
      };
    } catch (e: any) {
      checks['TEST-01: Fixed Joint Mapping'] = { passed: false, message: e.message };
    }

    // -----------------------------------------------------------------------
    // TEST-02: Revolute Joint (REVOLUTE -> 1 DOF)
    // -----------------------------------------------------------------------
    try {
      const manager = new RobotDOFManager();
      const revJoint = RobotJointDesignEngine.createDefaultJoint('J_REV', 'REVOLUTE');
      manager.addJoint(revJoint);

      const mappings = manager.getJointDOFMappings().find(m => m.jointId === 'J_REV');
      const passed = mappings !== undefined && mappings.declaredDOF === 1 && mappings.activeDOF === 1;
      checks['TEST-02: Revolute Joint Mapping'] = {
        passed,
        message: passed ? 'REVOLUTE joint correctly maps to 1 DOF' : `Expected 1 DOF, got ${mappings?.declaredDOF}`
      };
    } catch (e: any) {
      checks['TEST-02: Revolute Joint Mapping'] = { passed: false, message: e.message };
    }

    // -----------------------------------------------------------------------
    // TEST-03: Prismatic Joint (PRISMATIC -> 1 DOF)
    // -----------------------------------------------------------------------
    try {
      const manager = new RobotDOFManager();
      const prismJoint = RobotJointDesignEngine.createDefaultJoint('J_PRISM', 'PRISMATIC');
      manager.addJoint(prismJoint);

      const mappings = manager.getJointDOFMappings().find(m => m.jointId === 'J_PRISM');
      const passed = mappings !== undefined && mappings.declaredDOF === 1 && mappings.activeDOF === 1;
      checks['TEST-03: Prismatic Joint Mapping'] = {
        passed,
        message: passed ? 'PRISMATIC joint correctly maps to 1 DOF' : `Expected 1 DOF, got ${mappings?.declaredDOF}`
      };
    } catch (e: any) {
      checks['TEST-03: Prismatic Joint Mapping'] = { passed: false, message: e.message };
    }

    // -----------------------------------------------------------------------
    // TEST-04: Six-Axis Robot (Total DOF = 6)
    // -----------------------------------------------------------------------
    try {
      const manager = new RobotDOFManager();
      const summary = manager.computeDOFSummary();

      const passed = summary.totalDeclaredDOF === 6 && summary.totalActiveDOF === 6;
      checks['TEST-04: Six-Axis Robot Total DOF'] = {
        passed,
        message: passed
          ? 'Six-Axis robot assembly computes total active DOF = 6'
          : `Expected Declared=6, Active=6. Got Declared=${summary.totalDeclaredDOF}, Active=${summary.totalActiveDOF}`
      };
    } catch (e: any) {
      checks['TEST-04: Six-Axis Robot Total DOF'] = { passed: false, message: e.message };
    }

    // -----------------------------------------------------------------------
    // TEST-05: Locked Joint (Declared = 6, Active = 5, Locked = 1)
    // -----------------------------------------------------------------------
    try {
      const manager = new RobotDOFManager();
      manager.setJointLocked('J3_ELBOW', true);
      const summary = manager.computeDOFSummary();

      const passed = summary.totalDeclaredDOF === 6 && summary.totalActiveDOF === 5 && summary.totalLockedDOF === 1;
      checks['TEST-05: Locked Joint Support'] = {
        passed,
        message: passed
          ? 'Locking Joint 3 results in Declared=6, Active=5, Locked=1'
          : `Expected Declared=6, Active=5, Locked=1. Got Declared=${summary.totalDeclaredDOF}, Active=${summary.totalActiveDOF}, Locked=${summary.totalLockedDOF}`
      };
    } catch (e: any) {
      checks['TEST-05: Locked Joint Support'] = { passed: false, message: e.message };
    }

    // -----------------------------------------------------------------------
    // TEST-06: Invalid Axis (Axis = (0,0,0) -> Validation = FAIL)
    // -----------------------------------------------------------------------
    try {
      const manager = new RobotDOFManager();
      const invalidAxisJoint = RobotJointDesignEngine.createDefaultJoint('J_BAD_AXIS', 'REVOLUTE');
      invalidAxisJoint.axis = { x: 0, y: 0, z: 0 };
      manager.addJoint(invalidAxisJoint);

      const valReport = manager.validate();
      const passed = !valReport.valid && valReport.issues.some(i => i.field === 'axis');
      checks['TEST-06: Invalid Axis Rejection'] = {
        passed,
        message: passed ? 'Zero length axis correctly caught by validation' : 'Failed to reject zero-length axis'
      };
    } catch (e: any) {
      checks['TEST-06: Invalid Axis Rejection'] = { passed: false, message: e.message };
    }

    // -----------------------------------------------------------------------
    // TEST-07: Invalid Joint Limits (Min > Max -> Validation = FAIL)
    // -----------------------------------------------------------------------
    try {
      const manager = new RobotDOFManager();
      const invalidLimitsJoint = RobotJointDesignEngine.createDefaultJoint('J_BAD_LIMITS', 'REVOLUTE');
      invalidLimitsJoint.limits.minimumPosition = 180;
      invalidLimitsJoint.limits.maximumPosition = -180;
      manager.addJoint(invalidLimitsJoint);

      const valReport = manager.validate();
      const passed = !valReport.valid && valReport.issues.some(i => i.field.includes('limits'));
      checks['TEST-07: Invalid Joint Limits Rejection'] = {
        passed,
        message: passed ? 'Invalid limits (min > max) correctly rejected' : 'Failed to reject invalid limits'
      };
    } catch (e: any) {
      checks['TEST-07: Invalid Joint Limits Rejection'] = { passed: false, message: e.message };
    }

    // -----------------------------------------------------------------------
    // TEST-08: DOF State Limits (State outside limits -> Validation = FAIL)
    // -----------------------------------------------------------------------
    try {
      const manager = new RobotDOFManager();
      manager.setDOFState('DOF-J1_BASE', { position: 250 }); // Limits [-170, 170]

      const valReport = manager.validate();
      const passed = !valReport.valid && valReport.issues.some(i => i.field.includes('state.position'));
      checks['TEST-08: State Limits Rejection'] = {
        passed,
        message: passed ? 'Out-of-bounds state position correctly rejected' : 'Failed to reject out-of-bounds position'
      };
    } catch (e: any) {
      checks['TEST-08: State Limits Rejection'] = { passed: false, message: e.message };
    }

    // -----------------------------------------------------------------------
    // TEST-09: Assembly Modification (Dynamic DOF Recalculation)
    // -----------------------------------------------------------------------
    try {
      const manager = new RobotDOFManager();
      // Remove J6 to start with 5 DOFs
      manager.removeJoint('J6_WRIST_ROLL');
      const sumInitial = manager.computeDOFSummary();

      // Add J6 back to get 6 DOFs
      const j6 = RobotJointDesignEngine.createDefaultJoint('J6_WRIST_ROLL', 'REVOLUTE');
      manager.addJoint(j6);
      const sumFinal = manager.computeDOFSummary();

      const passed = sumInitial.totalActiveDOF === 5 && sumFinal.totalActiveDOF === 6;
      checks['TEST-09: Assembly Modification Recalculation'] = {
        passed,
        message: passed
          ? 'DOF count dynamically updated from 5 to 6 upon adding joint'
          : `Expected 5 -> 6, got ${sumInitial.totalActiveDOF} -> ${sumFinal.totalActiveDOF}`
      };
    } catch (e: any) {
      checks['TEST-09: Assembly Modification Recalculation'] = { passed: false, message: e.message };
    }

    // -----------------------------------------------------------------------
    // TEST-10: Joint Removal (DOF Decreases Accordingly)
    // -----------------------------------------------------------------------
    try {
      const manager = new RobotDOFManager();
      const sumInitial = manager.computeDOFSummary();
      manager.removeJoint('J6_WRIST_ROLL');
      const sumAfterRemove = manager.computeDOFSummary();

      const passed = sumInitial.totalActiveDOF === 6 && sumAfterRemove.totalActiveDOF === 5;
      checks['TEST-10: Joint Removal Decreases DOF'] = {
        passed,
        message: passed
          ? 'Removing joint decreased active DOF from 6 to 5'
          : `Expected 6 -> 5, got ${sumInitial.totalActiveDOF} -> ${sumAfterRemove.totalActiveDOF}`
      };
    } catch (e: any) {
      checks['TEST-10: Joint Removal Decreases DOF'] = { passed: false, message: e.message };
    }

    // -----------------------------------------------------------------------
    // TEST-11: Transmission Integration (Motor Speed -> Ratio -> Joint Speed -> DOF Velocity)
    // -----------------------------------------------------------------------
    try {
      const manager = new RobotDOFManager();
      const binding = manager.bindTransmission('J2_SHOULDER', 3000, 100, 2.0, 0.98);

      const expectedSpeedRpm = 30; // 3000 / 100
      const expectedDofVelDegS = 180; // 30 * 6
      const expectedTorqueNm = 196; // 2 * 100 * 0.98

      const passed =
        Math.abs(binding.jointSpeedRpm - expectedSpeedRpm) < 1e-3 &&
        Math.abs(binding.dofVelocity - expectedDofVelDegS) < 1e-3 &&
        Math.abs(binding.jointTorqueNm - expectedTorqueNm) < 1e-2;

      checks['TEST-11: Transmission Integration Consistency'] = {
        passed,
        message: passed
          ? 'Transmission speed/ratio/torque correctly mapped to DOF state'
          : `Transmission mismatch: speed=${binding.jointSpeedRpm}, vel=${binding.dofVelocity}, torque=${binding.jointTorqueNm}`
      };
    } catch (e: any) {
      checks['TEST-11: Transmission Integration Consistency'] = { passed: false, message: e.message };
    }

    // -----------------------------------------------------------------------
    // TEST-12: Constraint Integration
    // -----------------------------------------------------------------------
    try {
      const manager = new RobotDOFManager();
      manager.setJointLocked('J1_BASE', true);
      const summary = manager.computeDOFSummary();

      const passed = summary.independentDOF === 5;
      checks['TEST-12: Constraint Integration'] = {
        passed,
        message: passed ? 'Locking J1 correctly reduces independent DOF to 5' : `Expected independent DOF = 5, got ${summary.independentDOF}`
      };
    } catch (e: any) {
      checks['TEST-12: Constraint Integration'] = { passed: false, message: e.message };
    }

    // -----------------------------------------------------------------------
    // TEST-13: Reproducibility (Bit-identical Evidence Hashes)
    // -----------------------------------------------------------------------
    try {
      const fixedTime = '2026-09-03T12:00:00.000Z';
      const manager1 = new RobotDOFManager();
      const manager2 = new RobotDOFManager();

      const ev1 = manager1.generateEvidencePackage(fixedTime);
      const ev2 = manager2.generateEvidencePackage(fixedTime);

      const passed = ev1.evidenceHash === ev2.evidenceHash && ev1.verdict === 'PASS' && ev2.verdict === 'PASS';
      checks['TEST-13: Reproducibility'] = {
        passed,
        message: passed
          ? 'Identical robot configurations produce bit-identical evidence hashes'
          : `Evidence hash mismatch: ${ev1.evidenceHash} vs ${ev2.evidenceHash}`
      };
    } catch (e: any) {
      checks['TEST-13: Reproducibility'] = { passed: false, message: e.message };
    }

    // -----------------------------------------------------------------------
    // TEST-14: Evidence Generation
    // -----------------------------------------------------------------------
    try {
      const manager = new RobotDOFManager();
      const ev = manager.generateEvidencePackage();

      const passed =
        ev.robotId === 'ROB-6DOF-IND-01' &&
        ev.assemblyId === 'ASSY-ROBOT-6DOF' &&
        ev.totalDeclaredDOF === 6 &&
        ev.totalActiveDOF === 6 &&
        ev.verdict === 'PASS' &&
        ev.evidenceHash !== '';

      checks['TEST-14: Evidence Package Generation'] = {
        passed,
        message: passed ? 'Evidence package successfully generated with valid SHA-256 hash' : 'Invalid evidence package'
      };
    } catch (e: any) {
      checks['TEST-14: Evidence Package Generation'] = { passed: false, message: e.message };
    }

    // -----------------------------------------------------------------------
    // VERDICT DERIVATION
    // -----------------------------------------------------------------------
    const checkValues = Object.values(checks);
    const passedCount = checkValues.filter(c => c.passed).length;
    const failedCount = checkValues.filter(c => !c.passed).length;
    const totalChecks = checkValues.length;

    const verdict: 'PASS' | 'FAIL' = failedCount === 0 && totalChecks === 14 ? 'PASS' : 'FAIL';

    const evidencePayload = {
      epc: 'EPC-042',
      checks,
      summary: { totalChecks, passedChecks: passedCount, failedChecks: failedCount },
      verdict
    };

    const evidenceHash = EvidenceIntegrityService.computeHash(evidencePayload);

    return {
      epc: 'EPC-042',
      name: 'Degrees of Freedom (DOF) Model & Analysis Battery',
      verdict,
      checks,
      summary: {
        totalChecks,
        passedChecks: passedCount,
        failedChecks: failedCount
      },
      evidenceHash,
      timestamp: new Date().toISOString()
    };
  }
}
