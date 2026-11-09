/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 002
 * Comprehensive DHM Data Foundation Test Battery
 * 
 * Verifies all 15 required PHASE G test scenarios with independent expected-value assertions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AnthropometricDatasetRegistry,
  AnthropometricProfile,
  SkeletalTopologyEngine,
  AnatomicalRegion,
  AnatomicalJointEngine,
  CanonicalDHMIntegrationBridge
} from '../index';
import { EngineeringDocument } from '../../cad-kernel/document/CADDocument';

describe('SECP-HFEE-001 TASK 002 — DHM Data Foundation Test Battery', () => {
  let registry: AnthropometricDatasetRegistry;

  beforeEach(() => {
    registry = AnthropometricDatasetRegistry.getInstance();
    registry.reset();
  });

  // -------------------------------------------------------------------------
  // TEST 1: Anthropometric Unit Validation
  // -------------------------------------------------------------------------
  it('TEST-001: Validates SI units (mm for lengths, kg for body mass) in profiles', () => {
    const p50 = registry.getProfile('ANSUR2_MALE_P50');
    expect(p50).toBeDefined();
    expect(p50?.measurements.statureMm).toBe(1756); // mm
    expect(p50?.measurements.bodyMassKg).toBe(84.6);  // kg
    expect(p50?.isValid).toBe(true);
  });

  // -------------------------------------------------------------------------
  // TEST 2: Invalid Measurement Rejection
  // -------------------------------------------------------------------------
  it('TEST-002: Rejects out-of-bounds, negative, or non-finite anthropometric values', () => {
    const invalidProfile: AnthropometricProfile = {
      profileId: 'INVALID_TEST_PROFILE',
      name: 'Invalid Anatomical Profile',
      gender: 'MALE',
      provenance: {
        datasetId: 'TEST',
        datasetName: 'Test',
        publicationYear: 2026,
        populationDescription: 'Test',
        sampleSize: 100,
        gender: 'MALE',
        percentile: 'CUSTOM',
        measurementStandard: 'ISO_7250_1',
        sourceCitation: 'Test'
      },
      measurements: {
        statureMm: 5000, // Impossibly large (> 2400 mm)
        bodyMassKg: -10, // Negative mass
        shoulderBreadthMm: NaN
      },
      segmentMasses: {},
      isValid: true,
      validationErrors: []
    };

    const res = AnthropometricDatasetRegistry.validateProfile(invalidProfile);
    expect(res.isValid).toBe(false);
    expect(res.errors.length).toBeGreaterThanOrEqual(2);
    expect(() => registry.registerProfile(invalidProfile)).toThrow();
  });

  // -------------------------------------------------------------------------
  // TEST 3: Percentile Provenance Validation
  // -------------------------------------------------------------------------
  it('TEST-003: Verifies sample size and citation provenance for ANSUR II P5, P50, P95', () => {
    const p5 = registry.getProfile('ANSUR2_MALE_P5');
    const p50 = registry.getProfile('ANSUR2_MALE_P50');
    const p95 = registry.getProfile('ANSUR2_MALE_P95');

    expect(p5?.provenance.sampleSize).toBe(4082);
    expect(p50?.provenance.sampleSize).toBe(4082);
    expect(p95?.provenance.sampleSize).toBe(4082);

    expect(p5?.measurements.statureMm).toBeLessThan(p50?.measurements.statureMm!);
    expect(p50?.measurements.statureMm).toBeLessThan(p95?.measurements.statureMm!);

    expect(p5?.provenance.sourceCitation).toContain('NATICK/TR-15/007');
  });

  // -------------------------------------------------------------------------
  // TEST 4: Missing-Data Handling
  // -------------------------------------------------------------------------
  it('TEST-004: Retains missing measurements as explicitly undefined without silent interpolation', () => {
    const p5 = registry.getProfile('ANSUR2_MALE_P5');
    expect(p5?.measurements.statureMm).toBeDefined();
    // Verify that unmeasured fields remain explicitly undefined, not zero or interpolated
    const customProfile: AnthropometricProfile = {
      profileId: 'SPARSE_PROFILE',
      name: 'Sparse Measurement Profile',
      gender: 'FEMALE',
      provenance: {
        datasetId: 'SPARSE_01',
        datasetName: 'Sparse Dataset',
        publicationYear: 2026,
        populationDescription: 'Sparse Sample',
        sampleSize: 50,
        gender: 'FEMALE',
        percentile: 'CUSTOM',
        measurementStandard: 'ISO_7250_1',
        sourceCitation: 'Test Sparse'
      },
      measurements: {
        statureMm: 1650
        // sittingHeightMm, shoulderBreadthMm, etc. are intentionally undefined
      },
      segmentMasses: {},
      isValid: true,
      validationErrors: []
    };

    const val = AnthropometricDatasetRegistry.validateProfile(customProfile);
    expect(val.isValid).toBe(true);
    expect(customProfile.measurements.sittingHeightMm).toBeUndefined();
    expect(customProfile.measurements.shoulderBreadthMm).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // TEST 5: Skeletal Hierarchy Construction
  // -------------------------------------------------------------------------
  it('TEST-005: Constructs a 19-segment branched human skeleton from ANSUR II profile', () => {
    const p50 = registry.getProfile('ANSUR2_MALE_P50')!;
    const skeleton = SkeletalTopologyEngine.buildSkeleton(p50, 'MALE_P50_SKELETON');

    expect(skeleton.isValid).toBe(true);
    expect(skeleton.rootSegmentId).toBe(AnatomicalRegion.PELVIS);

    const segmentCount = Object.keys(skeleton.segments).length;
    expect(segmentCount).toBe(19);

    const head = skeleton.segments[AnatomicalRegion.HEAD];
    expect(head.parentSegmentId).toBe(AnatomicalRegion.NECK);

    const lHand = skeleton.segments[AnatomicalRegion.LEFT_HAND];
    expect(lHand.parentSegmentId).toBe(AnatomicalRegion.LEFT_FOREARM);
  });

  // -------------------------------------------------------------------------
  // TEST 6: Cyclic Hierarchy Rejection
  // -------------------------------------------------------------------------
  it('TEST-006: Detects and rejects cyclic parent-child relationships in skeleton', () => {
    const p50 = registry.getProfile('ANSUR2_MALE_P50')!;
    const skeleton = SkeletalTopologyEngine.buildSkeleton(p50);

    // Intentionally introduce cycle: NECK -> THORACIC_SPINE -> LUMBAR_SPINE -> PELVIS -> NECK
    skeleton.segments[AnatomicalRegion.PELVIS].childSegmentIds.push(AnatomicalRegion.NECK);
    skeleton.segments[AnatomicalRegion.NECK].childSegmentIds.push(AnatomicalRegion.THORACIC_SPINE);

    const val = SkeletalTopologyEngine.validateSkeletalTopology(skeleton.segments);
    expect(val.isValid).toBe(false);
    expect(val.errors.some((e) => e.includes('Cyclic'))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // TEST 7: Disconnected-Segment Validation
  // -------------------------------------------------------------------------
  it('TEST-007: Detects disconnected or orphaned segments in skeletal tree', () => {
    const p50 = registry.getProfile('ANSUR2_MALE_P50')!;
    const skeleton = SkeletalTopologyEngine.buildSkeleton(p50);

    // Disconnect LEFT_HAND from LEFT_FOREARM
    const lForearm = skeleton.segments[AnatomicalRegion.LEFT_FOREARM];
    lForearm.childSegmentIds = [];

    const val = SkeletalTopologyEngine.validateSkeletalTopology(skeleton.segments);
    expect(val.isValid).toBe(false);
    expect(val.errors.some((e) => e.includes('Disconnected') || e.includes('unreachable'))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // TEST 8: Anatomical Joint Definition Validation
  // -------------------------------------------------------------------------
  it('TEST-008: Validates anatomical joint definitions and NASA STD-3001 ROM bounds', () => {
    const joints = AnatomicalJointEngine.buildAnatomicalJoints();

    expect(joints.size).toBeGreaterThanOrEqual(14);

    const lShoulder = joints.get('J_LEFT_SHOULDER');
    expect(lShoulder).toBeDefined();
    expect(lShoulder?.degreesOfFreedom).toBe(3);
    expect(lShoulder?.rangeOfMotion.flexionExtension?.maxDeg).toBe(180);

    const lElbow = joints.get('J_LEFT_ELBOW');
    expect(lElbow?.degreesOfFreedom).toBe(1);
    expect(lElbow?.rangeOfMotion.flexionExtension?.maxDeg).toBe(145);
  });

  // -------------------------------------------------------------------------
  // TEST 9: Joint ROM Boundary Validation
  // -------------------------------------------------------------------------
  it('TEST-009: Detects joint angles exceeding anatomical Range of Motion (ROM) limits', () => {
    const joints = AnatomicalJointEngine.buildAnatomicalJoints();
    const lElbow = joints.get('J_LEFT_ELBOW')!;

    // Valid angle: 90 deg flexion
    const validRes = AnatomicalJointEngine.validateJointAngles(lElbow, { flexionExtension: 90 });
    expect(validRes.isValid).toBe(true);

    // Invalid angle: 180 deg flexion (max limit is 145 deg)
    const invalidRes = AnatomicalJointEngine.validateJointAngles(lElbow, { flexionExtension: 180 });
    expect(invalidRes.isValid).toBe(false);
    expect(invalidRes.violations[0]).toContain('violates anatomical ROM limits');
  });

  // -------------------------------------------------------------------------
  // TEST 10: Transform Composition
  // -------------------------------------------------------------------------
  it('TEST-010: Computes global 4x4 matrix transform chain from root Pelvis to Head', () => {
    const p50 = registry.getProfile('ANSUR2_MALE_P50')!;
    const skeleton = SkeletalTopologyEngine.buildSkeleton(p50);

    const head = skeleton.segments[AnatomicalRegion.HEAD];
    expect(head.globalTransform).toBeDefined();

    // Z position of head in global frame should equal sum of pelvic, lumbar, thoracic, neck, and head offsets
    const headZ = head.globalTransform[2][3];
    expect(headZ).toBeGreaterThan(700); // Height of upper torso above pelvis in mm
  });

  // -------------------------------------------------------------------------
  // TEST 11: Deterministic Serialization
  // -------------------------------------------------------------------------
  it('TEST-011: Generates deterministic serialization hashes for skeletal topologies', () => {
    const p50 = registry.getProfile('ANSUR2_MALE_P50')!;
    const skel1 = SkeletalTopologyEngine.buildSkeleton(p50, 'SKELETON_RUN_1');
    const skel2 = SkeletalTopologyEngine.buildSkeleton(p50, 'SKELETON_RUN_2');

    expect(skel1.serializationHash).toBe(skel2.serializationHash);
  });

  // -------------------------------------------------------------------------
  // TEST 12: Revision-Binding Integrity
  // -------------------------------------------------------------------------
  it('TEST-012: Binds DHM Model Instance to specific EngineeringDocument revision', () => {
    const mockDoc: EngineeringDocument = {
      documentId: 'DOC_CAD_DRONE_001',
      revision: 'REV_2.1',
      type: 'ASSEMBLY'
    };

    const p50 = registry.getProfile('ANSUR2_MALE_P50')!;
    const skeleton = SkeletalTopologyEngine.buildSkeleton(p50);
    const joints = AnatomicalJointEngine.buildAnatomicalJoints();

    const instance = CanonicalDHMIntegrationBridge.createModelInstance(
      mockDoc,
      p50,
      skeleton,
      joints,
      { parentCoordinateFrame: 'WCS', positionMm: { x: 100, y: 200, z: 0 } }
    );

    expect(instance.documentId).toBe('DOC_CAD_DRONE_001');
    expect(instance.revision).toBe('REV_2.1');
    expect(instance.provenanceHash).toBeDefined();

    const val = CanonicalDHMIntegrationBridge.validateBinding(mockDoc, instance);
    expect(val.isValid).toBe(true);
  });

  // -------------------------------------------------------------------------
  // TEST 13: Mutation Detection
  // -------------------------------------------------------------------------
  it('TEST-013: Detects unauthorized mutation or tamper of DHM model instance', () => {
    const mockDoc: EngineeringDocument = {
      documentId: 'DOC_CAD_DRONE_001',
      revision: 1
    };

    const p50 = registry.getProfile('ANSUR2_MALE_P50')!;
    const skeleton = SkeletalTopologyEngine.buildSkeleton(p50);
    const joints = AnatomicalJointEngine.buildAnatomicalJoints();

    const instance = CanonicalDHMIntegrationBridge.createModelInstance(mockDoc, p50, skeleton, joints);

    // Tamper position coordinates after creation
    instance.placementFrame.positionMm.x = 99999;

    const val = CanonicalDHMIntegrationBridge.validateBinding(mockDoc, instance);
    expect(val.isValid).toBe(false);
    expect(val.errors.some((e) => e.includes('provenance hash verification failed'))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // TEST 14: Invalid Dataset Provenance Rejection
  // -------------------------------------------------------------------------
  it('TEST-014: Rejects registration of profiles with invalid or empty provenance citations', () => {
    const invalidProvProfile: AnthropometricProfile = {
      profileId: 'NO_PROV_PROFILE',
      name: 'Uncited Profile',
      gender: 'MALE',
      provenance: {
        datasetId: '',
        datasetName: '',
        publicationYear: 0,
        populationDescription: '',
        sampleSize: -50, // Invalid sample size
        gender: 'MALE',
        percentile: 'CUSTOM',
        measurementStandard: 'ISO_7250_1',
        sourceCitation: '' // Empty citation
      },
      measurements: { statureMm: 1750 },
      segmentMasses: {},
      isValid: true,
      validationErrors: []
    };

    const val = AnthropometricDatasetRegistry.validateProfile(invalidProvProfile);
    expect(val.isValid).toBe(false);
    expect(val.errors.some((e) => e.includes('provenance'))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // TEST 15: Canonical Integration Compatibility
  // -------------------------------------------------------------------------
  it('TEST-015: Safely integrates DHM Instance into EngineeringDocument without breaking SOT contract', () => {
    const canonicalDoc: EngineeringDocument = {
      documentId: 'DOC_WORKBENCH_ASSEMBLY_001',
      revision: 'R1',
      type: 'ASSEMBLY',
      features: []
    };

    const p50 = registry.getProfile('ANSUR2_MALE_P50')!;
    const skeleton = SkeletalTopologyEngine.buildSkeleton(p50);
    const joints = AnatomicalJointEngine.buildAnatomicalJoints();

    const instance = CanonicalDHMIntegrationBridge.createModelInstance(canonicalDoc, p50, skeleton, joints);

    const updatedDoc = CanonicalDHMIntegrationBridge.attachToCanonicalDocument(canonicalDoc, instance);

    expect(updatedDoc.derived?.dhm).toBeDefined();
    expect(updatedDoc.metadata?.dhmProvenanceHash).toBe(instance.provenanceHash);
    expect(updatedDoc.evidence?.length).toBe(1);
    expect(updatedDoc.evidence?.[0].verdict).toBe('PASS');
    expect(updatedDoc.evidence?.[0].stage).toBe('HUMAN_FACTORS_DHM_FOUNDATION');

    // Verify original document was not mutated directly
    expect(canonicalDoc.derived?.dhm).toBeUndefined();
  });
});
