import { describe, it, expect } from 'vitest';
import { RobotJointDesignEngine } from '../robot/RobotJointDesignEngine';
import { RobotJointValidator } from '../robot/RobotJointValidator';
import { EPC039Verifier } from '../robot/EPC039Verifier';
import { RobotJointDefinition } from '../robot/RobotJointTypes';
import { EvidenceIntegrityService } from '../evidence/EvidenceIntegrityService';

describe('EPC-039 — Robot Joint Design Engineering Core', () => {
  it('1. Joint Definition Schema — valid joint creation and default parameters', () => {
    const jointDef = RobotJointDesignEngine.createDefaultJoint('J1_BASE', 'REVOLUTE');
    expect(jointDef.jointId).toBe('J1_BASE');
    expect(jointDef.jointType).toBe('REVOLUTE');
    expect(jointDef.parentLinkId).toBe('link_J1_BASE_parent');
    expect(jointDef.childLinkId).toBe('link_J1_BASE_child');
    expect(jointDef.axis).toEqual({ x: 0, y: 0, z: 1 });
    expect(jointDef.limits.minimumPosition).toBe(-180);
    expect(jointDef.limits.maximumPosition).toBe(180);

    const result = RobotJointDesignEngine.generateJoint(jointDef);
    expect(result.validation.valid).toBe(true);
    expect(result.joint.jointId).toBe('J1_BASE');
  });

  it('2. Parametric Joint Geometry — CAD Kernel generation and B-Rep solid volume calculation', () => {
    const jointDef = RobotJointDesignEngine.createDefaultJoint('J2_SHOULDER', 'REVOLUTE');
    const result = RobotJointDesignEngine.generateJoint(jointDef);

    expect(result.parts.length).toBeGreaterThanOrEqual(3);
    const housing = result.parts.find((p) => p.name.includes('Housing'));
    const shaft = result.parts.find((p) => p.name.includes('Shaft'));
    const flange = result.parts.find((p) => p.name.includes('Flange'));

    expect(housing).toBeDefined();
    expect(shaft).toBeDefined();
    expect(flange).toBeDefined();

    expect(housing!.solids[0].volume).toBeGreaterThan(0);
    expect(shaft!.solids[0].volume).toBeGreaterThan(0);
    expect(result.properties.geometricVolumeMm3).toBeGreaterThan(0);
  });

  it('3. Joint Axis Definition — Axis normalization and degenerate vector rejection', () => {
    const unnormalizedDef = RobotJointDesignEngine.createDefaultJoint('J3_ELBOW', 'REVOLUTE');
    unnormalizedDef.axis = { x: 0, y: 0, z: 25 }; // Norm = 25
    const result = RobotJointDesignEngine.generateJoint(unnormalizedDef);

    // Should be normalized to unit vector
    expect(result.joint.axis.z).toBeCloseTo(1.0, 5);

    // Zero-length axis must fail validation
    const zeroAxisDef = { ...unnormalizedDef, axis: { x: 0, y: 0, z: 0 } };
    const zeroValidation = RobotJointValidator.validateJoint(zeroAxisDef);
    expect(zeroValidation.valid).toBe(false);
    expect(zeroValidation.issues.some((i) => i.field === 'axis')).toBe(true);
  });

  it('4. Joint Limits — Enforce and reject invalid configurations', () => {
    const invalidLimitsDef: RobotJointDefinition = {
      ...RobotJointDesignEngine.createDefaultJoint('J4_WRIST1', 'REVOLUTE'),
      limits: {
        minimumPosition: 100, // minimum > maximum
        maximumPosition: -100,
        maxVelocity: -10,
        maxAcceleration: -5,
        maxTorque: -500,
        ratedTorque: 600
      }
    };

    const val = RobotJointValidator.validateJoint(invalidLimitsDef);
    expect(val.valid).toBe(false);
    expect(val.issues.some((i) => i.field.includes('minimumPosition'))).toBe(true);
    expect(val.issues.some((i) => i.field.includes('maxVelocity'))).toBe(true);
    expect(val.issues.some((i) => i.field.includes('maxTorque'))).toBe(true);
  });

  it('5. Joint <-> Assembly Integration — Parent/Child link assembly tree and mates', () => {
    const jointDef = RobotJointDesignEngine.createDefaultJoint('J5_WRIST2', 'REVOLUTE');
    const result = RobotJointDesignEngine.generateJoint(jointDef);

    expect(result.assembly.partIds).toContain(jointDef.parentLinkId);
    expect(result.assembly.partIds).toContain(jointDef.childLinkId);
    expect(result.assembly.mates.length).toBeGreaterThanOrEqual(2);
    expect(result.assembly.mates[0].type).toBe('CONCENTRIC');
    expect(result.assembly.mates[1].type).toBe('COINCIDENT');
  });

  it('6. Joint <-> Kinematics Integration — Revolute & Prismatic SE(3) transformation', () => {
    // Revolute joint position update
    const revDef0 = RobotJointDesignEngine.createDefaultJoint('J6_WRIST3', 'REVOLUTE');
    revDef0.position = 0;
    const revRes0 = RobotJointDesignEngine.generateJoint(revDef0);

    const revDef90 = { ...revDef0, position: 90 };
    const revRes90 = RobotJointDesignEngine.generateJoint(revDef90);

    expect(revRes0.childWorldTransform).not.toEqual(revRes90.childWorldTransform);

    // Prismatic joint position update
    const prismDef0 = RobotJointDesignEngine.createDefaultJoint('J_PRISM', 'PRISMATIC');
    prismDef0.position = 0;
    const prismRes0 = RobotJointDesignEngine.generateJoint(prismDef0);

    const prismDef150 = { ...prismDef0, position: 150 };
    const prismRes150 = RobotJointDesignEngine.generateJoint(prismDef150);

    expect(prismRes0.childWorldTransform).not.toEqual(prismRes150.childWorldTransform);
  });

  it('7. Joint Engineering Properties — Derived mass, COM, inertia tensor, torque capacity', () => {
    const jointDef = RobotJointDesignEngine.createDefaultJoint('J_PROPS', 'REVOLUTE');
    const result = RobotJointDesignEngine.generateJoint(jointDef);

    expect(result.properties.massKg).toBeGreaterThan(0);
    expect(result.properties.centerOfMassMm).toBeDefined();
    expect(result.properties.inertiaTensorKgM2.Izz).toBeGreaterThan(0);
    expect(result.properties.torqueCapacityNm).toBeGreaterThan(0);
    expect(result.properties.jointRange.span).toBe(360);
  });

  it('8. Deterministic Failure Rejection — Non-physical geometric dimensions', () => {
    const invalidGeomDef = RobotJointDesignEngine.createDefaultJoint('J_BAD_GEOM', 'REVOLUTE');
    invalidGeomDef.geometryParams.shaftDiameter = 300; // Shaft larger than housing (110)
    invalidGeomDef.geometryParams.housingDiameter = 110;

    const val = RobotJointValidator.validateJoint(invalidGeomDef);
    expect(val.valid).toBe(false);
    expect(val.issues.some((i) => i.field.includes('shaftDiameter'))).toBe(true);

    expect(() => RobotJointDesignEngine.generateJoint(invalidGeomDef)).toThrow();
  });

  it('9. Evidence Generation — Signed cryptographic evidence package', () => {
    const jointDef = RobotJointDesignEngine.createDefaultJoint('J_EVIDENCE', 'REVOLUTE');
    const result = RobotJointDesignEngine.generateJoint(jointDef);

    expect(result.evidenceHash).toBeDefined();
    expect(result.evidenceHash.length).toBe(64); // SHA-256 length

    const verifyResult = RobotJointDesignEngine.verifyEvidencePackage(result.evidencePackage);
    expect(verifyResult.isValid).toBe(true);
  });

  it('10. Traceability — Full Requirement -> Design -> Verification -> Evidence chain', () => {
    const jointDef = RobotJointDesignEngine.createDefaultJoint('J_TRACE', 'REVOLUTE');
    const result = RobotJointDesignEngine.generateJoint(jointDef);

    expect(result.traceability.robotRequirementId).toContain('REQ-ROB-039');
    expect(result.traceability.jointRequirementId).toContain('REQ-JNT-J_TRACE');
    expect(result.traceability.jointDesignId).toContain('DES-JNT-J_TRACE');
    expect(result.traceability.parametricGeometryId).toContain('GEO-CAD-J_TRACE');
    expect(result.traceability.assemblyId).toContain('ASSY-JNT-J_TRACE');
    expect(result.traceability.kinematicChainId).toBeDefined();
  });

  it('11. Reproducibility — Bit-identical evidence hash across independent executions', () => {
    const jointDef = RobotJointDesignEngine.createDefaultJoint('J_REPRODUCE', 'REVOLUTE');
    const fixedTs = '2026-09-03T00:00:00.000Z';
    const run1 = RobotJointDesignEngine.generateJoint(jointDef, fixedTs);
    const run2 = RobotJointDesignEngine.generateJoint(jointDef, fixedTs);

    expect(run1.evidenceHash).toBe(run2.evidenceHash);
    expect(run1.properties.massKg).toBe(run2.properties.massKg);
    expect(run1.properties.torqueCapacityNm).toBe(run2.properties.torqueCapacityNm);
  });

  it('12. Final EPC-039 Gate Report — Returns PASS with 13/13 passing checks', () => {
    const report = EPC039Verifier.runVerification();

    expect(report.epc).toBe('EPC-039');
    expect(report.verdict).toBe('PASS');
    expect(report.summary.passedChecks).toBe(13);
    expect(report.summary.failedChecks).toBe(0);
    expect(report.evidenceHash).toBeDefined();
  });
});
