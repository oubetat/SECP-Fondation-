/**
 * SECP Industrial OS v2 — Manufacturing Evidence Engine
 * Core Evidence Chain Management
 */

import {
  ManufacturingEvidenceRecord,
  ManufacturingEvidenceContract,
  EvidenceType,
  EvidenceSourceType,
  EventType,
  SourceIdentity,
  EventIdentity,
  ManufacturingEvidenceStatus,
  EvidenceAttestation,
  SignatureStatus,
  MachineStateSnapshot,
  ManufacturingInspectionEvidence,
  MeasurementEvidence,
  ManufacturingNonconformanceEvidence,
  PhysicalDigitalBinding,
  TelemetryEvidence,
  InspectionVerdict,
  CollisionSeverity,
} from "./types";
import { ManufacturingEvidenceHashPolicy } from "./ManufacturingEvidenceHashPolicy";
import { EvidenceSignatureVerifier } from "./EvidenceSignatureVerifier";

export class ManufacturingEvidenceEngine {
  private records: Map<string, ManufacturingEvidenceRecord> = new Map();
  private chainSequenceCounter = 0;
  private lastEvidenceHash = "GENESIS_EVIDENCE_HASH_0000000000000000000000000000000000000000";
  private signatureVerifier: EvidenceSignatureVerifier;

  constructor(signatureVerifier?: EvidenceSignatureVerifier) {
    this.signatureVerifier = signatureVerifier || new EvidenceSignatureVerifier();
  }

  public getRecordCount(): number {
    return this.records.size;
  }

  public getAllRecords(): ManufacturingEvidenceRecord[] {
    return Array.from(this.records.values()).sort(
      (a, b) => a.contract.chainSequence - b.contract.chainSequence
    );
  }

  public getRecordById(evidenceId: string): ManufacturingEvidenceRecord | undefined {
    return this.records.get(evidenceId);
  }

  /**
   * Capture, normalize, hash, sign, and append an evidence record to the chain.
   */
  public captureEvidence(params: {
    evidenceId: string;
    evidenceType: EvidenceType;
    evidenceVersion?: string;
    sourceIdentity: SourceIdentity;
    eventIdentity: EventIdentity;
    sourceArtifactId: string;
    sourceRevision: string;
    producerId: string;
    producerType: EvidenceSourceType;
    payload: any;
    context?: any;
    signingKeyRef?: string;
    recordingMode?: "ORIGINAL" | "RETROSPECTIVE";
    forcedChainSequence?: number; // Used for gap / sequence integrity testing
    forcedPreviousHash?: string; // Used for hash substitution / tampering testing
  }): ManufacturingEvidenceRecord {
    // 1. Enforce unique evidenceId
    if (this.records.has(params.evidenceId)) {
      throw new Error(`Duplicate evidenceId '${params.evidenceId}' is strictly prohibited.`);
    }

    // 2. Determine chain sequence
    const sequence = params.forcedChainSequence !== undefined
      ? params.forcedChainSequence
      : this.chainSequenceCounter + 1;
    this.chainSequenceCounter = Math.max(this.chainSequenceCounter, sequence);

    // 3. Normalize payload and context
    const normalizedPayload = ManufacturingEvidenceHashPolicy.normalizeValue(params.payload || {});
    const normalizedContext = ManufacturingEvidenceHashPolicy.normalizeValue(params.context || {});

    // 4. Compute content hash
    const contentHash = ManufacturingEvidenceHashPolicy.computeHash(normalizedPayload);

    // 5. Construct canonical representation structure for hashing
    const canonicalStructure = {
      evidenceId: params.evidenceId,
      evidenceType: params.evidenceType,
      sourceIdentity: params.sourceIdentity,
      eventIdentity: params.eventIdentity,
      payload: normalizedPayload,
      context: normalizedContext,
    };

    const canonicalHash = ManufacturingEvidenceHashPolicy.computeHash(canonicalStructure);

    // 6. Compute previous evidence hash
    const previousHash = params.forcedPreviousHash !== undefined
      ? params.forcedPreviousHash
      : this.lastEvidenceHash;

    const chainHash = ManufacturingEvidenceHashPolicy.computeChainHash(previousHash, canonicalHash, sequence);

    // 7. Signature generation if key ref provided
    let signature: string | undefined;
    let signingIdentity: string | undefined;
    if (params.signingKeyRef) {
      signingIdentity = params.signingKeyRef;
      signature = EvidenceSignatureVerifier.generateSignature(chainHash, params.signingKeyRef);
    }

    // 8. Create Contract
    const contract: ManufacturingEvidenceContract = {
      evidenceId: params.evidenceId,
      evidenceType: params.evidenceType,
      evidenceVersion: params.evidenceVersion || "1.0",
      sourceArtifactId: params.sourceArtifactId,
      sourceRevision: params.sourceRevision,
      eventId: params.eventIdentity.eventId,
      eventType: params.eventIdentity.eventType,
      eventTimestamp: params.eventIdentity.eventTimestamp,
      recordedTimestamp: params.eventIdentity.recordedTimestamp || Date.now(),
      producerId: params.producerId,
      producerType: params.producerType,
      contentHash,
      canonicalHash: chainHash, // Bind canonical hash to chain hash
      previousEvidenceHash: previousHash,
      chainSequence: sequence,
      signature,
      signingIdentity,
      verificationStatus: ManufacturingEvidenceStatus.COMPLETE,
      recordingMode: params.recordingMode || "ORIGINAL",
    };

    const record: ManufacturingEvidenceRecord = {
      contract,
      sourceIdentity: params.sourceIdentity,
      eventIdentity: params.eventIdentity,
      payload: normalizedPayload,
      context: normalizedContext,
      attestations: [],
    };

    // Verify signature status
    if (signature) {
      const sigRes = this.signatureVerifier.verifySignature(record);
      if (sigRes.status !== SignatureStatus.VALID) {
        contract.verificationStatus = ManufacturingEvidenceStatus.AUTHENTICITY_FAILURE;
      }
    }

    // Check timestamp anomaly (event time in future or far behind)
    if (params.eventIdentity.eventTimestamp > (params.eventIdentity.recordedTimestamp + 60000)) {
      contract.verificationStatus = ManufacturingEvidenceStatus.INVALID;
    }

    this.records.set(params.evidenceId, record);
    this.lastEvidenceHash = chainHash;

    return record;
  }

  /**
   * Add attestation to an evidence record.
   */
  public addAttestation(evidenceId: string, attestation: Omit<EvidenceAttestation, "evidenceId">): boolean {
    const record = this.records.get(evidenceId);
    if (!record) return false;

    const fullAttestation: EvidenceAttestation = {
      ...attestation,
      evidenceId,
    };
    record.attestations.push(fullAttestation);
    return true;
  }
}
