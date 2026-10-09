import { describe, it, expect } from 'vitest';
import {
  ClosedLoopMetrologyInversionEngine,
  CanonicalDesignAuthority,
  MetrologyBindingRecord,
  MetrologyPointDeviation
} from '../ClosedLoopMetrologyInversionEngine';
import { IndependentManufacturingOracle } from '../IndependentManufacturingOracle';
import { FiveAxisToolpath, FiveAxisSegmentType } from '../cam/types';

describe('CAP-SUP-005 — CLOSED-LOOP METROLOGY & INVERSION AUDIT SUITE', () => {
  const canonicalAuthority: CanonicalDesignAuthority = {
    cadModelId: 'CAD_IMPELLER_BLISK_001',
    designRevision: 'REV_C',
    immutableHash: 'SHA256_AUTH_BLISK_C_987654321',
    coordinateFrameId: 'DATUM_REF_FRAME_A_B_C',
    units: 'mm'
  };

  const validBinding: MetrologyBindingRecord = {
    partId: 'PART_BLISK_42',
    serialNumber: 'SN_2026_09_0042',
    designRevision: 'REV_C',
    featureId: 'BLADE_PRESSURE_FACE_01',
    toolId: 'TOOL_BALL_ENDMILL_D10_R5',
    datumFrameId: 'DATUM_REF_FRAME_A_B_C',
    unit: 'mm',
    toleranceBand: {
      nominalMm: 0.0,
      lowerMm: -0.05,
      upperMm: 0.05,
      characteristic: 'SURFACE_PROFILE'
    },
    measurementUncertaintyMm: 0.005, // 0.005 <= (0.05 - (-0.05)) * 0.25 = 0.025
    instrument: {
      instrumentId: 'ZEISS_PRISMO_CMM_01',
      calibrationValid: true,
      calibrationExpiry: '2027-12-31T23:59:59Z',
      lastCalibrated: '2026-01-15T08:00:00Z'
    },
    acquisitionType: 'SIMULATED_PHYSICAL_ACQUISITION',
    provenanceHash: 'SHA256_PROV_MEAS_A_123456789'
  };

  const validDeviations: MetrologyPointDeviation[] = [
    {
      pointId: 'P01',
      nominalCoordinates: { x: 50.0, y: 10.0, z: 20.0 },
      measuredCoordinates: { x: 50.04, y: 10.0, z: 20.0 },
      surfaceNormal: { x: 1.0, y: 0.0, z: 0.0 },
      deviationMm: 0.04,
      uncertaintyMm: 0.005
    },
    {
      pointId: 'P02',
      nominalCoordinates: { x: 52.0, y: 10.0, z: 20.0 },
      measuredCoordinates: { x: 52.04, y: 10.0, z: 20.0 },
      surfaceNormal: { x: 1.0, y: 0.0, z: 0.0 },
      deviationMm: 0.04,
      uncertaintyMm: 0.005
    }
  ];

  const baseToolpath: FiveAxisToolpath = {
    toolpathId: 'TP_FINISH_BLADE_01',
    operationId: 'OP_FINISH_01',
    toolpathRevision: 1,
    fingerprint: 'FGP_TP_BASE_001',
    segments: [
      {
        segmentId: 'SEG_01',
        segmentType: FiveAxisSegmentType.CUT,
        points: [
          {
            position: { x: 50.0, y: 10.0, z: 20.0 },
            toolAxis: { x: 0, y: 0, z: 1 },
            orientation: { x: 0, y: 0, z: 0 },
            feed: 1200,
            spindle: 12000,
            sequence: 1
          },
          {
            position: { x: 52.0, y: 10.0, z: 20.0 },
            toolAxis: { x: 0, y: 0, z: 1 },
            orientation: { x: 0, y: 0, z: 0 },
            feed: 1200,
            spindle: 12000,
            sequence: 2
          }
        ]
      }
    ]
  };

  it('CHECK-01: Design Authority Immutability & Reversibility', () => {
    const proposal = ClosedLoopMetrologyInversionEngine.formulateCompensationProposal(
      canonicalAuthority,
      validBinding,
      validDeviations,
      baseToolpath
    );

    expect(proposal.validationVerdict).toBe('VALID_COMPENSATION_PROPOSAL');
    // CAD authority is strictly preserved
    expect(proposal.canonicalDesignAuthority.cadModelId).toBe(canonicalAuthority.cadModelId);
    expect(proposal.canonicalDesignAuthority.immutableHash).toBe(canonicalAuthority.immutableHash);
    expect(proposal.canonicalDesignAuthority.designRevision).toBe(canonicalAuthority.designRevision);

    // Original toolpath is NOT mutated in place
    expect(baseToolpath.toolpathRevision).toBe(1);
    expect(baseToolpath.segments[0].points[0].position.x).toBe(50.0);

    // Proposal creates a new revision with reversibility token
    expect(proposal.proposedToolpathRevision).toBe(2);
    expect(proposal.reversibilityToken).toContain(canonicalAuthority.immutableHash);
  });

  it('CHECK-02: 9-Tuple Metrology Metadata Binding Verification', () => {
    const proposal = ClosedLoopMetrologyInversionEngine.formulateCompensationProposal(
      canonicalAuthority,
      validBinding,
      validDeviations,
      baseToolpath
    );

    const b = proposal.sourceMeasurementBinding;
    expect(b.partId).toBe('PART_BLISK_42');
    expect(b.serialNumber).toBe('SN_2026_09_0042');
    expect(b.designRevision).toBe('REV_C');
    expect(b.featureId).toBe('BLADE_PRESSURE_FACE_01');
    expect(b.toleranceBand.characteristic).toBe('SURFACE_PROFILE');
    expect(b.datumFrameId).toBe('DATUM_REF_FRAME_A_B_C');
    expect(b.measurementUncertaintyMm).toBe(0.005);
    expect(b.instrument.calibrationValid).toBe(true);
    expect(b.provenanceHash).toBe('SHA256_PROV_MEAS_A_123456789');
    expect(b.acquisitionType).toBe('SIMULATED_PHYSICAL_ACQUISITION');
  });

  it('CHECK-03: Independent Oracle Deviation Calculation Verification', () => {
    validDeviations.forEach(pt => {
      const oracleCheck = IndependentManufacturingOracle.verifyMetrologyDeviation(
        pt.nominalCoordinates,
        pt.measuredCoordinates,
        pt.surfaceNormal,
        pt.deviationMm
      );
      expect(oracleCheck).toBe(true);
    });
  });

  it('CHECK-04: Independent Oracle Tool-Wear Inference Verification', () => {
    const proposal = ClosedLoopMetrologyInversionEngine.formulateCompensationProposal(
      canonicalAuthority,
      validBinding,
      validDeviations,
      baseToolpath
    );

    const oracleWearCheck = IndependentManufacturingOracle.verifyToolWearInference(
      validDeviations.map(d => d.deviationMm),
      proposal.toolWearInference.inferredRadialWearMm
    );
    expect(oracleWearCheck).toBe(true);
    expect(proposal.toolWearInference.referenceModel).toBe('USUI_ANALYTICAL_FLANK_WEAR_V1');
  });

  it('CHECK-05: Exact Compensation Vector & Preservation of Direction', () => {
    const proposal = ClosedLoopMetrologyInversionEngine.formulateCompensationProposal(
      canonicalAuthority,
      validBinding,
      validDeviations,
      baseToolpath
    );

    // Initial deviation is +0.04mm along X (+1, 0, 0).
    // Compensation must counter this: -0.04mm along X.
    expect(proposal.compensationVector.x).toBeCloseTo(-0.04, 4);
    expect(proposal.compensationVector.y).toBeCloseTo(0.0, 4);
    expect(proposal.compensationVector.z).toBeCloseTo(0.0, 4);

    const oracleCompCheck = IndependentManufacturingOracle.verifyCompensationVector(
      0.04,
      { x: 1, y: 0, z: 0 },
      proposal.compensationVector
    );
    expect(oracleCompCheck).toBe(true);
  });

  it('CHECK-06: Compensation Failure Modes & Guard-band Violations', () => {
    // 6a. Stale / Wrong revision
    const staleBinding = { ...validBinding, designRevision: 'REV_B' };
    const propStale = ClosedLoopMetrologyInversionEngine.formulateCompensationProposal(
      canonicalAuthority,
      staleBinding,
      validDeviations,
      baseToolpath
    );
    expect(propStale.validationVerdict).toBe('REJECTED_INPUT_INVALID');
    expect(propStale.rejectionReason).toContain('STALE_OR_WRONG_REVISION');

    // 6b. Coordinate frame mismatch
    const frameMismatch = { ...validBinding, datumFrameId: 'LOCAL_FIXTURE_FRAME_F2' };
    const propFrame = ClosedLoopMetrologyInversionEngine.formulateCompensationProposal(
      canonicalAuthority,
      frameMismatch,
      validDeviations,
      baseToolpath
    );
    expect(propFrame.validationVerdict).toBe('REJECTED_INPUT_INVALID');
    expect(propFrame.rejectionReason).toContain('COORDINATE_FRAME_MISMATCH');

    // 6c. Unit mismatch
    const unitMismatch = { ...validBinding, unit: 'inch' as const };
    const propUnit = ClosedLoopMetrologyInversionEngine.formulateCompensationProposal(
      canonicalAuthority,
      unitMismatch,
      validDeviations,
      baseToolpath
    );
    expect(propUnit.validationVerdict).toBe('REJECTED_INPUT_INVALID');
    expect(propUnit.rejectionReason).toContain('UNIT_MISMATCH');

    // 6d. Uncertainty larger than 25% of allowed tolerance (ISO 14253-1)
    const highUncertainty = { ...validBinding, measurementUncertaintyMm: 0.030 }; // tolerance band = 0.10, 25% = 0.025
    const propUncert = ClosedLoopMetrologyInversionEngine.formulateCompensationProposal(
      canonicalAuthority,
      highUncertainty,
      validDeviations,
      baseToolpath
    );
    expect(propUncert.validationVerdict).toBe('REJECTED_GUARD_BAND_BREACH');

    // 6e. Contradictory measurements
    const contradictoryDevs: MetrologyPointDeviation[] = [
      {
        pointId: 'CP1',
        nominalCoordinates: { x: 50, y: 10, z: 20 },
        measuredCoordinates: { x: 50.08, y: 10, z: 20 },
        surfaceNormal: { x: 1, y: 0, z: 0 },
        deviationMm: 0.08,
        uncertaintyMm: 0.005
      },
      {
        pointId: 'CP2',
        nominalCoordinates: { x: 50, y: 10, z: 20 },
        measuredCoordinates: { x: 49.92, y: 10, z: 20 },
        surfaceNormal: { x: 1, y: 0, z: 0 },
        deviationMm: -0.08,
        uncertaintyMm: 0.005
      }
    ];
    const propContra = ClosedLoopMetrologyInversionEngine.formulateCompensationProposal(
      canonicalAuthority,
      validBinding,
      contradictoryDevs,
      baseToolpath
    );
    expect(propContra.validationVerdict).toBe('REJECTED_INPUT_INVALID');
    expect(propContra.rejectionReason).toContain('CONTRADICTORY_MEASUREMENTS');
  });

  it('CHECK-07: Closed-Loop Deterministic Replay (Measurement A -> B -> Residual)', () => {
    const replayRun1 = ClosedLoopMetrologyInversionEngine.replayClosedLoop(
      canonicalAuthority,
      validBinding,
      validDeviations,
      baseToolpath,
      0.95
    );

    const replayRun2 = ClosedLoopMetrologyInversionEngine.replayClosedLoop(
      canonicalAuthority,
      validBinding,
      validDeviations,
      baseToolpath,
      0.95
    );

    // Replay determinism proof
    expect(replayRun1.deterministicHash).toBe(replayRun2.deterministicHash);
    expect(replayRun1.conformanceStatus).toBe('PASS');
    expect(replayRun1.reMeasurement.meanResidualDeviationMm).toBeLessThan(0.01);

    // Independent Oracle Residual Verification
    const oracleResidualCheck = IndependentManufacturingOracle.verifyClosedLoopResidual(
      0.04,
      0.04,
      0.95,
      replayRun1.reMeasurement.meanResidualDeviationMm
    );
    expect(oracleResidualCheck).toBe(true);
  });

  it('CHECK-08: ISO 14253-1 Independent Oracle Acceptance Decision', () => {
    // Residual = 0.002mm, U = 0.005mm, Band = [-0.05, +0.05]
    // Guarded band = [-0.045, +0.045] -> PASS
    const decisionPass = IndependentManufacturingOracle.verifyQualityAcceptance(
      0.002,
      0.005,
      -0.05,
      0.05
    );
    expect(decisionPass).toBe('PASS');

    // Residual = 0.048mm, U = 0.005mm -> INCONCLUSIVE (in guard band)
    const decisionInconclusive = IndependentManufacturingOracle.verifyQualityAcceptance(
      0.048,
      0.005,
      -0.05,
      0.05
    );
    expect(decisionInconclusive).toBe('INCONCLUSIVE');

    // Residual = 0.060mm -> FAIL
    const decisionFail = IndependentManufacturingOracle.verifyQualityAcceptance(
      0.060,
      0.005,
      -0.05,
      0.05
    );
    expect(decisionFail).toBe('FAIL');
  });
});
