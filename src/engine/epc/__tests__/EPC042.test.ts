import { describe, it, expect } from 'vitest';
import { RobotDOFManager } from '../robot/RobotDOFManager';
import { RobotJointDesignEngine } from '../robot/RobotJointDesignEngine';
import { EPC042Verifier } from '../robot/EPC042Verifier';

describe('EPC-042: Degrees of Freedom Specification Battery', () => {
  it('TEST-01: Fixed Joint - FIXED -> 0 DOF', () => {
    const manager = new RobotDOFManager();
    const fixedJoint = RobotJointDesignEngine.createDefaultJoint('J_FIXED', 'FIXED');
    manager.addJoint(fixedJoint);

    const mappings = manager.getJointDOFMappings().find(m => m.jointId === 'J_FIXED');
    expect(mappings).toBeDefined();
    expect(mappings?.declaredDOF).toBe(0);
    expect(mappings?.activeDOF).toBe(0);
  });

  it('TEST-02: Revolute Joint - REVOLUTE -> 1 DOF', () => {
    const manager = new RobotDOFManager();
    const revJoint = RobotJointDesignEngine.createDefaultJoint('J_REV', 'REVOLUTE');
    manager.addJoint(revJoint);

    const mappings = manager.getJointDOFMappings().find(m => m.jointId === 'J_REV');
    expect(mappings).toBeDefined();
    expect(mappings?.declaredDOF).toBe(1);
    expect(mappings?.activeDOF).toBe(1);
  });

  it('TEST-03: Prismatic Joint - PRISMATIC -> 1 DOF', () => {
    const manager = new RobotDOFManager();
    const prismJoint = RobotJointDesignEngine.createDefaultJoint('J_PRISM', 'PRISMATIC');
    manager.addJoint(prismJoint);

    const mappings = manager.getJointDOFMappings().find(m => m.jointId === 'J_PRISM');
    expect(mappings).toBeDefined();
    expect(mappings?.declaredDOF).toBe(1);
    expect(mappings?.activeDOF).toBe(1);
  });

  it('TEST-04: Six-Axis Robot - computes total active DOF = 6', () => {
    const manager = new RobotDOFManager();
    const summary = manager.computeDOFSummary();

    expect(summary.totalDeclaredDOF).toBe(6);
    expect(summary.totalActiveDOF).toBe(6);
    expect(summary.totalLockedDOF).toBe(0);
  });

  it('TEST-05: Locked Joint - Declared = 6, Active = 5, Locked = 1', () => {
    const manager = new RobotDOFManager();
    manager.setJointLocked('J3_ELBOW', true);

    const summary = manager.computeDOFSummary();
    expect(summary.totalDeclaredDOF).toBe(6);
    expect(summary.totalActiveDOF).toBe(5);
    expect(summary.totalLockedDOF).toBe(1);
  });

  it('TEST-06: Invalid Axis - Axis = (0,0,0) fails validation', () => {
    const manager = new RobotDOFManager();
    const badAxisJoint = RobotJointDesignEngine.createDefaultJoint('J_BAD_AXIS', 'REVOLUTE');
    badAxisJoint.axis = { x: 0, y: 0, z: 0 };
    manager.addJoint(badAxisJoint);

    const valReport = manager.validate();
    expect(valReport.valid).toBe(false);
    expect(valReport.issues.some(i => i.field === 'axis')).toBe(true);
  });

  it('TEST-07: Invalid Joint Limits - Minimum > Maximum fails validation', () => {
    const manager = new RobotDOFManager();
    const badLimitsJoint = RobotJointDesignEngine.createDefaultJoint('J_BAD_LIMITS', 'REVOLUTE');
    badLimitsJoint.limits.minimumPosition = 100;
    badLimitsJoint.limits.maximumPosition = -100;
    manager.addJoint(badLimitsJoint);

    const valReport = manager.validate();
    expect(valReport.valid).toBe(false);
    expect(valReport.issues.some(i => i.field.includes('limits'))).toBe(true);
  });

  it('TEST-08: DOF State Limits - Position out of bounds fails validation', () => {
    const manager = new RobotDOFManager();
    manager.setDOFState('DOF-J1_BASE', { position: 200 }); // Limits [-170, 170]

    const valReport = manager.validate();
    expect(valReport.valid).toBe(false);
    expect(valReport.issues.some(i => i.field.includes('state.position'))).toBe(true);
  });

  it('TEST-09: Assembly Modification - dynamically recalculates DOF', () => {
    const manager = new RobotDOFManager();
    manager.removeJoint('J6_WRIST_ROLL');
    expect(manager.computeDOFSummary().totalActiveDOF).toBe(5);

    const j6 = RobotJointDesignEngine.createDefaultJoint('J6_WRIST_ROLL', 'REVOLUTE');
    manager.addJoint(j6);
    expect(manager.computeDOFSummary().totalActiveDOF).toBe(6);
  });

  it('TEST-10: Joint Removal - DOF count decreases accordingly', () => {
    const manager = new RobotDOFManager();
    expect(manager.computeDOFSummary().totalActiveDOF).toBe(6);

    manager.removeJoint('J6_WRIST_ROLL');
    expect(manager.computeDOFSummary().totalActiveDOF).toBe(5);
  });

  it('TEST-11: Transmission Integration - verifies speed, ratio, velocity, torque consistency', () => {
    const manager = new RobotDOFManager();
    const binding = manager.bindTransmission('J2_SHOULDER', 3000, 100, 2.0, 0.98);

    expect(binding.jointSpeedRpm).toBe(30);
    expect(binding.dofVelocity).toBe(180);
    expect(binding.jointTorqueNm).toBe(196);
    expect(binding.isConsistent).toBe(true);
  });

  it('TEST-12: Constraint Integration - locking joint reduces independent DOF', () => {
    const manager = new RobotDOFManager();
    manager.setJointLocked('J1_BASE', true);

    const summary = manager.computeDOFSummary();
    expect(summary.independentDOF).toBe(5);
  });

  it('TEST-13: Reproducibility - produces bit-identical evidence hashes for identical configurations', () => {
    const fixedTime = '2026-09-03T12:00:00.000Z';
    const manager1 = new RobotDOFManager();
    const manager2 = new RobotDOFManager();

    const ev1 = manager1.generateEvidencePackage(fixedTime);
    const ev2 = manager2.generateEvidencePackage(fixedTime);

    expect(ev1.verdict).toBe('PASS');
    expect(ev1.evidenceHash).toBe(ev2.evidenceHash);
  });

  it('TEST-14: Evidence Generation & Provenance - produces valid SHA-256 evidence package', () => {
    const manager = new RobotDOFManager();
    const ev = manager.generateEvidencePackage();

    expect(ev.robotId).toBe('ROB-6DOF-IND-01');
    expect(ev.assemblyId).toBe('ASSY-ROBOT-6DOF');
    expect(ev.totalDeclaredDOF).toBe(6);
    expect(ev.totalActiveDOF).toBe(6);
    expect(ev.verdict).toBe('PASS');
    expect(ev.evidenceHash).not.toBe('');
  });

  it('Acceptance Gate Report - EPC042Verifier returns PASS', () => {
    const report = EPC042Verifier.verify();

    expect(report.epc).toBe('EPC-042');
    expect(report.verdict).toBe('PASS');
    expect(report.summary.failedChecks).toBe(0);
    expect(report.summary.passedChecks).toBe(14);
  });
});
