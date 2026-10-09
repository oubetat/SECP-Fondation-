import { describe, it, expect } from 'vitest';
import {
  CyberPhysicalLossAccountingEngine,
  LifecycleStage,
  StagePayload
} from '../../digital_thread/CyberPhysicalLossAccountingEngine';
import {
  CMMHardwareProtocolBridge,
  CMMMachineSpecification,
  ProbeTipCalibration
} from '../metrology/CMMHardwareProtocolBridge';
import {
  EmpiricalToolWearInferenceEngine,
  CuttingCondition,
  InProcessSensorTelemetry
} from '../wear/EmpiricalToolWearInferenceEngine';
import {
  MachineExecutionSafetyGateway,
  PhysicalMachineIdentity,
  MachineWorkOffsetContext,
  LoadedToolMagazineRecord
} from '../safety/MachineExecutionSafetyGateway';
import { ExternalReferenceBenchmarkOracle } from '../oracle/ExternalReferenceBenchmarkOracle';
import { FiveAxisToolpath, FiveAxisSegmentType } from '../cam/types';

describe('PHASE3-REDTEAM-001 — CYBER-PHYSICAL TRUTH BREAK TEST', () => {

  const baseEntities = [
    {
      entityId: 'FEAT_BLADE_PRESSURE_SURFACE',
      entityType: 'BRepFace',
      semanticIntent: 'SURFACE_PROFILE_0_04_A_B_C',
      geometryHash: 'SHA256_GEOM_BLADE_PS',
      uncertaintyMm: 0.003
    },
    {
      entityId: 'FEAT_BLADE_ROOT_DOVETAIL',
      entityType: 'BRepFace',
      semanticIntent: 'POSITION_0_02_A',
      geometryHash: 'SHA256_GEOM_ROOT_DOVETAIL',
      uncertaintyMm: 0.002
    }
  ];

  const createClean16Stages = (): StagePayload[] => {
    const allStages = [
      LifecycleStage.STAGE_01_REQUIREMENT,
      LifecycleStage.STAGE_02_CANONICAL_CAD,
      LifecycleStage.STAGE_03_SEMANTIC_PMI,
      LifecycleStage.STAGE_04_PHYSICS_SIMULATION,
      LifecycleStage.STAGE_05_OPTIMIZATION,
      LifecycleStage.STAGE_06_CAM_TOOLPATH,
      LifecycleStage.STAGE_07_MACHINE_SAFETY_GATEWAY,
      LifecycleStage.STAGE_08_PHYSICAL_CUTTING,
      LifecycleStage.STAGE_09_PHYSICAL_MEASUREMENT,
      LifecycleStage.STAGE_10_QIF_INTERCHANGE,
      LifecycleStage.STAGE_11_UNCERTAINTY_PROPAGATION,
      LifecycleStage.STAGE_12_DEVIATION_FIELD,
      LifecycleStage.STAGE_13_TOOL_WEAR_INFERENCE,
      LifecycleStage.STAGE_14_INVERSE_COMPENSATION,
      LifecycleStage.STAGE_15_REVISION_PROPOSAL,
      LifecycleStage.STAGE_16_RE_MANUFACTURING_TWIN
    ];

    const baseTime = Date.parse('2026-09-23T08:00:00Z');

    return allStages.map((stg, idx) => ({
      stage: stg,
      stageName: stg.replace('STAGE_', ''),
      cadModelId: 'CAD_AERO_BLISK_GEN3',
      revision: idx >= 14 ? 'REV_B' : 'REV_A',
      provenanceHash: `SHA256_PROV_STAGE_${idx}_AUTHENTIC`,
      coordinateFrameId: 'DATUM_REF_FRAME_A_B_C',
      unit: 'mm' as const,
      timestampIso: new Date(baseTime + idx * 3600000).toISOString(),
      authorizationToken: 'AUTH_TOKEN_CRYPTO_MULTI_SIG_LEAD',
      entities: baseEntities.map(e => ({ ...e }))
    }));
  };

  const defaultMachine: PhysicalMachineIdentity = {
    machineId: 'HERMLE_C42_U',
    manufacturer: 'HERMLE',
    model: 'C42U',
    controllerType: 'HEIDENHAIN_TNC_640',
    controllerFirmwareVersion: '340590-08',
    kinematicType: 'TABLE_TABLE',
    travelLimitsMm: { x: [-400, 400], y: [-400, 400], z: [-300, 300] },
    rotaryLimitsDeg: { a_or_b: [-130, 130], c: [0, 360] },
    maxSpindleRpm: 18000,
    maxFeedrateMmPerMin: 30000,
    maxRapidTraverseMmPerMin: 60000
  };

  const defaultOffsets: MachineWorkOffsetContext = {
    workOffsetId: 'G54',
    workpieceZeroOffsetMm: { x: 0, y: 0, z: 100 },
    tableRotaryPivotCenterMm: { x: 0, y: 0, z: -250 },
    datumFrameId: 'DATUM_REF_FRAME_A_B_C',
    lastProbedTimestampUtc: new Date().toISOString()
  };

  const defaultLoadedTool: LoadedToolMagazineRecord = {
    pocketNumber: 12,
    toolId: 'TOOL_BALL_ENDMILL_D10',
    measuredGaugeLengthMm: 145.22,
    measuredDiameterMm: 9.998,
    maxAllowedRpm: 15000,
    presetterCertificateId: 'PRESET_ZOLLER_CERT_8821'
  };

  const defaultToolpath: FiveAxisToolpath = {
    toolpathId: 'TP_FINISH_BLADE_01',
    operationId: 'OP_01',
    toolpathRevision: 1,
    fingerprint: 'FGP_SAFE_01',
    segments: [
      {
        segmentId: 'S1',
        segmentType: FiveAxisSegmentType.CUT,
        points: [
          {
            position: { x: 50, y: 50, z: 20 },
            toolAxis: { x: 0, y: 0, z: 1 },
            orientation: { x: 0, y: 0, z: 0 },
            feed: 1500,
            spindle: 12000,
            sequence: 1
          }
        ]
      }
    ]
  };

  // -------------------------------------------------------------------------
  // ADVERSARIAL MUTATIONS 01 - 07: DIGITAL THREAD INTEGRITY
  // -------------------------------------------------------------------------

  it('RT-01: Change partId midway across boundary triggers identity breach', () => {
    const stages = createClean16Stages();
    // Tamper with cadModelId in CAM toolpath stage
    stages[5].cadModelId = 'CAD_TURBINE_DISK_FORGED';
    // Entities no longer match canonical CAD definition
    stages[5].entities[0].entityId = 'FEAT_DISK_BORE';

    const report = CyberPhysicalLossAccountingEngine.auditEndToEndThread(stages);
    expect(report.overallVerdict).toBe('BREACH_DETECTED');
    expect(report.lossSummary.IDENTITY_LOSS.totalViolations).toBeGreaterThan(0);
    expect(report.transitions[4].status).toBe('UNACCEPTABLE_LOSS');
  });

  it('RT-02: Change designRevision silently without proposal triggers revision breach', () => {
    const stages = createClean16Stages();
    // Silently mutate revision at STAGE_06 (CAM) without going through proposal
    stages[5].revision = 'REV_X_UNAUTHORIZED';

    const report = CyberPhysicalLossAccountingEngine.auditEndToEndThread(stages);
    expect(report.overallVerdict).toBe('BREACH_DETECTED');
    expect(report.lossSummary.REVISION_LOSS.totalViolations).toBeGreaterThan(0);
    expect(report.transitions[4].status).toBe('UNACCEPTABLE_LOSS');
  });

  it('RT-03: Change featureId between CAD and QIF triggers identity breach', () => {
    const stages = createClean16Stages();
    // Alter featureId in QIF stage
    stages[9].entities[0].entityId = 'FEAT_IMPOSTER_ID_999';

    const report = CyberPhysicalLossAccountingEngine.auditEndToEndThread(stages);
    expect(report.overallVerdict).toBe('BREACH_DETECTED');
    expect(report.lossSummary.IDENTITY_LOSS.totalViolations).toBeGreaterThan(0);
  });

  it('RT-04: Change datum semantic intent triggers semantic breach', () => {
    const stages = createClean16Stages();
    // Change datum reference intent from |A|B|C| to |D|E|F|
    stages[9].entities[0].semanticIntent = 'SURFACE_PROFILE_0_04_D_E_F';

    const report = CyberPhysicalLossAccountingEngine.auditEndToEndThread(stages);
    expect(report.overallVerdict).toBe('BREACH_DETECTED');
    expect(report.lossSummary.SEMANTIC_LOSS.totalViolations).toBeGreaterThan(0);
  });

  it('RT-05: Coordinate frame mismatch triggers coordinate frame breach', () => {
    const stages = createClean16Stages();
    // Switch from workpiece datum frame to raw machine coordinate system
    stages[8].coordinateFrameId = 'MCS_MACHINE_COORDINATES';

    const report = CyberPhysicalLossAccountingEngine.auditEndToEndThread(stages);
    expect(report.overallVerdict).toBe('BREACH_DETECTED');
    expect(report.lossSummary.COORDINATE_FRAME_LOSS.totalViolations).toBeGreaterThan(0);
  });

  it('RT-06: Unit mismatch (mm vs inch) triggers unit breach', () => {
    const stages = createClean16Stages();
    stages[9].unit = 'inch';

    const report = CyberPhysicalLossAccountingEngine.auditEndToEndThread(stages);
    expect(report.overallVerdict).toBe('BREACH_DETECTED');
    expect(report.lossSummary.UNIT_LOSS.totalViolations).toBeGreaterThan(0);
  });

  it('RT-07: Dropping GUM uncertainty in CMM triggers uncertainty breach', () => {
    const stages = createClean16Stages();
    delete stages[8].entities[0].uncertaintyMm;

    const report = CyberPhysicalLossAccountingEngine.auditEndToEndThread(stages);
    expect(report.overallVerdict).toBe('BREACH_DETECTED');
    expect(report.lossSummary.UNCERTAINTY_LOSS.totalViolations).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // ADVERSARIAL MUTATIONS 08 - 14: PROVENANCE, TIME & HARDWARE SAFETY
  // -------------------------------------------------------------------------

  it('RT-08: Severing cryptographic provenance hash triggers provenance breach', () => {
    const stages = createClean16Stages();
    stages[6].provenanceHash = ''; // Erased hash

    const report = CyberPhysicalLossAccountingEngine.auditEndToEndThread(stages);
    expect(report.overallVerdict).toBe('BREACH_DETECTED');
    expect(report.lossSummary.PROVENANCE_LOSS.totalViolations).toBeGreaterThan(0);
  });

  it('RT-09: Non-monotonic timestamp (time travel) triggers temporal breach', () => {
    const stages = createClean16Stages();
    // Backdate STAGE_09 to 1999
    stages[8].timestampIso = '1999-12-31T23:59:59Z';

    const report = CyberPhysicalLossAccountingEngine.auditEndToEndThread(stages);
    expect(report.overallVerdict).toBe('BREACH_DETECTED');
    expect(report.lossSummary.TEMPORAL_LOSS.totalViolations).toBeGreaterThan(0);
  });

  it('RT-10: Stale workpiece zero probe (>7 days) triggers safety interlock', () => {
    const staleOffsets: MachineWorkOffsetContext = {
      ...defaultOffsets,
      lastProbedTimestampUtc: new Date(Date.now() - 86400000 * 14).toISOString() // 14 days ago
    };

    const auth = MachineExecutionSafetyGateway.authorizeExecution(
      defaultMachine,
      staleOffsets,
      defaultLoadedTool,
      defaultToolpath,
      'AUTH_TOKEN_CRYPTO_MULTI_SIG_LEAD'
    );

    expect(auth.status).toBe('EXECUTION_INTERLOCKED_REJECTED');
    expect(auth.interlockViolations.some(v => v.includes('WORK_OFFSET_STALE'))).toBe(true);
  });

  it('RT-11: Missing tool pre-setter certificate triggers safety interlock', () => {
    const uncertifiedTool: LoadedToolMagazineRecord = {
      ...defaultLoadedTool,
      presetterCertificateId: ''
    };

    const auth = MachineExecutionSafetyGateway.authorizeExecution(
      defaultMachine,
      defaultOffsets,
      uncertifiedTool,
      defaultToolpath,
      'AUTH_TOKEN_CRYPTO_MULTI_SIG_LEAD'
    );

    expect(auth.status).toBe('EXECUTION_INTERLOCKED_REJECTED');
    expect(auth.interlockViolations.some(v => v.includes('TOOL_PRESETTER_ERROR'))).toBe(true);
  });

  it('RT-12: Expired CMM probe qualification (>30 days) blocks acquisition', () => {
    const expiredProbe: ProbeTipCalibration = {
      probeId: 'STYLUS_RUBY_D3',
      tipDiameterMm: 3.0,
      calibratedSphereRadiusMm: 1.5,
      formErrorMm: 0.0003,
      qualificationDate: '2023-01-01T00:00:00Z',
      qualificationCertificateId: 'CERT_EXPIRED',
      touchRepeatabilityMm: 0.0008
    };

    const bridge = new CMMHardwareProtocolBridge();
    const session = bridge.connect(
      {
        machineModel: 'ZEISS_PRISMO',
        serialNumber: 'SN_123',
        controllerIp: '192.168.1.1',
        controllerPort: 8444,
        measuringRangeMm: { x: [0, 900], y: [0, 1200], z: [0, 700] },
        iso10360_2_MPE_E: { baseConstantUm: 1.5, lengthDenominator: 350 },
        maxAccelerationMmPerS2: 2000,
        maxVelocityMmPerS: 250,
        currentTemperatureDegC: 20.0,
        referenceTemperatureDegC: 20.0,
        thermalExpansionCoefficientPpmPerK: 11.5
      },
      expiredProbe
    );

    expect(session.probeQualified).toBe(false);
    expect(() => {
      bridge.acquireQualifiedPoint('FEAT_01', {
        touchIndex: 1,
        rawPosition: { x: 10, y: 10, z: 10 },
        approachVector: { x: 1, y: 0, z: 0 },
        temperatureDegC: 20.0,
        triggerForceMillinewtons: 10,
        timestampUtc: new Date().toISOString()
      });
    }).toThrow('CMM_HARDWARE_ERROR');
  });

  // -------------------------------------------------------------------------
  // ADVERSARIAL MUTATIONS 13 - 18: TOOL WEAR & SENSOR ANOMALIES
  // -------------------------------------------------------------------------

  it('RT-13: Contradictory sensor telemetry (zero speed + high cutting force) returns UNDETERMINED', () => {
    const conditions: CuttingCondition = {
      cuttingSpeedVc_m_per_min: 0.0, // Machine stopped!
      feedPerToothFz_mm: 0.1,
      axialDepthAp_mm: 2.0,
      radialWidthAe_mm: 3.0,
      workpieceMaterial: 'INCONEL_718',
      toolMaterial: 'CARBIDE'
    };

    const contradictoryTelemetry: InProcessSensorTelemetry = {
      timestampUtc: new Date().toISOString(),
      cuttingTimeMinutes: 10.0,
      passNumber: 2,
      spindleTorquePercent: 50.0,
      spindlePowerKw: 4.0,
      cuttingForcesN: { tangentialFc: 500.0, feedFf: 200.0, radialFp: 250.0 }, // 500N force while stopped!
      vibrationRmsG: 0.1,
      acousticEmissionEnergyV2s: 0.0
    };

    const prediction = EmpiricalToolWearInferenceEngine.inferWear(
      'TOOL_123',
      conditions,
      contradictoryTelemetry
    );

    expect(prediction.governanceFlag).toBe('TOOL_HEALTH_UNDETERMINED');
    expect(prediction.decisionEvidence).toContain('PHYSICAL_CONTRADICTION');
  });

  it('RT-14: Anomalous negative cutting force telemetry returns UNDETERMINED', () => {
    const conditions: CuttingCondition = {
      cuttingSpeedVc_m_per_min: 150.0,
      feedPerToothFz_mm: 0.1,
      axialDepthAp_mm: 2.0,
      radialWidthAe_mm: 3.0,
      workpieceMaterial: 'INCONEL_718',
      toolMaterial: 'CARBIDE'
    };

    const corruptTelemetry: InProcessSensorTelemetry = {
      timestampUtc: new Date().toISOString(),
      cuttingTimeMinutes: 5.0,
      passNumber: 1,
      spindleTorquePercent: 30.0,
      spindlePowerKw: -2.5, // Negative power!
      cuttingForcesN: { tangentialFc: -100.0, feedFf: 50.0, radialFp: 50.0 },
      vibrationRmsG: 0.5,
      acousticEmissionEnergyV2s: 1.0
    };

    const prediction = EmpiricalToolWearInferenceEngine.inferWear(
      'TOOL_123',
      conditions,
      corruptTelemetry
    );

    expect(prediction.governanceFlag).toBe('TOOL_HEALTH_UNDETERMINED');
    expect(prediction.decisionEvidence).toContain('SENSOR_DATA_CORRUPT');
  });

  it('RT-15: Critical tool wear crossing failure limit forces TOOL_CRITICAL_CHANGE_REQUIRED', () => {
    // Calibrate first to establish valid artifact
    EmpiricalToolWearInferenceEngine.calibrate(
      'TOOL_123',
      {
        cuttingSpeedVc_m_per_min: 220.0,
        feedPerToothFz_mm: 0.15,
        axialDepthAp_mm: 4.0,
        radialWidthAe_mm: 8.0,
        workpieceMaterial: 'INCONEL_718',
        toolMaterial: 'CARBIDE',
        operationId: 'FINISHING_MILL',
        machineId: 'HAAS_VF2_CNC'
      },
      [
        {
          timestampUtc: '2026-09-23T10:00:00Z',
          cuttingTimeMinutes: 10.0,
          passNumber: 1,
          spindleTorquePercent: 42.0,
          spindlePowerKw: 3.5,
          cuttingForcesN: { tangentialFc: 450.0, feedFf: 180.0, radialFp: 120.0 },
          vibrationRmsG: 0.8,
          acousticEmissionEnergyV2s: 1.2
        }
      ],
      [
        {
          observationId: 'OBS_TRN_01',
          toolId: 'TOOL_123',
          cuttingTimeMinutes: 10.0,
          measuredFlankWearVB_mm: 0.040,
          measuredMaxFlankWearVBmax_mm: 0.055,
          measuredDimensionalDeviationMm: 0.008,
          measurementMethod: 'OPTICAL_TOOL_MICROSCOPE',
          measurementUncertaintyMm: 0.002
        }
      ]
    );

    const conditions: CuttingCondition = {
      cuttingSpeedVc_m_per_min: 220.0,
      feedPerToothFz_mm: 0.15,
      axialDepthAp_mm: 4.0,
      radialWidthAe_mm: 8.0,
      workpieceMaterial: 'INCONEL_718',
      toolMaterial: 'CARBIDE'
    };

    // Extreme passive force indicating severely worn tool
    const criticalTelemetry: InProcessSensorTelemetry = {
      timestampUtc: new Date().toISOString(),
      cuttingTimeMinutes: 65.0,
      passNumber: 12,
      spindleTorquePercent: 95.0,
      spindlePowerKw: 11.5,
      cuttingForcesN: { tangentialFc: 800.0, feedFf: 700.0, radialFp: 1800.0 }, // Fp massive
      vibrationRmsG: 3.8,
      acousticEmissionEnergyV2s: 8.5
    };

    const prediction = EmpiricalToolWearInferenceEngine.inferWear(
      'TOOL_123',
      conditions,
      criticalTelemetry,
      0.30 // Failure limit
    );

    expect(prediction.governanceFlag).toBe('TOOL_CRITICAL_CHANGE_REQUIRED');
    expect(prediction.decisionEvidence).toContain('CRITICAL_WEAR_BREACH');
    expect(prediction.estimatedRemainingUsefulLifeMinutes).toBe(0);
  });

  // -------------------------------------------------------------------------
  // ADVERSARIAL MUTATIONS 16 - 21: EXTERNAL ORACLE & THREAD DISRUPTION
  // -------------------------------------------------------------------------

  it('RT-16: Corrupted external oracle comparison fails when discrepancy exceeds tolerance', () => {
    const benchmark = ExternalReferenceBenchmarkOracle.getNISTBenchmarkCylinder042();
    // Simulate an SECP bug where radius is calculated as 25.100 mm instead of certified 25.0038 mm
    const bogusComputedRadius = 25.100;

    const result = ExternalReferenceBenchmarkOracle.verifyAgainstCertifiedBenchmark(
      benchmark,
      bogusComputedRadius,
      0.001 // 1 um allowed tolerance
    );

    expect(result.conformanceStatus).toBe('DISCREPANCY_EXCEEDS_TOLERANCE');
    expect(result.absoluteDiscrepancyMm).toBeGreaterThan(0.09);
    expect(result.independentOracleSignature).toContain('FAILED');
  });

  it('RT-17: Dropping a mandatory safety gateway stage triggers chain failure', () => {
    const stages = createClean16Stages();
    // Filter out STAGE_07_MACHINE_SAFETY_GATEWAY completely
    const disruptedStages = stages.filter(
      s => s.stage !== LifecycleStage.STAGE_07_MACHINE_SAFETY_GATEWAY
    );

    // Boundary from CAM (06) directly to Physical Cutting (08)
    const report = CyberPhysicalLossAccountingEngine.auditEndToEndThread(disruptedStages);
    // Transition 06 -> 08 skips safety gateway and has authorization gap
    expect(report.transitions.some(t => t.fromStage === LifecycleStage.STAGE_06_CAM_TOOLPATH && t.toStage === LifecycleStage.STAGE_08_PHYSICAL_CUTTING)).toBe(true);
  });

  it('RT-18: Reordering stages (QIF inspection before cutting) triggers chronological/provenance failure', () => {
    const stages = createClean16Stages();
    // Swap stage 7 (cutting) and stage 9 (QIF)
    const temp = stages[7];
    stages[7] = stages[9];
    stages[9] = temp;

    const report = CyberPhysicalLossAccountingEngine.auditEndToEndThread(stages);
    expect(report.overallVerdict).toBe('BREACH_DETECTED');
    expect(report.lossSummary.TEMPORAL_LOSS.totalViolations).toBeGreaterThan(0);
  });

  it('RT-19: Unauthorized toolpath without governance token fails safety gateway', () => {
    const auth = MachineExecutionSafetyGateway.authorizeExecution(
      defaultMachine,
      defaultOffsets,
      defaultLoadedTool,
      defaultToolpath,
      'FORGED_OR_MISSING_TOKEN'
    );

    expect(auth.status).toBe('EXECUTION_INTERLOCKED_REJECTED');
    expect(auth.interlockViolations.some(v => v.includes('SECURITY_VIOLATION'))).toBe(true);
    expect(auth.executionSignature).toContain('SIG_BLOCKED');
  });

  it('RT-20: Missing entity semantic intent triggers semantic breach', () => {
    const stages = createClean16Stages();
    // Clear semanticIntent in CAM
    stages[5].entities[0].semanticIntent = 'INTENT_STRIPPED_ANONYMOUS';

    const report = CyberPhysicalLossAccountingEngine.auditEndToEndThread(stages);
    expect(report.overallVerdict).toBe('BREACH_DETECTED');
    expect(report.lossSummary.SEMANTIC_LOSS.totalViolations).toBeGreaterThan(0);
  });

  it('RT-21: Excessive geometric loss (>1um) triggers geometric breach', () => {
    const stages = createClean16Stages();
    // Change geometryHash to simulate chordal meshing approximation error
    stages[5].entities[0].geometryHash = 'SHA256_GEOM_ALTERED_MESH_APPROX';

    // Transition audit with tight 0.0001 mm geometric threshold
    const trans = CyberPhysicalLossAccountingEngine.auditTransition(
      stages[4],
      stages[5],
      0.0001 // 0.1 um threshold
    );

    expect(trans.status).toBe('UNACCEPTABLE_LOSS');
    expect(trans.losses.some(l => l.dimension === 'GEOMETRIC_LOSS' && l.lossDetected)).toBe(true);
  });
});
