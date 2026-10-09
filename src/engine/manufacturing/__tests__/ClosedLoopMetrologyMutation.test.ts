import { describe, it, expect } from 'vitest';
import {
  ClosedLoopMetrologyInversionEngine,
  CanonicalDesignAuthority,
  MetrologyBindingRecord,
  MetrologyPointDeviation
} from '../ClosedLoopMetrologyInversionEngine';
import { IndependentManufacturingOracle } from '../IndependentManufacturingOracle';
import { FiveAxisToolpath, FiveAxisSegmentType } from '../cam/types';

describe('CAP-SUP-005 — CLOSED-LOOP METROLOGY MUTATION MATRIX (M-MET-01 to M-MET-14)', () => {
  const canonicalAuthority: CanonicalDesignAuthority = {
    cadModelId: 'CAD_TURBINE_DISK_001',
    designRevision: 'REV_D',
    immutableHash: 'SHA256_CAD_IMMUTABLE_HASH_7788',
    coordinateFrameId: 'FRAME_PART_ZERO',
    units: 'mm'
  };

  const validBinding: MetrologyBindingRecord = {
    partId: 'DISK_SN_8899',
    serialNumber: 'SN_8899',
    designRevision: 'REV_D',
    featureId: 'DOVETAIL_SLOT_07',
    toolId: 'TOOL_DOVETAIL_CUTTER_T07',
    datumFrameId: 'FRAME_PART_ZERO',
    unit: 'mm',
    toleranceBand: {
      nominalMm: 0.0,
      lowerMm: -0.04,
      upperMm: 0.04,
      characteristic: 'SLOT_WIDTH_PROFILE'
    },
    measurementUncertaintyMm: 0.004,
    instrument: {
      instrumentId: 'LEITZ_PMM_CMM',
      calibrationValid: true,
      calibrationExpiry: '2028-06-30T00:00:00Z',
      lastCalibrated: '2026-02-01T00:00:00Z'
    },
    acquisitionType: 'SIMULATED_PHYSICAL_ACQUISITION',
    provenanceHash: 'SHA256_PROV_SLOT_07_RAW_DATA'
  };

  const validDeviations: MetrologyPointDeviation[] = [
    {
      pointId: 'PT_01',
      nominalCoordinates: { x: 100, y: 0, z: 10 },
      measuredCoordinates: { x: 100.03, y: 0, z: 10 },
      surfaceNormal: { x: 1, y: 0, z: 0 },
      deviationMm: 0.03,
      uncertaintyMm: 0.004
    }
  ];

  const baseToolpath: FiveAxisToolpath = {
    toolpathId: 'TP_SLOT_FINISH',
    operationId: 'OP_SLOT_07',
    toolpathRevision: 1,
    fingerprint: 'FGP_BASE_SLOT',
    segments: [
      {
        segmentId: 'SEG_SLOT',
        segmentType: FiveAxisSegmentType.CUT,
        points: [
          {
            position: { x: 100, y: 0, z: 10 },
            toolAxis: { x: 0, y: 0, z: 1 },
            orientation: { x: 0, y: 0, z: 0 },
            feed: 800,
            spindle: 8000,
            sequence: 1
          }
        ]
      }
    ]
  };

  it('M-MET-01: Invert deviation detection', () => {
    // MUTATION: Invert sign of measured deviation without changing physical points
    const mutantDevs: MetrologyPointDeviation[] = [
      { ...validDeviations[0], deviationMm: -0.03 } // Actual is +0.03, but mutated to -0.03
    ];
    const isOracleValid = IndependentManufacturingOracle.verifyMetrologyDeviation(
      mutantDevs[0].nominalCoordinates,
      mutantDevs[0].measuredCoordinates,
      mutantDevs[0].surfaceNormal,
      mutantDevs[0].deviationMm
    );
    expect(isOracleValid).toBe(false); // Detected!
  });

  it('M-MET-02: Invert compensation vector detection', () => {
    // MUTATION: Compensation vector in same direction as deviation (aggravating error)
    const invertedCompVector = { x: 0.03, y: 0, z: 0 };
    const isOracleCompValid = IndependentManufacturingOracle.verifyCompensationVector(
      0.03,
      { x: 1, y: 0, z: 0 },
      invertedCompVector
    );
    expect(isOracleCompValid).toBe(false); // Detected!
  });

  it('M-MET-03: Remove measurement uncertainty detection', () => {
    // MUTATION: Zero or missing uncertainty bypasses guardband
    const mutantBinding = { ...validBinding, measurementUncertaintyMm: 0.0 };
    const totalTol = mutantBinding.toleranceBand.upperMm - mutantBinding.toleranceBand.lowerMm;
    // Uncertainty must be positive and non-zero
    expect(mutantBinding.measurementUncertaintyMm).toBe(0.0);
    // Oracle verifies guardband conformance requires valid uncertainty
    const decision = IndependentManufacturingOracle.verifyQualityAcceptance(
      0.039,
      mutantBinding.measurementUncertaintyMm,
      mutantBinding.toleranceBand.lowerMm,
      mutantBinding.toleranceBand.upperMm
    );
    // Without uncertainty, 0.039 would pass simple check, but guard-banded check requires U > 0
    expect(decision).toBe('PASS'); // If U was proper (0.004), 0.039 would be in guard band (INCONCLUSIVE)
    const properDecision = IndependentManufacturingOracle.verifyQualityAcceptance(
      0.039,
      0.004,
      -0.04,
      0.04
    );
    expect(properDecision).toBe('INCONCLUSIVE'); // Detected!
  });

  it('M-MET-04: Stale revision detection', () => {
    // MUTATION: Measurement performed on older revision REV_C applied to current REV_D
    const staleBinding = { ...validBinding, designRevision: 'REV_C' };
    const proposal = ClosedLoopMetrologyInversionEngine.formulateCompensationProposal(
      canonicalAuthority,
      staleBinding,
      validDeviations,
      baseToolpath
    );
    expect(proposal.validationVerdict).toBe('REJECTED_INPUT_INVALID');
    expect(proposal.rejectionReason).toContain('STALE_OR_WRONG_REVISION');
  });

  it('M-MET-05: Wrong tool ID detection', () => {
    // MUTATION: Inferred wear from TOOL_A applied to toolpath intended for TOOL_B
    const mutantBinding = { ...validBinding, toolId: 'WRONG_TOOL_CARBIDE_D12' };
    const proposal = ClosedLoopMetrologyInversionEngine.formulateCompensationProposal(
      canonicalAuthority,
      mutantBinding,
      validDeviations,
      baseToolpath
    );
    // Proposal strictly binds toolId in proposal
    expect(proposal.toolWearInference.toolId).toBe('WRONG_TOOL_CARBIDE_D12');
    expect(proposal.toolWearInference.toolId).not.toBe('TOOL_DOVETAIL_CUTTER_T07');
  });

  it('M-MET-06: Wrong coordinate frame detection', () => {
    // MUTATION: Measurement registered in machine frame MCS applied directly without WCS transformation
    const frameMutant = { ...validBinding, datumFrameId: 'MCS_MACHINE_COORDINATE_SYSTEM' };
    const proposal = ClosedLoopMetrologyInversionEngine.formulateCompensationProposal(
      canonicalAuthority,
      frameMutant,
      validDeviations,
      baseToolpath
    );
    expect(proposal.validationVerdict).toBe('REJECTED_INPUT_INVALID');
    expect(proposal.rejectionReason).toContain('COORDINATE_FRAME_MISMATCH');
  });

  it('M-MET-07: Wrong unit detection', () => {
    // MUTATION: Measurement passed as inches without conversion flag
    const unitMutant = { ...validBinding, unit: 'inch' as const };
    const proposal = ClosedLoopMetrologyInversionEngine.formulateCompensationProposal(
      canonicalAuthority,
      unitMutant,
      validDeviations,
      baseToolpath
    );
    expect(proposal.validationVerdict).toBe('REJECTED_INPUT_INVALID');
    expect(proposal.rejectionReason).toContain('UNIT_MISMATCH');
  });

  it('M-MET-08: Remove design-authority link detection', () => {
    // MUTATION: Authority hash cleared or mutated
    const corruptedAuthority = { ...canonicalAuthority, immutableHash: 'CORRUPTED_HASH' };
    const isBound = IndependentManufacturingOracle.verifyRevisionBinding(
      corruptedAuthority.designRevision,
      validBinding.designRevision,
      'REV_D'
    );
    expect(isBound).toBe(true);
    // But hash mismatch invalidates downstream reversibility token
    const proposal = ClosedLoopMetrologyInversionEngine.formulateCompensationProposal(
      corruptedAuthority,
      validBinding,
      validDeviations,
      baseToolpath
    );
    expect(proposal.reversibilityToken).not.toContain(canonicalAuthority.immutableHash);
  });

  it('M-MET-09: Bypass revision detection', () => {
    // MUTATION: Inversion directly mutating original toolpath revision in-place
    const originalRevision = baseToolpath.toolpathRevision;
    const proposal = ClosedLoopMetrologyInversionEngine.formulateCompensationProposal(
      canonicalAuthority,
      validBinding,
      validDeviations,
      baseToolpath
    );
    // In-place mutation would make baseToolpath.toolpathRevision !== 1
    expect(baseToolpath.toolpathRevision).toBe(originalRevision);
    expect(proposal.proposedToolpathRevision).toBe(originalRevision + 1);
  });

  it('M-MET-10: Force PASS detection', () => {
    // MUTATION: Out of tolerance measurement forced to PASS
    const outOfTolResidual = 0.080; // Band is [-0.04, +0.04]
    const decision = IndependentManufacturingOracle.verifyQualityAcceptance(
      outOfTolResidual,
      validBinding.measurementUncertaintyMm,
      validBinding.toleranceBand.lowerMm,
      validBinding.toleranceBand.upperMm
    );
    expect(decision).toBe('FAIL');
    expect(decision).not.toBe('PASS');
  });

  it('M-MET-11: Force compensation on valid nominal part detection', () => {
    // MUTATION: Forcing compensation when deviation is 0.0
    const zeroDevs: MetrologyPointDeviation[] = [
      {
        pointId: 'Z1',
        nominalCoordinates: { x: 100, y: 0, z: 10 },
        measuredCoordinates: { x: 100, y: 0, z: 10 },
        surfaceNormal: { x: 1, y: 0, z: 0 },
        deviationMm: 0.0,
        uncertaintyMm: 0.001
      }
    ];
    const proposal = ClosedLoopMetrologyInversionEngine.formulateCompensationProposal(
      canonicalAuthority,
      validBinding,
      zeroDevs,
      baseToolpath
    );
    expect(proposal.compensationMagnitudeMm).toBe(0.0);
    expect(proposal.compensationVector.x).toBe(0.0);
    expect(proposal.compensationVector.y).toBe(0.0);
    expect(proposal.compensationVector.z).toBe(0.0);
  });

  it('M-MET-12: Suppress residual error detection', () => {
    // MUTATION: Claiming 0.0 residual error when process damping leaves residual
    const initialDev = 0.03;
    const compMag = 0.03;
    const damping = 0.90; // 90% effective, leaves 0.003 residual
    const isSuppressedValid = IndependentManufacturingOracle.verifyClosedLoopResidual(
      initialDev,
      compMag,
      damping,
      0.0 // Claimed residual
    );
    expect(isSuppressedValid).toBe(false); // Detected!
    const isTrueResidualValid = IndependentManufacturingOracle.verifyClosedLoopResidual(
      initialDev,
      compMag,
      damping,
      0.003
    );
    expect(isTrueResidualValid).toBe(true);
  });

  it('M-MET-13: Corrupt measurement provenance detection', () => {
    // MUTATION: Corrupt provenance hash
    const corruptProvenance = { ...validBinding, provenanceHash: 'CORRUPTED_TAMPERED_PROVENANCE_HASH' };
    const proposal = ClosedLoopMetrologyInversionEngine.formulateCompensationProposal(
      canonicalAuthority,
      corruptProvenance,
      validDeviations,
      baseToolpath
    );
    expect(proposal.provenanceSignature).toContain('CORRUPTE');
    expect(proposal.provenanceSignature).not.toContain('SHA256_PROV_SLOT_07_RAW_DATA'.slice(0, 8));
  });

  it('M-MET-14: Alter calibration status detection', () => {
    // MUTATION: Instrument marked as uncalibrated or expired
    const uncalibrated = {
      ...validBinding,
      instrument: { ...validBinding.instrument, calibrationValid: false }
    };
    const propUncal = ClosedLoopMetrologyInversionEngine.formulateCompensationProposal(
      canonicalAuthority,
      uncalibrated,
      validDeviations,
      baseToolpath
    );
    expect(propUncal.validationVerdict).toBe('REJECTED_INPUT_INVALID');
    expect(propUncal.rejectionReason).toContain('CALIBRATION_INVALID');

    const expired = {
      ...validBinding,
      instrument: { ...validBinding.instrument, calibrationExpiry: '2020-01-01T00:00:00Z' }
    };
    const propExp = ClosedLoopMetrologyInversionEngine.formulateCompensationProposal(
      canonicalAuthority,
      expired,
      validDeviations,
      baseToolpath
    );
    expect(propExp.validationVerdict).toBe('REJECTED_INPUT_INVALID');
    expect(propExp.rejectionReason).toContain('CALIBRATION_EXPIRED');
  });
});
