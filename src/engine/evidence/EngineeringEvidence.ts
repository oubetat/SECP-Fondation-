/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-011: Unified Engineering Evidence Object Model
 */

import * as crypto from 'crypto';
import { CanonicalSerializer } from '../serialization/CanonicalSerializer';
import { EngineeringIdentityFactory } from '../identity/EngineeringIdentityFactory';
import { EngineeringHashChain } from './EngineeringHashChain';
import { EvidenceVerificationEngine } from './EvidenceVerificationEngine';
import { EngineeringEvidencePayload } from './EngineeringEvidencePayload';
import {
  EngineeringEvidence,
  EngineeringEvidenceType,
  VALID_EVIDENCE_TYPES,
  EvidenceValidationResult,
  EvidenceValidationError,
  EngineeringEvidenceVerificationResult,
  EvidenceVerificationVerdict,
  EvidenceCheck,
  EngineeringEvidenceType as EvidenceType,
  ENGINEERING_EVIDENCE_SCHEMA_VERSION
} from './EngineeringEvidenceTypes';
import { DetailedVerificationResult } from './EvidenceVerificationTypes';

export class EngineeringEvidenceFactory {
  public static readonly SCHEMA_VERSION: string = ENGINEERING_EVIDENCE_SCHEMA_VERSION;

  /**
   * Create a new Engineering Evidence object.
   * Validates structural requirements and computes integrity hashes.
   */
  public static createEvidence(input: Partial<EngineeringEvidence>): EngineeringEvidence {
    // 1. Mandatory structural checks
    if (!input.evidenceId) throw new Error('evidenceId is required');
    if (!input.evidenceType || !VALID_EVIDENCE_TYPES.includes(input.evidenceType)) {
      throw new Error(`Invalid or missing evidenceType: ${input.evidenceType}`);
    }
    if (!input.subject) throw new Error('subject is required');
    if (!input.artifact) throw new Error('artifact is required');
    if (!input.provenance) throw new Error('provenance is required');
    if (!input.canonicalization) throw new Error('canonicalization is required');
    if (!input.integrity) throw new Error('integrity is required');
    if (!input.verification) throw new Error('verification is required');
    if (!input.claims) throw new Error('claims are required');
    if (!input.createdAt) throw new Error('createdAt is required');

    const evidence: EngineeringEvidence = {
      evidenceId: input.evidenceId!,
      evidenceType: input.evidenceType!,
      schemaVersion: this.SCHEMA_VERSION,
      subject: Object.freeze({ ...input.subject! }),
      artifact: Object.freeze({ ...input.artifact! }),
      provenance: Object.freeze({ ...input.provenance! }),
      computation: input.computation ? Object.freeze({ ...input.computation }) : undefined,
      inputs: input.inputs ? Object.freeze([...input.inputs]) : undefined,
      canonicalization: Object.freeze({ ...input.canonicalization! }),
      integrity: Object.freeze({ ...input.integrity! }),
      verification: Object.freeze({
        ...input.verification!,
        checks: input.verification!.checks ? Object.freeze([...input.verification!.checks]) : undefined
      }),
      claims: Object.freeze([...input.claims!]),
      lineage: input.lineage ? Object.freeze({ ...input.lineage }) : undefined,
      createdAt: input.createdAt!,
      metadata: input.metadata ? Object.freeze({ ...input.metadata }) : undefined
    };

    // 2. Initial Validation
    const validation = this.validateEngineeringEvidence(evidence);
    if (!validation.valid) {
      throw new Error(`Evidence validation failed: ${validation.errors.map(e => e.message).join('; ')}`);
    }

    return Object.freeze(evidence);
  }

  /**
   * Independently verify the structural and cryptographic integrity of an Evidence object.
   * Replaces legacy verification with the PATCH-012 Verification Engine.
   */
  public static verifyEngineeringEvidence(evidence: EngineeringEvidence): DetailedVerificationResult {
    return EvidenceVerificationEngine.verifyEvidence(evidence);
  }

  /**
   * Validate structural requirements of an evidence object.
   */
  public static validateEngineeringEvidence(evidence: EngineeringEvidence): EvidenceValidationResult {
    const errors: EvidenceValidationError[] = [];
    const warnings: any[] = [];

    if (evidence.schemaVersion !== this.SCHEMA_VERSION) {
      errors.push({ code: 'INVALID_SCHEMA', message: `Unsupported schema version: ${evidence.schemaVersion}` });
    }

    if (!evidence.subject.identityId) {
      errors.push({ code: 'MISSING_IDENTITY', message: 'Subject identityId is missing' });
    }

    if (!evidence.artifact.artifactId) {
      errors.push({ code: 'MISSING_ARTIFACT', message: 'Artifact artifactId is missing' });
    }

    if (!evidence.artifact.canonicalHash || evidence.artifact.canonicalHash.length !== 64) {
      errors.push({ code: 'INVALID_HASH', message: 'Artifact canonicalHash is missing or invalid' });
    }

    if (evidence.provenance.producer.type === 'UNKNOWN') {
      warnings.push({ code: 'UNKNOWN_PROVENANCE', message: 'Producer type is UNKNOWN' });
    }

    if (evidence.verification.verdict === 'PASS' && (!evidence.verification.checks || evidence.verification.checks.length === 0)) {
       errors.push({ code: 'INVALID_VERDICT', message: 'Verdict is PASS but no supporting checks are provided' });
    }

    return Object.freeze({
      valid: errors.length === 0,
      errors: Object.freeze(errors),
      warnings: Object.freeze(warnings)
    });
  }

  /**
   * Project the evidence object into its canonical payload for hashing.
   * Excludes the hashes themselves to avoid circularity.
   */
  public static getCanonicalPayload(evidence: Partial<EngineeringEvidence>): any {
    return EngineeringEvidencePayload.getCanonicalPayload(evidence);
  }

  /**
   * Compute the deterministic evidence hash.
   */
  public static computeEvidenceHash(evidence: Partial<EngineeringEvidence>): string {
    const payload = this.getCanonicalPayload(evidence);
    const serialization = CanonicalSerializer.serialize(payload);
    return crypto
      .createHash('sha256')
      .update(serialization.canonicalString, 'utf8')
      .digest('hex');
  }
}
