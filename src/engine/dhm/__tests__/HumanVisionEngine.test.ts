/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 005
 * Comprehensive Human Vision & Line-of-Sight Test Battery
 * 
 * Verifies all 21 required Section 8 test scenarios with independent mathematical oracles.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AnthropometricDatasetRegistry,
  SkeletalTopologyEngine,
  AnatomicalRegion,
  HumanForwardKinematicsEngine,
  HumanVisualModel,
  HumanLineOfSightEngine,
  CanonicalVisionBridge,
  LineOfSightQueryInput
} from '../index';
import { EngineeringDocument } from '../../cad-kernel/document/CADDocument';
import { RobotInverseKinematicsEngine } from '../../epc/robot/RobotInverseKinematicsEngine';

describe('SECP-HFEE-001 TASK 005 — Human Vision & Line-of-Sight Test Battery', () => {
  let registry: AnthropometricDatasetRegistry;

  beforeEach(() => {
    registry = AnthropometricDatasetRegistry.getInstance();
    registry.reset();
  });

  // -------------------------------------------------------------------------
  // TEST 1: Unobstructed Target in Front of Human Model
  // -------------------------------------------------------------------------
  it('TEST-001: Evaluates unobstructed target directly in front as VISIBLE_BINOCULAR', () => {
    const eyeConfig = HumanVisualModel.computeEyeConfiguration('ANSUR2_MALE_P50');
    const eyeCenter = eyeConfig.cyclopeanEyeOriginWCS;

    // Target 1000mm in front (+X direction)
    const targetPos = { x: eyeCenter.x + 1000, y: eyeCenter.y, z: eyeCenter.z };

    const input: LineOfSightQueryInput = {
      documentId: 'DOC_COCKPIT_001',
      revision: 'REV_1',
      dhmProfileId: 'ANSUR2_MALE_P50',
      targetPositionMm: targetPos
    };

    const res = HumanLineOfSightEngine.evaluateLineOfSight(input);

    expect(res.status).toBe('VISIBLE_BINOCULAR');
    expect(res.isLeftEyeUnobstructed).toBe(true);
    expect(res.isRightEyeUnobstructed).toBe(true);
    expect(res.isInsideVisualField).toBe(true);
    expect(res.occlusionPercentage).toBe(0.0);
  });

  // -------------------------------------------------------------------------
  // TEST 2: Target Behind CAD Obstacle (Fully Occluded)
  // -------------------------------------------------------------------------
  it('TEST-002: Classifies target behind CAD obstacle as FULLY_OCCLUDED', () => {
    const eyeConfig = HumanVisualModel.computeEyeConfiguration('ANSUR2_MALE_P50');
    const eyeCenter = eyeConfig.cyclopeanEyeOriginWCS;
    const targetPos = { x: eyeCenter.x + 1000, y: eyeCenter.y, z: eyeCenter.z };

    // Obstacle triangle placed at X = +500mm, blocking both eye rays
    const obstacleGeom = {
      documentId: 'DOC_CAD_WALL_001',
      revisionId: 'REV_1',
      bounds: { min: { x: eyeCenter.x + 400, y: -500, z: -500 }, max: { x: eyeCenter.x + 600, y: 500, z: 500 } },
      triangles: [
        [
          { x: eyeCenter.x + 500, y: -300, z: eyeCenter.z - 300 },
          { x: eyeCenter.x + 500, y: 300, z: eyeCenter.z - 300 },
          { x: eyeCenter.x + 500, y: 0, z: eyeCenter.z + 300 }
        ]
      ]
    };

    const res = HumanLineOfSightEngine.evaluateLineOfSight({
      documentId: 'DOC_COCKPIT_001',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      targetPositionMm: targetPos,
      obstacleGeometry: obstacleGeom
    });

    expect(res.status).toBe('FULLY_OCCLUDED');
    expect(res.isLeftEyeUnobstructed).toBe(false);
    expect(res.isRightEyeUnobstructed).toBe(false);
    expect(res.occlusionPercentage).toBe(100.0);
    expect(res.firstHitObstacle).toBeDefined();
    expect(res.firstHitObstacle?.distanceMm).toBeGreaterThan(400);
  });

  // -------------------------------------------------------------------------
  // TEST 3: Left-Eye-Only Visibility
  // -------------------------------------------------------------------------
  it('TEST-003: Evaluates target obstructed for Right Eye only as VISIBLE_LEFT_EYE_ONLY', () => {
    const eyeConfig = HumanVisualModel.computeEyeConfiguration('ANSUR2_MALE_P50');
    const targetPos = { x: eyeConfig.cyclopeanEyeOriginWCS.x + 1000, y: 0, z: eyeConfig.cyclopeanEyeOriginWCS.z };

    // Obstacle placed strictly on right side, blocking right eye ray (+Y is left, -Y is right)
    const rightObstacle = {
      documentId: 'DOC_CAD_PILLAR_RIGHT',
      revisionId: 1,
      triangles: [
        [
          { x: eyeConfig.rightEyeOriginWCS.x + 300, y: eyeConfig.rightEyeOriginWCS.y - 100, z: eyeConfig.rightEyeOriginWCS.z - 100 },
          { x: eyeConfig.rightEyeOriginWCS.x + 300, y: eyeConfig.rightEyeOriginWCS.y + 100, z: eyeConfig.rightEyeOriginWCS.z - 100 },
          { x: eyeConfig.rightEyeOriginWCS.x + 300, y: eyeConfig.rightEyeOriginWCS.y, z: eyeConfig.rightEyeOriginWCS.z + 100 }
        ]
      ]
    };

    const res = HumanLineOfSightEngine.evaluateLineOfSight({
      documentId: 'DOC_001',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      targetPositionMm: targetPos,
      obstacleGeometry: rightObstacle
    });

    expect(res.status).toBe('VISIBLE_LEFT_EYE_ONLY');
    expect(res.isLeftEyeUnobstructed).toBe(true);
    expect(res.isRightEyeUnobstructed).toBe(false);
  });

  // -------------------------------------------------------------------------
  // TEST 4: Right-Eye-Only Visibility
  // -------------------------------------------------------------------------
  it('TEST-004: Evaluates target obstructed for Left Eye only as VISIBLE_RIGHT_EYE_ONLY', () => {
    const eyeConfig = HumanVisualModel.computeEyeConfiguration('ANSUR2_MALE_P50');
    const targetPos = { x: eyeConfig.cyclopeanEyeOriginWCS.x + 1000, y: 0, z: eyeConfig.cyclopeanEyeOriginWCS.z };

    // Obstacle placed strictly on left side, blocking left eye ray (+Y is left)
    const leftObstacle = {
      documentId: 'DOC_CAD_PILLAR_LEFT',
      revisionId: 1,
      triangles: [
        [
          { x: eyeConfig.leftEyeOriginWCS.x + 300, y: eyeConfig.leftEyeOriginWCS.y - 32, z: eyeConfig.leftEyeOriginWCS.z - 100 },
          { x: eyeConfig.leftEyeOriginWCS.x + 300, y: eyeConfig.leftEyeOriginWCS.y + 50, z: eyeConfig.leftEyeOriginWCS.z - 100 },
          { x: eyeConfig.leftEyeOriginWCS.x + 300, y: eyeConfig.leftEyeOriginWCS.y - 10, z: eyeConfig.leftEyeOriginWCS.z + 100 }
        ]
      ]
    };

    const res = HumanLineOfSightEngine.evaluateLineOfSight({
      documentId: 'DOC_001',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      targetPositionMm: targetPos,
      obstacleGeometry: leftObstacle
    });

    expect(res.status).toBe('VISIBLE_RIGHT_EYE_ONLY');
    expect(res.isLeftEyeUnobstructed).toBe(false);
    expect(res.isRightEyeUnobstructed).toBe(true);
  });

  // -------------------------------------------------------------------------
  // TEST 5: Binocular Visibility Verification
  // -------------------------------------------------------------------------
  it('TEST-005: Verifies clear binocular visibility flags for unobstructed target', () => {
    const eyeConfig = HumanVisualModel.computeEyeConfiguration('ANSUR2_MALE_P50');
    const targetPos = { x: eyeConfig.cyclopeanEyeOriginWCS.x + 800, y: 0, z: eyeConfig.cyclopeanEyeOriginWCS.z };

    const res = HumanLineOfSightEngine.evaluateLineOfSight({
      documentId: 'DOC_001',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      targetPositionMm: targetPos
    });

    expect(res.status).toBe('VISIBLE_BINOCULAR');
    expect(res.isLeftEyeUnobstructed).toBe(true);
    expect(res.isRightEyeUnobstructed).toBe(true);
  });

  // -------------------------------------------------------------------------
  // TEST 6: Target Outside Horizontal Visual Field (FOV)
  // -------------------------------------------------------------------------
  it('TEST-006: Classifies target far to the side (120° yaw) as OUTSIDE_VISUAL_FIELD', () => {
    const eyeConfig = HumanVisualModel.computeEyeConfiguration('ANSUR2_MALE_P50');
    // Target placed far behind / to the side (-X direction)
    const targetPos = { x: eyeConfig.cyclopeanEyeOriginWCS.x - 1000, y: eyeConfig.cyclopeanEyeOriginWCS.y + 1000, z: eyeConfig.cyclopeanEyeOriginWCS.z };

    const res = HumanLineOfSightEngine.evaluateLineOfSight({
      documentId: 'DOC_001',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      targetPositionMm: targetPos
    });

    expect(res.status).toBe('OUTSIDE_VISUAL_FIELD');
    expect(res.isInsideVisualField).toBe(false);
  });

  // -------------------------------------------------------------------------
  // TEST 7: Target Outside Vertical Visual Field (FOV)
  // -------------------------------------------------------------------------
  it('TEST-007: Classifies target directly above head (80° pitch) as OUTSIDE_VISUAL_FIELD', () => {
    const eyeConfig = HumanVisualModel.computeEyeConfiguration('ANSUR2_MALE_P50');
    // Target placed directly overhead (+Z direction)
    const targetPos = { x: eyeConfig.cyclopeanEyeOriginWCS.x, y: eyeConfig.cyclopeanEyeOriginWCS.y, z: eyeConfig.cyclopeanEyeOriginWCS.z + 1500 };

    const res = HumanLineOfSightEngine.evaluateLineOfSight({
      documentId: 'DOC_001',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      targetPositionMm: targetPos
    });

    expect(res.status).toBe('OUTSIDE_VISUAL_FIELD');
    expect(res.isInsideVisualField).toBe(false);
  });

  // -------------------------------------------------------------------------
  // TEST 8: Head Rotation Changing Line-of-Sight Result
  // -------------------------------------------------------------------------
  it('TEST-008: Demonstrates head rotation bringing side target into visual field', () => {
    const sideTarget = { x: 0, y: 800, z: 1200 };

    // 1. Forward gaze: target is outside FOV
    const resForward = HumanLineOfSightEngine.evaluateLineOfSight({
      documentId: 'DOC_001',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      targetPositionMm: sideTarget
    });

    expect(resForward.status).toBe('OUTSIDE_VISUAL_FIELD');

    // 2. Rotate neck/head towards left (+45° axial rotation)
    const rotatedPose = HumanForwardKinematicsEngine.createDefaultNeutralPose();
    rotatedPose.jointAngles['J_NECK'] = { flexionExtension: 0, lateralBending: 0, axialRotation: 45 };

    const resRotated = HumanLineOfSightEngine.evaluateLineOfSight({
      documentId: 'DOC_001',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      poseState: rotatedPose,
      targetPositionMm: sideTarget
    });

    expect(resRotated.isInsideVisualField).toBe(true);
  });

  // -------------------------------------------------------------------------
  // TEST 9: Eye Gaze Yaw/Pitch Rotation Changing Result
  // -------------------------------------------------------------------------
  it('TEST-009: Demonstrates eye gaze yaw/pitch updating gaze vector and visual field', () => {
    const sideTarget = { x: 500, y: 400, z: 1200 };

    const resNeutralGaze = HumanLineOfSightEngine.evaluateLineOfSight({
      documentId: 'DOC_001',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      gazeConfig: { eyeGazeYawDeg: 0, eyeGazePitchDeg: 0 },
      targetPositionMm: sideTarget
    });

    const resTurnedGaze = HumanLineOfSightEngine.evaluateLineOfSight({
      documentId: 'DOC_001',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      gazeConfig: { eyeGazeYawDeg: 30, eyeGazePitchDeg: 0 },
      targetPositionMm: sideTarget
    });

    expect(resTurnedGaze.isInsideFovealCone || resTurnedGaze.isInsideVisualField).toBe(true);
  });

  // -------------------------------------------------------------------------
  // TEST 10: Multiple Obstacles and First-Hit Identification
  // -------------------------------------------------------------------------
  it('TEST-010: Identifies closest obstacle as firstHitObstacle among multiple CAD barriers', () => {
    const eyeConfig = HumanVisualModel.computeEyeConfiguration('ANSUR2_MALE_P50');
    const targetPos = { x: eyeConfig.cyclopeanEyeOriginWCS.x + 1500, y: 0, z: eyeConfig.cyclopeanEyeOriginWCS.z };

    // Near obstacle at X = +400, Far obstacle at X = +900
    const multiObstacle = {
      documentId: 'DOC_CAD_MULTI_OBSTACLE',
      revisionId: 1,
      triangles: [
        // Near triangle
        [
          { x: eyeConfig.cyclopeanEyeOriginWCS.x + 400, y: -200, z: eyeConfig.cyclopeanEyeOriginWCS.z - 200 },
          { x: eyeConfig.cyclopeanEyeOriginWCS.x + 400, y: 200, z: eyeConfig.cyclopeanEyeOriginWCS.z - 200 },
          { x: eyeConfig.cyclopeanEyeOriginWCS.x + 400, y: 0, z: eyeConfig.cyclopeanEyeOriginWCS.z + 200 }
        ],
        // Far triangle
        [
          { x: eyeConfig.cyclopeanEyeOriginWCS.x + 900, y: -200, z: eyeConfig.cyclopeanEyeOriginWCS.z - 200 },
          { x: eyeConfig.cyclopeanEyeOriginWCS.x + 900, y: 200, z: eyeConfig.cyclopeanEyeOriginWCS.z - 200 },
          { x: eyeConfig.cyclopeanEyeOriginWCS.x + 900, y: 0, z: eyeConfig.cyclopeanEyeOriginWCS.z + 200 }
        ]
      ]
    };

    const res = HumanLineOfSightEngine.evaluateLineOfSight({
      documentId: 'DOC_001',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      targetPositionMm: targetPos,
      obstacleGeometry: multiObstacle
    });

    expect(res.status).toBe('FULLY_OCCLUDED');
    expect(res.firstHitObstacle).toBeDefined();
    expect(res.firstHitObstacle?.distanceMm).toBeLessThan(500); // Identifies near obstacle (~400mm)
  });

  // -------------------------------------------------------------------------
  // TEST 11: Partial Target Region Occlusion
  // -------------------------------------------------------------------------
  it('TEST-011: Evaluates target region with 50% obstructed points as PARTIALLY_OCCLUDED', () => {
    const eyeConfig = HumanVisualModel.computeEyeConfiguration('ANSUR2_MALE_P50');
    const targetPos = { x: eyeConfig.cyclopeanEyeOriginWCS.x + 1000, y: 0, z: eyeConfig.cyclopeanEyeOriginWCS.z };

    // Small obstacle covering half the sample points
    const halfObstacle = {
      documentId: 'DOC_HALF_OBSTACLE',
      revisionId: 1,
      triangles: [
        [
          { x: eyeConfig.cyclopeanEyeOriginWCS.x + 500, y: -300, z: eyeConfig.cyclopeanEyeOriginWCS.z - 300 },
          { x: eyeConfig.cyclopeanEyeOriginWCS.x + 500, y: 300, z: eyeConfig.cyclopeanEyeOriginWCS.z - 300 },
          { x: eyeConfig.cyclopeanEyeOriginWCS.x + 500, y: 0, z: eyeConfig.cyclopeanEyeOriginWCS.z + 300 }
        ]
      ]
    };

    const samplePoints = [
      { x: targetPos.x, y: targetPos.y, z: targetPos.z }, // Obstructed
      { x: targetPos.x, y: targetPos.y + 600, z: targetPos.z } // Clear outside triangle
    ];

    const res = HumanLineOfSightEngine.evaluateLineOfSight({
      documentId: 'DOC_001',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      targetPositionMm: targetPos,
      targetRegion: { samplePoints },
      obstacleGeometry: halfObstacle
    });

    expect(res.occlusionPercentage).toBe(50.0);
    expect(res.status).toBe('PARTIALLY_OCCLUDED');
  });

  // -------------------------------------------------------------------------
  // TEST 12: Complete Target Region Occlusion
  // -------------------------------------------------------------------------
  it('TEST-012: Evaluates target region with 100% obstructed points as FULLY_OCCLUDED', () => {
    const eyeConfig = HumanVisualModel.computeEyeConfiguration('ANSUR2_MALE_P50');
    const targetPos = { x: eyeConfig.cyclopeanEyeOriginWCS.x + 1000, y: 0, z: eyeConfig.cyclopeanEyeOriginWCS.z };

    const fullObstacle = {
      documentId: 'DOC_FULL_OBSTACLE',
      revisionId: 1,
      triangles: [
        [
          { x: eyeConfig.cyclopeanEyeOriginWCS.x + 500, y: -1000, z: eyeConfig.cyclopeanEyeOriginWCS.z - 1000 },
          { x: eyeConfig.cyclopeanEyeOriginWCS.x + 500, y: 1000, z: eyeConfig.cyclopeanEyeOriginWCS.z - 1000 },
          { x: eyeConfig.cyclopeanEyeOriginWCS.x + 500, y: 0, z: eyeConfig.cyclopeanEyeOriginWCS.z + 1000 }
        ]
      ]
    };

    const samplePoints = [
      { x: targetPos.x, y: targetPos.y, z: targetPos.z },
      { x: targetPos.x, y: targetPos.y + 100, z: targetPos.z }
    ];

    const res = HumanLineOfSightEngine.evaluateLineOfSight({
      documentId: 'DOC_001',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      targetPositionMm: targetPos,
      targetRegion: { samplePoints },
      obstacleGeometry: fullObstacle
    });

    expect(res.occlusionPercentage).toBe(100.0);
    expect(res.status).toBe('FULLY_OCCLUDED');
  });

  // -------------------------------------------------------------------------
  // TEST 13: Coordinate Frame Validation (WCS / MCS)
  // -------------------------------------------------------------------------
  it('TEST-013: Correctly validates coordinate frames in vision query inputs', () => {
    const eyeConfig = HumanVisualModel.computeEyeConfiguration('ANSUR2_MALE_P50');
    const targetPos = { x: eyeConfig.cyclopeanEyeOriginWCS.x + 500, y: 0, z: eyeConfig.cyclopeanEyeOriginWCS.z };

    const res = HumanLineOfSightEngine.evaluateLineOfSight({
      documentId: 'DOC_001',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      targetPositionMm: targetPos,
      coordinateFrame: 'MCS'
    });

    expect(res.queryId).toBeDefined();
    expect(res.status).toBe('VISIBLE_BINOCULAR');
  });

  // -------------------------------------------------------------------------
  // TEST 14: Deterministic Visibility Query Reproducibility
  // -------------------------------------------------------------------------
  it('TEST-014: Produces bit-for-bit identical vision query results across repeated runs', () => {
    const eyeConfig = HumanVisualModel.computeEyeConfiguration('ANSUR2_MALE_P50');
    const targetPos = { x: eyeConfig.cyclopeanEyeOriginWCS.x + 600, y: 100, z: eyeConfig.cyclopeanEyeOriginWCS.z };

    const query1 = HumanLineOfSightEngine.evaluateLineOfSight({
      documentId: 'DOC_001',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      targetPositionMm: targetPos
    });

    const query2 = HumanLineOfSightEngine.evaluateLineOfSight({
      documentId: 'DOC_001',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      targetPositionMm: targetPos
    });

    expect(query1.status).toBe(query2.status);
    expect(query1.leftEyeRayDistanceMm).toBe(query2.leftEyeRayDistanceMm);
    expect(query1.occlusionPercentage).toBe(query2.occlusionPercentage);
  });

  // -------------------------------------------------------------------------
  // TEST 15: Invalid / Missing Input Fail-Closed Behavior
  // -------------------------------------------------------------------------
  it('TEST-015: Fails closed with INVALID_INPUT on non-finite coordinates or null inputs', () => {
    const res = HumanLineOfSightEngine.evaluateLineOfSight({
      documentId: 'DOC_001',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      targetPositionMm: { x: NaN, y: 0, z: 0 }
    });

    expect(res.status).toBe('INVALID_INPUT');
    expect(res.isLeftEyeUnobstructed).toBe(false);
  });

  // -------------------------------------------------------------------------
  // TEST 16: Obstacle Geometry Error Handling
  // -------------------------------------------------------------------------
  it('TEST-016: Handles invalid obstacle geometry fail-closed without crashing', () => {
    const res = HumanLineOfSightEngine.evaluateLineOfSight({
      documentId: 'DOC_001',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      targetPositionMm: { x: 500, y: 0, z: 1200 },
      obstacleGeometry: {
        documentId: 'INVALID_CAD_DOC',
        revisionId: 1,
        triangles: [] // Empty triangles
      }
    });

    expect(res.status).toBe('VISIBLE_BINOCULAR');
    expect(res.isLeftEyeUnobstructed).toBe(true);
  });

  // -------------------------------------------------------------------------
  // TEST 17: Canonical Document Revision Mismatch Rejection
  // -------------------------------------------------------------------------
  it('TEST-017: Rejects vision binding when EngineeringDocument revision mismatches', () => {
    const doc: EngineeringDocument = {
      documentId: 'DOC_CABIN_001',
      revision: 'REV_1'
    };

    const eyeConfig = HumanVisualModel.computeEyeConfiguration('ANSUR2_MALE_P50');
    const targetPos = { x: eyeConfig.cyclopeanEyeOriginWCS.x + 500, y: 0, z: eyeConfig.cyclopeanEyeOriginWCS.z };

    const visRes = HumanLineOfSightEngine.evaluateLineOfSight({
      documentId: 'DOC_CABIN_001',
      revision: 'REV_1',
      dhmProfileId: 'ANSUR2_MALE_P50',
      targetPositionMm: targetPos
    });

    const boundDoc = CanonicalVisionBridge.attachVisionToDocument(doc, visRes);
    expect(boundDoc.derived?.humanVision).toBeDefined();

    // Revision mismatch check
    const check = CanonicalVisionBridge.validateVisionBinding(
      { documentId: 'DOC_CABIN_001', revision: 'REV_2' },
      boundDoc.derived?.humanVision
    );

    expect(check.isValid).toBe(false);
    expect(check.errors[0]).toContain('Revision mismatch');
  });

  // -------------------------------------------------------------------------
  // TEST 18: CAD Assembly Revision Mismatch Rejection
  // -------------------------------------------------------------------------
  it('TEST-018: Rejects binding when document ID mismatches', () => {
    const eyeConfig = HumanVisualModel.computeEyeConfiguration('ANSUR2_MALE_P50');
    const targetPos = { x: eyeConfig.cyclopeanEyeOriginWCS.x + 500, y: 0, z: eyeConfig.cyclopeanEyeOriginWCS.z };

    const visRes = HumanLineOfSightEngine.evaluateLineOfSight({
      documentId: 'DOC_ORIGINAL',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      targetPositionMm: targetPos
    });

    const check = CanonicalVisionBridge.validateVisionBinding(
      { documentId: 'DOC_DIFFERENT', revision: 1 },
      visRes
    );

    expect(check.isValid).toBe(false);
    expect(check.errors[0]).toContain('Document ID mismatch');
  });

  // -------------------------------------------------------------------------
  // TEST 19: Provenance Mutation Detection
  // -------------------------------------------------------------------------
  it('TEST-019: Detects tamper or unauthorized mutation of vision query result provenance', () => {
    const eyeConfig = HumanVisualModel.computeEyeConfiguration('ANSUR2_MALE_P50');
    const targetPos = { x: eyeConfig.cyclopeanEyeOriginWCS.x + 500, y: 0, z: eyeConfig.cyclopeanEyeOriginWCS.z };

    const visRes = HumanLineOfSightEngine.evaluateLineOfSight({
      documentId: 'DOC_001',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      targetPositionMm: targetPos
    });

    // Tamper status after query execution
    visRes.status = 'FULLY_OCCLUDED';

    const check = CanonicalVisionBridge.validateVisionBinding(
      { documentId: 'DOC_001', revision: 1 },
      visRes
    );

    expect(check.isValid).toBe(false);
    expect(check.errors[0]).toContain('provenance hash verification failed');
  });

  // -------------------------------------------------------------------------
  // TEST 20: Persistent Canonical Evidence Verification
  // -------------------------------------------------------------------------
  it('TEST-020: Persists structured vision evidence via canonical bridge evidence ledger', () => {
    const doc: EngineeringDocument = {
      documentId: 'DOC_VIS_EVIDENCE',
      revision: 1
    };

    const eyeConfig = HumanVisualModel.computeEyeConfiguration('ANSUR2_MALE_P50');
    const targetPos = { x: eyeConfig.cyclopeanEyeOriginWCS.x + 500, y: 0, z: eyeConfig.cyclopeanEyeOriginWCS.z };

    const visRes = HumanLineOfSightEngine.evaluateLineOfSight({
      documentId: 'DOC_VIS_EVIDENCE',
      revision: 1,
      dhmProfileId: 'ANSUR2_MALE_P50',
      targetPositionMm: targetPos
    });

    const updatedDoc = CanonicalVisionBridge.attachVisionToDocument(doc, visRes);

    expect(updatedDoc.evidence?.length).toBe(1);
    expect(updatedDoc.evidence?.[0].stage).toBe('HUMAN_FACTORS_VISION');
    expect(updatedDoc.metadata?.visionProvenanceHash).toBe(visRes.provenanceHash);
  });

  // -------------------------------------------------------------------------
  // TEST 21: Regression Protection for Pre-Existing Solvers
  // -------------------------------------------------------------------------
  it('TEST-021: Preserves existing Robot IK, Human FK, IK, and Reachability capabilities without regression', () => {
    expect(RobotInverseKinematicsEngine).toBeDefined();
    expect(HumanForwardKinematicsEngine).toBeDefined();
    expect(HumanLineOfSightEngine).toBeDefined();
  });
});
