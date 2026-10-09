/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-162: Attestation Registry & Ledger Bridge
 */

import { EngineeringEvidenceLedger } from '../evidence/ledger/EngineeringEvidenceLedger';
import { CryptographicAttestationEngine } from './CryptographicAttestationEngine';
import {
  AttestationVerificationCurrentState,
  AttestationVerificationResult,
  CryptographicAttestation,
} from './types';

export class AttestationRegistry {
  private static instance: AttestationRegistry | null = null;

  private readonly byAttestationId = new Map<string, CryptographicAttestation>();
  private readonly bySubjectId = new Map<string, Set<string>>();
  private readonly byExecutionId = new Map<string, Set<string>>();
  private readonly byArtifactHash = new Map<string, Set<string>>();

  private constructor() {}

  public static getInstance(): AttestationRegistry {
    if (!AttestationRegistry.instance) {
      AttestationRegistry.instance = new AttestationRegistry();
    }
    return AttestationRegistry.instance;
  }

  public static resetInstance(): void {
    if (AttestationRegistry.instance) {
      AttestationRegistry.instance.clear();
    }
    AttestationRegistry.instance = new AttestationRegistry();
  }

  /**
   * Registers a newly issued Cryptographic Attestation in the registry
   * and optionally anchors it to the immutable Evidence Ledger.
   */
  public register(
    attestation: CryptographicAttestation,
    options?: {
      anchorToLedger?: boolean;
      ledgerInstance?: EngineeringEvidenceLedger;
      projectId?: string;
      organizationId?: string;
    }
  ): void {
    this.byAttestationId.set(attestation.attestationId, attestation);

    // Subject index
    let subjectSet = this.bySubjectId.get(attestation.subjectId);
    if (!subjectSet) {
      subjectSet = new Set<string>();
      this.bySubjectId.set(attestation.subjectId, subjectSet);
    }
    subjectSet.add(attestation.attestationId);

    // Execution index
    let executionSet = this.byExecutionId.get(attestation.executionId);
    if (!executionSet) {
      executionSet = new Set<string>();
      this.byExecutionId.set(attestation.executionId, executionSet);
    }
    executionSet.add(attestation.attestationId);

    // Artifact Hash index
    let hashSet = this.byArtifactHash.get(attestation.artifactHash);
    if (!hashSet) {
      hashSet = new Set<string>();
      this.byArtifactHash.set(attestation.artifactHash, hashSet);
    }
    hashSet.add(attestation.attestationId);

    // Anchor to Evidence Ledger if requested
    if (options?.anchorToLedger) {
      const ledger = options.ledgerInstance || EngineeringEvidenceLedger.getInstance();
      ledger.registerEvidence({
        evidenceType: 'CERTIFICATE',
        engineeringObjectId: attestation.subjectId,
        objectRevision: '1.0.0',
        projectId: options.projectId || 'PRJ-ATTESTATION-HUB',
        organizationId: options.organizationId || 'ORG-FORENSIC-ENG',
        producerIdentity: attestation.engineeringIdentity,
        producerType: 'SERVICE',
        sourceSystem: 'SECP-ATTESTATION-ENGINE',
        sourceVersion: attestation.attestationVersion,
        payload: {
          attestationId: attestation.attestationId,
          canonicalPayloadHash: attestation.canonicalPayloadHash,
          artifactHash: attestation.artifactHash,
          solverIdentity: attestation.solverIdentity,
          solverVersion: attestation.solverVersion,
          status: attestation.status,
          signature: attestation.signature,
          signingKeyId: attestation.signingKeyId,
        },
        correlationId: attestation.executionId,
      });
    }
  }

  public getById(attestationId: string): CryptographicAttestation | undefined {
    return this.byAttestationId.get(attestationId);
  }

  public getBySubjectId(subjectId: string): readonly CryptographicAttestation[] {
    const ids = this.bySubjectId.get(subjectId);
    if (!ids) return [];
    const results: CryptographicAttestation[] = [];
    for (const id of ids) {
      const item = this.byAttestationId.get(id);
      if (item) results.push(item);
    }
    return results;
  }

  public getByExecutionId(executionId: string): readonly CryptographicAttestation[] {
    const ids = this.byExecutionId.get(executionId);
    if (!ids) return [];
    const results: CryptographicAttestation[] = [];
    for (const id of ids) {
      const item = this.byAttestationId.get(id);
      if (item) results.push(item);
    }
    return results;
  }

  public getByArtifactHash(artifactHash: string): readonly CryptographicAttestation[] {
    const ids = this.byArtifactHash.get(artifactHash);
    if (!ids) return [];
    const results: CryptographicAttestation[] = [];
    for (const id of ids) {
      const item = this.byAttestationId.get(id);
      if (item) results.push(item);
    }
    return results;
  }

  public listAll(): readonly CryptographicAttestation[] {
    return Array.from(this.byAttestationId.values());
  }

  public verifyById(
    attestationId: string,
    currentState?: AttestationVerificationCurrentState
  ): AttestationVerificationResult | undefined {
    const att = this.byAttestationId.get(attestationId);
    if (!att) return undefined;
    return CryptographicAttestationEngine.verifyAttestation(att, currentState);
  }

  public verifyAll(
    currentState?: AttestationVerificationCurrentState
  ): readonly AttestationVerificationResult[] {
    return this.listAll().map(att =>
      CryptographicAttestationEngine.verifyAttestation(att, currentState)
    );
  }

  public clear(): void {
    this.byAttestationId.clear();
    this.bySubjectId.clear();
    this.byExecutionId.clear();
    this.byArtifactHash.clear();
  }
}
