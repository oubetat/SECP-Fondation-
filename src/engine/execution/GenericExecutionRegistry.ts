import { createHash } from 'crypto';
import { GenericExecutionEnvelope } from './CoreExecutionTypes';
import { verifyGenericEnvelopeSeal } from './CoreExecutionAuthorityInternal';
import { CanonicalDerivedArtifactBinding } from '../topology/CanonicalDerivedArtifactBinding';
import { AttestationCanonicalizer } from '../attestation/AttestationCanonicalizer';
import { EvidenceMerkleTree } from '../certification/truth/EvidenceMerkleTree';

export class GenericExecutionRegistry {
  private static authenticExecutions = new Map<string, GenericExecutionEnvelope>();

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
   * Authoritatively extracts pure engineering outputs, filtering out any wall-clock
   * runtime or execution-occurrence metadata (e.g. solvedAt, duration, timestamp).
   */
  public static extractEngineeringOutputs(rawResults: Record<string, any>): Record<string, any> {
    if (!rawResults || typeof rawResults !== 'object') return {};
    const filtered: Record<string, any> = {};
    for (const [k, v] of Object.entries(rawResults)) {
      if (k === 'solvedAt' || k === 'executionDurationMs' || k === 'duration' || k === 'processTiming' || k === 'timestamp') {
        continue;
      }
      filtered[k] = v;
    }
    return filtered;
  }

  /**
   * Deterministically computes the authoritative Engineering Result Identity (resultDigest).
   * Guaranteed invariant under re-execution with identical engineering inputs.
   */
  public static computeResultDigest(rawResults: Record<string, any>): string {
    const engineeringOutputs = this.extractEngineeringOutputs(rawResults);
    const normalized = AttestationCanonicalizer.normalizeValue(engineeringOutputs);
    return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  }

  /**
   * Computes canonical content digest for generic execution envelope payload.
   */
  public static computeContentDigest(envelope: GenericExecutionEnvelope): string {
    if (!envelope || typeof envelope !== 'object') {
      return '';
    }
    const engineeringOutputs = this.extractEngineeringOutputs(envelope.solverResult?.rawResults || {});
    const canonicalPayload = {
      executionId: envelope.executionId,
      engineeringObjectId: envelope.engineeringObjectId,
      revisionHash: envelope.revisionHash,
      geometryHash: envelope.geometryHash,
      pluginId: envelope.pluginId,
      pluginVersion: envelope.pluginVersion,
      executionKind: envelope.executionKind,
      inputDigest: envelope.inputDigest,
      resultDigest: envelope.resultDigest,
      solverIdentity: envelope.solverIdentity,
      artifactDigest: envelope.derivationBinding?.artifactDigest || '',
      overallVerdict: envelope.verificationResult?.overallVerdict || 'UNPROVEN',
      rawResults: engineeringOutputs
    };
    return AttestationCanonicalizer.hashObject(canonicalPayload);
  }

  /**
   * Registers a generic execution envelope.
   * Enforces:
   * 1. Structural Seal Check: Must carry private core execution seal.
   * 2. Identity Integrity: Derivation binding digest must match execution digest.
   * 3. Revision/Geometry Binding match.
   * 4. Overwrite Prevention: Conflicting content for existing executionId is rejected.
   */
  public static registerExecution(envelope: GenericExecutionEnvelope): void {
    if (!envelope || typeof envelope !== 'object') {
      throw new Error('GENERIC_REGISTRATION_FAILED: Invalid execution envelope');
    }

    // 1. Seal Check
    if (!verifyGenericEnvelopeSeal(envelope)) {
      throw new Error('GENERIC_REGISTRATION_FAILED: Missing authoritative execution seal.');
    }

    const { executionId, derivationBinding, revisionHash, geometryHash, engineeringObjectId, inputDigest, resultDigest } = envelope;

    if (!executionId || typeof executionId !== 'string' || executionId.trim() === '') {
      throw new Error('GENERIC_REGISTRATION_FAILED: Invalid or empty executionId');
    }

    // Overwrite Prevention: Check if executionId already exists
    if (this.authenticExecutions.has(executionId)) {
      const existing = this.authenticExecutions.get(executionId)!;
      const existingDigest = this.computeContentDigest(existing);
      const incomingDigest = this.computeContentDigest(envelope);

      if (
        existingDigest !== incomingDigest ||
        existing.resultDigest !== envelope.resultDigest ||
        existing.revisionHash !== revisionHash ||
        existing.geometryHash !== geometryHash
      ) {
        throw new Error(
          `IMMUTABLE_IDENTITY_CONFLICT: Execution identity '${executionId}' is already registered and immutable. Cannot overwrite with conflicting content.`
        );
      }

      // Case A: Same scenario + Same engineering result -> Valid replay! Record occurrence
      if (envelope.occurrences && envelope.occurrences.length > 0) {
        const existingOccurrences = (existing as any).occurrences ? [...(existing as any).occurrences] : [];
        for (const occ of envelope.occurrences) {
          if (!existingOccurrences.some((o: any) => o.occurrenceId === occ.occurrenceId)) {
            existingOccurrences.push(occ);
          }
        }
        const updated = {
          ...existing,
          occurrences: existingOccurrences
        };
        this.authenticExecutions.set(executionId, this.deepFreeze(updated));
      }
      return;
    }

    // 2. Identity Integrity - Verify rawResults match resultDigest
    const computedResultDigest = this.computeResultDigest(envelope.solverResult?.rawResults || {});
    if (computedResultDigest !== resultDigest) {
      throw new Error('GENERIC_REGISTRATION_FAILED: Result digest mismatch. Raw results have been tampered with.');
    }

    // Verify evidence leaf hash matches computed leaf hash
    if (envelope.evidenceLeaf) {
      const computedLeafHash = EvidenceMerkleTree.computeLeafHash(envelope.evidenceLeaf);
      if (computedLeafHash !== envelope.evidenceLeaf.leafHash) {
        throw new Error('GENERIC_REGISTRATION_FAILED: Evidence leaf hash mismatch. Evidence has been tampered with.');
      }
    }

    // 3. Identity Integrity - Verify computed execution ID matches declared executionId
    const preimage = {
      engineeringObjectId: engineeringObjectId || '',
      executionKind: envelope.executionKind || '',
      geometryHash: geometryHash || '',
      inputDigest: inputDigest || '',
      pluginId: envelope.pluginId || '',
      pluginVersion: envelope.pluginVersion || '',
      revisionHash: revisionHash || '',
      solverIdentity: envelope.solverIdentity || ''
    };
    const sortedKeys = Object.keys(preimage).sort() as (keyof typeof preimage)[];
    const canonicalString = sortedKeys.map(k => `${k}=${preimage[k]}`).join('&');
    const computedExecId = `EXEC-${createHash('sha256').update(canonicalString, 'utf8').digest('hex').substring(0, 24).toUpperCase()}`;

    if (computedExecId !== executionId) {
      throw new Error('GENERIC_REGISTRATION_FAILED: Execution ID mismatch. Envelope metadata has been tampered with.');
    }

    // 4. Binding Integrity
    if (!derivationBinding || typeof derivationBinding !== 'object') {
      throw new Error('GENERIC_REGISTRATION_FAILED: Missing derived artifact binding');
    }

    if (derivationBinding.cadRevisionHash !== revisionHash || derivationBinding.canonicalGeometryHash !== geometryHash) {
      throw new Error('GENERIC_REGISTRATION_FAILED: Revision or geometry hash mismatch in binding');
    }

    // Compute canonical content digest
    const contentDigest = this.computeContentDigest(envelope);

    // Deep freeze and store
    const cloned = JSON.parse(JSON.stringify(envelope));
    (cloned as any).contentDigest = contentDigest;
    this.authenticExecutions.set(executionId, this.deepFreeze(cloned) as unknown as GenericExecutionEnvelope);

    // Asynchronously persist all registered executions to storage
    this.persistToStorage().catch(err => {
      console.warn('[GenericExecutionRegistry] Background persistence failed:', err);
    });
  }

  public static verifyExecution(executionId: string): boolean {
    return this.authenticExecutions.has(executionId);
  }

  /**
   * Verifies execution binding against candidate envelope and target expected hashes.
   */
  public static verifyResultBinding(
    candidate: GenericExecutionEnvelope,
    expectedRevisionHash?: string,
    expectedGeometryHash?: string,
    expectedObjectId?: string
  ): { isValid: boolean; failureReason?: string; record?: GenericExecutionEnvelope } {
    if (!candidate || !candidate.executionId) {
      return { isValid: false, failureReason: 'INVALID_ENVELOPE' };
    }

    const registered = this.authenticExecutions.get(candidate.executionId);
    if (!registered) {
      return { isValid: false, failureReason: 'UNREGISTERED_EXECUTION_IDENTITY' };
    }

    // Content digest comparison
    const candidateDigest = this.computeContentDigest(candidate);
    const registeredDigest = this.computeContentDigest(registered);

    if (candidateDigest !== registeredDigest) {
      return {
        isValid: false,
        failureReason: `RESULT_DIGEST_MISMATCH: Candidate digest (${candidateDigest}) does not match registered digest (${registeredDigest})`
      };
    }

    // Target expectations check
    if (expectedRevisionHash && candidate.revisionHash !== expectedRevisionHash) {
      return { isValid: false, failureReason: `REVISION_MISMATCH: Expected ${expectedRevisionHash}, got ${candidate.revisionHash}` };
    }

    if (expectedGeometryHash && candidate.geometryHash !== expectedGeometryHash) {
      return { isValid: false, failureReason: `GEOMETRY_MISMATCH: Expected ${expectedGeometryHash}, got ${candidate.geometryHash}` };
    }

    if (expectedObjectId && candidate.engineeringObjectId !== expectedObjectId) {
      return { isValid: false, failureReason: `ENTITY_MISMATCH: Expected ${expectedObjectId}, got ${candidate.engineeringObjectId}` };
    }

    // Derived binding check
    const internalVerify = CanonicalDerivedArtifactBinding.verifyBinding(
      candidate.derivationBinding,
      candidate.revisionHash,
      candidate.geometryHash
    );

    if (!internalVerify.isValid) {
      return { isValid: false, failureReason: `BINDING_CORRUPTION: ${internalVerify.reasons.join(', ')}` };
    }

    return { isValid: true, record: registered };
  }

  public static getExecution(executionId: string): GenericExecutionEnvelope | undefined {
    const record = this.authenticExecutions.get(executionId);
    if (!record) return undefined;
    return JSON.parse(JSON.stringify(record));
  }

  public static getRegisteredIds(): string[] {
    return Array.from(this.authenticExecutions.keys());
  }

  /**
   * Rehydrates registry from durable storage (IndexedDB) and validates each envelope.
   */
  public static async rehydrateFromStorage(): Promise<void> {
    try {
      const { IndexedDbEngine } = await import('../storage/IndexedDbEngine');
      if (IndexedDbEngine.isSupported()) {
        const envelopes = await IndexedDbEngine.getKeyValue<GenericExecutionEnvelope[]>('SECP_AUTHORITATIVE_EXECUTION_LEDGER');
        if (envelopes && Array.isArray(envelopes)) {
          for (const envelope of envelopes) {
            try {
              // Re-register each envelope (performing seals checks, binding checks etc.)
              this.registerExecution(envelope);
            } catch (err) {
              console.warn('[GenericExecutionRegistry] Rehydration notice for envelope:', envelope.executionId, err);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[GenericExecutionRegistry] Failed to rehydrate from durable storage:', e);
    }
  }

  /**
   * Persists all registered execution envelopes durably to IndexedDB.
   */
  public static async persistToStorage(): Promise<void> {
    try {
      const { IndexedDbEngine } = await import('../storage/IndexedDbEngine');
      if (IndexedDbEngine.isSupported()) {
        const allEnvelopes = Array.from(this.authenticExecutions.values());
        await IndexedDbEngine.setKeyValue('SECP_AUTHORITATIVE_EXECUTION_LEDGER', allEnvelopes);
      }
    } catch (e) {
      console.warn('[GenericExecutionRegistry] Failed to persist to durable storage:', e);
    }
  }

  public static clear(): void {
    this.authenticExecutions.clear();
  }
}
