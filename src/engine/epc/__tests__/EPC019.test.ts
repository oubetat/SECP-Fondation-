/**
 * SECP Industrial OS — EPC-019: Parametric Airframe CAD Test Suite
 * Validates TEST-019-001 through TEST-019-022.
 */

import { describe, it, expect } from 'vitest';
import { ParametricAirframeGenerator } from '../airframe/ParametricAirframeGenerator';
import { ParametricAirframeManager } from '../airframe/ParametricAirframeManager';
import { ParametricAirframeParameters } from '../airframe/ParametricAirframeParameters';
import { AirframeTraceabilityBridge } from '../airframe/AirframeTraceabilityBridge';
import { AirframeValidator, AirframeValidationError } from '../airframe/AirframeValidator';
import { AirframeSerializer } from '../airframe/AirframeSerializer';
import { EPC019Verifier } from '../airframe/EPC019Verifier';
import { MultidisciplinaryModelRegistry } from '../MultidisciplinaryModelRegistry';
import { RequirementTraceabilityEngine } from '../RequirementTraceabilityEngine';
import { EngineeringEvidencePackageManager } from '../evidence/EngineeringEvidencePackageManager';

describe('SECP EPC-019 — Parametric Airframe CAD Test Suite', () => {
  // Master Verification Test
  it('should run EPC019Verifier and achieve 100% PASS verdict for Industrial Drone Parametric Airframe', () => {
    const result = EPC019Verifier.runVerification();

    if (result.verdict !== 'PASS') {
      const failed = Object.entries(result.checks).filter(([k, v]) => !v.passed);
      console.error('FAILED CHECKS IN VERIFIER:', JSON.stringify(failed, null, 2));
    }

    expect(result.verdict).toBe('PASS');
    expect(result.summary.totalChecks).toBe(22);
    expect(result.summary.passedChecks).toBe(22);
    expect(result.summary.failedChecks).toBe(0);
    expect(result.evidenceHash).toBeDefined();
    expect(result.evidenceHash.length).toBe(64);
  });

  // TEST-019-001: CAD Kernel Usage
  it('TEST-019-001: should build all airframe solid features using the SECP CAD Geometry Kernel', () => {
    const model = ParametricAirframeGenerator.generateModel();

    expect(model.cadKernelVersion).toContain('SECP-BOOLEAN');
    expect(model.features.length).toBeGreaterThanOrEqual(14);
    for (const feat of model.features) {
      expect(feat.solidEntity).toBeDefined();
      expect(feat.solidEntity.id).toBeDefined();
      expect(feat.solidEntity.volumeM3).toBeGreaterThan(0);
      expect(feat.solidEntity.surfaceAreaM2).toBeGreaterThan(0);
    }
  });

  // TEST-019-002: Model Registry Registration
  it('TEST-019-002: should register model in MultidisciplinaryModelRegistry with domain and provenance', () => {
    const registry = new MultidisciplinaryModelRegistry();
    const model = ParametricAirframeGenerator.generateModel();

    const regModel = AirframeTraceabilityBridge.registerInModelRegistry(registry, model);
    expect(regModel.modelId).toBe('DRONE-AIRFRAME-001');
    expect(regModel.domain).toBe('INDUSTRIAL_DRONE');
    expect(regModel.modelType).toBe('CAD');
    expect(regModel.contentHash.length).toBe(64);

    const retrieved = registry.getModel('DRONE-AIRFRAME-001');
    expect(retrieved).toBeDefined();
    expect(retrieved?.modelRevision).toBe('1.0');
  });

  // TEST-019-003: Configuration Baseline
  it('TEST-019-003: should create locked CAD, Material, and Parameter baseline via ConfigurationBaselineManager', () => {
    const model = ParametricAirframeGenerator.generateModel();
    const baselineManager = AirframeTraceabilityBridge.createConfigurationBaseline(model);
    const baselineData = baselineManager.getData();

    expect(baselineData.baselineId).toContain('BSL-DRONE');
    expect(baselineData.cad.cadId).toBe(model.modelId);
    expect(baselineData.cad.geometryHash).toBe(model.geometryHash);
    expect(baselineData.materials.length).toBeGreaterThanOrEqual(1);
    expect(baselineData.parameters).toBeDefined();
  });

  // TEST-019-004: Requirement Traceability
  it('TEST-019-004: should link all mandatory EPC-017 requirements to the Airframe CAD model', () => {
    const traceEngine = new RequirementTraceabilityEngine('GRAPH-TEST-001', '1.0');
    const model = ParametricAirframeGenerator.generateModel();

    AirframeTraceabilityBridge.registerRequirementLinks(traceEngine, model);

    const reqIds = [
      'DRONE-REQ-001',
      'DRONE-REQ-005',
      'DRONE-REQ-006',
      'DRONE-REQ-007',
      'DRONE-REQ-008',
      'DRONE-REQ-010',
      'DRONE-REQ-018',
      'DRONE-REQ-019',
      'DRONE-REQ-020'
    ];

    const allEdges = traceEngine.getAllEdges();
    for (const reqId of reqIds) {
      expect(traceEngine.getArtifact(reqId)).toBeDefined();
      expect(allEdges.some(e => e.sourceId === reqId && e.targetId === model.modelId)).toBe(true);
    }
  });

  // TEST-019-005: Parameter Definitions
  it('TEST-019-005: should define all 20+ engineering airframe parameters with bounds and units', () => {
    const params = ParametricAirframeParameters.createParameters();

    expect(params.BodyLength.value).toBe(240.0);
    expect(params.BodyWidth.value).toBe(240.0);
    expect(params.BodyHeight.value).toBe(55.0);
    expect(params.ArmCount.value).toBe(4);
    expect(params.ArmLength.value).toBe(320.0);
    expect(params.ArmWidth.value).toBe(30.0);
    expect(params.ArmThickness.value).toBe(3.0);
    expect(params.MotorMountDiameter.value).toBe(45.0);
    expect(params.MotorMountThickness.value).toBe(4.0);
    expect(params.PayloadMountLength.value).toBe(180.0);
    expect(params.BatteryMountLength.value).toBe(200.0);
    expect(params.LandingGearMountPosition.value).toBe(160.0);
    expect(params.StructuralClearance.value).toBe(5.0);
    expect(params.FastenerDiameter.value).toBe(3.0);
    expect(params.MaterialReference.value).toBe('mat-carbon-fiber');
  });

  // TEST-019-006: Parameter Dependency DAG
  it('TEST-019-006: should maintain a valid Parameter Dependency DAG without cyclic dependencies', () => {
    const dag = ParametricAirframeParameters.buildDependencyGraph();

    expect(dag.nodes.length).toBeGreaterThan(10);
    expect(dag.evaluationOrder.length).toBe(dag.nodes.length);
    expect(dag.hasCycles).toBe(false);

    const armLenNode = dag.nodes.find(n => n.parameterName === 'ArmLength');
    expect(armLenNode?.dependsOn).toContain('BodyLength');
  });

  // TEST-019-007: Central Body Generation
  it('TEST-019-007: should generate Central Body upper deck, lower deck, and 4x standoffs', () => {
    const model = ParametricAirframeGenerator.generateModel();

    const upper = model.features.find(f => f.type === 'BODY_UPPER_DECK');
    const lower = model.features.find(f => f.type === 'BODY_LOWER_DECK');
    const standoffs = model.features.filter(f => f.type === 'BODY_STANDOFF');

    expect(upper).toBeDefined();
    expect(lower).toBeDefined();
    expect(standoffs.length).toBe(4);
    expect(upper!.position.z).toBeGreaterThan(lower!.position.z);
  });

  // TEST-019-008: Arms Generation
  it('TEST-019-008: should generate radial arms matching armCount with exact geometric dimensions', () => {
    const model = ParametricAirframeGenerator.generateModel({ armCount: 4, armLength: 350.0 });
    const arms = model.features.filter(f => f.type === 'ARM_BEAM');

    expect(arms.length).toBe(4);
    for (const arm of arms) {
      expect(arm.dimensions.lengthMm).toBe(350.0);
      expect(arm.dimensions.widthMm).toBe(30.0);
      expect(arm.dimensions.thicknessMm).toBe(3.0);
      expect(arm.materialId).toBe('mat-carbon-fiber');
    }
  });

  // TEST-019-009: Motor Mounts Generation
  it('TEST-019-009: should generate motor mount brackets at arm tips in CNC Aluminum', () => {
    const model = ParametricAirframeGenerator.generateModel({ armCount: 4 });
    const mounts = model.features.filter(f => f.type === 'MOTOR_MOUNT_BRACKET');

    expect(mounts.length).toBe(4);
    for (const mount of mounts) {
      expect(mount.materialId).toBe('mat-alu-6061');
      expect(mount.dimensions.radiusMm).toBe(22.5); // 45 / 2
      expect(mount.dimensions.heightMm).toBe(4.0);
    }
  });

  // TEST-019-010: Payload Mount Interface
  it('TEST-019-010: should generate lower-deck payload mounting rail interface', () => {
    const model = ParametricAirframeGenerator.generateModel({ payloadMountLength: 190.0 });
    const payload = model.features.find(f => f.type === 'PAYLOAD_MOUNT_RAIL');

    expect(payload).toBeDefined();
    expect(payload!.position.z).toBeLessThan(0);
    expect(payload!.dimensions.lengthMm).toBe(190.0);
    expect(payload!.materialId).toBe('mat-carbon-fiber');
  });

  // TEST-019-011: Battery Mount Interface
  it('TEST-019-011: should generate upper-deck quick-release battery retention tray', () => {
    const model = ParametricAirframeGenerator.generateModel({ batteryMountLength: 210.0 });
    const battery = model.features.find(f => f.type === 'BATTERY_MOUNT_TRAY');

    expect(battery).toBeDefined();
    expect(battery!.position.z).toBeGreaterThan(0);
    expect(battery!.dimensions.lengthMm).toBe(210.0);
    expect(battery!.materialId).toBe('mat-carbon-fiber');
  });

  // TEST-019-012: Landing Gear Mount Interface
  it('TEST-019-012: should generate 4x landing gear hardpoints with negative Z offset', () => {
    const model = ParametricAirframeGenerator.generateModel();
    const lg = model.features.filter(f => f.type === 'LANDING_GEAR_BRACKET');

    expect(lg.length).toBe(4);
    for (const mount of lg) {
      expect(mount.position.z).toBeLessThan(0);
      expect(mount.materialId).toBe('mat-alu-6061');
    }
  });

  // TEST-019-013: Structural Interfaces
  it('TEST-019-013: should declare and validate all mechanical, sliding, and isolated structural interfaces', () => {
    const model = ParametricAirframeGenerator.generateModel();

    expect(model.interfaces.length).toBeGreaterThanOrEqual(5);
    const ifaceTypes = model.interfaces.map(i => i.interfaceType);
    expect(ifaceTypes).toContain('MECHANICAL_BOLTED');
    expect(ifaceTypes).toContain('VIBRATION_ISOLATED');
    expect(ifaceTypes).toContain('MECHANICAL_SLIDING');
  });

  // TEST-019-014: Design Limits
  it('TEST-019-014: should enforce structural, clearance, and aspect ratio design limits', () => {
    const model = ParametricAirframeGenerator.generateModel();

    expect(model.designLimits.length).toBeGreaterThanOrEqual(5);
    for (const limit of model.designLimits) {
      expect(limit.limitId).toBeDefined();
      expect(limit.value).toBeGreaterThan(0);
      expect(limit.unit).toBeDefined();
    }
  });

  // TEST-019-015: Parameter Modification & Regeneration
  it('TEST-019-015: should mutate parameters, bump revision, and recalculate mass deltas', () => {
    const manager = new ParametricAirframeManager();
    const initialModel = manager.getModel();
    expect(initialModel.revision).toBe('1.0');

    const diff = manager.updateParameter('ArmLength', 360.0);
    const updatedModel = manager.getModel();

    expect(updatedModel.revision).toBe('1.1');
    expect(updatedModel.parameters.ArmLength.value).toBe(360.0);
    expect(diff.deltaMassKg).toBeGreaterThan(0);
    expect(updatedModel.massProperties.totalMassKg).toBeGreaterThan(initialModel.massProperties.totalMassKg);
  });

  // TEST-019-016: Mass Properties Derivation
  it('TEST-019-016: should compute rigorous Mass, Center of Gravity, and Inertia Tensor via Parallel Axis Theorem', () => {
    const model = ParametricAirframeGenerator.generateModel();
    const mass = model.massProperties;

    expect(mass.totalMassKg).toBeGreaterThan(0.5);
    expect(mass.totalMassKg).toBeLessThan(5.0);
    expect(mass.totalVolumeM3).toBeGreaterThan(0);
    expect(mass.totalSurfaceAreaM2).toBeGreaterThan(0);
    expect(mass.calculationMethod).toBe('PHYSICS_BASED_DERIVATION');

    // Inertia Tensor diagonal elements must be strictly positive
    expect(mass.inertiaTensor.Ixx).toBeGreaterThan(0);
    expect(mass.inertiaTensor.Iyy).toBeGreaterThan(0);
    expect(mass.inertiaTensor.Izz).toBeGreaterThan(0);

    // Symmetric airframe implies center of gravity near origin
    expect(Math.abs(mass.centerOfGravity.x)).toBeLessThan(1.0);
    expect(Math.abs(mass.centerOfGravity.y)).toBeLessThan(1.0);
  });

  // TEST-019-017: B-Rep & Topology Validation
  it('TEST-019-017: should validate B-Rep manifold status and topological Euler characteristics', () => {
    const model = ParametricAirframeGenerator.generateModel();
    const topo = model.topologyValidation;

    expect(topo.isValid).toBe(true);
    expect(topo.manifoldStatus).toBe('MANIFOLD');
    expect(topo.solidCount).toBeGreaterThanOrEqual(14);
    expect(topo.faceCount).toBeGreaterThan(50);
    expect(topo.vertexCount).toBeGreaterThan(50);
    expect(topo.nonManifoldDetected).toBe(false);
    expect(topo.openShellDetected).toBe(false);
  });

  // TEST-019-018: CAD/CAE Dependency Graph
  it('TEST-019-018: should register forward dependencies from CAD to FEA and CFD models', () => {
    const registry = new MultidisciplinaryModelRegistry();
    const model = ParametricAirframeGenerator.generateModel();

    AirframeTraceabilityBridge.registerCadCaeModels(registry, model);

    const fea = registry.getModel('FEA-AIRFRAME-STRUCTURAL-001');
    const cfd = registry.getModel('CFD-AIRFRAME-AERO-001');

    expect(fea).toBeDefined();
    expect(cfd).toBeDefined();
    expect(fea?.dependencyIds).toContain(model.modelId);
    expect(cfd?.dependencyIds).toContain(model.modelId);
  });

  // TEST-019-019: Evidence Package Generation
  it('TEST-019-019: should generate a complete verifiable Evidence Package', () => {
    const evidenceManager = new EngineeringEvidencePackageManager();
    const model = ParametricAirframeGenerator.generateModel();

    const pkg = AirframeTraceabilityBridge.generateEvidencePackage(evidenceManager, model);
    expect(pkg.packageId).toBeDefined();
    expect(pkg.integrityHash.length).toBe(64);
  });

  // TEST-019-020: Evidence Provenance & Hashing
  it('TEST-019-020: should compute canonical SHA-256 hashes for geometry, topology, and content', () => {
    const model = ParametricAirframeGenerator.generateModel();

    expect(model.contentHash).toBeDefined();
    expect(model.contentHash.length).toBe(64);
    expect(model.geometryHash.length).toBe(64);
    expect(model.topologyHash.length).toBe(64);
    expect(model.parameterHash.length).toBe(64);
  });

  // TEST-019-021: Reproducibility
  it('TEST-019-021: should guarantee bitwise deterministic reproducibility between runs', () => {
    const model = ParametricAirframeGenerator.generateModel();
    const repro = AirframeTraceabilityBridge.verifyReproducibility(model);

    expect(repro.reproducible).toBe(true);
    expect(repro.geometryMatch).toBe(true);
    expect(repro.massDelta).toBe(0);
    expect(repro.cgDelta).toBe(0);
    expect(repro.inertiaDelta).toBe(0);
  });

  // TEST-019-022: Multi-Variant Support
  it('TEST-019-022: should generate Quad, Hexa, and Octo variants with proper geometry scaling', () => {
    const quad = ParametricAirframeGenerator.generateModel({ armCount: 4 });
    const hexa = ParametricAirframeGenerator.generateModel({ armCount: 6 });
    const octo = ParametricAirframeGenerator.generateModel({ armCount: 8 });

    expect(quad.features.filter(f => f.type === 'ARM_BEAM').length).toBe(4);
    expect(hexa.features.filter(f => f.type === 'ARM_BEAM').length).toBe(6);
    expect(octo.features.filter(f => f.type === 'ARM_BEAM').length).toBe(8);

    expect(octo.massProperties.totalMassKg).toBeGreaterThan(hexa.massProperties.totalMassKg);
    expect(hexa.massProperties.totalMassKg).toBeGreaterThan(quad.massProperties.totalMassKg);
  });

  // Parameter bounds validation
  it('should throw validation error when parameter exceeds engineering limits', () => {
    expect(() => {
      ParametricAirframeGenerator.generateModel({ armLength: 900.0 }); // max is 600
    }).toThrow(AirframeValidationError);

    expect(() => {
      ParametricAirframeGenerator.generateModel({ armThickness: 0.5 }); // min is 1.0
    }).toThrow(AirframeValidationError);
  });

  it('should reject unknown material references', () => {
    expect(() => {
      ParametricAirframeGenerator.generateModel({ bodyMaterialId: 'mat-unobtainium' });
    }).toThrow(AirframeValidationError);
  });

  it('should serialize model to JSON and STEP metadata without loss', () => {
    const model = ParametricAirframeGenerator.generateModel();
    const json = AirframeSerializer.serializeToJSON(model);
    const parsed = AirframeSerializer.deserializeFromJSON(json);

    expect(parsed.modelId).toBe(model.modelId);
    expect(parsed.geometryHash).toBe(model.geometryHash);

    const step = AirframeSerializer.exportToSTEP(model);
    expect(step).toContain('ISO-10303-21;');
    expect(step).toContain('HEADER;');
    expect(step).toContain('DATA;');
    expect(step).toContain('END-ISO-10303-21;');
  });
});
