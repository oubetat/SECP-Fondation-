/**
 * SECP Industrial OS — EPC-020: Structural Components Test Suite
 * Validates Arm, Motor Mount, Landing Gear, Payload Structure, and Battery Structure
 * components, solid geometry, materials, assembly, mass properties, FEA readiness,
 * manufacturing definitions, revision control, traceability, and evidence package.
 */

import { describe, it, expect } from 'vitest';
import { StructuralAssemblyManager } from '../structural/StructuralAssemblyManager';
import { StructuralComponentGenerators } from '../structural/StructuralComponentGenerators';
import { StructuralTraceabilityBridge } from '../structural/StructuralTraceabilityBridge';
import { EPC020EvidenceGenerator } from '../structural/EPC020EvidenceGenerator';
import { EPC020Verifier } from '../structural/EPC020Verifier';
import { MultidisciplinaryModelRegistry } from '../MultidisciplinaryModelRegistry';
import { RequirementTraceabilityEngine } from '../RequirementTraceabilityEngine';
import { EngineeringEvidencePackageManager } from '../evidence/EngineeringEvidencePackageManager';
import { MaterialsEngine } from '../../materials';

describe('SECP EPC-020: Industrial Drone Structural Components', () => {
  it('TEST-020-001: should instantiate all 5 mandatory structural component types with valid CAD solid geometry', () => {
    const assemblyManager = new StructuralAssemblyManager();
    const components = assemblyManager.getAllComponents();

    expect(components.length).toBeGreaterThanOrEqual(5);

    const arms = assemblyManager.getComponentsByType('ARM');
    const mounts = assemblyManager.getComponentsByType('MOTOR_MOUNT');
    const gears = assemblyManager.getComponentsByType('LANDING_GEAR');
    const payloads = assemblyManager.getComponentsByType('PAYLOAD_STRUCTURE');
    const batteries = assemblyManager.getComponentsByType('BATTERY_STRUCTURE');

    expect(arms.length).toBe(4);
    expect(mounts.length).toBe(4);
    expect(gears.length).toBe(4);
    expect(payloads.length).toBe(1);
    expect(batteries.length).toBe(1);

    for (const comp of components) {
      expect(comp.componentId).toBeDefined();
      expect(comp.geometryReference.solidEntity).toBeDefined();
      expect(comp.geometryReference.solidEntity.volumeM3).toBeGreaterThan(0);
      expect(comp.geometryReference.solidEntity.surfaceAreaM2).toBeGreaterThan(0);
      expect(comp.geometryReference.vertexCount).toBeGreaterThan(0);
      expect(comp.geometryReference.faceCount).toBeGreaterThan(0);
      expect(comp.geometryReference.isManifold).toBe(true);
      expect(comp.geometryReference.eulerCharacteristic).toBe(2);
    }
  });

  it('TEST-020-002: should parametrically regenerate components and update mass deterministically', () => {
    const armStandard = StructuralComponentGenerators.generateArm({ length: 280, width: 25 });
    const armLonger = StructuralComponentGenerators.generateArm({ length: 350, width: 25 });

    expect(armLonger.geometryReference.boundingDimensionsMm.length).toBe(350);
    expect(armLonger.massProperties.massKg).toBeGreaterThan(armStandard.massProperties.massKg);
    expect(armLonger.contentHash).not.toBe(armStandard.contentHash);
    expect(armLonger.geometryReference.geometryHash).not.toBe(armStandard.geometryReference.geometryHash);
  });

  it('TEST-020-003: should verify Material linkage with SECP MaterialsEngine and physics-based mass calculation', () => {
    const carbonFiberMat = MaterialsEngine.getMaterial('mat-carbon-fiber');
    expect(carbonFiberMat).toBeDefined();

    const arm = StructuralComponentGenerators.generateArm({ materialId: 'mat-carbon-fiber' });
    expect(arm.materialReference.materialId).toBe('mat-carbon-fiber');
    expect(arm.materialReference.densityKgM3).toBe(carbonFiberMat!.densityKgM3);
    expect(arm.materialReference.youngModulusGPa).toBe(carbonFiberMat!.youngModulusGPa);
    expect(arm.materialReference.yieldStrengthMPa).toBe(carbonFiberMat!.yieldStrengthMPa);

    const calculatedMass = arm.geometryReference.solidEntity.volumeM3 * arm.materialReference.densityKgM3;
    expect(Math.abs(calculatedMass - arm.massProperties.massKg)).toBeLessThan(0.0001);
  });

  it('TEST-020-004: should calculate 3D Center of Gravity and 3D Inertia Tensor using Parallel Axis Theorem', () => {
    const assemblyManager = new StructuralAssemblyManager();
    const subsystem = assemblyManager.buildSubsystemModel();
    const agg = subsystem.aggregateMassProperties;

    expect(agg.totalMassKg).toBeGreaterThan(0);
    expect(agg.totalVolumeM3).toBeGreaterThan(0);
    expect(typeof agg.centerOfGravity.x).toBe('number');
    expect(typeof agg.centerOfGravity.y).toBe('number');
    expect(typeof agg.centerOfGravity.z).toBe('number');

    expect(agg.inertiaTensor.Ixx).toBeGreaterThan(0);
    expect(agg.inertiaTensor.Iyy).toBeGreaterThan(0);
    expect(agg.inertiaTensor.Izz).toBeGreaterThan(0);
    expect(agg.inertiaTensor.principalMoments).toHaveLength(3);
  });

  it('TEST-020-005: should verify structural assembly hierarchy, mates satisfaction, and interference detection', () => {
    const assemblyManager = new StructuralAssemblyManager();
    const matesResult = assemblyManager.verifyAssemblyMates();

    expect(matesResult.totalMatesCount).toBeGreaterThan(0);
    expect(matesResult.allSatisfied).toBe(true);

    const collisionResult = assemblyManager.checkInterference();
    expect(collisionResult.passed).toBe(true);
    expect(collisionResult.clashCount).toBe(0);

    const subsystem = assemblyManager.buildSubsystemModel();
    expect(subsystem.assemblyHierarchy.root).toBe('DRONE-AIRFRAME-BODY');
    expect(subsystem.assemblyHierarchy.parentChildPairs.length).toBeGreaterThanOrEqual(5);
  });

  it('TEST-020-006: should enforce revision control, provenance tracking, and analysis invalidation on mutation', () => {
    const assemblyManager = new StructuralAssemblyManager();
    const arm = assemblyManager.getComponentsByType('ARM')[0];

    const mutation = assemblyManager.mutateComponentParameter(arm.componentId, 'length', 320);

    expect(mutation.previousRevision).toBe('REV-A');
    expect(mutation.newRevision).toBe('REV-B');
    expect(mutation.mutatedComponent.parameterSet.length.value).toBe(320);
    expect(mutation.mutatedComponent.contentHash).not.toBe(arm.contentHash);
    expect(mutation.invalidatedAnalysisIds.length).toBeGreaterThan(0);
    expect(mutation.invalidatedEvidenceReferences.length).toBeGreaterThan(0);
    expect(mutation.provenanceEvent.eventId).toMatch(/^PROV-EVT-/);

    const history = assemblyManager.getComponentRevisions(arm.componentId);
    expect(history.length).toBe(2);
    expect(history[0].revision).toBe('REV-A');
    expect(history[1].revision).toBe('REV-B');
  });

  it('TEST-020-007: should verify FEA structural readiness and load case definitions without mock solvers', () => {
    const assemblyManager = new StructuralAssemblyManager();
    const components = assemblyManager.getAllComponents();

    for (const comp of components) {
      expect(comp.loadCases.length).toBeGreaterThan(0);
      for (const lc of comp.loadCases) {
        expect(lc.loadCaseId).toBeDefined();
        expect(lc.magnitudeN).toBeGreaterThan(0);
        expect(lc.boundaryConditions.length).toBeGreaterThan(0);
        expect(lc.safetyFactorRequired).toBeGreaterThanOrEqual(1.5);
      }

      expect(comp.analysisReferences.length).toBeGreaterThan(0);
      for (const ana of comp.analysisReferences) {
        expect(ana.status).toBe('FEA_READY');
        expect(ana.meshRequirements.targetElementSizeMm).toBeGreaterThan(0);
        expect(ana.allowableVonMisesStressMPa).toBeGreaterThan(0);
      }
    }
  });

  it('TEST-020-008: should verify manufacturing definitions, GD&T critical dimensions, and inspection requirements', () => {
    const assemblyManager = new StructuralAssemblyManager();
    const components = assemblyManager.getAllComponents();

    for (const comp of components) {
      const mfg = comp.manufacturingDefinition;
      expect(mfg.process).toBeDefined();
      expect(mfg.standardTolerances).toBeDefined();
      expect(mfg.surfaceRoughnessRaUm).toBeGreaterThan(0);
      expect(mfg.criticalDimensions.length).toBeGreaterThan(0);
      for (const dim of mfg.criticalDimensions) {
        expect(dim.nominalMm).toBeGreaterThan(0);
        expect(dim.upperLimitMm).toBeGreaterThanOrEqual(dim.nominalMm);
        expect(dim.lowerLimitMm).toBeLessThanOrEqual(dim.nominalMm);
      }
      expect(mfg.inspectionRequirements.length).toBeGreaterThan(0);
      expect(mfg.camToolpathReady).toBe(true);
    }
  });

  it('TEST-020-009: should verify requirement traceability graph population across all structural requirements', () => {
    const traceEngine = new RequirementTraceabilityEngine('GRAPH-TEST-020', '1.0');
    const modelRegistry = new MultidisciplinaryModelRegistry();
    const assemblyManager = new StructuralAssemblyManager();
    const components = assemblyManager.getAllComponents();

    StructuralTraceabilityBridge.registerComponentsInModelRegistry(modelRegistry, components);
    StructuralTraceabilityBridge.populateTraceabilityGraph(traceEngine, components);

    const requiredReqIds = [
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

    for (const reqId of requiredReqIds) {
      const art = traceEngine.getArtifact(reqId);
      expect(art).toBeDefined();
      const outgoing = traceEngine.getOutgoingEdges(reqId);
      expect(outgoing.length).toBeGreaterThan(0);
    }
  });

  it('TEST-020-010: should generate and register EPC020-EVIDENCE package with canonical SHA-256 verification', () => {
    const assemblyManager = new StructuralAssemblyManager();
    const evidenceManager = new EngineeringEvidencePackageManager();
    const pkg = EPC020EvidenceGenerator.generateEvidencePackage(assemblyManager);

    expect(pkg.packageId).toBe('EPC020-EVIDENCE');
    expect(pkg.epcNumber).toBe('EPC-020');
    expect(pkg.components.length).toBeGreaterThanOrEqual(5);
    expect(pkg.canonicalPackageHash).toHaveLength(64);
    expect(pkg.materialLedger.length).toBeGreaterThan(0);
    expect(pkg.loadCaseRegistry.length).toBeGreaterThan(0);
    expect(pkg.manufacturingLedger.length).toBeGreaterThan(0);

    EPC020EvidenceGenerator.registerInEvidenceManager(evidenceManager, pkg);
    const retrieved = evidenceManager.getPackage('EPC020-EVIDENCE');
    expect(retrieved).toBeDefined();
    expect(retrieved!.canonicalHash).toBe(pkg.canonicalPackageHash);
  });

  it('TEST-020-011: Master Verifier should execute all 18 checks and return 100% PASS verdict', () => {
    const result = EPC020Verifier.runVerification();

    expect(result.epc).toBe('EPC-020');
    expect(result.verdict).toBe('PASS');
    expect(result.summary.totalChecks).toBe(18);
    expect(result.summary.passedChecks).toBe(18);
    expect(result.summary.failedChecks).toBe(0);
    expect(result.evidenceHash).toHaveLength(64);
  });
});
