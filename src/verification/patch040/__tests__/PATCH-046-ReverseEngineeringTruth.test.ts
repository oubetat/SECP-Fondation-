/**
 * SECP — PATCH-046 Qualification Battery
 * REVERSE ENGINEERING CANONICAL BRIDGE
 */

import { describe, it, expect } from 'vitest';
import { 
  ReverseEngineeringTruthGate, 
  SurfaceFittingMetrics, 
  REFeatureTree 
} from '../../../engine/cad/reverse_engineering/ReverseEngineeringTruthGate';
import { Point3D, PointCloudBounds } from '../../../engine/reverse_engineering/point_cloud/PointCloudTypes315';
import { RegisteredPointCloud, RigidTransform } from '../../../engine/reverse_engineering/registration/PointCloudRegistrationTypes317';
import { EngineeringDocument } from '../../../engine/cad-kernel/document/CADDocument';

describe('PATCH-046 Reverse Engineering Canonical Bridge Battery', () => {

  const mockDoc: EngineeringDocument = {
    documentId: 'DOC-RE-046',
    revision: 1,
    type: 'PART',
    units: { system: 'SI_MM', length: 'mm', angle: 'deg', mass: 'kg', force: 'N', pressure: 'MPa' },
    sketches: [],
    constraints: [],
    features: [],
    parameters: [],
    topologyMap: { version: 1 },
    derived: {},
    evidence: []
  } as any;

  const validBounds: PointCloudBounds = {
    minX: 0, maxX: 100,
    minY: 0, maxY: 100,
    minZ: 0, maxZ: 50,
    sizeX: 100, sizeY: 100, sizeZ: 50,
    center: [50, 50, 25],
    diagonalMm: 150
  };

  const validTransform: RigidTransform = {
    transformId: 'TR-RIGID-046',
    sourceFrame: 'SCAN-A',
    targetFrame: 'WORLD_MM',
    matrix: [
      1, 0, 0, 10,
      0, 1, 0, 20,
      0, 0, 1, 5,
      0, 0, 0, 1
    ],
    rotationMatrix: [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1
    ],
    translationVector: [10, 20, 5],
    scaleFactor: 1.0,
    isValidRigid: true,
    determinantR: 1.0
  };

  const validPointCloud: RegisteredPointCloud = {
    registeredDatasetId: 'REG-DS-046',
    sourceDatasetIds: ['SCAN-A'],
    targetRefDatasetId: 'WORLD_MM',
    registrationId: 'REG-046',
    appliedTransform: validTransform,
    pointCount: 10,
    bounds: validBounds,
    units: 'mm',
    globalCoordinateFrame: 'WORLD_MM',
    registeredPoints: [
      { pointIndex: 0, originalPoint: { x: 0, y: 0, z: 0 }, transformedPoint: { x: 10, y: 20, z: 5 }, sourceDatasetId: 'SCAN-A' }
    ],
    qualityReport: {
      registrationId: 'REG-046',
      convergenceStatus: 'CONVERGED',
      iterationsCompleted: 5,
      initialRmseMm: 0.5,
      finalRmseMm: 0.01,
      rmseImprovementMm: 0.49,
      overlapRatioEstimate: 1.0,
      isSufficientOverlap: true,
      residualAnalysis: {
        meanResidualMm: 0.01, medianResidualMm: 0.01, stdDevResidualMm: 0.0,
        rmseMm: 0.01, maxResidualMm: 0.02, percentile90ResidualMm: 0.015,
        validCorrespondenceCount: 10, rejectedCorrespondenceCount: 0
      },
      transformValidity: { isRigid: true, scalePreserved: true, rotationDeterminant: 1.0, orthogonalityError: 0.0 },
      warnings: [], errors: []
    },
    provenance: {
      transformId: 'TR-RIGID-046', sourceDatasetId: 'SCAN-A', targetDatasetId: 'WORLD_MM',
      algorithm: 'ICP_POINT_TO_POINT', algorithmVersion: '1.0.0', executionBackend: 'CPU_SINGLE_THREAD',
      timestamp: new Date().toISOString(), executionTimeMs: 12, settingsHash: 'H', transformHash: 'H'
    },
    integrityHash: 'H',
    createdAt: new Date().toISOString()
  };

  const validSurfaceMetrics: SurfaceFittingMetrics = {
    surfaceId: 'SURF-046-CYL',
    type: 'CYLINDER',
    rmsDeviationMm: 0.02,
    meanDeviationMm: 0.015,
    maxDeviationMm: 0.04,
    isContinuousG1: true
  };

  const validFeatureTree: REFeatureTree = {
    featureId: 'FEAT-046-HOLE',
    type: 'HOLE_THROUGH',
    parameters: { diameterMm: 10.0 },
    geometryReferenceId: 'FACE_CYL_046',
    isRegenerable: true
  };

  // RE-001 & RE-002: Ingestion & Validation
  it('should validate point cloud bounds and coordinate integrity', () => {
    const points: Point3D[] = [{ x: 10, y: 20, z: 5 }];
    const valid = ReverseEngineeringTruthGate.validatePointCloud(points, validBounds);
    expect(valid).toBe(true);
  });

  // RE-004 & RE-005: Registration Verification
  it('should verify alignment transformation rigidity and reject scales or deformations', () => {
    const isRigid = ReverseEngineeringTruthGate.verifyRigidTransform(validTransform);
    expect(isRigid).toBe(true);
  });

  // RE-011: NURBS Mathematical Validity
  it('should verify NURBS surface fitting metrics', () => {
    const isFitOk = ReverseEngineeringTruthGate.verifySurfaceFitting(validSurfaceMetrics, 0.05);
    expect(isFitOk).toBe(true);
  });

  // RE-020: Feature Tree Regeneration
  it('should verify parametric feature tree modifies geometry on parameter change', () => {
    const signatureBefore = 'BREP_CYL_RADIUS_5_MM';
    const signatureAfter = 'BREP_CYL_RADIUS_6_MM'; // Parameter changed 10mm -> 12mm diameter

    const isRegenOk = ReverseEngineeringTruthGate.verifyFeatureTreeRegeneration(
      validFeatureTree,
      signatureBefore,
      signatureAfter
    );
    expect(isRegenOk).toBe(true);
  });

  // RE-028: Truth Acceptance Gate & Evidence Record Generation
  it('should audit reverse engineering pipeline and produce PASS evidence records', () => {
    const verdicts = ReverseEngineeringTruthGate.runAudit(
      mockDoc,
      validPointCloud,
      validSurfaceMetrics,
      validFeatureTree,
      'BREP_CYL_RADIUS_5_MM',
      'BREP_CYL_RADIUS_6_MM',
      0.02, // actual deviation matching rmsDeviationMm
      0.02
    );

    verdicts.forEach(v => {
      expect(v.verdict).toBe('PASS');
    });

    const evidence = ReverseEngineeringTruthGate.generateEvidence(
      mockDoc,
      validPointCloud,
      validSurfaceMetrics,
      validFeatureTree,
      'BREP_CYL_RADIUS_5_MM',
      'BREP_CYL_RADIUS_6_MM',
      0.02,
      0.02
    );

    expect(evidence.verdict).toBe('PASS');
    expect(evidence.payload.rmsDeviationMm).toBe(0.02);
  });

  // ==========================================
  // NEGATIVE PROOFS
  // ==========================================

  // RP-NEG-003: Fake NURBS
  it('should FAIL NURBS verification if surface fitting RMS deviation is zero or uncalculated', () => {
    const fakeSurfaceMetrics: SurfaceFittingMetrics = {
      surfaceId: 'SURF-FAKE',
      type: 'NURBS',
      rmsDeviationMm: 0, // Uncalculated/simulated fitting
      meanDeviationMm: 0,
      maxDeviationMm: 0,
      isContinuousG1: true
    };
    expect(ReverseEngineeringTruthGate.verifySurfaceFitting(fakeSurfaceMetrics, 0.05)).toBe(false);
  });

  // RP-NEG-005: Fake Registration
  it('should FAIL transform rigidity verification if rotation determinant is not equal to 1.0', () => {
    const deformedTransform: RigidTransform = {
      transformId: 'TR-DEFORMED',
      sourceFrame: 'SCAN-A',
      targetFrame: 'WORLD_MM',
      matrix: [
        1.5, 0, 0, 0,  // Scale deformation along X axis
        0, 1.0, 0, 0,
        0, 0, 1.0, 0,
        0, 0, 0, 1.0
      ],
      rotationMatrix: [
        1.5, 0, 0,
        0, 1.0, 0,
        0, 0, 1.0
      ],
      translationVector: [0, 0, 0],
      scaleFactor: 1.5,
      isValidRigid: false,
      determinantR: 1.5
    };

    expect(ReverseEngineeringTruthGate.verifyRigidTransform(deformedTransform)).toBe(false);
  });

  // RP-NEG-012: False Accuracy Claim
  it('should FAIL audit if actual deviation does not match the claimed reconstruction metrics', () => {
    const verdicts = ReverseEngineeringTruthGate.runAudit(
      mockDoc,
      validPointCloud,
      validSurfaceMetrics,
      validFeatureTree,
      'BREP_CYL_RADIUS_5_MM',
      'BREP_CYL_RADIUS_6_MM',
      0.09, // Actual computed deviation of 0.09mm
      0.02  // False accuracy claim of 0.02mm
    );
    
    const deviationVerdict = verdicts.find(v => v.test === 'CAD_TO_MEASUREMENT_DEVIATION');
    expect(deviationVerdict!.verdict).toBe('FAIL');
  });

  // RP-NEG-014: Parameter Illusion
  it('should FAIL feature tree verification if changing a parameter does not mutate the output B-Rep', () => {
    // Both signatures are identical despite changing parametric diameter
    const isRegenOk = ReverseEngineeringTruthGate.verifyFeatureTreeRegeneration(
      validFeatureTree,
      'BREP_UNMUTATED_GEOMETRY',
      'BREP_UNMUTATED_GEOMETRY'
    );
    expect(isRegenOk).toBe(false);
  });

});
