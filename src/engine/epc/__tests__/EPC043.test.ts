import { describe, it, expect } from 'vitest';
import { RobotKinematicChainManager } from '../robot/RobotKinematicChainManager';
import { RobotKinematicChainValidator } from '../robot/RobotKinematicChainValidator';
import { EPC043Verifier } from '../robot/EPC043Verifier';
import { TransformMatrix } from '../../assembly/graph/TransformMatrix';

describe('EPC-043: Kinematic Chain Specification Battery', () => {
  it('TEST-01: Simple Chain Verification', () => {
    const mgr = new RobotKinematicChainManager();
    const report = mgr.validate();
    expect(report.valid).toBe(true);
    expect(report.checks.rootValid).toBe(true);
    expect(mgr.getLinkCount()).toBeGreaterThanOrEqual(2);
  });

  it('TEST-02: Six Axis Chain Representation', () => {
    const mgr = new RobotKinematicChainManager();
    expect(mgr.getLinkCount()).toBe(7);
    expect(mgr.getJointCount()).toBe(6);
    expect(mgr.getActiveDOFCount()).toBe(6);
    expect(mgr.getChainDepth()).toBe(7);
  });

  it('TEST-03: Parent/Child Integrity', () => {
    const mgr = new RobotKinematicChainManager();
    const report = mgr.validate();
    expect(report.checks.parentChildValid).toBe(true);
    expect(report.checks.jointRefsValid).toBe(true);
  });

  it('TEST-04: Broken Reference Detection', () => {
    const mgr = new RobotKinematicChainManager();
    mgr.addJoint({
      jointId: 'J_BROKEN',
      jointType: 'REVOLUTE',
      parentLinkId: 'LINK-NON-EXISTENT',
      childLinkId: 'LINK-J1-SWIVEL',
      axis: { x: 0, y: 0, z: 1 },
      referenceFrame: 'FRAME-BROKEN',
      dofId: 'DOF-BROKEN',
      limits: { minimumPosition: -100, maximumPosition: 100 },
      originTransform: TransformMatrix.identity(),
      state: { position: 0, velocity: 0, acceleration: 0 },
      revision: 'REV-A'
    });

    const report = mgr.validate();
    expect(report.valid).toBe(false);
    expect(report.checks.jointRefsValid).toBe(false);
  });

  it('TEST-05: Orphan Link Detection', () => {
    const mgr = new RobotKinematicChainManager();
    mgr.addLink({
      linkId: 'LINK-ORPHAN',
      partId: 'PART-DEF-BASE-PLATE',
      assemblyInstanceId: 'INST-BASE-PLATE-001',
      parentLinkId: 'LINK-MISSING-PARENT',
      childLinkIds: [],
      referenceFrame: 'FRAME-ORPHAN',
      massProperties: { unitMassKg: 5, centerOfMassMm: { x: 0, y: 0, z: 0 } },
      geometryReference: 'CAD-ORPHAN',
      revision: 'REV-A'
    });

    const report = mgr.validate();
    expect(report.valid).toBe(false);
    expect(report.checks.connected).toBe(false);
  });

  it('TEST-06: Kinematic Cycle Detection', () => {
    const mgr = new RobotKinematicChainManager();
    const links = mgr.getLinks();
    const j6Link = links.find((l) => l.linkId === 'LINK-J6-END-EFFECTOR');
    if (j6Link) {
      j6Link.childLinkIds.push('LINK-J1-SWIVEL');
    }

    const report = RobotKinematicChainValidator.validate({
      ...mgr.getModel(),
      links
    });

    expect(report.valid).toBe(false);
    expect(report.checks.cycleFree).toBe(false);
  });

  it('TEST-07: Invalid Axis Validation', () => {
    const mgr = new RobotKinematicChainManager();
    const joints = mgr.getJoints();
    joints[0].axis = { x: 0, y: 0, z: 0 };

    const report = RobotKinematicChainValidator.validate({
      ...mgr.getModel(),
      joints
    });

    expect(report.valid).toBe(false);
    expect(report.checks.axesValid).toBe(false);
  });

  it('TEST-08: Joint Limit Enforcement', () => {
    const mgr = new RobotKinematicChainManager();
    mgr.setJointPosition('J1_BASE', 250); // Limit [-170, 170]

    const report = mgr.validate(true);
    expect(report.valid).toBe(false);
    expect(report.checks.limitsValid).toBe(false);
  });

  it('TEST-09: Forward Kinematics Transform Propagation', () => {
    const mgr = new RobotKinematicChainManager();
    const initialPose = mgr.getEndEffectorPose();

    mgr.setJointPosition('J1_BASE', 90);
    const newPose = mgr.getEndEffectorPose();

    const changed = Math.abs(initialPose.position.x - newPose.position.x) > 0.1 ||
                    Math.abs(initialPose.position.y - newPose.position.y) > 0.1;
    expect(changed).toBe(true);
  });

  it('TEST-10: Locality Property Verification', () => {
    const mgr = new RobotKinematicChainManager();
    const j1Before = mgr.getFrames().find((f) => f.frameId === 'FRAME-J1_BASE')?.worldTransform;

    mgr.setJointPosition('J3_ELBOW', 45);

    const j1After = mgr.getFrames().find((f) => f.frameId === 'FRAME-J1_BASE')?.worldTransform;

    expect(j1Before).toBeDefined();
    expect(j1After).toBeDefined();
    if (j1Before && j1After) {
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          expect(j1Before[r][c]).toBeCloseTo(j1After[r][c], 5);
        }
      }
    }
  });

  it('TEST-11: EPC-042 DOF Integration', () => {
    const mgr = new RobotKinematicChainManager();
    const model = mgr.getModel();
    expect(model.dofMapping.length).toBe(6);
    expect(model.dofMapping.every((d) => d.dofId.length > 0)).toBe(true);
  });

  it('TEST-12: EPC-040 Transmission Integration', () => {
    const mgr = new RobotKinematicChainManager();
    mgr.setMotorState('J1_BASE', 3000, 1000); // 100:1 ratio -> joint position = 10deg, speed = 180deg/s

    const j1 = mgr.getJoints().find((j) => j.jointId === 'J1_BASE');
    expect(j1).toBeDefined();
    expect(j1?.state.position).toBeCloseTo(10, 3);
    expect(j1?.state.velocity).toBeCloseTo(180, 3);
  });

  it('TEST-13: EPC-041 Assembly Integration', () => {
    const mgr = new RobotKinematicChainManager();
    const countBefore = mgr.getLinkCount();

    mgr.addLink({
      linkId: 'LINK-DYNAMIC-TOOL',
      partId: 'PART-DEF-HOUSING-J6',
      assemblyInstanceId: 'INST-HOUSING-J6-001',
      parentLinkId: 'LINK-J6-END-EFFECTOR',
      childLinkIds: [],
      referenceFrame: 'FRAME-DYNAMIC-TOOL',
      massProperties: { unitMassKg: 1.0, centerOfMassMm: { x: 0, y: 0, z: 0 } },
      geometryReference: 'CAD-TOOL',
      revision: 'REV-A'
    });

    expect(mgr.getLinkCount()).toBe(countBefore + 1);
  });

  it('TEST-14: Deterministic Chain Ordering', () => {
    const mgr1 = new RobotKinematicChainManager();
    const mgr2 = new RobotKinematicChainManager();

    expect(mgr1.getLinks().map((l) => l.linkId)).toEqual(mgr2.getLinks().map((l) => l.linkId));
    expect(mgr1.getJoints().map((j) => j.jointId)).toEqual(mgr2.getJoints().map((j) => j.jointId));
  });

  it('TEST-15: Reproducibility & Numerical Stability', () => {
    const ts = '2026-09-03T12:00:00.000Z';
    const mgr1 = new RobotKinematicChainManager();
    const mgr2 = new RobotKinematicChainManager();

    mgr1.setJointPositions({ J1_BASE: 20, J2_SHOULDER: -15 });
    mgr2.setJointPositions({ J1_BASE: 20, J2_SHOULDER: -15 });

    const pkg1 = mgr1.generateEvidencePackage(ts);
    const pkg2 = mgr2.generateEvidencePackage(ts);

    expect(pkg1.evidenceHash).toEqual(pkg2.evidenceHash);
  });

  it('TEST-16: Acceptance Verifier Gate Report', () => {
    const gateReport = EPC043Verifier.verify();
    expect(gateReport.epc).toBe('EPC-043');
    expect(gateReport.verdict).toBe('PASS');
    expect(gateReport.summary.failedChecks).toBe(0);
    expect(gateReport.summary.passedChecks).toBe(16);
    expect(gateReport.evidenceHash.length).toBe(64);
  });
});
