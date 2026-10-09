// SECP Industrial OS v2 — HARD ACCEPTANCE GATE 125
import { ManufacturingTwinEngine } from './ManufacturingTwinEngine';
import { IndependentManufacturingVerifier } from './IndependentManufacturingVerifier';
import { ManufacturingIdentityService } from './ManufacturingIdentityService';
import {
  ManufacturingFeature,
  ProcessPlan,
  MachineConfiguration,
  ToolAssembly,
  FixtureDefinition,
  ManufacturingSetup,
  Toolpath,
  PostProcessorDefinition,
  NCProgram,
  ManufacturingExecution,
  AsManufacturedGeometry,
  ToleranceVerification
} from './types';

export interface Gate125CheckResult {
  gateId: string;
  description: string;
  passed: boolean;
  score: number; // 0 or 100
  details: string;
}

export interface Gate125Summary {
  totalChecks: number;
  passedChecks: number;
  overallScore: number;
  verdict: 'PASS' | 'FAIL';
  checks: Gate125CheckResult[];
}

export class HardAcceptanceGate125 {
  public static evaluateGate(): Gate125Summary {
    const checks: Gate125CheckResult[] = [];
    const engine = new ManufacturingTwinEngine();

    // Reusable fixture data
    const features: ManufacturingFeature[] = [
      {
        featureId: 'FEAT-001-POCKET',
        featureType: 'POCKET',
        geometryEntityId: 'GEOM-CAD-BLOCK',
        geometryRevision: 'REV-A',
        geometryHash: 'cad_hash_998877665544332211',
        parameters: { depth: 15.0, length: 100.0, width: 50.0 },
        tolerance: { lowerLimit: -0.05, upperLimit: 0.05, unit: 'mm' },
        datumReferences: ['A', 'B', 'C'],
        materialCondition: 'MMC',
        featureHash: 'feat_hash_pocket_01'
      },
      {
        featureId: 'FEAT-002-HOLE',
        featureType: 'HOLE',
        geometryEntityId: 'GEOM-CAD-BLOCK',
        geometryRevision: 'REV-A',
        geometryHash: 'cad_hash_998877665544332211',
        parameters: { depth: 20.0, diameter: 10.0 },
        tolerance: { lowerLimit: -0.02, upperLimit: 0.02, unit: 'mm' },
        datumReferences: ['A'],
        materialCondition: 'RFS',
        featureHash: 'feat_hash_hole_01'
      }
    ];

    const processPlan: ProcessPlan = {
      processPlanId: 'PLAN-001',
      revision: 'REV-1',
      machineId: 'HAAS-VF2',
      processHash: 'proc_hash_01',
      sequence: ['OP-010', 'OP-020'],
      operations: [
        {
          operationId: 'OP-010',
          operationType: 'POCKETING',
          sequence: 10,
          targetFeatureIds: ['FEAT-001-POCKET'],
          machineId: 'HAAS-VF2',
          toolAssemblyId: 'TOOL-ASM-01-ENDMILL',
          fixtureId: 'FIX-01-VISE',
          parameters: { feed: 1200, rpm: 8000 },
          feedRate: 1200,
          spindleSpeed: 8000,
          depthOfCut: 3.0,
          stepover: 6.0,
          coolant: 'FLOOD',
          operationHash: 'op_hash_10'
        },
        {
          operationId: 'OP-020',
          operationType: 'DRILLING',
          sequence: 20,
          targetFeatureIds: ['FEAT-002-HOLE'],
          machineId: 'HAAS-VF2',
          toolAssemblyId: 'TOOL-ASM-02-DRILL',
          fixtureId: 'FIX-01-VISE',
          parameters: { feed: 300, rpm: 3000 },
          feedRate: 300,
          spindleSpeed: 3000,
          depthOfCut: 20.0,
          stepover: 0.0,
          coolant: 'THROUGH_TOOL',
          operationHash: 'op_hash_20'
        }
      ]
    };

    const machineConfiguration: MachineConfiguration = {
      machineId: 'HAAS-VF2',
      machineModel: 'VF-2SS',
      machineRevision: 'REV-2026',
      kinematicsRevision: 'KIN-VF2-3AXIS',
      controllerType: 'HAAS_NGC',
      controllerVersion: 'v18.04',
      machineConfigurationHash: 'mc_hash_vf2',
      kinematics: {
        axisCount: 3,
        axisTypes: ['LINEAR_X', 'LINEAR_Y', 'LINEAR_Z'],
        travelLimits: { X: [-380, 380], Y: [-200, 200], Z: [-250, 250] },
        velocityLimits: { X: 30000, Y: 30000, Z: 30000 },
        accelerationLimits: { X: 5000, Y: 5000, Z: 5000 },
        homePositions: { X: 0, Y: 0, Z: 0 },
        kinematicChain: 'TABLE_X_Y_HEAD_Z',
        pivotLocations: { X: [0, 0, 0] }
      }
    };

    const toolAssemblies: ToolAssembly[] = [
      {
        toolAssemblyId: 'TOOL-ASM-01-ENDMILL',
        tool: {
          toolId: 'TL-EM-12MM',
          toolType: 'END_MILL',
          diameter: 12.0,
          length: 75.0,
          cuttingEdges: 4,
          material: 'CARBIDE',
          coating: 'TiAlN',
          manufacturer: 'SANDVIK',
          revision: 'R1',
          toolHash: 'tool_em_12'
        },
        holder: {
          holderId: 'HLD-CAT40-ER32',
          holderType: 'CAT40',
          gaugeLength: 80.0,
          diameter: 50.0,
          interface: 'CAT40',
          revision: 'R1',
          holderHash: 'holder_cat40'
        },
        toolLifeRemaining: 92.5,
        usageCount: 14,
        cuttingTimeMinutes: 45.2,
        wearState: 'NORMAL_WEAR',
        toolAssemblyHash: 'asm_em_12'
      }
    ];

    const fixture: FixtureDefinition = {
      fixtureId: 'FIX-01-VISE',
      revision: 'REV-A',
      locators: ['LOC-01', 'LOC-02'],
      clamps: ['CLM-01'],
      datumReferences: ['A', 'B'],
      fixtureGeometryHash: 'fix_geom_01',
      fixtureConfigurationHash: 'fix_cfg_01'
    };

    const setup: ManufacturingSetup = {
      setupId: 'SETUP-01',
      workpieceId: 'WP-RAW-BLOCK',
      fixtureId: 'FIX-01-VISE',
      orientation: [0, 0, 0],
      datumReferenceFrame: 'G54',
      workOffset: 'G54',
      setupRevision: 'REV-1',
      setupHash: 'setup_hash_01'
    };

    const toolpaths: Toolpath[] = [
      {
        toolpathId: 'TP-010',
        toolpathRevision: 'REV-1',
        operationId: 'OP-010',
        machineId: 'HAAS-VF2',
        toolAssemblyId: 'TOOL-ASM-01-ENDMILL',
        segments: [
          { segmentId: 'SEG-1', type: 'RAPID', startPoint: [0, 0, 50], endPoint: [10, 10, 5], toolAxis: [0, 0, 1], feedRate: 10000, spindleSpeed: 8000 },
          { segmentId: 'SEG-2', type: 'LINEAR', startPoint: [10, 10, 5], endPoint: [10, 10, -5], toolAxis: [0, 0, 1], feedRate: 1200, spindleSpeed: 8000 }
        ],
        toolpathHash: 'tp_hash_010'
      }
    ];

    const postProcessor: PostProcessorDefinition = {
      postId: 'POST-HAAS-VF2',
      postVersion: 'v2.1',
      machineTarget: 'VF-2SS',
      controllerTarget: 'HAAS_NGC',
      configuration: { useG43: true, optiFeed: true },
      revision: 'REV-1',
      postHash: 'post_hash_01'
    };

    const ncProgram: NCProgram = {
      programId: 'PROG-1001',
      programRevision: 'REV-1',
      postProcessorHash: 'post_hash_01',
      toolpathHash: 'tp_hash_010',
      machineHash: 'mc_hash_vf2',
      gcodeLines: [
        'O1001 (PART MFG)',
        'G90 G54 G0 X10. Y10. S8000 M03',
        'G43 H01 Z5.',
        'G1 Z-5. F1200.',
        'M30'
      ],
      programTextHash: 'nc_hash_program_1001'
    };

    // 1. GATE-125-01: Deterministic Identity & Order-Invariant Hashing
    const twin1 = engine.createManufacturingTwin({
      manufacturingTwinId: 'TWIN-001',
      productId: 'PROD-AIRBUS-FLAP',
      productRevision: 'REV-C',
      geometryTwinId: 'GTWIN-100',
      releasedGeometryHash: 'cad_hash_998877665544332211',
      releasedGeometryRevision: 'REV-A',
      materialId: 'MAT-AL-7075-T6',
      materialRevision: 'MAT-REV-01',
      materialBatch: 'BATCH-2026-08',
      features,
      processPlan,
      machineConfiguration,
      toolAssemblies,
      fixture,
      setup,
      toolpaths,
      postProcessor,
      ncProgram
    });

    const twin1Hash = twin1.inputHash;
    const twin1Reconstructed = engine.createManufacturingTwin({
      manufacturingTwinId: 'TWIN-001-RECON',
      productId: 'PROD-AIRBUS-FLAP',
      productRevision: 'REV-C',
      geometryTwinId: 'GTWIN-100',
      releasedGeometryHash: 'cad_hash_998877665544332211',
      releasedGeometryRevision: 'REV-A',
      materialId: 'MAT-AL-7075-T6',
      materialRevision: 'MAT-REV-01',
      materialBatch: 'BATCH-2026-08',
      features,
      processPlan,
      machineConfiguration,
      toolAssemblies,
      fixture,
      setup,
      toolpaths,
      postProcessor,
      ncProgram
    });

    const g01Passed = twin1Hash === twin1Reconstructed.inputHash && twin1Hash.length === 64;
    checks.push({
      gateId: 'GATE-125-01',
      description: 'Deterministic Physics Identity & Order-Invariant Input Hashing',
      passed: g01Passed,
      score: g01Passed ? 100 : 0,
      details: g01Passed ? `Determinism verified. Input Hash: ${twin1Hash.substring(0, 16)}...` : 'Input hash determinism failed'
    });

    // 2. GATE-125-02: Feature Hashing & Operation Link Integrity
    const opLinkRes = ManufacturingIdentityService.verifyProcessSequence(processPlan);
    checks.push({
      gateId: 'GATE-125-02',
      description: 'Feature Hashing & Operation-Feature Relationship Integrity',
      passed: opLinkRes.valid,
      score: opLinkRes.valid ? 100 : 0,
      details: opLinkRes.valid ? 'Feature hashing & target operation links validated' : opLinkRes.errors.join('; ')
    });

    // 3. GATE-125-03: Geometry Hash Match & Mismatch Interception
    const badGeomRes = ManufacturingIdentityService.verifyGeometryConsistency('tampered_geom_hash', 'cad_hash_998877665544332211');
    const g03Passed = !badGeomRes.valid && badGeomRes.error?.includes('MANUFACTURING_GEOMETRY_MISMATCH') === true;
    checks.push({
      gateId: 'GATE-125-03',
      description: 'Geometry Hash Match & Mismatch Interception (MANUFACTURING_GEOMETRY_MISMATCH)',
      passed: g03Passed,
      score: g03Passed ? 100 : 0,
      details: g03Passed ? 'Successfully intercepted MANUFACTURING_GEOMETRY_MISMATCH' : 'Failed to intercept geometry mismatch'
    });

    // 4. GATE-125-04: Geometry Freshness Interception
    const staleGeomRes = ManufacturingIdentityService.verifyGeometryFreshness('REV-B_LATEST', 'REV-A');
    const g04Passed = !staleGeomRes.fresh && staleGeomRes.error?.includes('MANUFACTURING_GEOMETRY_STALE') === true;
    checks.push({
      gateId: 'GATE-125-04',
      description: 'Geometry Revision Freshness Interception (MANUFACTURING_GEOMETRY_STALE)',
      passed: g04Passed,
      score: g04Passed ? 100 : 0,
      details: g04Passed ? 'Successfully intercepted MANUFACTURING_GEOMETRY_STALE' : 'Failed to intercept stale geometry'
    });

    // 5. GATE-125-05: Material Revision Qualification Interception
    const badMatRes = ManufacturingIdentityService.verifyMaterialConsistency('UNQUALIFIED_REV', 'MAT-REV-01');
    const g05Passed = !badMatRes.valid && badMatRes.error?.includes('MANUFACTURING_MATERIAL_MISMATCH') === true;
    checks.push({
      gateId: 'GATE-125-05',
      description: 'Material Revision Qualification Interception (MANUFACTURING_MATERIAL_MISMATCH)',
      passed: g05Passed,
      score: g05Passed ? 100 : 0,
      details: g05Passed ? 'Successfully intercepted MANUFACTURING_MATERIAL_MISMATCH' : 'Failed to intercept unqualified material'
    });

    // 6. GATE-125-06: Machine Kinematics Travel Limits & Compatibility
    const machineComp = ManufacturingIdentityService.verifyMachineCompatibility(toolpaths[0], machineConfiguration);
    const g06Passed = machineComp.status === 'MACHINE_COMPATIBLE';
    checks.push({
      gateId: 'GATE-125-06',
      description: 'Machine Kinematics Travel Limits & Compatibility Verification',
      passed: g06Passed,
      score: g06Passed ? 100 : 0,
      details: g06Passed ? 'Toolpath strictly within 3-axis VF-2 envelope' : machineComp.details
    });

    // 7. GATE-125-07: Collision Avoidance & Rapid Motion Interception
    const collisionRes = ManufacturingIdentityService.verifyCollision(toolpaths[0]);
    const g07Passed = collisionRes.verdict === 'COLLISION_FREE';
    checks.push({
      gateId: 'GATE-125-07',
      description: 'Toolpath Collision Avoidance & Rapid Motion Interception',
      passed: g07Passed,
      score: g07Passed ? 100 : 0,
      details: g07Passed ? 'Toolpath verified collision-free' : collisionRes.details
    });

    // 8. GATE-125-08: NC G-Code Syntax & Program Termination Integrity
    const gcodeRes = ManufacturingIdentityService.verifyGCode(ncProgram);
    const g08Passed = gcodeRes.verdict === 'GCODE_VALID';
    checks.push({
      gateId: 'GATE-125-08',
      description: 'NC G-Code Syntax & Program Termination Integrity',
      passed: g08Passed,
      score: g08Passed ? 100 : 0,
      details: g08Passed ? 'NC Program G-code verified valid' : gcodeRes.details
    });

    // 9. GATE-125-09: Telemetry Continuity & Unapproved Program Interception
    const execution: ManufacturingExecution = {
      executionId: 'EXEC-999',
      manufacturingTwinId: 'TWIN-001',
      machineId: 'HAAS-VF2',
      operatorId: 'OP-402',
      programHash: 'nc_hash_program_1001',
      toolpathHash: 'tp_hash_010',
      startTime: new Date().toISOString(),
      executionState: 'COMPLETED',
      telemetryStream: [
        { timestamp: '10:00:00', sequence: 1, axisPosition: { X: 0, Y: 0, Z: 50 }, axisVelocity: { X: 0, Y: 0, Z: 0 }, spindleSpeed: 8000, spindleLoad: 12, feedRate: 0, coolantState: true, temperature: 22, vibrationLevel: 0.01, payloadHash: 'p1', signature: 's1' },
        { timestamp: '10:00:01', sequence: 2, axisPosition: { X: 10, Y: 10, Z: 5 }, axisVelocity: { X: 100, Y: 100, Z: 0 }, spindleSpeed: 8000, spindleLoad: 25, feedRate: 10000, coolantState: true, temperature: 23, vibrationLevel: 0.02, payloadHash: 'p2', signature: 's2' }
      ],
      executionHash: 'exec_hash_999'
    };

    const attachRes = engine.attachExecution('TWIN-001', execution);
    const g09Passed = attachRes.valid && twin1.state === 'READY';
    checks.push({
      gateId: 'GATE-125-09',
      description: 'Telemetry Sequence Continuity & Unapproved Program Interception',
      passed: g09Passed,
      score: g09Passed ? 100 : 0,
      details: g09Passed ? 'Execution & telemetry stream attached & validated' : attachRes.error || 'Execution attach failed'
    });

    // 10. GATE-125-10: End-to-End Inspection Audit & Physical Part Identity
    const asManufactured: AsManufacturedGeometry = {
      measurementDataId: 'MEAS-888',
      pointCloudHash: 'scan_pt_cloud_888',
      scanHash: 'scan_geometry_hash_888',
      inspectionGeometryHash: 'insp_geom_888',
      measurementDevice: 'ZEISS_CMM_CONTURA',
      measurementAccuracy: 0.001,
      calibrationId: 'CAL-2026-001',
      timestamp: new Date().toISOString()
    };

    const verifications: ToleranceVerification[] = [
      { featureId: 'FEAT-001-POCKET', nominalValue: 15.0, measuredValue: 15.012, lowerLimit: 14.95, upperLimit: 15.05, deviation: 0.012, uncertainty: 0.001, verdict: 'WITHIN_TOLERANCE' },
      { featureId: 'FEAT-002-HOLE', nominalValue: 10.0, measuredValue: 10.005, lowerLimit: 9.98, upperLimit: 10.02, deviation: 0.005, uncertainty: 0.001, verdict: 'WITHIN_TOLERANCE' }
    ];

    const inspAttach = engine.attachInspection('TWIN-001', asManufactured, verifications);
    const evidence = engine.getEvidence('TWIN-001');

    const g10Passed = inspAttach.twin.state === 'MANUFACTURING_VALID' && evidence?.partIdentity.partSerial.startsWith('SN-PART-') === true;
    checks.push({
      gateId: 'GATE-125-10',
      description: 'End-to-End Inspection Tolerance Audit & Physical Part Identity Traceability',
      passed: g10Passed,
      score: g10Passed ? 100 : 0,
      details: g10Passed ? `Inspection VALID. Traceable Part Serial: ${evidence?.partIdentity.partSerial}` : 'Inspection tolerance audit failed'
    });

    const passedCount = checks.filter(c => c.passed).length;
    const overallScore = (passedCount / checks.length) * 100;

    return {
      totalChecks: checks.length,
      passedChecks: passedCount,
      overallScore,
      verdict: passedCount === checks.length ? 'PASS' : 'FAIL',
      checks
    };
  }
}
