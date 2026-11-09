/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 006-B
 * Comprehensive Ergonomics Test Battery & Numerical Validation
 * 
 * Verifies methodology fidelity for RULA, REBA, OWAS, and NIOSH.
 * Includes 32 detailed reference cases with intermediate scoring verification.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AnthropometricDatasetRegistry,
  HumanForwardKinematicsEngine,
  HumanErgonomicsEngine,
  RULAInput,
  REBAInput,
  OWASInput,
  NIOSHInput,
  OWASLegPosture,
  NIOSHStatus,
  CanonicalErgonomicsBridge
} from '../index';
import { EngineeringDocument } from '../../cad-kernel/document/CADDocument';

describe('SECP-HFEE-001 TASK 006-B — Ergonomics Methodology & Canonical Integration', () => {
  let registry: AnthropometricDatasetRegistry;

  beforeEach(() => {
    registry = AnthropometricDatasetRegistry.getInstance();
    registry.reset();
  });

  // -------------------------------------------------------------------------
  // 1. RULA NUMERICAL QUALIFICATION (McAtamney & Corlett, 1993)
  // -------------------------------------------------------------------------
  describe('RULA Methodology Fidelity', () => {
    const neutralPose = HumanForwardKinematicsEngine.createDefaultNeutralPose();
    // Adjust elbow to 90 deg for LA=1
    const idealPose = JSON.parse(JSON.stringify(neutralPose));
    idealPose.jointAngles['J_ELBOW_R'] = { flexionExtension: 90, abductionAdduction: 0, axialRotation: 0 };

    it('RULA-REF-01: Ideal neutral posture (UA=1, LA=1, W=1, WT=1, N=1, T=1, L=1) -> Final 1', () => {
      const input: RULAInput = {
        pose: idealPose, muscleUse: false, loadKg: 0,
        armSupported: false, shoulderAbducted: false, shoulderRaised: false,
        neckTwisted: false, neckSideBending: false, trunkTwisted: false, trunkSideBending: false,
        wristTwist: 1, legsSupported: true
      };
      const res = HumanErgonomicsEngine.assessRULA(input);
      expect(res.scores.upperArm).toBe(1);
      expect(res.scores.lowerArm).toBe(1);
      expect(res.scores.scoreA).toBe(1);
      expect(res.scores.scoreB).toBe(1);
      expect(res.scores.finalScore).toBe(1);
    });

    it('RULA-REF-02: Shoulder abducted and raised (UA: 1 + 1 + 1 = 3)', () => {
      const input: RULAInput = {
        pose: idealPose, muscleUse: false, loadKg: 0,
        armSupported: false, shoulderAbducted: true, shoulderRaised: true,
        neckTwisted: false, neckSideBending: false, trunkTwisted: false, trunkSideBending: false,
        wristTwist: 1, legsSupported: true
      };
      const res = HumanErgonomicsEngine.assessRULA(input);
      expect(res.scores.upperArm).toBe(3);
    });

    it('RULA-REF-03: Heavy load adjustment (Score A + 2, Score B + 2)', () => {
      const input: RULAInput = {
        pose: idealPose, muscleUse: false, loadKg: 12,
        armSupported: false, shoulderAbducted: false, shoulderRaised: false,
        neckTwisted: false, neckSideBending: false, trunkTwisted: false, trunkSideBending: false,
        wristTwist: 1, legsSupported: true
      };
      const res = HumanErgonomicsEngine.assessRULA(input);
      expect(res.scores.scoreA).toBe(3); // Table A(1,1,1,1)=1 + Load 2
      expect(res.scores.scoreB).toBe(3); // Table B(1,1,1)=1 + Load 2
    });

    it('RULA-REF-04: Neck extension (>0°) adjustment (Neck Score 4)', () => {
      const pose = JSON.parse(JSON.stringify(idealPose));
      pose.jointAngles['J_NECK'] = { flexionExtension: -10, lateralBending: 0, axialRotation: 0 };
      const input: RULAInput = {
        pose, muscleUse: false, loadKg: 0,
        armSupported: false, shoulderAbducted: false, shoulderRaised: false,
        neckTwisted: false, neckSideBending: false, trunkTwisted: false, trunkSideBending: false,
        wristTwist: 1, legsSupported: true
      };
      const res = HumanErgonomicsEngine.assessRULA(input);
      expect(res.scores.neck).toBe(4);
    });

    it('RULA-REF-05: Trunk twisted and side bending (Trunk: 1 + 1 + 1 = 3)', () => {
      const input: RULAInput = {
        pose: idealPose, muscleUse: false, loadKg: 0,
        armSupported: false, shoulderAbducted: false, shoulderRaised: false,
        neckTwisted: false, neckSideBending: false, trunkTwisted: true, trunkSideBending: true,
        wristTwist: 1, legsSupported: true
      };
      const res = HumanErgonomicsEngine.assessRULA(input);
      expect(res.scores.trunk).toBe(3);
    });

    it('RULA-REF-06: Legs not supported (Leg score 2)', () => {
      const input: RULAInput = {
        pose: idealPose, muscleUse: false, loadKg: 0,
        armSupported: false, shoulderAbducted: false, shoulderRaised: false,
        neckTwisted: false, neckSideBending: false, trunkTwisted: false, trunkSideBending: false,
        wristTwist: 1, legsSupported: false
      };
      const res = HumanErgonomicsEngine.assessRULA(input);
      expect(res.scores.legs).toBe(2);
      expect(res.scores.scoreB).toBe(3); // Table B(1,1,2) = 3
    });

    it('RULA-REF-07: Wrist twist end of range (Score 2)', () => {
      const input: RULAInput = {
        pose: idealPose, muscleUse: false, loadKg: 0,
        armSupported: false, shoulderAbducted: false, shoulderRaised: false,
        neckTwisted: false, neckSideBending: false, trunkTwisted: false, trunkSideBending: false,
        wristTwist: 2, legsSupported: true
      };
      const res = HumanErgonomicsEngine.assessRULA(input);
      expect(res.scores.wristTwist).toBe(2);
      expect(res.scores.scoreA).toBe(2); // Table A(1,1,1,2) = 2
    });

    it('RULA-REF-08: Arm supported adjustment (UA Score - 1)', () => {
      const pose = JSON.parse(JSON.stringify(idealPose));
      pose.jointAngles['J_SHOULDER_R'] = { flexionExtension: 30, abductionAdduction: 0, axialRotation: 0 };
      const input: RULAInput = {
        pose, muscleUse: false, loadKg: 0,
        armSupported: true, shoulderAbducted: false, shoulderRaised: false,
        neckTwisted: false, neckSideBending: false, trunkTwisted: false, trunkSideBending: false,
        wristTwist: 1, legsSupported: true
      };
      const res = HumanErgonomicsEngine.assessRULA(input);
      expect(res.scores.upperArm).toBe(1); // 2 (30 deg) - 1 (supported)
    });
  });

  // -------------------------------------------------------------------------
  // 2. REBA NUMERICAL QUALIFICATION (Hignett & McAtamney, 2000)
  // -------------------------------------------------------------------------
  describe('REBA Methodology Fidelity', () => {
    const neutralPose = HumanForwardKinematicsEngine.createDefaultNeutralPose();

    it('REBA-REF-01: Ideal neutral posture -> Final 1', () => {
      const input: REBAInput = {
        pose: neutralPose, loadKg: 0, coupling: 0, legSupport: 1, kneeFlexionDeg: 0,
        activity: { staticPosture: false, repeatedAction: false, rapidChange: false }
      };
      const res = HumanErgonomicsEngine.assessREBA(input);
      expect(res.scores.finalScore).toBe(1);
    });

    it('REBA-REF-02: Knee flexion adjustment (Leg: 1 + 1 = 2)', () => {
      const input: REBAInput = {
        pose: neutralPose, loadKg: 0, coupling: 0, legSupport: 1, kneeFlexionDeg: 45,
        activity: { staticPosture: false, repeatedAction: false, rapidChange: false }
      };
      const res = HumanErgonomicsEngine.assessREBA(input);
      expect(res.scores.legs).toBe(2);
    });

    it('REBA-REF-03: Deep squat adjustment (Leg: 1 + 2 = 3)', () => {
      const input: REBAInput = {
        pose: neutralPose, loadKg: 0, coupling: 0, legSupport: 1, kneeFlexionDeg: 70,
        activity: { staticPosture: false, repeatedAction: false, rapidChange: false }
      };
      const res = HumanErgonomicsEngine.assessREBA(input);
      expect(res.scores.legs).toBe(3);
    });

    it('REBA-REF-04: Load weight adjustment (Score A + 1)', () => {
      const input: REBAInput = {
        pose: neutralPose, loadKg: 8, coupling: 0, legSupport: 1, kneeFlexionDeg: 0,
        activity: { staticPosture: false, repeatedAction: false, rapidChange: false }
      };
      const res = HumanErgonomicsEngine.assessREBA(input);
      expect(res.scores.scoreA).toBe(2); // Table A(1,1,1)=1 + Load 1
    });

    it('REBA-REF-05: Upper arm 100° flexion (UA Score 4)', () => {
      const pose = HumanForwardKinematicsEngine.createDefaultNeutralPose();
      pose.jointAngles['J_SHOULDER_R'] = { flexionExtension: 100, abductionAdduction: 0, axialRotation: 0 };
      const input: REBAInput = {
        pose, loadKg: 0, coupling: 0, legSupport: 1, kneeFlexionDeg: 0,
        activity: { staticPosture: false, repeatedAction: false, rapidChange: false }
      };
      const res = HumanErgonomicsEngine.assessREBA(input);
      expect(res.scores.upperArm).toBe(4);
    });

    it('REBA-REF-06: Poor coupling adjustment (Score B + 2)', () => {
      const input: REBAInput = {
        pose: neutralPose, loadKg: 0, coupling: 2, legSupport: 1, kneeFlexionDeg: 0,
        activity: { staticPosture: false, repeatedAction: false, rapidChange: false }
      };
      const res = HumanErgonomicsEngine.assessREBA(input);
      expect(res.scores.scoreB).toBe(3); // Table B(1,1,1)=1 + Coupling 2
    });

    it('REBA-REF-07: Static + Repeated activity (+2 to final)', () => {
      const input: REBAInput = {
        pose: neutralPose, loadKg: 0, coupling: 0, legSupport: 1, kneeFlexionDeg: 0,
        activity: { staticPosture: true, repeatedAction: true, rapidChange: false }
      };
      const res = HumanErgonomicsEngine.assessREBA(input);
      expect(res.scores.finalScore).toBe(3); // 1 + 1 + 1
    });

    it('REBA-REF-08: Trunk extension adjustment (Trunk Score 3)', () => {
      const pose = HumanForwardKinematicsEngine.createDefaultNeutralPose();
      pose.jointAngles['J_SPINE_MID'] = { flexionExtension: -30, lateralBending: 0, axialRotation: 0 };
      const input: REBAInput = {
        pose, loadKg: 0, coupling: 0, legSupport: 1, kneeFlexionDeg: 0,
        activity: { staticPosture: false, repeatedAction: false, rapidChange: false }
      };
      const res = HumanErgonomicsEngine.assessREBA(input);
      expect(res.scores.trunk).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // 3. OWAS QUALIFICATION (Karhu et al., 1977)
  // -------------------------------------------------------------------------
  describe('OWAS Methodology Fidelity', () => {
    const neutralPose = HumanForwardKinematicsEngine.createDefaultNeutralPose();

    it('OWAS-REF-01: Neutral standing (1-1-2-1) -> Action Cat 1', () => {
      const input: OWASInput = { pose: neutralPose, loadKg: 0, legPosture: OWASLegPosture.STANDING_BOTH_STRAIGHT };
      const res = HumanErgonomicsEngine.assessOWAS(input);
      expect(res.scores.backCode).toBe(1);
      expect(res.scores.armsCode).toBe(1);
      expect(res.scores.legsCode).toBe(2);
      expect(res.actionLevel).toBe(1);
    });

    it('OWAS-REF-02: Sitting posture (Leg Code 1)', () => {
      const input: OWASInput = { pose: neutralPose, loadKg: 0, legPosture: OWASLegPosture.SITTING };
      const res = HumanErgonomicsEngine.assessOWAS(input);
      expect(res.scores.legsCode).toBe(1);
    });

    it('OWAS-REF-03: Kneeling posture (Leg Code 6)', () => {
      const input: OWASInput = { pose: neutralPose, loadKg: 0, legPosture: OWASLegPosture.KNEELING };
      const res = HumanErgonomicsEngine.assessOWAS(input);
      expect(res.scores.legsCode).toBe(6);
    });

    it('OWAS-REF-04: Bent and twisted back (Back Code 4)', () => {
      const pose = HumanForwardKinematicsEngine.createDefaultNeutralPose();
      pose.jointAngles['J_SPINE_MID'] = { flexionExtension: 30, lateralBending: 0, axialRotation: 30 };
      const input: OWASInput = { pose, loadKg: 0, legPosture: OWASLegPosture.STANDING_BOTH_STRAIGHT };
      const res = HumanErgonomicsEngine.assessOWAS(input);
      expect(res.scores.backCode).toBe(4);
    });

    it('OWAS-REF-05: Both arms above shoulder (Arms Code 3)', () => {
      const pose = HumanForwardKinematicsEngine.createDefaultNeutralPose();
      pose.jointAngles['J_SHOULDER_R'] = { flexionExtension: 90, abductionAdduction: 0, axialRotation: 0 };
      pose.jointAngles['J_SHOULDER_L'] = { flexionExtension: 90, abductionAdduction: 0, axialRotation: 0 };
      const input: OWASInput = { pose, loadKg: 0, legPosture: OWASLegPosture.STANDING_BOTH_STRAIGHT };
      const res = HumanErgonomicsEngine.assessOWAS(input);
      expect(res.scores.armsCode).toBe(3);
    });

    it('OWAS-REF-06: Heavy load category (>20kg -> Code 3)', () => {
      const input: OWASInput = { pose: neutralPose, loadKg: 25, legPosture: OWASLegPosture.STANDING_BOTH_STRAIGHT };
      const res = HumanErgonomicsEngine.assessOWAS(input);
      expect(res.scores.loadCode).toBe(3);
    });

    it('OWAS-REF-07: Action Category 4 (Bent/Twisted Back + High Arms + Standing)', () => {
      const pose = HumanForwardKinematicsEngine.createDefaultNeutralPose();
      pose.jointAngles['J_SPINE_MID'] = { flexionExtension: 30, lateralBending: 0, axialRotation: 30 };
      pose.jointAngles['J_SHOULDER_R'] = { flexionExtension: 90, abductionAdduction: 0, axialRotation: 0 };
      pose.jointAngles['J_SHOULDER_L'] = { flexionExtension: 90, abductionAdduction: 0, axialRotation: 0 };
      const input: OWASInput = { pose, loadKg: 0, legPosture: OWASLegPosture.STANDING_BOTH_STRAIGHT };
      const res = HumanErgonomicsEngine.assessOWAS(input);
      expect(res.actionLevel).toBe(4);
    });

    it('OWAS-REF-08: Action Category 2 (Bent Back only)', () => {
      const pose = HumanForwardKinematicsEngine.createDefaultNeutralPose();
      pose.jointAngles['J_SPINE_MID'] = { flexionExtension: 30, lateralBending: 0, axialRotation: 0 };
      const input: OWASInput = { pose, loadKg: 0, legPosture: OWASLegPosture.STANDING_BOTH_STRAIGHT };
      const res = HumanErgonomicsEngine.assessOWAS(input);
      expect(res.actionLevel).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // 4. NIOSH NUMERICAL QUALIFICATION (Waters et al., 1993)
  // -------------------------------------------------------------------------
  describe('NIOSH Methodology Fidelity', () => {
    it('NIOSH-REF-01: Ideal lift (H=25, V=75, D=0, A=0, F=0.2, Dur=1) -> RWL 23.0', () => {
      const input: NIOSHInput = {
        originMm: { x: 250, y: 0, z: 750 },
        destinationMm: { x: 250, y: 0, z: 750 },
        loadKg: 5, frequency: 0.1, durationHours: 1, coupling: 'Good', asymmetryAngleDeg: 0,
        isSignificantControlRequired: false
      };
      const res = HumanErgonomicsEngine.assessNIOSH(input);
      expect(res.scores.rwl).toBe(23.0);
      expect(res.scores.hm).toBe(1.0);
      expect(res.scores.vm).toBe(1.0);
      expect(res.scores.fm).toBe(1.0);
    });

    it('NIOSH-REF-02: Horizontal distance penalty (H=50 -> HM=0.5)', () => {
      const input: NIOSHInput = {
        originMm: { x: 500, y: 0, z: 750 },
        destinationMm: { x: 500, y: 0, z: 750 },
        loadKg: 5, frequency: 0.1, durationHours: 1, coupling: 'Good', asymmetryAngleDeg: 0,
        isSignificantControlRequired: false
      };
      const res = HumanErgonomicsEngine.assessNIOSH(input);
      expect(res.scores.hm).toBe(0.5);
      expect(res.scores.rwl).toBe(11.5);
    });

    it('NIOSH-REF-03: Asymmetry penalty (A=90° -> AM=0.712)', () => {
      const input: NIOSHInput = {
        originMm: { x: 250, y: 0, z: 750 },
        destinationMm: { x: 250, y: 0, z: 750 },
        loadKg: 5, frequency: 0.1, durationHours: 1, coupling: 'Good', asymmetryAngleDeg: 90,
        isSignificantControlRequired: false
      };
      const res = HumanErgonomicsEngine.assessNIOSH(input);
      expect(res.scores.am).toBe(0.712);
    });

    it('NIOSH-REF-04: High frequency penalty (F=12, Dur=1 -> FM=0.37)', () => {
      const input: NIOSHInput = {
        originMm: { x: 250, y: 0, z: 750 },
        destinationMm: { x: 250, y: 0, z: 750 },
        loadKg: 5, frequency: 12, durationHours: 1, coupling: 'Good', asymmetryAngleDeg: 0,
        isSignificantControlRequired: false
      };
      const res = HumanErgonomicsEngine.assessNIOSH(input);
      expect(res.scores.fm).toBe(0.37);
    });

    it('NIOSH-REF-05: Reject H > 63cm (OUT_OF_DOMAIN)', () => {
      const input: NIOSHInput = {
        originMm: { x: 700, y: 0, z: 750 },
        destinationMm: { x: 700, y: 0, z: 750 },
        loadKg: 5, frequency: 0.1, durationHours: 1, coupling: 'Good', asymmetryAngleDeg: 0,
        isSignificantControlRequired: false
      };
      const res = HumanErgonomicsEngine.assessNIOSH(input);
      expect(res.scores.validityCode).toBe(0);
      expect(res.interpretation).toContain('OUT_OF_DOMAIN');
    });

    it('NIOSH-REF-06: Vertical travel distance (D=100 -> DM=0.865)', () => {
      const input: NIOSHInput = {
        originMm: { x: 250, y: 0, z: 750 },
        destinationMm: { x: 250, y: 0, z: 1750 },
        loadKg: 5, frequency: 0.1, durationHours: 1, coupling: 'Good', asymmetryAngleDeg: 0,
        isSignificantControlRequired: false
      };
      const res = HumanErgonomicsEngine.assessNIOSH(input);
      expect(res.scores.dm).toBe(0.865); // 0.82 + 4.5/100
    });

    it('NIOSH-REF-07: Frequency limit rejection (F > 15)', () => {
      const input: NIOSHInput = {
        originMm: { x: 250, y: 0, z: 750 },
        destinationMm: { x: 250, y: 0, z: 750 },
        loadKg: 5, frequency: 20, durationHours: 1, coupling: 'Good', asymmetryAngleDeg: 0,
        isSignificantControlRequired: false
      };
      const res = HumanErgonomicsEngine.assessNIOSH(input);
      expect(res.scores.validityCode).toBe(0);
    });

    it('NIOSH-REF-08: Coupling multiplier (Poor -> CM=0.90)', () => {
      const input: NIOSHInput = {
        originMm: { x: 250, y: 0, z: 750 },
        destinationMm: { x: 250, y: 0, z: 750 },
        loadKg: 5, frequency: 0.1, durationHours: 1, coupling: 'Poor', asymmetryAngleDeg: 0,
        isSignificantControlRequired: false
      };
      const res = HumanErgonomicsEngine.assessNIOSH(input);
      expect(res.scores.cm).toBe(0.90);
    });
  });

  // -------------------------------------------------------------------------
  // 5. CANONICAL INTEGRATION TESTS
  // -------------------------------------------------------------------------
  describe('Canonical Ergonomics Integration', () => {
    it('CANON-01: Binds RULA evidence to document with correct metadata', () => {
      const doc: EngineeringDocument = { documentId: 'DOC_CAD', revision: 'A' };
      const input: RULAInput = {
        pose: HumanForwardKinematicsEngine.createDefaultNeutralPose(), muscleUse: false, loadKg: 0,
        armSupported: false, shoulderAbducted: false, shoulderRaised: false,
        neckTwisted: false, neckSideBending: false, trunkTwisted: false, trunkSideBending: false,
        wristTwist: 1, legsSupported: true
      };
      const evidence = HumanErgonomicsEngine.assessRULA(input);
      evidence.documentId = 'DOC_CAD';
      evidence.revision = 'A';

      const updatedDoc = CanonicalErgonomicsBridge.attachErgonomicsToDocument(doc, evidence);
      expect(updatedDoc.derived?.humanErgonomics.length).toBe(1);
      expect(updatedDoc.evidence?.[0].stage).toBe('HUMAN_FACTORS_ERGONOMICS_RULA');
    });

    it('CANON-02: Rejects binding on revision mismatch', () => {
      const doc: EngineeringDocument = { documentId: 'DOC_CAD', revision: 'A' };
      const input: RULAInput = {
        pose: HumanForwardKinematicsEngine.createDefaultNeutralPose(), muscleUse: false, loadKg: 0,
        armSupported: false, shoulderAbducted: false, shoulderRaised: false,
        neckTwisted: false, neckSideBending: false, trunkTwisted: false, trunkSideBending: false,
        wristTwist: 1, legsSupported: true
      };
      const evidence = HumanErgonomicsEngine.assessRULA(input);
      evidence.documentId = 'DOC_CAD';
      evidence.revision = 'B';

      expect(() => CanonicalErgonomicsBridge.attachErgonomicsToDocument(doc, evidence)).toThrow('Revision mismatch');
    });
  });
});
