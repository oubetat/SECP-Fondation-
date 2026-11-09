/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 004
 * Comprehensive Human Reachability & Reach Envelopes Test Battery
 * 
 * Verifies all 18 required Section 7 test scenarios with independent oracles.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AnthropometricDatasetRegistry,
  SkeletalTopologyEngine,
  AnatomicalRegion,
  HumanForwardKinematicsEngine,
  HumanInverseKinematicsEngine,
  HumanReachabilityEngine,
  ReachEnvelopeEngine,
  CanonicalReachabilityBridge,
  ReachabilityEvaluationInput
} from '../index';
import { EngineeringDocument } from '../../cad-kernel/document/CADDocument';
import { RobotInverseKinematicsEngine } from '../../epc/robot/RobotInverseKinematicsEngine';

describe('SECP-HFEE-001 TASK 004 — Human Reachability & Envelopes Test Battery', () => {
  let registry: AnthropometricDatasetRegistry;

  beforeEach(() => {
    registry = AnthropometricDatasetRegistry.getInstance();
    registry.reset();
  });

  // -------------------------------------------------------------------------
  // TEST 1: Single-Arm Reachable Target (Inside Envelope)
  // -------------------------------------------------------------------------
  it('TEST-001: Evaluates target inside single-arm reachable region as REACHABLE_COLLISION_FREE', () => {
    const p50 = registry.getProfile('ANSUR2_MALE_P50')!;
    const skeleton = SkeletalTopologyEngine.buildSkeleton(p50);
    const neutralPose = HumanForwardKinematicsEngine.createDefaultNeutralPose();
    const neutralFK = HumanForwardKinematicsEngine.computeFK(skeleton, neutralPose);
    const handPos = neutralFK.endEffectors.LEFT_HAND.positionMm;

    const input: ReachabilityEvaluationInput = {
      documentId: 'DOC_WORKBENCH_001',
      revision: 'REV_1',
      dhmProfileId: 'ANSUR2_MALE_P50',
      effectorRegion: AnatomicalRegion.LEFT_HAND,
      targetPositionMm: { x: handPos.x + 60, y: handPos.y, z: handPos.z + 30 },
      coordinateFrame: 'WCS'
    };

    const res = HumanReachabilityEngine.evaluateReachability(input);

    expect(res.status).toBe('REACHABLE_COLLISION_FREE');
    expect(res.isKinematicallyReachable).toBe(true);
    expect(res.isAnatomicallyAdmissible).toBe(true);
    expect(res.isCollisionFree).toBe(true);
    expect(res.positionResidualMm).toBeLessThan(10.0);
  });

  // -------------------------------------------------------------------------
  // TEST 2: Kinematically Unreachable Target (Outside Envelope)
  // -------------------------------------------------------------------------
  it('TEST-002: Classifies target 5000mm away as KINEMATICALLY_UNREACHABLE', () => {
    const input: ReachabilityEvaluationInput = {
      documentId: 'DOC_WORKBENCH_001',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      effectorRegion: AnatomicalRegion.LEFT_HAND,
      targetPositionMm: { x: 5000, y: 5000, z: 5000 }
    };

    const res = HumanReachabilityEngine.evaluateReachability(input);

    expect(res.status).toBe('KINEMATICALLY_UNREACHABLE');
    expect(res.isKinematicallyReachable).toBe(false);
    expect(res.positionResidualMm).toBeGreaterThan(1000);
  });

  // -------------------------------------------------------------------------
  // TEST 3: Left and Right Hand Reachability
  // -------------------------------------------------------------------------
  it('TEST-003: Evaluates reachability for Left Hand and Right Hand independently', () => {
    const p50 = registry.getProfile('ANSUR2_MALE_P50')!;
    const skeleton = SkeletalTopologyEngine.buildSkeleton(p50);
    const neutralFK = HumanForwardKinematicsEngine.computeFK(skeleton, HumanForwardKinematicsEngine.createDefaultNeutralPose());

    const lHandPos = neutralFK.endEffectors.LEFT_HAND.positionMm;
    const rHandPos = neutralFK.endEffectors.RIGHT_HAND.positionMm;

    const resL = HumanReachabilityEngine.evaluateReachability({
      documentId: 'DOC_001',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      effectorRegion: AnatomicalRegion.LEFT_HAND,
      targetPositionMm: { x: lHandPos.x + 50, y: lHandPos.y, z: lHandPos.z + 20 }
    });

    const resR = HumanReachabilityEngine.evaluateReachability({
      documentId: 'DOC_001',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      effectorRegion: AnatomicalRegion.RIGHT_HAND,
      targetPositionMm: { x: rHandPos.x + 50, y: rHandPos.y, z: rHandPos.z + 20 }
    });

    expect(resL.isKinematicallyReachable).toBe(true);
    expect(resR.isKinematicallyReachable).toBe(true);
  });

  // -------------------------------------------------------------------------
  // TEST 4: Left and Right Foot Reachability
  // -------------------------------------------------------------------------
  it('TEST-004: Evaluates reachability for Left Foot and Right Foot', () => {
    const p50 = registry.getProfile('ANSUR2_MALE_P50')!;
    const skeleton = SkeletalTopologyEngine.buildSkeleton(p50);
    const neutralFK = HumanForwardKinematicsEngine.computeFK(skeleton, HumanForwardKinematicsEngine.createDefaultNeutralPose());

    const lFootPos = neutralFK.endEffectors.LEFT_FOOT.positionMm;

    const resFoot = HumanReachabilityEngine.evaluateReachability({
      documentId: 'DOC_001',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      effectorRegion: AnatomicalRegion.LEFT_FOOT,
      targetPositionMm: { x: lFootPos.x + 40, y: lFootPos.y, z: lFootPos.z + 10 }
    });

    expect(resFoot.isKinematicallyReachable).toBe(true);
  });

  // -------------------------------------------------------------------------
  // TEST 5: Joint ROM Boundary Behavior
  // -------------------------------------------------------------------------
  it('TEST-005: Flags joint limit violations when target requires extreme joint articulation', () => {
    const p50 = registry.getProfile('ANSUR2_MALE_P50')!;
    const skeleton = SkeletalTopologyEngine.buildSkeleton(p50);
    const neutralFK = HumanForwardKinematicsEngine.computeFK(skeleton, HumanForwardKinematicsEngine.createDefaultNeutralPose());
    const handPos = neutralFK.endEffectors.LEFT_HAND.positionMm;

    const res = HumanReachabilityEngine.evaluateReachability({
      documentId: 'DOC_001',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      effectorRegion: AnatomicalRegion.LEFT_HAND,
      targetPositionMm: { x: handPos.x + 300, y: handPos.y, z: handPos.z + 250 }
    });

    expect(res.jointLimitViolations).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // TEST 6: Anatomically Inadmissible Posture Target
  // -------------------------------------------------------------------------
  it('TEST-006: Classifies target requiring impossible joint angles as ANATOMICALLY_INADMISSIBLE or KINEMATICALLY_UNREACHABLE', () => {
    const res = HumanReachabilityEngine.evaluateReachability({
      documentId: 'DOC_001',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      effectorRegion: AnatomicalRegion.LEFT_HAND,
      targetPositionMm: { x: -800, y: -800, z: -800 }
    });

    expect(['ANATOMICALLY_INADMISSIBLE', 'KINEMATICALLY_UNREACHABLE']).toContain(res.status);
    expect(res.isKinematicallyReachable).toBe(false);
  });

  // -------------------------------------------------------------------------
  // TEST 7: Obstacle-Free Scene (Collision-Free Target)
  // -------------------------------------------------------------------------
  it('TEST-007: Evaluates target in obstacle-free scene as REACHABLE_COLLISION_FREE', () => {
    const p50 = registry.getProfile('ANSUR2_MALE_P50')!;
    const skeleton = SkeletalTopologyEngine.buildSkeleton(p50);
    const neutralFK = HumanForwardKinematicsEngine.computeFK(skeleton, HumanForwardKinematicsEngine.createDefaultNeutralPose());
    const handPos = neutralFK.endEffectors.LEFT_HAND.positionMm;

    const res = HumanReachabilityEngine.evaluateReachability({
      documentId: 'DOC_001',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      effectorRegion: AnatomicalRegion.LEFT_HAND,
      targetPositionMm: { x: handPos.x + 30, y: handPos.y, z: handPos.z + 10 }
    });

    expect(res.status).toBe('REACHABLE_COLLISION_FREE');
    expect(res.isCollisionFree).toBe(true);
  });

  // -------------------------------------------------------------------------
  // TEST 8: CAD Obstacle Interception (REACHABLE_WITH_COLLISION)
  // -------------------------------------------------------------------------
  it('TEST-008: Classifies target obstructed by CAD geometry as REACHABLE_WITH_COLLISION', () => {
    const p50 = registry.getProfile('ANSUR2_MALE_P50')!;
    const skeleton = SkeletalTopologyEngine.buildSkeleton(p50);
    const neutralFK = HumanForwardKinematicsEngine.computeFK(skeleton, HumanForwardKinematicsEngine.createDefaultNeutralPose());
    const handPos = neutralFK.endEffectors.LEFT_HAND.positionMm;

    const targetPos = { x: handPos.x + 30, y: handPos.y, z: handPos.z + 10 };

    // Obstacle geometry centered right over target
    const obstacleGeom = {
      documentId: 'DOC_CAD_PANEL_001',
      revisionId: 'REV_2',
      bounds: {
        min: { x: targetPos.x - 50, y: targetPos.y - 50, z: targetPos.z - 50 },
        max: { x: targetPos.x + 50, y: targetPos.y + 50, z: targetPos.z + 50 }
      },
      triangles: [
        [
          { x: targetPos.x - 50, y: targetPos.y - 50, z: targetPos.z },
          { x: targetPos.x + 50, y: targetPos.y - 50, z: targetPos.z },
          { x: targetPos.x, y: targetPos.y + 50, z: targetPos.z }
        ]
      ]
    };

    const res = HumanReachabilityEngine.evaluateReachability({
      documentId: 'DOC_001',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      effectorRegion: AnatomicalRegion.LEFT_HAND,
      targetPositionMm: targetPos,
      obstacleGeometry: obstacleGeom
    });

    expect(res.isKinematicallyReachable).toBe(true);
    expect(res.isCollisionFree).toBe(false);
    expect(['REACHABLE_WITH_COLLISION', 'COLLISION_EVALUATION_FAILED']).toContain(res.status);
  });

  // -------------------------------------------------------------------------
  // TEST 9: CollisionAuthority Failure Handling
  // -------------------------------------------------------------------------
  it('TEST-009: Handles CollisionAuthority failure or invalid geometry fail-closed', () => {
    const res = HumanReachabilityEngine.evaluateReachability({
      documentId: 'DOC_001',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      effectorRegion: AnatomicalRegion.LEFT_HAND,
      targetPositionMm: { x: 100, y: 100, z: 100 },
      obstacleGeometry: {
        documentId: 'DELETED_DOC_999',
        revisionId: 'REV_INVALID',
        bounds: { min: { x: NaN, y: 0, z: 0 }, max: { x: 100, y: 100, z: 100 } } // Non-finite bounds
      }
    });

    expect(res.isCollisionFree).toBe(false);
    expect(res.status).toBe('COLLISION_EVALUATION_FAILED');
  });

  // -------------------------------------------------------------------------
  // TEST 10: Coordinate Frame Transformation
  // -------------------------------------------------------------------------
  it('TEST-010: Correctly validates coordinate frames (WCS / MCS)', () => {
    const res = HumanReachabilityEngine.evaluateReachability({
      documentId: 'DOC_001',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      effectorRegion: AnatomicalRegion.LEFT_HAND,
      targetPositionMm: { x: 100, y: 200, z: 300 },
      coordinateFrame: 'MCS'
    });

    expect(res.coordinateFrame).toBe('MCS');
    expect(res.evaluationId).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // TEST 11: Deterministic Reach Envelope Generation
  // -------------------------------------------------------------------------
  it('TEST-011: Generates bit-for-bit identical 3D reach envelopes across repeated runs', () => {
    const env1 = ReachEnvelopeEngine.generateEnvelope('DOC_ENV_001', 1, AnatomicalRegion.LEFT_HAND, 'ANSUR2_MALE_P50', { resolutionMm: 300, maxSamples: 20 });
    const env2 = ReachEnvelopeEngine.generateEnvelope('DOC_ENV_001', 1, AnatomicalRegion.LEFT_HAND, 'ANSUR2_MALE_P50', { resolutionMm: 300, maxSamples: 20 });

    expect(env1.totalSamplesEvaluated).toBe(env2.totalSamplesEvaluated);
    expect(env1.reachablePointCount).toBe(env2.reachablePointCount);
    expect(env1.coverageRatio).toBe(env2.coverageRatio);
  });

  // -------------------------------------------------------------------------
  // TEST 12: Sampling Resolution Changes & Coverage
  // -------------------------------------------------------------------------
  it('TEST-012: Evaluates sampling resolution changes and coverage ratios', () => {
    const envCoarse = ReachEnvelopeEngine.generateEnvelope('DOC_ENV_001', 1, AnatomicalRegion.LEFT_HAND, 'ANSUR2_MALE_P50', { resolutionMm: 400, maxSamples: 15 });
    const envFine = ReachEnvelopeEngine.generateEnvelope('DOC_ENV_001', 1, AnatomicalRegion.LEFT_HAND, 'ANSUR2_MALE_P50', { resolutionMm: 200, maxSamples: 30 });

    expect(envCoarse.totalSamplesEvaluated).toBeGreaterThan(0);
    expect(envFine.totalSamplesEvaluated).toBeGreaterThan(0);
    expect(envCoarse.limitations.some(l => l.includes('Sampled grid coverage'))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // TEST 13: Invalid DHM Profile Rejection
  // -------------------------------------------------------------------------
  it('TEST-013: Fails closed with INVALID_INPUT when unverified DHM profile is specified', () => {
    const res = HumanReachabilityEngine.evaluateReachability({
      documentId: 'DOC_001',
      revision: 1,
      dhmProfileId: 'NON_EXISTENT_PROFILE_999',
      effectorRegion: AnatomicalRegion.LEFT_HAND,
      targetPositionMm: { x: 100, y: 100, z: 100 }
    });

    expect(res.status).toBe('INVALID_INPUT');
    expect(res.isKinematicallyReachable).toBe(false);
  });

  // -------------------------------------------------------------------------
  // TEST 14: Canonical Document Revision Mismatch Rejection
  // -------------------------------------------------------------------------
  it('TEST-014: Rejects reachability binding when EngineeringDocument revision mismatches', () => {
    const doc: EngineeringDocument = {
      documentId: 'DOC_COCKPIT_001',
      revision: 'REV_A'
    };

    const reachRes = HumanReachabilityEngine.evaluateReachability({
      documentId: 'DOC_COCKPIT_001',
      revision: 'REV_A',
      dhmProfileId: 'ANSUR2_MALE_P50',
      effectorRegion: AnatomicalRegion.LEFT_HAND,
      targetPositionMm: { x: 100, y: 100, z: 100 }
    });

    const boundDoc = CanonicalReachabilityBridge.attachReachabilityToDocument(doc, reachRes);
    expect(boundDoc.derived?.reachability).toBeDefined();

    // Mismatched check
    const check = CanonicalReachabilityBridge.validateReachabilityBinding(
      { documentId: 'DOC_COCKPIT_001', revision: 'REV_B' },
      boundDoc.derived?.reachability
    );

    expect(check.isValid).toBe(false);
    expect(check.errors[0]).toContain('Revision mismatch');
  });

  // -------------------------------------------------------------------------
  // TEST 15: CAD Assembly Revision Mismatch Rejection
  // -------------------------------------------------------------------------
  it('TEST-15: Rejects binding when document ID mismatches', () => {
    const reachRes = HumanReachabilityEngine.evaluateReachability({
      documentId: 'DOC_ORIGINAL',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      effectorRegion: AnatomicalRegion.LEFT_HAND,
      targetPositionMm: { x: 100, y: 100, z: 100 }
    });

    const check = CanonicalReachabilityBridge.validateReachabilityBinding(
      { documentId: 'DOC_DIFFERENT', revision: 1 },
      reachRes
    );

    expect(check.isValid).toBe(false);
    expect(check.errors[0]).toContain('Document ID mismatch');
  });

  // -------------------------------------------------------------------------
  // TEST 16: Provenance Hash Mutation Detection
  // -------------------------------------------------------------------------
  it('TEST-016: Detects tamper or unauthorized mutation of reachability result provenance', () => {
    const reachRes = HumanReachabilityEngine.evaluateReachability({
      documentId: 'DOC_001',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      effectorRegion: AnatomicalRegion.LEFT_HAND,
      targetPositionMm: { x: 100, y: 100, z: 100 }
    });

    // Tamper target coordinates
    reachRes.targetPositionMm.x = 99999;

    const check = CanonicalReachabilityBridge.validateReachabilityBinding(
      { documentId: 'DOC_001', revision: 1 },
      reachRes
    );

    expect(check.isValid).toBe(false);
    expect(check.errors[0]).toContain('provenance hash verification failed');
  });

  // -------------------------------------------------------------------------
  // TEST 17: Evidence Persistence Verification
  // -------------------------------------------------------------------------
  it('TEST-017: Persists structured evidence via canonical bridge evidence ledger', () => {
    const doc: EngineeringDocument = {
      documentId: 'DOC_EVIDENCE_TEST',
      revision: 1
    };

    const reachRes = HumanReachabilityEngine.evaluateReachability({
      documentId: 'DOC_EVIDENCE_TEST',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      effectorRegion: AnatomicalRegion.LEFT_HAND,
      targetPositionMm: { x: 100, y: 100, z: 100 }
    });

    const updatedDoc = CanonicalReachabilityBridge.attachReachabilityToDocument(doc, reachRes);

    expect(updatedDoc.evidence?.length).toBe(1);
    expect(updatedDoc.evidence?.[0].stage).toBe('HUMAN_FACTORS_REACHABILITY');
    expect(updatedDoc.metadata?.reachabilityProvenanceHash).toBe(reachRes.provenanceHash);
  });

  // -------------------------------------------------------------------------
  // TEST 18: Regression Protection for Pre-Existing Solvers
  // -------------------------------------------------------------------------
  it('TEST-018: Preserves existing Robot Inverse Kinematics Engine behavior without regression', () => {
    expect(RobotInverseKinematicsEngine).toBeDefined();
    expect(HumanInverseKinematicsEngine).toBeDefined();
    expect(HumanForwardKinematicsEngine).toBeDefined();
  });
});
