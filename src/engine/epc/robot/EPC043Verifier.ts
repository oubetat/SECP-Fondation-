/**
 * SECP Industrial OS — EPC-043: Acceptance Gate Verifier
 * Verifies Kinematic Chain infrastructure across 16 formal tests:
 * TEST-01: Simple Chain Verification
 * TEST-02: Six Axis Chain Representation
 * TEST-03: Parent/Child Integrity
 * TEST-04: Broken Reference Detection
 * TEST-05: Orphan Link Detection
 * TEST-06: Kinematic Cycle Detection
 * TEST-07: Invalid Axis Validation
 * TEST-08: Joint Limit Enforcement
 * TEST-09: Forward Kinematics Transform Propagation
 * TEST-10: Locality Property Verification
 * TEST-11: EPC-042 DOF Integration
 * TEST-12: EPC-040 Transmission Integration
 * TEST-13: EPC-041 Assembly Integration
 * TEST-14: Deterministic Chain Ordering
 * TEST-15: Reproducibility & Numerical Stability
 * TEST-16: Evidence Package & SHA-256 Hashing
 */

import { EPC043GateReport } from './RobotKinematicTypes';
import { RobotKinematicChainManager } from './RobotKinematicChainManager';
import { RobotKinematicChainValidator } from './RobotKinematicChainValidator';
import { TransformMatrix } from '../../assembly/graph/TransformMatrix';
import { EvidenceIntegrityService } from '../evidence/EvidenceIntegrityService';

export class EPC043Verifier {
  public static verify(): EPC043GateReport {
    const checks: Record<string, { passed: boolean; message: string }> = {};

    // -----------------------------------------------------------------------
    // TEST-01: Simple Chain Verification
    // -----------------------------------------------------------------------
    try {
      const mgr = new RobotKinematicChainManager();
      // Test simple chain subset
      const report = mgr.validate();
      checks['TEST-01-SIMPLE-CHAIN'] = {
        passed: report.checks.rootValid && mgr.getLinkCount() >= 2,
        message: `Simple chain constructed with ${mgr.getLinkCount()} links, root valid: ${report.checks.rootValid}`
      };
    } catch (err: any) {
      checks['TEST-01-SIMPLE-CHAIN'] = { passed: false, message: err.message };
    }

    // -----------------------------------------------------------------------
    // TEST-02: Six Axis Chain Representation
    // -----------------------------------------------------------------------
    try {
      const mgr = new RobotKinematicChainManager();
      const linkCount = mgr.getLinkCount();
      const jointCount = mgr.getJointCount();
      const activeDOF = mgr.getActiveDOFCount();
      const is6DOF = linkCount === 7 && jointCount === 6 && activeDOF === 6;

      checks['TEST-02-SIX-AXIS-CHAIN'] = {
        passed: is6DOF,
        message: `6-Axis chain confirmed: ${linkCount} links, ${jointCount} joints, ${activeDOF} active DOFs`
      };
    } catch (err: any) {
      checks['TEST-02-SIX-AXIS-CHAIN'] = { passed: false, message: err.message };
    }

    // -----------------------------------------------------------------------
    // TEST-03: Parent/Child Integrity
    // -----------------------------------------------------------------------
    try {
      const mgr = new RobotKinematicChainManager();
      const report = mgr.validate();

      checks['TEST-03-PARENT-CHILD-INTEGRITY'] = {
        passed: report.checks.parentChildValid && report.checks.jointRefsValid,
        message: `Parent/child integrity pass: ${report.checks.parentChildValid}`
      };
    } catch (err: any) {
      checks['TEST-03-PARENT-CHILD-INTEGRITY'] = { passed: false, message: err.message };
    }

    // -----------------------------------------------------------------------
    // TEST-04: Broken Reference Detection
    // -----------------------------------------------------------------------
    try {
      const mgr = new RobotKinematicChainManager();
      mgr.addJoint({
        jointId: 'J_BROKEN',
        jointType: 'REVOLUTE',
        parentLinkId: 'LINK-NON-EXISTENT-PARENT',
        childLinkId: 'LINK-J1-SWIVEL',
        axis: { x: 0, y: 0, z: 1 },
        referenceFrame: 'FRAME-INVALID',
        dofId: 'DOF-BROKEN',
        limits: { minimumPosition: -100, maximumPosition: 100 },
        originTransform: TransformMatrix.identity(),
        state: { position: 0, velocity: 0, acceleration: 0 },
        revision: 'REV-A'
      });

      const report = mgr.validate();
      const detected = !report.valid && !report.checks.jointRefsValid;

      checks['TEST-04-BROKEN-REFERENCE'] = {
        passed: detected,
        message: `Broken reference detected as expected: ${detected}`
      };
    } catch (err: any) {
      checks['TEST-04-BROKEN-REFERENCE'] = { passed: false, message: err.message };
    }

    // -----------------------------------------------------------------------
    // TEST-05: Orphan Link Detection
    // -----------------------------------------------------------------------
    try {
      const mgr = new RobotKinematicChainManager();
      mgr.addLink({
        linkId: 'LINK-ORPHAN-ISOLATED',
        partId: 'PART-DEF-BASE-PLATE',
        assemblyInstanceId: 'INST-BASE-PLATE-001',
        parentLinkId: 'LINK-SOME-OTHER-PARENT',
        childLinkIds: [],
        referenceFrame: 'FRAME-ORPHAN',
        massProperties: { unitMassKg: 5, centerOfMassMm: { x: 0, y: 0, z: 0 } },
        geometryReference: 'CAD-ORPHAN',
        revision: 'REV-A'
      });

      const report = mgr.validate();
      const detected = !report.valid && !report.checks.connected;

      checks['TEST-05-ORPHAN-LINK'] = {
        passed: detected,
        message: `Orphan link detected: ${detected}, connected=${report.checks.connected}`
      };
    } catch (err: any) {
      checks['TEST-05-ORPHAN-LINK'] = { passed: false, message: err.message };
    }

    // -----------------------------------------------------------------------
    // TEST-06: Kinematic Cycle Detection
    // -----------------------------------------------------------------------
    try {
      const mgr = new RobotKinematicChainManager();
      // Force a cycle in child link IDs
      const links = mgr.getLinks();
      const j6Link = links.find((l) => l.linkId === 'LINK-J6-END-EFFECTOR');
      if (j6Link) {
        j6Link.childLinkIds.push('LINK-J1-SWIVEL'); // Cycle: J1 -> J2 -> ... -> J6 -> J1
      }

      const report = RobotKinematicChainValidator.validate({
        ...mgr.getModel(),
        links
      });

      const cycleDetected = !report.valid && !report.checks.cycleFree;

      checks['TEST-06-CYCLE-DETECTION'] = {
        passed: cycleDetected,
        message: `Kinematic cycle detected: ${cycleDetected}`
      };
    } catch (err: any) {
      checks['TEST-06-CYCLE-DETECTION'] = { passed: false, message: err.message };
    }

    // -----------------------------------------------------------------------
    // TEST-07: Invalid Axis Validation
    // -----------------------------------------------------------------------
    try {
      const mgr = new RobotKinematicChainManager();
      const joints = mgr.getJoints();
      joints[0].axis = { x: 0, y: 0, z: 0 }; // Zero vector

      const report = RobotKinematicChainValidator.validate({
        ...mgr.getModel(),
        joints
      });

      const detected = !report.valid && !report.checks.axesValid;

      checks['TEST-07-INVALID-AXIS'] = {
        passed: detected,
        message: `Zero axis vector rejected: ${detected}`
      };
    } catch (err: any) {
      checks['TEST-07-INVALID-AXIS'] = { passed: false, message: err.message };
    }

    // -----------------------------------------------------------------------
    // TEST-08: Joint Limit Enforcement
    // -----------------------------------------------------------------------
    try {
      const mgr = new RobotKinematicChainManager();
      mgr.setJointPosition('J1_BASE', 250); // Limit is [-170, 170]

      const report = mgr.validate(true);
      const limitViolationDetected = !report.valid && !report.checks.limitsValid;

      checks['TEST-08-JOINT-LIMIT'] = {
        passed: limitViolationDetected,
        message: `Joint limit violation detected at position 250deg: ${limitViolationDetected}`
      };
    } catch (err: any) {
      checks['TEST-08-JOINT-LIMIT'] = { passed: false, message: err.message };
    }

    // -----------------------------------------------------------------------
    // TEST-09: Forward Kinematics Transform Propagation
    // -----------------------------------------------------------------------
    try {
      const mgr = new RobotKinematicChainManager();
      const poseInitial = mgr.getEndEffectorPose();

      mgr.setJointPosition('J1_BASE', 90);
      const poseAfterJ1 = mgr.getEndEffectorPose();

      const poseChanged = Math.abs(poseInitial.position.x - poseAfterJ1.position.x) > 0.1 ||
                          Math.abs(poseInitial.position.y - poseAfterJ1.position.y) > 0.1;

      checks['TEST-09-TRANSFORM-PROPAGATION'] = {
        passed: poseChanged,
        message: `Transform propagation verified: EE position changed after J1 rotation (Initial: (${poseInitial.position.x}, ${poseInitial.position.y}) vs New: (${poseAfterJ1.position.x}, ${poseAfterJ1.position.y}))`
      };
    } catch (err: any) {
      checks['TEST-09-TRANSFORM-PROPAGATION'] = { passed: false, message: err.message };
    }

    // -----------------------------------------------------------------------
    // TEST-10: Locality Property Verification
    // -----------------------------------------------------------------------
    try {
      const mgr = new RobotKinematicChainManager();
      const framesBefore = mgr.getFrames();
      const j1FrameBefore = framesBefore.find((f) => f.frameId === 'FRAME-J1_BASE')?.worldTransform;
      const link1FrameBefore = framesBefore.find((f) => f.associatedEntityId === 'LINK-J1-SWIVEL')?.worldTransform;

      // Change Joint 3 (Elbow) angle
      mgr.setJointPosition('J3_ELBOW', 45);

      const framesAfter = mgr.getFrames();
      const j1FrameAfter = framesAfter.find((f) => f.frameId === 'FRAME-J1_BASE')?.worldTransform;
      const link1FrameAfter = framesAfter.find((f) => f.associatedEntityId === 'LINK-J1-SWIVEL')?.worldTransform;

      let upstreamUnchanged = true;
      if (j1FrameBefore && j1FrameAfter) {
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 4; c++) {
            if (Math.abs(j1FrameBefore[r][c] - j1FrameAfter[r][c]) > 1e-6) {
              upstreamUnchanged = false;
            }
          }
        }
      }
      if (link1FrameBefore && link1FrameAfter) {
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 4; c++) {
            if (Math.abs(link1FrameBefore[r][c] - link1FrameAfter[r][c]) > 1e-6) {
              upstreamUnchanged = false;
            }
          }
        }
      }

      checks['TEST-10-LOCALITY'] = {
        passed: upstreamUnchanged,
        message: `Locality property verified: changing J3 leaves upstream frames J1 and Link1 unchanged: ${upstreamUnchanged}`
      };
    } catch (err: any) {
      checks['TEST-10-LOCALITY'] = { passed: false, message: err.message };
    }

    // -----------------------------------------------------------------------
    // TEST-11: EPC-042 DOF Integration
    // -----------------------------------------------------------------------
    try {
      const mgr = new RobotKinematicChainManager();
      const model = mgr.getModel();
      const boundDOF = model.dofMapping.length === 6 && model.dofMapping.every((d) => d.dofId.startsWith('DOF-'));

      checks['TEST-11-DOF-INTEGRATION'] = {
        passed: boundDOF,
        message: `DOF Integration pass: 6 DOFs mapped to joint definitions`
      };
    } catch (err: any) {
      checks['TEST-11-DOF-INTEGRATION'] = { passed: false, message: err.message };
    }

    // -----------------------------------------------------------------------
    // TEST-12: EPC-040 Transmission Integration
    // -----------------------------------------------------------------------
    try {
      const mgr = new RobotKinematicChainManager();
      // Set motor at 3000 RPM, 1000 deg -> ratio 100:1 -> joint angle = 10 deg, velocity = 180 deg/s
      mgr.setMotorState('J1_BASE', 3000, 1000);

      const joints = mgr.getJoints();
      const j1 = joints.find((j) => j.jointId === 'J1_BASE');
      const consistent = j1 ? Math.abs(j1.state.position - 10) < 1e-4 && Math.abs(j1.state.velocity - 180) < 1e-4 : false;

      checks['TEST-12-TRANSMISSION-INTEGRATION'] = {
        passed: consistent,
        message: `Transmission integration pass: motor 1000deg at 100:1 ratio yields joint position ${j1?.state.position}deg`
      };
    } catch (err: any) {
      checks['TEST-12-TRANSMISSION-INTEGRATION'] = { passed: false, message: err.message };
    }

    // -----------------------------------------------------------------------
    // TEST-13: EPC-041 Assembly Integration
    // -----------------------------------------------------------------------
    try {
      const mgr = new RobotKinematicChainManager();
      const initialCount = mgr.getLinkCount();

      mgr.addLink({
        linkId: 'LINK-TOOL-GRIPPER',
        partId: 'PART-DEF-HOUSING-J6',
        assemblyInstanceId: 'INST-HOUSING-J6-001',
        parentLinkId: 'LINK-J6-END-EFFECTOR',
        childLinkIds: [],
        referenceFrame: 'FRAME-GRIPPER',
        massProperties: { unitMassKg: 1.0, centerOfMassMm: { x: 0, y: 0, z: 0 } },
        geometryReference: 'CAD-GRIPPER',
        revision: 'REV-A'
      });

      const updatedCount = mgr.getLinkCount();
      const dynamicUpdatePassed = updatedCount === initialCount + 1;

      checks['TEST-13-ASSEMBLY-INTEGRATION'] = {
        passed: dynamicUpdatePassed,
        message: `Assembly integration pass: dynamically added link, link count increased from ${initialCount} to ${updatedCount}`
      };
    } catch (err: any) {
      checks['TEST-13-ASSEMBLY-INTEGRATION'] = { passed: false, message: err.message };
    }

    // -----------------------------------------------------------------------
    // TEST-14: Deterministic Chain Ordering
    // -----------------------------------------------------------------------
    try {
      const mgr1 = new RobotKinematicChainManager();
      const mgr2 = new RobotKinematicChainManager();

      const links1 = mgr1.getLinks().map((l) => l.linkId);
      const links2 = mgr2.getLinks().map((l) => l.linkId);

      const joints1 = mgr1.getJoints().map((j) => j.jointId);
      const joints2 = mgr2.getJoints().map((j) => j.jointId);

      const linksIdentical = JSON.stringify(links1) === JSON.stringify(links2);
      const jointsIdentical = JSON.stringify(joints1) === JSON.stringify(joints2);

      checks['TEST-14-DETERMINISTIC-ORDERING'] = {
        passed: linksIdentical && jointsIdentical,
        message: `Deterministic chain ordering pass: link and joint lists identical across instances`
      };
    } catch (err: any) {
      checks['TEST-14-DETERMINISTIC-ORDERING'] = { passed: false, message: err.message };
    }

    // -----------------------------------------------------------------------
    // TEST-15: Reproducibility & Numerical Stability
    // -----------------------------------------------------------------------
    try {
      const fixedTimestamp = '2026-09-03T12:00:00.000Z';
      const mgr1 = new RobotKinematicChainManager();
      const mgr2 = new RobotKinematicChainManager();

      mgr1.setJointPositions({ J1_BASE: 15, J2_SHOULDER: -30, J3_ELBOW: 45 });
      mgr2.setJointPositions({ J1_BASE: 15, J2_SHOULDER: -30, J3_ELBOW: 45 });

      const pkg1 = mgr1.generateEvidencePackage(fixedTimestamp);
      const pkg2 = mgr2.generateEvidencePackage(fixedTimestamp);

      const hashesMatch = pkg1.evidenceHash === pkg2.evidenceHash;

      checks['TEST-15-REPRODUCIBILITY'] = {
        passed: hashesMatch,
        message: `Reproducibility pass: bit-identical evidence hashes (${pkg1.evidenceHash})`
      };
    } catch (err: any) {
      checks['TEST-15-REPRODUCIBILITY'] = { passed: false, message: err.message };
    }

    // -----------------------------------------------------------------------
    // TEST-16: Evidence Package & SHA-256 Hashing
    // -----------------------------------------------------------------------
    try {
      const mgr = new RobotKinematicChainManager();
      const pkg = mgr.generateEvidencePackage('2026-09-03T12:00:00.000Z');

      const validPkg = pkg.evidenceHash.length === 64 &&
                       pkg.verdict === 'PASS' &&
                       pkg.chainDepth === 7 &&
                       pkg.linkList.length === 7;

      checks['TEST-16-EVIDENCE-PACKAGE'] = {
        passed: validPkg,
        message: `Evidence package generated with SHA-256 hash ${pkg.evidenceHash.substring(0, 16)}..., depth=${pkg.chainDepth}`
      };
    } catch (err: any) {
      checks['TEST-16-EVIDENCE-PACKAGE'] = { passed: false, message: err.message };
    }

    // -----------------------------------------------------------------------
    // Summary & Verdict
    // -----------------------------------------------------------------------
    const totalChecks = Object.keys(checks).length;
    const passedChecks = Object.values(checks).filter((c) => c.passed).length;
    const failedChecks = totalChecks - passedChecks;
    const verdict = failedChecks === 0 ? 'PASS' : 'FAIL';

    const timestamp = '2026-09-03T12:00:00.000Z';
    const evidenceHash = EvidenceIntegrityService.computeHash({
      epc: 'EPC-043',
      verdict,
      checks,
      timestamp
    });

    return {
      epc: 'EPC-043',
      name: 'Kinematic Chain Engineering Proof Case',
      verdict,
      checks,
      summary: {
        totalChecks,
        passedChecks,
        failedChecks
      },
      evidenceHash,
      timestamp
    };
  }
}
