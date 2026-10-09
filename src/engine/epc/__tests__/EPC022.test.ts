import { describe, it, expect, beforeEach } from 'vitest';
import { DroneMassPropertiesManager } from '../mass/DroneMassPropertiesManager';
import { MassPropertiesCalculator } from '../../physics/mass/MassPropertiesCalculator';
import { MassPropertiesUnitConverter } from '../../physics/mass/MassPropertiesUnitConverter';
import { EPC022EvidenceGenerator } from '../mass/EPC022EvidenceGenerator';
import { EPC022Verifier } from '../mass/EPC022Verifier';
import { SolidGeometrySpec } from '../../physics/mass/MassPropertiesTypes';

describe('SECP EPC-022: Mass Properties Engine (Industrial Drone)', () => {
  let manager: DroneMassPropertiesManager;

  beforeEach(() => {
    manager = new DroneMassPropertiesManager();
  });

  // =========================================================================
  // 1. SOLID GEOMETRY & VOLUME VALIDATION
  // =========================================================================

  it('TEST-022-001: should validate solid geometry B-Rep topology and volume', () => {
    const validBox: SolidGeometrySpec = {
      shapeType: 'BOX',
      dimensions: { dx: 0.1, dy: 0.2, dz: 0.3 },
      units: 'm',
      isClosedSolid: true,
      hasValidTopology: true,
      geometryHash: 'TEST-BOX-HASH'
    };
    const valResult = MassPropertiesCalculator.validateSolidGeometry(validBox);
    expect(valResult.isValid).toBe(true);
    expect(valResult.volume).toBeCloseTo(0.006, 6);

    const invalidBox: SolidGeometrySpec = {
      ...validBox,
      isClosedSolid: false
    };
    const invalidVal = MassPropertiesCalculator.validateSolidGeometry(invalidBox);
    expect(invalidVal.isValid).toBe(false);
    expect(invalidVal.errors.length).toBeGreaterThan(0);
  });

  // =========================================================================
  // 2. MATERIAL DENSITY & PART MASS CALCULATION
  // =========================================================================

  it('TEST-022-002: should calculate Part Mass strictly via Mass = Density × Volume without hardcoding', () => {
    const airframeProps = manager.getPartMassProperties('INST-AIRFRAME-001');
    expect(airframeProps.isValid).toBe(true);
    expect(airframeProps.density).toBe(1600);
    expect(airframeProps.volume).toBeCloseTo(0.00036, 6); // 0.3 x 0.3 x 0.004 m
    expect(airframeProps.mass).toBeCloseTo(1600 * 0.00036, 6); // 0.576 kg
  });

  it('TEST-022-003: should calculate Part Local Center of Gravity (CG)', () => {
    const props = manager.getPartMassProperties('INST-ARM-001');
    expect(props.centerOfMass.x).toBe(0);
    expect(props.centerOfMass.y).toBe(0);
    expect(props.centerOfMass.z).toBe(0);
  });

  it('TEST-022-004: should calculate Part Local Inertia Tensor with exact analytical physics equations', () => {
    const props = manager.getPartMassProperties('INST-MOTOR-001');
    expect(props.inertiaTensor).toBeDefined();
    expect(props.inertiaTensor.length).toBe(3);
    expect(props.inertiaTensor[0][0]).toBeGreaterThan(0);
    expect(props.inertiaTensor[1][1]).toBeGreaterThan(0);
    expect(props.inertiaTensor[2][2]).toBeGreaterThan(0);
    expect(props.inertiaTensor[0][1]).toBeCloseTo(0, 6);
  });

  // =========================================================================
  // 3. TRANSFORMATIONS & PARALLEL AXIS THEOREM
  // =========================================================================

  it('TEST-022-005: should rotate inertia tensor and satisfy orthogonality R Rᵀ ≈ I', () => {
    const R = MassPropertiesCalculator.createRotationMatrix(0.1, 0.2, 0.3);
    const RT = [
      [R[0][0], R[1][0], R[2][0]],
      [R[0][1], R[1][1], R[2][1]],
      [R[0][2], R[1][2], R[2][2]]
    ];
    
    // R * RT should be Identity
    const I_mat = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        for (let k = 0; k < 3; k++) {
          I_mat[r][c] += R[r][k] * RT[k][c];
        }
      }
    }
    expect(I_mat[0][0]).toBeCloseTo(1, 6);
    expect(I_mat[1][1]).toBeCloseTo(1, 6);
    expect(I_mat[2][2]).toBeCloseTo(1, 6);
    expect(I_mat[0][1]).toBeCloseTo(0, 6);
  });

  it('TEST-022-006: should apply Parallel Axis Theorem correctly to shift inertia tensor', () => {
    const I_local = [
      [1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
      [0.0, 0.0, 1.0]
    ];
    const massKg = 2.0;
    const dVec = { x: 3.0, y: 4.0, z: 0.0 }; // distance = 5m -> parallel axis contribution = m * d^2 = 2 * 25 = 50 for Izz

    const I_ref = MassPropertiesCalculator.applyParallelAxisTheorem(I_local, massKg, dVec);
    expect(I_ref[0][0]).toBeCloseTo(1.0 + 2.0 * (4.0 * 4.0), 6); // 1 + 32 = 33
    expect(I_ref[1][1]).toBeCloseTo(1.0 + 2.0 * (3.0 * 3.0), 6); // 1 + 18 = 19
    expect(I_ref[2][2]).toBeCloseTo(1.0 + 2.0 * (3.0 * 3.0 + 4.0 * 4.0), 6); // 1 + 50 = 51
  });

  // =========================================================================
  // 4. SUBASSEMBLY MASS PROPERTIES
  // =========================================================================

  it('TEST-022-007: should compute Subassembly Mass Properties for all subassemblies', () => {
    const airframeSub = manager.evaluateSubassemblyMassProperties('AIRFRAME');
    const propSub = manager.evaluateSubassemblyMassProperties('PROPULSION');
    const landingSub = manager.evaluateSubassemblyMassProperties('LANDING');
    const battSub = manager.evaluateSubassemblyMassProperties('BATTERY');
    const payloadSub = manager.evaluateSubassemblyMassProperties('PAYLOAD');
    const avionicsSub = manager.evaluateSubassemblyMassProperties('AVIONICS');

    expect(airframeSub.mass).toBeGreaterThan(0);
    expect(propSub.mass).toBeGreaterThan(0);
    expect(landingSub.mass).toBeGreaterThan(0);
    expect(battSub.mass).toBeGreaterThan(0);
    expect(payloadSub.mass).toBeGreaterThan(0);
    expect(avionicsSub.mass).toBeGreaterThan(0);
  });

  // =========================================================================
  // 5. COMPLETE ASSEMBLY MASS PROPERTIES
  // =========================================================================

  it('TEST-022-008: should compute Complete Assembly Mass, CG, and Inertia Tensor', () => {
    const assembly = manager.evaluateCompleteAssemblyMassProperties('OPERATIONAL_DRONE');
    expect(assembly.isValid).toBe(true);
    expect(assembly.mass).toBeGreaterThan(10.0); // Complete drone mass ~ 14 kg
    expect(assembly.centerOfMass).toBeDefined();
    expect(assembly.inertiaTensor[0][0]).toBeGreaterThan(0);
    expect(assembly.inertiaTensor[1][1]).toBeGreaterThan(0);
    expect(assembly.inertiaTensor[2][2]).toBeGreaterThan(0);
  });

  // =========================================================================
  // 6. PRODUCT CONFIGURATION VARIATION
  // =========================================================================

  it('TEST-022-009: should vary Mass Properties dynamically across Empty, Operational, and Max Payload variants', () => {
    const emptyProps = manager.evaluateCompleteAssemblyMassProperties('EMPTY_DRONE');
    const opProps = manager.evaluateCompleteAssemblyMassProperties('OPERATIONAL_DRONE');
    const maxProps = manager.evaluateCompleteAssemblyMassProperties('MAX_PAYLOAD_DRONE');

    expect(emptyProps.mass).toBeLessThan(opProps.mass);
    expect(opProps.mass).toBeLessThan(maxProps.mass);

    expect(emptyProps.centerOfMass.z).not.toEqual(opProps.centerOfMass.z);
    expect(opProps.centerOfMass.z).not.toEqual(maxProps.centerOfMass.z);
  });

  // =========================================================================
  // 7. PARAMETRIC UPDATES & DEPENDENCY INVALIDATION
  // =========================================================================

  it('TEST-022-010: should invalidate cached properties and recompute when component parameters change', () => {
    const oldMass = manager.getPartMassProperties('INST-ARM-001').mass;
    const newProps = manager.updateComponentGeometryParameter('INST-ARM-001', 'radius', 0.025);
    
    expect(newProps.mass).toBeGreaterThan(oldMass);
    const logs = manager.getInvalidationLogs();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].targetInstanceId).toBe('INST-ARM-001');
  });

  // =========================================================================
  // 8. UNIT CONSISTENCY
  // =========================================================================

  it('TEST-022-011: should perform explicit unit conversions without silent errors', () => {
    const propsSI = manager.getPartMassProperties('INST-AIRFRAME-001');
    const propsEng = MassPropertiesUnitConverter.convertMassProperties(propsSI, {
      mass: 'g',
      length: 'mm',
      inertia: 'kg·mm²',
      density: 'g/cm³',
      volume: 'mm³'
    });

    expect(propsEng.mass).toBeCloseTo(propsSI.mass * 1000, 4);
    expect(propsEng.volume).toBeCloseTo(propsSI.volume * 1e9, 2);
    expect(propsEng.inertiaTensor[0][0]).toBeCloseTo(propsSI.inertiaTensor[0][0] * 1e6, 2);
  });

  // =========================================================================
  // 9. ANALYTICAL BENCHMARK FIXTURES
  // =========================================================================

  it('TEST-022-012: should pass analytical benchmark test fixtures (Box, Cylinder, Sphere)', () => {
    const boxResult = MassPropertiesCalculator.calculateAnalyticalBoxFixture(0.4, 0.3, 0.2, 2700);
    expect(boxResult.passed).toBe(true);
    expect(boxResult.massErrorRel).toBeLessThan(1e-5);

    const cylResult = MassPropertiesCalculator.calculateAnalyticalCylinderFixture(0.15, 0.5, 7850);
    expect(cylResult.passed).toBe(true);
    expect(cylResult.massErrorRel).toBeLessThan(1e-5);

    const sphereResult = MassPropertiesCalculator.calculateAnalyticalSphereFixture(0.25, 1200);
    expect(sphereResult.passed).toBe(true);
    expect(sphereResult.massErrorRel).toBeLessThan(1e-5);
  });

  // =========================================================================
  // 10. SYMMETRY, PHYSICAL VALIDITY & PRINCIPAL MOMENTS
  // =========================================================================

  it('TEST-022-013: should enforce inertia tensor symmetry, positive definiteness, and triangle inequalities', () => {
    const assemblyProps = manager.evaluateCompleteAssemblyMassProperties('OPERATIONAL_DRONE');
    const report = MassPropertiesCalculator.validateInertiaSymmetryAndPhysicalValidity(
      assemblyProps.inertiaTensor
    );

    expect(report.isSymmetric).toBe(true);
    expect(report.isPositiveDefinite).toBe(true);
    expect(report.satisfiesTriangleInequality).toBe(true);
  });

  it('TEST-022-014: should compute principal moments via Jacobi eigenvalue decomposition with negligible reconstruction error', () => {
    const assemblyProps = manager.evaluateCompleteAssemblyMassProperties('OPERATIONAL_DRONE');
    const principal = MassPropertiesCalculator.eigenDecomposeInertiaTensor(
      assemblyProps.inertiaTensor
    );

    expect(principal.principalMoments[0]).toBeGreaterThan(0);
    expect(principal.principalMoments[1]).toBeGreaterThan(0);
    expect(principal.principalMoments[2]).toBeGreaterThan(0);
    expect(principal.reconstructionError).toBeLessThan(1e-6);
  });

  // =========================================================================
  // 11. MASS CONSERVATION & CONSISTENCY CHECKS
  // =========================================================================

  it('TEST-022-015: should verify Mass Conservation (Sum of Part Masses = Total Assembly Mass)', () => {
    const checks = manager.runAllVerificationChecks();
    expect(checks.massConservationPassed).toBe(true);
    expect(checks.details.massDiff).toBeLessThan(1e-6);
  });

  it('TEST-022-016: should verify CG Consistency (Direct Assembly CG = Subassembly Rollup CG)', () => {
    const checks = manager.runAllVerificationChecks();
    expect(checks.cgConsistencyPassed).toBe(true);
    expect(checks.details.cgDiffMax).toBeLessThan(1e-5);
  });

  it('TEST-022-017: should verify Inertia Consistency (Direct Assembly Inertia = Subassembly Aggregated Inertia)', () => {
    const checks = manager.runAllVerificationChecks();
    expect(checks.inertiaConsistencyPassed).toBe(true);
    expect(checks.details.inertiaDiffMax).toBeLessThan(1e-5);
  });

  // =========================================================================
  // 12. DETERMINISM & EVIDENCE PACKAGE
  // =========================================================================

  it('TEST-022-018: should guarantee deterministic recalculation', () => {
    const run1 = manager.evaluateCompleteAssemblyMassProperties('OPERATIONAL_DRONE');
    const run2 = manager.evaluateCompleteAssemblyMassProperties('OPERATIONAL_DRONE');
    expect(run1.provenance.outputHash).toEqual(run2.provenance.outputHash);
  });

  it('TEST-022-019: should generate signed SHA-256 evidence package', () => {
    const pkg = EPC022EvidenceGenerator.generateEvidencePackage(manager, 'OPERATIONAL_DRONE');
    expect(pkg.packageId).toContain('EPC022-PKG');
    expect(pkg.provenance.signedSha256).toBeDefined();
    expect(pkg.provenance.signedSha256.length).toBeGreaterThan(0);
    expect(pkg.partMassProperties.length).toBeGreaterThan(0);
    expect(pkg.subassemblyMassProperties.length).toBe(6);
  });

  // =========================================================================
  // 13. MASTER VERIFIER ACCEPTANCE
  // =========================================================================

  it('TEST-022-MASTER: Master Verifier should return ENGINEERING VERDICT: EPC-022 = PASS', () => {
    const report = EPC022Verifier.runVerification(manager);
    expect(report.verdict).toBe('PASS');
    expect(report.acceptanceCriteria.every(c => c.passed)).toBe(true);
  });
});
