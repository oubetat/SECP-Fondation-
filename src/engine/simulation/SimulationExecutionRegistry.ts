import { createHash } from 'crypto';
import { CanonicalDerivedArtifactBinding } from '../topology/CanonicalDerivedArtifactBinding';
import { AttestationCanonicalizer } from '../attestation/AttestationCanonicalizer';
import { verifyEnvelopeSeal, SimulationExecutionEnvelope } from './SimulationAuthorityInternal';

export interface CanonicalSimulationContentFields {
  scenarioId?: string;
  cadRevisionHash?: string;
  canonicalGeometryHash?: string;
  materialHash?: string;
  meshHash?: string;
  boundaryConditionHash?: string;
  initialConditionHash?: string;
  solverConfigurationHash?: string;
  maxStressMpa?: number;
  safetyFactor?: number;
  displacementMm?: number;
  criticalFeatureId?: string;
  status?: string;
  solverTerminationState?: string;
  convergenceMetrics?: Record<string, any>;
  conservationMetrics?: Record<string, any>;
  fieldHashes?: Record<string, string>;
  scalarResults?: Record<string, number>;
  vectorResults?: Record<string, readonly number[]>;
  residualHistory?: readonly Record<string, number>[];
  iterationData?: readonly Record<string, any>[];
}

export class SimulationExecutionRegistry {
  private static authenticResults = new Map<string, any>();

  /**
   * Deep-freezes an object recursively to guarantee immutability of registered records.
   */
  public static deepFreeze<T>(obj: T): Readonly<T> {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    const propNames = Object.getOwnPropertyNames(obj);
    for (const name of propNames) {
      const value = (obj as any)[name];
      if (value && typeof value === 'object') {
        this.deepFreeze(value);
      }
    }
    return Object.freeze(obj);
  }

  /**
   * Deterministically computes the canonical content digest for any simulation result
   * using AttestationCanonicalizer (key-sorted, invariant-normalized).
   */
  public static computeCanonicalContentDigest(result: any): string {
    if (!result || typeof result !== 'object') {
      return '';
    }
    const scalarResults = result.scalarResults || {};
    const canonicalContent: Record<string, any> = {
      scenarioId: result.scenarioId || '',
      cadRevisionHash: result.cadRevisionHash || '',
      canonicalGeometryHash: result.canonicalGeometryHash || '',
      materialHash: result.materialHash || '',
      meshHash: result.meshHash || '',
      boundaryConditionHash: result.boundaryConditionHash || '',
      initialConditionHash: result.initialConditionHash || '',
      solverConfigurationHash: result.solverConfigurationHash || '',
      maxStressMpa: typeof result.maxStressMpa === 'number' ? result.maxStressMpa : (typeof scalarResults.maxStressMpa === 'number' ? scalarResults.maxStressMpa : null),
      safetyFactor: typeof result.safetyFactor === 'number' ? result.safetyFactor : (typeof scalarResults.safetyFactor === 'number' ? scalarResults.safetyFactor : null),
      displacementMm: typeof result.displacementMm === 'number' ? result.displacementMm : (typeof scalarResults.displacementMm === 'number' ? scalarResults.displacementMm : null),
      criticalFeatureId: result.criticalFeatureId || '',
      status: result.status || '',
      solverTerminationState: result.solverTerminationState || '',
      convergenceMetrics: result.convergenceMetrics || null,
      conservationMetrics: result.conservationMetrics || null,
      fieldHashes: result.fieldHashes || null,
      scalarResults: result.scalarResults || null,
      vectorResults: result.vectorResults || null,
      residualHistory: result.residualHistory || null,
      iterationData: result.iterationData || null,
    };
    return AttestationCanonicalizer.hashObject(canonicalContent);
  }

  /**
   * Registers a canonical simulation execution using an authoritative envelope.
   * Enforces:
   * 1. Architectural authority boundary (requires valid authority seal).
   * 2. Identity integrity (provenanceHash must match binding digest).
   * 3. Overwrite prevention (existing identities cannot be altered or overwritten).
   * 4. Deep immutability of stored records.
   */
  public static registerExecution(envelope: SimulationExecutionEnvelope): void {
    if (!envelope || typeof envelope !== 'object') {
      throw new Error('SIMULATION_REGISTRATION_FAILED: Invalid execution envelope');
    }

    // 1. Structural Authority Check: Envelope must be sealed by an authoritative engine
    if (!verifyEnvelopeSeal(envelope)) {
      throw new Error('SIMULATION_REGISTRATION_FAILED: Arbitrary registration rejected. Missing authoritative execution seal.');
    }

    const { provenanceHash, result, authoritativeRevisionHash, authoritativeGeometryHash } = envelope;

    if (!provenanceHash || typeof provenanceHash !== 'string' || provenanceHash.trim() === '') {
      throw new Error('SIMULATION_REGISTRATION_FAILED: Invalid or empty provenanceHash');
    }
    if (!result || typeof result !== 'object') {
      throw new Error('SIMULATION_REGISTRATION_FAILED: Invalid result payload');
    }

    // 2. Binding Integrity Check: result must have a binding matching the provenanceHash
    if (!result.derivedArtifactBinding || result.derivedArtifactBinding.artifactDigest !== provenanceHash) {
      throw new Error('SIMULATION_REGISTRATION_FAILED: Provenance hash mismatch. Execution identity must be derived from the result binding.');
    }

    // 3. Identity Verification: binding must match the authoritative hashes passed in the envelope
    const binding = result.derivedArtifactBinding;
    if (binding.cadRevisionHash !== authoritativeRevisionHash || binding.canonicalGeometryHash !== authoritativeGeometryHash) {
      throw new Error('SIMULATION_REGISTRATION_FAILED: Identity violation. Execution binding does not match authoritative revision or geometry.');
    }

    // Compute canonical content digest of incoming payload
    const contentDigest = this.computeCanonicalContentDigest(result);

    // 4. Overwrite prevention: Fail-closed if identity already exists with different content
    if (this.authenticResults.has(provenanceHash)) {
      const existing = this.authenticResults.get(provenanceHash);
      const existingDigest = existing.canonicalContentDigest || this.computeCanonicalContentDigest(existing);
      if (existingDigest !== contentDigest) {
        throw new Error(`SIMULATION_REGISTRATION_FAILED: Execution identity '${provenanceHash}' is already registered and immutable. Cannot overwrite with different content.`);
      }
      // Idempotent registration
      return;
    }

    // Clone and stamp canonical content digest
    const cloned = JSON.parse(JSON.stringify(result));
    cloned.canonicalContentDigest = contentDigest;
    cloned.authoritativeRevisionHash = authoritativeRevisionHash;
    cloned.authoritativeGeometryHash = authoritativeGeometryHash;

    // Deep freeze and store in authoritative registry
    this.authenticResults.set(provenanceHash, this.deepFreeze(cloned));
  }

  public static verifyExecution(provenanceHash: string): boolean {
    return this.authenticResults.has(provenanceHash);
  }

  /**
   * Authoritatively verifies a simulation result's cryptographic binding AND content integrity.
   * Compares the candidate result's calculated canonical digest against the authoritative registered record.
   * Verification is ALWAYS performed against the binding, regardless of whether target hashes are supplied.
   */
  public static verifyResultBinding(
    result: any,
    targetCadRevisionHash?: string,
    targetGeometryHash?: string
  ): { isValid: boolean; failureReason?: string; authoritativeResult?: any } {
    if (!result || typeof result !== 'object') {
      return { isValid: false, failureReason: 'INVALID_RESULT_OBJECT' };
    }
    if (!result.provenanceHash || !this.verifyExecution(result.provenanceHash)) {
      return { isValid: false, failureReason: 'UNREGISTERED_RESULT_PROVENANCE' };
    }

    const authenticRecord = this.authenticResults.get(result.provenanceHash);
    if (!authenticRecord) {
      return { isValid: false, failureReason: 'AUTHORITATIVE_RECORD_NOT_FOUND' };
    }

    // 1. Verify candidate content matches authoritative record
    const candidateDigest = this.computeCanonicalContentDigest(result);
    const authoritativeDigest = authenticRecord.canonicalContentDigest || this.computeCanonicalContentDigest(authenticRecord);

    if (candidateDigest !== authoritativeDigest) {
      return {
        isValid: false,
        failureReason: `RESULT_CONTENT_SUBSTITUTION_DETECTED: Candidate content digest (${candidateDigest}) does not match authoritative execution digest (${authoritativeDigest})`
      };
    }

    // 2. Mandatory Binding Integrity Verification
    if (!result.derivedArtifactBinding) {
      return { isValid: false, failureReason: 'MISSING_DERIVED_BINDING' };
    }

    const binding = result.derivedArtifactBinding;

    // Ensure structural consistency: top-level fields must match payload fields
    if (
      binding.cadRevisionHash !== binding.payload.cadRevisionHash ||
      binding.canonicalGeometryHash !== binding.payload.canonicalGeometryHash ||
      binding.artifactKind !== binding.payload.artifactKind
    ) {
      return { isValid: false, failureReason: 'BINDING_INCONSISTENCY: Binding top-level metadata does not match internal payload.' };
    }

    // Always verify binding digest and payload consistency
    const internalVerify = CanonicalDerivedArtifactBinding.verifyBinding(
      binding,
      binding.cadRevisionHash, // Self-consistency check
      binding.canonicalGeometryHash
    );

    if (!internalVerify.isValid) {
      return { isValid: false, failureReason: `BINDING_CORRUPTION: ${internalVerify.reasons.join(', ')}` };
    }

    // 3. Verify against authoritative registration hashes
    if (result.derivedArtifactBinding.cadRevisionHash !== authenticRecord.authoritativeRevisionHash) {
       return { isValid: false, failureReason: 'BINDING_REVISION_MISMATCH: Binding revision does not match authoritative registration.' };
    }
    if (result.derivedArtifactBinding.canonicalGeometryHash !== authenticRecord.authoritativeGeometryHash) {
       return { isValid: false, failureReason: 'BINDING_GEOMETRY_MISMATCH: Binding geometry does not match authoritative registration.' };
    }

    // 4. Verify against target caller expectations if provided
    if (targetCadRevisionHash) {
      if (result.derivedArtifactBinding.cadRevisionHash !== targetCadRevisionHash) {
        return { isValid: false, failureReason: `REVISION_MISMATCH: Expected ${targetCadRevisionHash}, got ${result.derivedArtifactBinding.cadRevisionHash}` };
      }
    }
    if (targetGeometryHash) {
      if (result.derivedArtifactBinding.canonicalGeometryHash !== targetGeometryHash) {
        return { isValid: false, failureReason: `GEOMETRY_MISMATCH: Expected ${targetGeometryHash}, got ${result.derivedArtifactBinding.canonicalGeometryHash}` };
      }
    }

    return { isValid: true, authoritativeResult: authenticRecord };
  }

  /**
   * Retrieves a safe, immutable copy of the authoritative result.
   */
  public static getResult(provenanceHash: string): any {
    const record = this.authenticResults.get(provenanceHash);
    if (!record) return undefined;
    return JSON.parse(JSON.stringify(record));
  }

  public static clear(): void {
    this.authenticResults.clear();
  }
}

