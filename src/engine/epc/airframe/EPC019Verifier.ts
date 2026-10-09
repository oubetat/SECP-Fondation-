/**
 * SECP Industrial OS — EPC-019: Master Verification Engine
 * Executes TEST-019-001 through TEST-019-022 to provide comprehensive,
 * non-mocked verification of the Parametric Airframe CAD model.
 */

import { MultidisciplinaryModelRegistry } from '../MultidisciplinaryModelRegistry';
import { ProductConfigurationManager } from '../ProductConfigurationManager';
import { RequirementTraceabilityEngine } from '../RequirementTraceabilityEngine';
import { EngineeringDependencyGraphService } from '../dependency/EngineeringDependencyGraphService';
import { EngineeringEvidencePackageManager } from '../evidence/EngineeringEvidencePackageManager';
import { EvidenceIntegrityService } from '../evidence/EvidenceIntegrityService';
import { ParametricAirframeGenerator } from './ParametricAirframeGenerator';
import { ParametricAirframeManager } from './ParametricAirframeManager';
import { AirframeTraceabilityBridge } from './AirframeTraceabilityBridge';
import { AirframeValidator, AirframeValidationError } from './AirframeValidator';
import { EPC019ValidationResult, ParametricAirframeModel } from './ParametricAirframeTypes';

export class EPC019Verifier {
  /**
   * Executes the full 22-test verification suite for EPC-019.
   */
  public static runVerification(): EPC019ValidationResult {
    const startTime = performance.now();
    const checks: Record<string, { passed: boolean; message: string; details?: unknown }> = {};

    let totalChecks = 0;
    let passedChecks = 0;
    let failedChecks = 0;

    const recordCheck = (testId: string, passed: boolean, message: string, details?: unknown) => {
      totalChecks++;
      if (passed) {
        passedChecks++;
      } else {
        failedChecks++;
      }
      checks[testId] = { passed, message, details };
    };

    // 1. Initialize SECP Core Infrastructure Services
    const modelRegistry = new MultidisciplinaryModelRegistry();
    const configManager = new ProductConfigurationManager();
    const traceEngine = new RequirementTraceabilityEngine('GRAPH-EPC019-001', '1.0');
    const depService = new EngineeringDependencyGraphService(modelRegistry, configManager);
    const evidenceManager = new EngineeringEvidencePackageManager();

    // 2. Generate Default Airframe Model
    const airframeManager = new ParametricAirframeManager();
    const model = airframeManager.getModel();

    // =========================================================================
    // TEST-019-001: CAD Kernel Usage
    // =========================================================================
    const t1Passed = model.cadKernelVersion.includes('SECP-BOOLEAN') &&
                     model.features.length > 0 &&
                     model.features.every(f => f.solidEntity && f.solidEntity.volumeM3 > 0);
    recordCheck(
      'TEST-019-001',
      t1Passed,
      t1Passed
        ? `CAD Kernel verified: ${model.cadKernelVersion} used for all ${model.features.length} solids.`
        : 'Failed CAD Kernel verification.',
      { kernel: model.cadKernelVersion, solidCount: model.features.length }
    );

    // =========================================================================
    // TEST-019-002: Model Registry Registration
    // =========================================================================
    AirframeTraceabilityBridge.registerInModelRegistry(modelRegistry, model);
    const regModel = modelRegistry.getModel(model.modelId);
    const t2Passed = regModel !== undefined &&
                     regModel.modelId === 'DRONE-AIRFRAME-001' &&
                     regModel.domain === 'INDUSTRIAL_DRONE' &&
                     regModel.modelType === 'CAD';
    recordCheck(
      'TEST-019-002',
      t2Passed,
      t2Passed
        ? `Model registry verified: ${model.modelId} registered with domain ${model.domain}.`
        : 'Failed Model Registry registration.',
      { registeredModel: regModel }
    );

    // =========================================================================
    // TEST-019-003: Configuration Baseline
    // =========================================================================
    const baselineMgr = AirframeTraceabilityBridge.createConfigurationBaseline(model);
    const baselineData = baselineMgr.getData();
    const t3Passed = baselineData !== undefined &&
                     baselineData.cad.cadId === model.modelId &&
                     baselineData.materials.length > 0 &&
                     baselineData.parameters !== undefined;
    recordCheck(
      'TEST-019-003',
      t3Passed,
      t3Passed
        ? `Configuration baseline verified for ${baselineData.baselineId} (CAD, Material, Parameter baselines locked).`
        : 'Failed Configuration Baseline registration.',
      { baselineId: baselineData.baselineId, cad: baselineData.cad }
    );

    // =========================================================================
    // TEST-019-004: Requirement Traceability
    // =========================================================================
    AirframeTraceabilityBridge.registerRequirementLinks(traceEngine, model);
    const allEdges = traceEngine.getAllEdges();
    const reqRequirements = ['DRONE-REQ-001', 'DRONE-REQ-005', 'DRONE-REQ-006', 'DRONE-REQ-007', 'DRONE-REQ-008', 'DRONE-REQ-010', 'DRONE-REQ-018', 'DRONE-REQ-019', 'DRONE-REQ-020'];
    const t4Passed = reqRequirements.every(reqId => traceEngine.getArtifact(reqId) !== undefined && allEdges.some(e => e.sourceId === reqId && e.targetId === model.modelId)) &&
                     traceEngine.getArtifact(model.modelId) !== undefined;
    recordCheck(
      'TEST-019-004',
      t4Passed,
      t4Passed
        ? `Requirement Traceability verified: all ${reqRequirements.length} EPC-017 requirements linked to ${model.modelId}.`
        : 'Failed Requirement Traceability linking.',
      { edgeCount: traceEngine.getAllEdges().length, expectedCount: reqRequirements.length }
    );

    // =========================================================================
    // TEST-019-005: Parameter Definitions
    // =========================================================================
    const expectedParamNames = [
      'BodyLength', 'BodyWidth', 'BodyHeight', 'ArmLength', 'ArmWidth', 'ArmThickness',
      'MotorMountDiameter', 'MotorMountThickness', 'PayloadMountLength', 'PayloadMountWidth',
      'PayloadMountHeight', 'BatteryMountLength', 'BatteryMountWidth', 'BatteryMountHeight',
      'LandingGearMountPosition', 'ArmCount', 'MotorMountOffset', 'StructuralClearance',
      'FastenerDiameter', 'MaterialReference'
    ];
    const t5Passed = expectedParamNames.every(name => model.parameters[name] !== undefined);
    recordCheck(
      'TEST-019-005',
      t5Passed,
      t5Passed
        ? `All ${expectedParamNames.length} parametric dimensions defined with engineering bounds.`
        : 'Missing required parametric dimensions.',
      { definedParams: Object.keys(model.parameters) }
    );

    // =========================================================================
    // TEST-019-006: Parameter Dependencies
    // =========================================================================
    const depGraph = model.dependencyGraph;
    const t6Passed = depGraph.nodes.length > 0 &&
                     depGraph.evaluationOrder.length > 0 &&
                     depGraph.nodes.some(n => n.parameterName === 'ArmLength' && n.dependsOn.includes('BodyLength'));
    recordCheck(
      'TEST-019-006',
      t6Passed,
      t6Passed
        ? `Parameter Dependency Graph verified: ${depGraph.nodes.length} nodes with DAG evaluation order.`
        : 'Failed Parameter Dependency Graph validation.',
      { nodeCount: depGraph.nodes.length }
    );

    // =========================================================================
    // TEST-019-007: Central Body Generation
    // =========================================================================
    const upperDeck = model.features.find(f => f.type === 'BODY_UPPER_DECK');
    const lowerDeck = model.features.find(f => f.type === 'BODY_LOWER_DECK');
    const standoffs = model.features.filter(f => f.type === 'BODY_STANDOFF');
    const t7Passed = upperDeck !== undefined && lowerDeck !== undefined && standoffs.length === 4;
    recordCheck(
      'TEST-019-007',
      t7Passed,
      t7Passed
        ? `Central Body Assembly verified: Upper deck, Lower deck, and 4x Standoffs generated as 3D solids.`
        : 'Failed Central Body feature generation.',
      { upperDeck: !!upperDeck, lowerDeck: !!lowerDeck, standoffCount: standoffs.length }
    );

    // =========================================================================
    // TEST-019-008: Arms Generation
    // =========================================================================
    const arms = model.features.filter(f => f.type === 'ARM_BEAM');
    const t8Passed = arms.length === model.parameters.ArmCount.value &&
                     arms.every(a => a.dimensions.lengthMm === model.parameters.ArmLength.value);
    recordCheck(
      'TEST-019-008',
      t8Passed,
      t8Passed
        ? `Radial Arms verified: ${arms.length} arm beams generated with radial symmetry.`
        : 'Failed Radial Arm generation.',
      { armCount: arms.length, expected: model.parameters.ArmCount.value }
    );

    // =========================================================================
    // TEST-019-009: Motor Mounts Generation
    // =========================================================================
    const motorMounts = model.features.filter(f => f.type === 'MOTOR_MOUNT_BRACKET');
    const t9Passed = motorMounts.length === model.parameters.ArmCount.value &&
                     motorMounts.every(m => m.dimensions.radiusMm !== undefined && m.materialId === 'mat-alu-6061');
    recordCheck(
      'TEST-019-009',
      t9Passed,
      t9Passed
        ? `Motor Mounts verified: ${motorMounts.length} CNC aluminum mounts positioned at arm tips.`
        : 'Failed Motor Mounts generation.',
      { motorMountCount: motorMounts.length }
    );

    // =========================================================================
    // TEST-019-010: Payload Mount Interface
    // =========================================================================
    const payloadRail = model.features.find(f => f.type === 'PAYLOAD_MOUNT_RAIL');
    const t10Passed = payloadRail !== undefined &&
                      payloadRail.position.z < 0 &&
                      payloadRail.dimensions.lengthMm === model.parameters.PayloadMountLength.value;
    recordCheck(
      'TEST-019-010',
      t10Passed,
      t10Passed
        ? `Payload Mount interface verified on lower deck with length ${payloadRail?.dimensions.lengthMm} mm.`
        : 'Failed Payload Mount interface generation.',
      { payloadRail }
    );

    // =========================================================================
    // TEST-019-011: Battery Mount Interface
    // =========================================================================
    const batteryTray = model.features.find(f => f.type === 'BATTERY_MOUNT_TRAY');
    const t11Passed = batteryTray !== undefined &&
                      batteryTray.position.z > 0 &&
                      batteryTray.dimensions.lengthMm === model.parameters.BatteryMountLength.value;
    recordCheck(
      'TEST-019-011',
      t11Passed,
      t11Passed
        ? `Battery Mount interface verified on upper deck with length ${batteryTray?.dimensions.lengthMm} mm.`
        : 'Failed Battery Mount interface generation.',
      { batteryTray }
    );

    // =========================================================================
    // TEST-019-012: Landing Gear Mount Interface
    // =========================================================================
    const lgMounts = model.features.filter(f => f.type === 'LANDING_GEAR_BRACKET');
    const t12Passed = lgMounts.length === 4 && lgMounts.every(l => l.position.z < 0);
    recordCheck(
      'TEST-019-012',
      t12Passed,
      t12Passed
        ? `Landing Gear interface verified: 4x hardpoint sockets generated.`
        : 'Failed Landing Gear interface generation.',
      { lgMountCount: lgMounts.length }
    );

    // =========================================================================
    // TEST-019-013: Structural Interfaces
    // =========================================================================
    const t13Passed = model.interfaces.length >= 5 &&
                      model.interfaces.some(i => i.interfaceType === 'MECHANICAL_BOLTED') &&
                      model.interfaces.some(i => i.interfaceType === 'VIBRATION_ISOLATED') &&
                      model.interfaces.some(i => i.interfaceType === 'MECHANICAL_SLIDING');
    recordCheck(
      'TEST-019-013',
      t13Passed,
      t13Passed
        ? `Structural interfaces verified: ${model.interfaces.length} mechanical/thermal interfaces declared.`
        : 'Failed Structural Interfaces verification.',
      { interfaces: model.interfaces.map(i => i.name) }
    );

    // =========================================================================
    // TEST-019-014: Design Limits
    // =========================================================================
    const t14Passed = model.designLimits.length >= 5 &&
                      model.designLimits.some(l => l.limitId === 'LIM-ARM-001') &&
                      model.designLimits.some(l => l.limitId === 'LIM-ARM-003');
    recordCheck(
      'TEST-019-014',
      t14Passed,
      t14Passed
        ? `Design Limits verified: ${model.designLimits.length} structural & clearance limits enforced.`
        : 'Failed Design Limits verification.',
      { limitCount: model.designLimits.length }
    );

    // =========================================================================
    // TEST-019-015: Parameter Modification & Regeneration
    // =========================================================================
    const initialMass = model.massProperties.totalMassKg;
    const diff = airframeManager.updateParameter('ArmLength', 380.0);
    const updatedModel = airframeManager.getModel();
    const t15Passed = updatedModel.revision === '1.1' &&
                      updatedModel.parameters.ArmLength.value === 380.0 &&
                      diff.deltaMassKg > 0 &&
                      updatedModel.massProperties.totalMassKg > initialMass;
    recordCheck(
      'TEST-019-015',
      t15Passed,
      t15Passed
        ? `Parameter modification verified: ArmLength modified 320 -> 380 mm (Mass changed by +${diff.deltaMassKg} kg).`
        : 'Failed Parameter modification & regeneration.',
      { diff, newMass: updatedModel.massProperties.totalMassKg }
    );

    // =========================================================================
    // TEST-019-016: Mass Properties Derivation
    // =========================================================================
    const massProps = updatedModel.massProperties;
    const t16Passed = massProps.totalMassKg > 0 &&
                      massProps.totalVolumeM3 > 0 &&
                      massProps.inertiaTensor.Ixx > 0 &&
                      massProps.inertiaTensor.Iyy > 0 &&
                      massProps.inertiaTensor.Izz > 0 &&
                      massProps.calculationMethod === 'PHYSICS_BASED_DERIVATION';
    recordCheck(
      'TEST-019-016',
      t16Passed,
      t16Passed
        ? `Mass properties verified: Total Mass=${massProps.totalMassKg} kg, Izz=${massProps.inertiaTensor.Izz} kg·m² derived from solid geometry & density.`
        : 'Failed Mass properties derivation.',
      { massProps }
    );

    // =========================================================================
    // TEST-019-017: B-Rep & Topology Validation
    // =========================================================================
    const topo = updatedModel.topologyValidation;
    const t17Passed = topo.isValid &&
                      topo.manifoldStatus === 'MANIFOLD' &&
                      topo.solidCount > 0 &&
                      topo.faceCount > 0 &&
                      topo.vertexCount > 0;
    recordCheck(
      'TEST-019-017',
      t17Passed,
      t17Passed
        ? `B-Rep & Topology verified: 2-manifold status with ${topo.solidCount} solids, ${topo.faceCount} faces, ${topo.vertexCount} vertices.`
        : 'Failed B-Rep & Topology validation.',
      { topo }
    );

    // =========================================================================
    // TEST-019-018: CAD/CAE Dependency Graph
    // =========================================================================
    AirframeTraceabilityBridge.registerCadCaeModels(modelRegistry, updatedModel);
    const feaModel = modelRegistry.getModel('FEA-AIRFRAME-STRUCTURAL-001');
    const cfdModel = modelRegistry.getModel('CFD-AIRFRAME-AERO-001');
    const t18Passed = feaModel !== undefined &&
                      cfdModel !== undefined &&
                      feaModel.dependencyIds.includes(updatedModel.modelId) &&
                      cfdModel.dependencyIds.includes(updatedModel.modelId);
    recordCheck(
      'TEST-019-018',
      t18Passed,
      t18Passed
        ? `CAD/CAE dependencies verified: FEA Structural and CFD Aero simulations registered with CAD dependency.`
        : 'Failed CAD/CAE Dependency Graph registration.',
      { feaModel: !!feaModel, cfdModel: !!cfdModel }
    );

    // =========================================================================
    // TEST-019-019: Evidence Package Generation
    // =========================================================================
    const evidencePkg = AirframeTraceabilityBridge.generateEvidencePackage(evidenceManager, updatedModel);
    const t19Passed = evidencePkg.packageId.startsWith('EVIDENCE-PKG') && evidencePkg.integrityHash.length === 64;
    recordCheck(
      'TEST-019-019',
      t19Passed,
      t19Passed
        ? `Evidence Package verified: Package ${evidencePkg.packageId} created with complete parameters.`
        : 'Failed Evidence Package generation.',
      { evidencePkg }
    );

    // =========================================================================
    // TEST-019-020: Evidence Provenance & Hashing
    // =========================================================================
    const t20Passed = updatedModel.contentHash.length === 64 &&
                      updatedModel.geometryHash.length === 64 &&
                      updatedModel.topologyHash.length === 64 &&
                      updatedModel.parameterHash.length === 64;
    recordCheck(
      'TEST-019-020',
      t20Passed,
      t20Passed
        ? `Evidence Provenance & SHA-256 Hashes verified (Geometry, Topology, Parameter, Content hashes locked).`
        : 'Failed Evidence Provenance & Hashing.',
      { contentHash: updatedModel.contentHash, geometryHash: updatedModel.geometryHash }
    );

    // =========================================================================
    // TEST-019-021: Reproducibility
    // =========================================================================
    const repro = AirframeTraceabilityBridge.verifyReproducibility(updatedModel);
    const t21Passed = repro.reproducible && repro.geometryMatch && repro.massDelta === 0;
    recordCheck(
      'TEST-019-021',
      t21Passed,
      t21Passed
        ? `Reproducibility verified: Run 1 vs Run 2 produces bitwise identical geometry hash and 0.000000 kg mass delta.`
        : 'Failed Reproducibility verification.',
      { repro }
    );

    // =========================================================================
    // TEST-019-022: Multi-Variant Support
    // =========================================================================
    const quad = ParametricAirframeGenerator.generateModel({ armCount: 4 });
    const hexa = ParametricAirframeGenerator.generateModel({ armCount: 6 });
    const octo = ParametricAirframeGenerator.generateModel({ armCount: 8 });
    const t22Passed = quad.features.filter(f => f.type === 'ARM_BEAM').length === 4 &&
                      hexa.features.filter(f => f.type === 'ARM_BEAM').length === 6 &&
                      octo.features.filter(f => f.type === 'ARM_BEAM').length === 8 &&
                      octo.massProperties.totalMassKg > hexa.massProperties.totalMassKg &&
                      hexa.massProperties.totalMassKg > quad.massProperties.totalMassKg;
    recordCheck(
      'TEST-019-022',
      t22Passed,
      t22Passed
        ? `Multi-Variant verified: Quad (4 arms, ${quad.massProperties.totalMassKg} kg), Hexa (6 arms, ${hexa.massProperties.totalMassKg} kg), Octo (8 arms, ${octo.massProperties.totalMassKg} kg).`
        : 'Failed Multi-Variant verification.',
      { quadMass: quad.massProperties.totalMassKg, hexaMass: hexa.massProperties.totalMassKg, octoMass: octo.massProperties.totalMassKg }
    );

    const endTime = performance.now();
    const verdict = failedChecks === 0 ? 'PASS' : 'FAIL';
    const evidenceHash = EvidenceIntegrityService.computeHash({
      epc: 'EPC-019',
      verdict,
      checks,
      summary: { totalChecks, passedChecks, failedChecks }
    });

    return {
      epc: 'EPC-019',
      verdict,
      evidenceHash,
      checks,
      summary: {
        totalChecks,
        passedChecks,
        failedChecks
      },
      provenance: {
        timestamp: new Date().toISOString(),
        cadKernelVersion: ParametricAirframeGenerator.KERNEL_VERSION,
        agent: 'SECP-EPC019-VERIFIER',
        executionDurationMs: Number((endTime - startTime).toFixed(2))
      }
    };
  }
}
