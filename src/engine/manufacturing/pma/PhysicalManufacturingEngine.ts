import crypto from 'crypto';
import {
  PhysicalTelemetryEnvelope,
  PhysicalManufacturingAttestation,
  MetrologyProof,
  DeviationVerdict,
  PMALevel,
  DeterminismClass,
} from './PhysicalManufacturingTypes';

export const PRODUCTION_PHYSICAL_TRUST = 'NOT_PROVISIONED';

export const TELEMETRY_TRUST_CLASSIFICATION = {
  TEST_ANCHOR: 'SIMULATED_TEST_HMAC_ANCHOR',
  HARDWARE_ROOT_OF_TRUST: 'NOT_PROVISIONED'
} as const;

export class PhysicalManufacturingEngine {
  public static verifyTelemetryChain(telemetryData: PhysicalTelemetryEnvelope[], expectedMachineId: string): string | null {
    if (!telemetryData || telemetryData.length === 0) return 'CHAIN_INTEGRITY_FAILURE';
    
    let expectedSequence = telemetryData[0].sequenceNumber;
    let expectedPrevHash = telemetryData[0].previousHash;

    for (let i = 0; i < telemetryData.length; i++) {
      const record = telemetryData[i];

      if (record.machineId !== expectedMachineId) return 'MACHINE_IDENTITY_MISMATCH'; 
      if (record.sequenceNumber !== expectedSequence) return 'CHAIN_INTEGRITY_FAILURE'; // missing/deleted/reordered record
      if (record.previousHash !== expectedPrevHash) return 'REPLAY_DETECTED'; // replay or hash mismatch

      // Verify signature
      const validSig = this.verifySignature(record);
      if (!validSig) return 'TELEMETRY_INTEGRITY_FAILURE'; // invalid signature or payload modified

      // calculate hash for next
      expectedPrevHash = this.hashTelemetryRecord(record);
      expectedSequence++;
    }
    return null; // OK
  }

  public static hashTelemetryRecord(record: PhysicalTelemetryEnvelope): string {
    const data = `${record.deviceId}:${record.machineId}:${record.sequenceNumber}:${record.timestamp}:${JSON.stringify(record.payload)}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  public static verifySignature(record: PhysicalTelemetryEnvelope): boolean {
    // In a real system, we would verify against a TPM/HSM public key.
    // For now, signature is just a simple HMAC/hash or specific known value for testing.
    const expectedSig = crypto.createHmac('sha256', 'secure-telemetry-secret').update(this.hashTelemetryRecord(record)).digest('hex');
    return record.signature === expectedSig;
  }

  public static signTelemetry(record: Omit<PhysicalTelemetryEnvelope, 'signature'>): PhysicalTelemetryEnvelope {
    const r = record as PhysicalTelemetryEnvelope;
    r.signature = crypto.createHmac('sha256', 'secure-telemetry-secret').update(this.hashTelemetryRecord(r)).digest('hex');
    return r;
  }

  public static analyzeDeviation(
    expectedGeometryHash: string,
    actualGeometryHash: string,
    metrology: MetrologyProof,
    requiredTolerances: Record<string, number>
  ): DeviationVerdict | string {
    if (!metrology || Object.keys(metrology.dimensionalMeasurements).length === 0) return 'INSPECTION_INCOMPLETE';
    if (expectedGeometryHash !== actualGeometryHash) return 'GEOMETRY_PROVENANCE_MISMATCH';

    for (const [key, value] of Object.entries(metrology.dimensionalMeasurements)) {
      const tolerance = requiredTolerances[key] || 0.1; // default 0.1
      if (Math.abs(value) > tolerance) {
        return 'OUT_OF_TOLERANCE';
      }
    }
    return 'PASS';
  }

  public static verifyAttestationChain(attestations: PhysicalManufacturingAttestation[]): string | null {
    if (attestations.length === 0) return 'ATTESTATION_CHAIN_FAILURE';
    for (let i = 1; i < attestations.length; i++) {
      const prevHash = crypto.createHash('sha256').update(JSON.stringify(attestations[i-1])).digest('hex');
      if (attestations[i].predecessorAttestationHash !== prevHash) return 'ATTESTATION_CHAIN_FAILURE';
    }
    return null;
  }
}
