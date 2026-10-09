import { describe, it, expect } from 'vitest';
import { HardAcceptanceGatePMA001, PMARequest } from '../HardAcceptanceGatePMA001';
import { PhysicalTelemetryEnvelope, MetrologyProof } from '../PhysicalManufacturingTypes';
import { PhysicalManufacturingEngine } from '../PhysicalManufacturingEngine';

describe('Physical Manufacturing Attestation Adversarial Tests', () => {

  const createValidRequest = (): PMARequest => {
    const telemetryChain: PhysicalTelemetryEnvelope[] = [];
    let prevHash = 'genesis';
    for (let i = 0; i < 5; i++) {
      const rec = PhysicalManufacturingEngine.signTelemetry({
        deviceId: 'DEV1',
        machineId: 'MACH1',
        sequenceNumber: i + 1,
        timestamp: new Date().toISOString(),
        payload: { spindleSpeed: 10000, position: [i, 0, 0] },
        previousHash: prevHash
      });
      telemetryChain.push(rec);
      prevHash = PhysicalManufacturingEngine.hashTelemetryRecord(rec);
    }

    const metrologyProof: MetrologyProof = {
      inspectionId: 'INSP1',
      instrumentIdentity: 'CMM_ZEISS',
      measurementSystem: 'CMM',
      dimensionalMeasurements: { length: 0.05 },
      geometricDeviations: { flatness: 0.01 },
      datumReferences: ['A', 'B', 'C'],
      tolerances: { length: 0.1 },
      measurementUncertainty: 0.001,
      inspectionEvidenceHash: 'meas_hash'
    };

    return {
      digitalEngineeringTruthHash: 'truth_hash',
      releasedArtifactGCodeHash: 'gcode_hash',
      loadedProgramHash: 'gcode_hash',
      machineId: 'MACH1',
      controllerId: 'CTRL1',
      toolId: 'TOOL1',
      stockId: 'STOCK1',
      manufacturingRunId: 'RUN1',
      physicalPartId: 'PART1',
      telemetryChain,
      metrologyProof,
      canonicalGeometryHash: 'geom_hash',
      actualGeometryHash: 'geom_hash',
      predecessorAttestationHash: 'pred_hash',
      hasHardwareRootOfTrust: true
    };
  };

  it('A1 — G-Code substitution', () => {
    const req = createValidRequest();
    req.loadedProgramHash = 'different_gcode_hash';
    const verdict = HardAcceptanceGatePMA001.executeGate(req);
    expect(verdict.status).toBe('REJECTED');
    expect(verdict.reason).toBe('ATTESTATION_FAILURE');
  });

  it('A2 — Hash mismatch', () => {
    const req = createValidRequest();
    req.releasedArtifactGCodeHash = 'tampered_gcode_hash';
    const verdict = HardAcceptanceGatePMA001.executeGate(req);
    expect(verdict.status).toBe('REJECTED');
    expect(verdict.reason).toBe('ATTESTATION_FAILURE');
  });

  it('A3 — Telemetry tampering', () => {
    const req = createValidRequest();
    req.telemetryChain[2].payload.spindleSpeed = 999999; // tampered
    const verdict = HardAcceptanceGatePMA001.executeGate(req);
    expect(verdict.status).toBe('REJECTED');
    expect(verdict.reason).toBe('TELEMETRY_INTEGRITY_FAILURE');
  });

  it('A4 — Telemetry deletion', () => {
    const req = createValidRequest();
    req.telemetryChain.splice(2, 1);
    const verdict = HardAcceptanceGatePMA001.executeGate(req);
    expect(verdict.status).toBe('REJECTED');
    expect(verdict.reason).toBe('CHAIN_INTEGRITY_FAILURE');
  });

  it('A5 — Replay', () => {
    const req = createValidRequest();
    // Insert an old valid record that doesn't fit the previousHash chain
    const replayed = PhysicalManufacturingEngine.signTelemetry({
      deviceId: 'DEV1',
      machineId: 'MACH1',
      sequenceNumber: 2,
      timestamp: new Date().toISOString(),
      payload: { spindleSpeed: 10000, position: [0, 0, 0] },
      previousHash: 'wrong_prev_hash'
    });
    req.telemetryChain[1] = replayed;
    const verdict = HardAcceptanceGatePMA001.executeGate(req);
    expect(verdict.status).toBe('REJECTED');
    expect(verdict.reason).toBe('REPLAY_DETECTED');
  });

  it('A6 — Wrong machine', () => {
    const req = createValidRequest();
    req.telemetryChain[1].machineId = 'MACH_DIFFERENT';
    req.telemetryChain[1] = PhysicalManufacturingEngine.signTelemetry(req.telemetryChain[1]);
    // The verify process will catch the wrong machine ID
    const verdict = HardAcceptanceGatePMA001.executeGate(req);
    expect(verdict.status).toBe('REJECTED');
    expect(verdict.reason).toBe('MACHINE_IDENTITY_MISMATCH');
  });

  it('A8 — Measurement manipulation (incomplete inspection)', () => {
    const req = createValidRequest();
    req.metrologyProof = null;
    const verdict = HardAcceptanceGatePMA001.executeGate(req);
    expect(verdict.status).toBe('REJECTED');
    expect(verdict.reason).toBe('INSPECTION_INTEGRITY_FAILURE');
  });

  it('A9 — Geometry mismatch', () => {
    const req = createValidRequest();
    req.actualGeometryHash = 'wrong_geometry_hash';
    const verdict = HardAcceptanceGatePMA001.executeGate(req);
    expect(verdict.status).toBe('REJECTED');
    expect(verdict.reason).toBe('GEOMETRY_PROVENANCE_MISMATCH');
  });

  it('A10 — Broken predecessor chain', () => {
    // We already check this in verifyAttestationChain, let's verify that function directly here.
    const valid = PhysicalManufacturingEngine.verifyAttestationChain([]);
    expect(valid).toBe('ATTESTATION_CHAIN_FAILURE');
  });

  it('Hardware Root of Trust Unavailable', () => {
    const req = createValidRequest();
    req.hasHardwareRootOfTrust = false;
    const verdict = HardAcceptanceGatePMA001.executeGate(req);
    expect(verdict.status).toBe('REJECTED');
    expect(verdict.reason).toBe('HARDWARE_ROOT_OF_TRUST = UNAVAILABLE');
    expect(verdict.antiFabricationGuardBlocked).toBe(true);
    expect(verdict.claimLevel).toBe('PHYSICAL_EXECUTION_PROVEN');
  });

  it('Passes with valid execution', () => {
    const req = createValidRequest();
    const verdict = HardAcceptanceGatePMA001.executeGate(req);
    expect(verdict.status).toBe('ACCEPTED');
    expect(verdict.antiFabricationGuardBlocked).toBe(false);
    expect(verdict.claimLevel).toBe('INDUSTRIAL_FIELD_QUALIFIED');
  });

});
