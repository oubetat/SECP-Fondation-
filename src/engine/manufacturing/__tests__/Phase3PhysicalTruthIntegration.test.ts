import { describe, it, expect } from 'vitest';
import {
  CMMHardwareProtocolBridge,
  CMMMachineSpecification,
  ProbeTipCalibration,
  RawTouchTriggerPoint
} from '../metrology/CMMHardwareProtocolBridge';
import {
  EmpiricalToolWearInferenceEngine,
  CuttingCondition,
  InProcessSensorTelemetry,
  MeasuredToolWearObservation
} from '../wear/EmpiricalToolWearInferenceEngine';
import {
  MachineExecutionSafetyGateway,
  PhysicalMachineIdentity,
  MachineWorkOffsetContext,
  LoadedToolMagazineRecord
} from '../safety/MachineExecutionSafetyGateway';
import { ExternalReferenceBenchmarkOracle } from '../oracle/ExternalReferenceBenchmarkOracle';
import {
  CyberPhysicalLossAccountingEngine,
  LifecycleStage,
  StagePayload
} from '../../digital_thread/CyberPhysicalLossAccountingEngine';
import { FiveAxisToolpath, FiveAxisSegmentType } from '../cam/types';

describe('SECP-POST-007 PHASE 3 — PHYSICAL TRUTH & INDUSTRIAL SUPERIORITY INTEGRATION', () => {

  describe('WP-PHY-01: CMM Hardware Protocol Interface (I++ DME / Renishaw)', () => {
    const machineSpec: CMMMachineSpecification = {
      machineModel: 'ZEISS_PRISMO_NAVIGATOR',
      serialNumber: 'SN_PRISMO_998877',
      controllerIp: '192.168.1.100',
      controllerPort: 8444,
      measuringRangeMm: {
        x: [0, 900],
        y: [0, 1200],
        z: [0, 700]
      },
      iso10360_2_MPE_E: {
        baseConstantUm: 1.2, // 1.2 um
        lengthDenominator: 350 // L / 350
      },
      maxAccelerationMmPerS2: 2500,
      maxVelocityMmPerS: 300,
      currentTemperatureDegC: 20.8, // 0.8 C above 20 C reference
      referenceTemperatureDegC: 20.0,
      thermalExpansionCoefficientPpmPerK: 11.5
    };

    const validProbe: ProbeTipCalibration = {
      probeId: 'STYLUS_RUBY_D3_L50',
      tipDiameterMm: 3.0000,
      calibratedSphereRadiusMm: 1.5002,
      formErrorMm: 0.0003,
      qualificationDate: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
      qualificationCertificateId: 'CERT_PROBE_CAL_2026_09',
      touchRepeatabilityMm: 0.0007 // 0.7 um
    };

    it('establishes qualified session and acquires touch points with GUM uncertainty', () => {
      const bridge = new CMMHardwareProtocolBridge();
      const session = bridge.connect(machineSpec, validProbe, 'I_PLUS_PLUS_DME');

      expect(session.connected).toBe(true);
      expect(session.probeQualified).toBe(true);
      expect(session.sessionToken).toContain('TOKEN_IPP_DME');

      const rawTouch: RawTouchTriggerPoint = {
        touchIndex: 1,
        rawPosition: { x: 101.500, y: 50.000, z: 25.000 },
        approachVector: { x: 1.0, y: 0.0, z: 0.0 }, // Approaching along +X
        temperatureDegC: 20.8,
        triggerForceMillinewtons: 15.0,
        timestampUtc: new Date().toISOString()
      };

      const qualifiedPt = bridge.acquireQualifiedPoint('FEAT_BORE_01', rawTouch);

      // Probe tip radius = 1.5000mm compensated along +X -> Center 101.5 - 1.5 = 100.0mm nominal
      expect(qualifiedPt.compensatedPosition.x).toBeCloseTo(100.0, 2);
      expect(qualifiedPt.surfaceNormal.x).toBe(1.0);

      // GUM expanded uncertainty (k=2) must be positive and bounded (approx 1.5 - 3 um)
      expect(qualifiedPt.expandedUncertaintyMm).toBeGreaterThan(0.001);
      expect(qualifiedPt.expandedUncertaintyMm).toBeLessThan(0.005);
      expect(qualifiedPt.temperatureCorrectionMm).toBeGreaterThan(0.0);
      expect(qualifiedPt.provenanceHash).toContain('SHA256_TOUCH');

      const disconnectCert = bridge.disconnect();
      expect(disconnectCert.totalPoints).toBe(1);
    });

    it('rejects acquisition if probe qualification has expired (>30 days)', () => {
      const expiredProbe: ProbeTipCalibration = {
        ...validProbe,
        qualificationDate: '2024-01-01T00:00:00Z'
      };
      const bridge = new CMMHardwareProtocolBridge();
      const session = bridge.connect(machineSpec, expiredProbe);
      expect(session.probeQualified).toBe(false);

      expect(() => {
        bridge.acquireQualifiedPoint('FEAT_BORE_01', {
          touchIndex: 1,
          rawPosition: { x: 50, y: 50, z: 50 },
          approachVector: { x: 0, y: 0, z: 1 },
          temperatureDegC: 20.0,
          triggerForceMillinewtons: 12.0,
          timestampUtc: new Date().toISOString()
        });
      }).toThrow('CMM_HARDWARE_ERROR');
    });
  });

  describe('WP-PHY-02: Empirical Tool-Wear Telemetry & Calibration (ISO 3685)', () => {
    const conditions: CuttingCondition = {
      cuttingSpeedVc_m_per_min: 180.0,
      feedPerToothFz_mm: 0.12,
      axialDepthAp_mm: 3.0,
      radialWidthAe_mm: 5.0,
      workpieceMaterial: 'INCONEL_718',
      toolMaterial: 'CARBIDE_PVD_TICN'
    };

    const telemetrySeries: InProcessSensorTelemetry[] = [
      {
        timestampUtc: '2026-09-23T08:00:00Z',
        cuttingTimeMinutes: 5.0,
        passNumber: 1,
        spindleTorquePercent: 35.0,
        spindlePowerKw: 4.2,
        cuttingForcesN: { tangentialFc: 420.0, feedFf: 180.0, radialFp: 120.0 },
        vibrationRmsG: 0.45,
        acousticEmissionEnergyV2s: 1.2
      },
      {
        timestampUtc: '2026-09-23T08:20:00Z',
        cuttingTimeMinutes: 20.0,
        passNumber: 4,
        spindleTorquePercent: 48.0,
        spindlePowerKw: 5.8,
        cuttingForcesN: { tangentialFc: 480.0, feedFf: 260.0, radialFp: 290.0 }, // Fp rose significantly
        vibrationRmsG: 0.88,
        acousticEmissionEnergyV2s: 2.9
      }
    ];

    const groundTruthObs: MeasuredToolWearObservation[] = [
      {
        observationId: 'OBS_01',
        toolId: 'TOOL_ENDMILL_D12',
        cuttingTimeMinutes: 5.0,
        measuredFlankWearVB_mm: 0.042,
        measuredMaxFlankWearVBmax_mm: 0.055,
        measuredDimensionalDeviationMm: 0.008,
        measurementMethod: 'OPTICAL_TOOL_MICROSCOPE',
        measurementUncertaintyMm: 0.002
      },
      {
        observationId: 'OBS_02',
        toolId: 'TOOL_ENDMILL_D12',
        cuttingTimeMinutes: 20.0,
        measuredFlankWearVB_mm: 0.091,
        measuredMaxFlankWearVBmax_mm: 0.120,
        measuredDimensionalDeviationMm: 0.018,
        measurementMethod: 'OPTICAL_TOOL_MICROSCOPE',
        measurementUncertaintyMm: 0.002
      }
    ];

    it('calibrates empirical wear model and infers wear from live telemetry', () => {
      const calib = EmpiricalToolWearInferenceEngine.calibrate(
        'TOOL_ENDMILL_D12',
        conditions,
        telemetrySeries,
        groundTruthObs
      );

      expect(calib.isCalibrated).toBe(true);
      expect(calib.rootMeanSquareErrorMm).toBeLessThan(0.025); // Under 25 um RMSE
      expect(calib.predictionUncertaintyMm).toBeGreaterThan(0.0);

      // Infer wear on active pass 4 telemetry
      const prediction = EmpiricalToolWearInferenceEngine.inferWear(
        'TOOL_ENDMILL_D12',
        conditions,
        telemetrySeries[1],
        0.30 // failure threshold
      );

      expect(prediction.predictedFlankWearVB_mm).toBeCloseTo(0.09, 1);
      expect(prediction.confidenceInterval95[0]).toBeLessThan(prediction.predictedFlankWearVB_mm);
      expect(prediction.confidenceInterval95[1]).toBeGreaterThan(prediction.predictedFlankWearVB_mm);
      expect(prediction.recommendedCompensationRadialOffsetMm).toBeGreaterThan(0.01);
      expect(prediction.governanceFlag).toBe('TOOL_DEGRADED_COMPENSATE');
    });
  });

  describe('WP-PHY-05: Machine Execution Safety Gateway (ISO 14649 / ISO 23125)', () => {
    const machine: PhysicalMachineIdentity = {
      machineId: 'HERMLE_C42_U_5AXIS',
      manufacturer: 'HERMLE',
      model: 'C42U',
      controllerType: 'HEIDENHAIN_TNC_640',
      controllerFirmwareVersion: '340590-08',
      kinematicType: 'TABLE_TABLE',
      travelLimitsMm: {
        x: [-400, 400],
        y: [-400, 400],
        z: [-300, 300]
      },
      rotaryLimitsDeg: {
        a_or_b: [-130, 130],
        c: [0, 360]
      },
      maxSpindleRpm: 18000,
      maxFeedrateMmPerMin: 30000,
      maxRapidTraverseMmPerMin: 60000
    };

    const offsets: MachineWorkOffsetContext = {
      workOffsetId: 'G54',
      workpieceZeroOffsetMm: { x: 0, y: 0, z: 100 },
      tableRotaryPivotCenterMm: { x: 0, y: 0, z: -250 },
      datumFrameId: 'FRAME_PART_ORIGIN_ABC',
      lastProbedTimestampUtc: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
    };

    const loadedTool: LoadedToolMagazineRecord = {
      pocketNumber: 12,
      toolId: 'TOOL_BALL_ENDMILL_D10',
      measuredGaugeLengthMm: 145.22,
      measuredDiameterMm: 9.998,
      maxAllowedRpm: 15000,
      presetterCertificateId: 'PRESET_ZOLLER_CERT_8821'
    };

    const safeToolpath: FiveAxisToolpath = {
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

    it('authorizes valid toolpath with cryptographic signature and rollback token', () => {
      const auth = MachineExecutionSafetyGateway.authorizeExecution(
        machine,
        offsets,
        loadedTool,
        safeToolpath,
        'AUTH_TOKEN_CRYPTO_MULTI_SIG_ENGINEERING_LEAD'
      );

      expect(auth.status).toBe('AUTHORIZED_FOR_CNC_EXECUTION');
      expect(auth.interlockViolations.length).toBe(0);
      expect(auth.rollbackToken).toContain('ROLLBACK_HERMLE_C42_U_5AXIS');
      expect(auth.executionSignature).toContain('SIG_AUTHORIZED_HEIDENHAIN_TNC_640');
    });

    it('interlocks and blocks execution on axis overtravel', () => {
      const overtravelToolpath: FiveAxisToolpath = {
        ...safeToolpath,
        segments: [
          {
            ...safeToolpath.segments[0],
            points: [
              {
                ...safeToolpath.segments[0].points[0],
                position: { x: 450, y: 0, z: 0 } // Machine limit is +400
              }
            ]
          }
        ]
      };

      const auth = MachineExecutionSafetyGateway.authorizeExecution(
        machine,
        offsets,
        loadedTool,
        overtravelToolpath,
        'AUTH_TOKEN_CRYPTO_MULTI_SIG_ENGINEERING_LEAD'
      );

      expect(auth.status).toBe('EXECUTION_INTERLOCKED_REJECTED');
      expect(auth.interlockViolations.some(v => v.includes('AXIS_OVERTRAVEL_X'))).toBe(true);
    });

    it('interlocks and blocks execution on missing governance authorization token', () => {
      const auth = MachineExecutionSafetyGateway.authorizeExecution(
        machine,
        offsets,
        loadedTool,
        safeToolpath,
        '' // Missing token
      );

      expect(auth.status).toBe('EXECUTION_INTERLOCKED_REJECTED');
      expect(auth.interlockViolations.some(v => v.includes('SECURITY_VIOLATION'))).toBe(true);
    });
  });

  describe('WP-PHY-04: External Reference Benchmark Oracle (NIST & PTB Standards)', () => {
    it('verifies independent circle fitting against NIST Benchmark Cylinder-042', () => {
      const benchmark = ExternalReferenceBenchmarkOracle.getNISTBenchmarkCylinder042();
      expect(benchmark.datasetId).toBe('NIST_PMICHECK_CYLINDER_042');

      const secpComputedRadius = ExternalReferenceBenchmarkOracle.computeIndependentFittedRadius(
        benchmark.samplePoints
      );

      // Compare against certified NIST golden value: 25.0038 mm
      const comparison = ExternalReferenceBenchmarkOracle.verifyAgainstCertifiedBenchmark(
        benchmark,
        secpComputedRadius,
        0.001 // 1 um tolerance
      );

      expect(comparison.conformanceStatus).toBe('CERTIFIED_REFERENCE_MATCH');
      expect(comparison.absoluteDiscrepancyMm).toBeLessThan(0.0005); // Discrepancy under 0.5 um
      expect(comparison.independentOracleSignature).toContain('VERIFIED');
    });
  });

  describe('WP-PHY-03: End-to-End Cyber-Physical Zero-Loss Round-Trip Proof', () => {
    it('proves zero fatal loss across all 11 dimensions in the full 16-stage cyber-physical thread', () => {
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

      const baseTime = Date.parse('2026-09-23T09:00:00Z');
      const stages: StagePayload[] = allStages.map((stg, idx) => ({
        stage: stg,
        stageName: stg.replace('STAGE_', ''),
        cadModelId: 'CAD_AEROSPACE_DISK_NIST_REF',
        revision: idx >= 14 ? 'REV_B' : 'REV_A',
        provenanceHash: `SHA256_PROV_CP_STAGE_${idx}`,
        coordinateFrameId: 'DATUM_REF_FRAME_A_B_C',
        unit: 'mm' as const,
        timestampIso: new Date(baseTime + idx * 1800000).toISOString(),
        authorizationToken: 'AUTH_TOKEN_CRYPTO_MULTI_SIG_ENGINEERING_LEAD',
        entities: [
          {
            entityId: 'FEAT_BLADE_PRESSURE_SURFACE',
            entityType: 'BRepFace',
            semanticIntent: 'SURFACE_PROFILE_0_04_A_B_C',
            geometryHash: 'SHA256_GEOM_BLADE_PS',
            uncertaintyMm: 0.003
          }
        ]
      }));

      const report = CyberPhysicalLossAccountingEngine.auditEndToEndThread(stages);

      expect(report.totalStages).toBe(16);
      expect(report.totalTransitions).toBe(15);
      expect(report.overallVerdict).toBe('CYBER_PHYSICAL_TRUTH_PROVEN');
      expect(report.lossSummary.IDENTITY_LOSS.totalViolations).toBe(0);
      expect(report.lossSummary.SEMANTIC_LOSS.totalViolations).toBe(0);
      expect(report.lossSummary.UNCERTAINTY_LOSS.totalViolations).toBe(0);
      expect(report.lossSummary.REVISION_LOSS.totalViolations).toBe(0);
      expect(report.lossSummary.COORDINATE_FRAME_LOSS.totalViolations).toBe(0);
      expect(report.lossSummary.UNIT_LOSS.totalViolations).toBe(0);
      expect(report.lossSummary.AUTHORIZATION_LOSS.totalViolations).toBe(0);
    });
  });
});
