/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-014: Tamper-Evidence Verifier
 *
 * ARCHITECTURAL CONTRACT:
 * 1. Proves that modification of any canonical engineering artifact is detectable through
 *    the existing Engineering Truth chain (Identity -> Serializer -> Hash -> Evidence -> Provenance).
 * 2. Independently recomputes artifact canonical hashes via PATCH-009 CanonicalSerializer
 *    without trusting any hash stored on or provided by the mutable artifact itself.
 * 3. Compares recomputed hash against trusted expected evidence from PATCH-011 Evidence Objects
 *    and PATCH-010 Hash Chains, verified via PATCH-012 Evidence Verification Engine.
 * 4. Integrates with PATCH-013 Provenance Graph to verify graph lineage linkage.
 * 5. Returns tamperDetected = true ONLY when an independently recomputed hash contradicts
 *    trusted evidence (Missing Evidence = UNPROVEN, NOT Tampering).
 */

import * as crypto from 'crypto';
import { CanonicalSerializer } from '../serialization/CanonicalSerializer';
import { EngineeringEvidence } from '../evidence/EngineeringEvidenceTypes';
import { EvidenceVerificationEngine } from '../evidence/EvidenceVerificationEngine';
import { ProvenanceGraph } from '../provenance/ProvenanceGraph';
import { ProvenanceGraphVerifier } from '../provenance/ProvenanceGraphVerifier';
import { EngineeringClock, WallClock } from '../core/clock';

export interface TamperEvidenceResult {
  artifactId: string;
  expectedHash: string;
  actualHash: string;

  hashMatch: boolean;

  evidencePresent: boolean;
  evidenceValid: boolean;

  provenancePresent: boolean;
  provenanceValid: boolean;

  tamperDetected: boolean;

  verdict:
    | 'PASS'
    | 'FAIL'
    | 'UNPROVEN'
    | 'INCONCLUSIVE'
    | 'INVALID';

  reasons: string[];
}

export interface TamperEvidenceVerifyOptions {
  /**
   * Trusted Evidence Object created and signed by SECP Evidence System.
   * Must pass EvidenceVerificationEngine.verifyEvidence().
   */
  trustedEvidence?: EngineeringEvidence;

  /**
   * Optional Provenance Graph connecting this artifact to design/manufacturing lineage.
   */
  provenanceGraph?: ProvenanceGraph;

  /**
   * Clock abstraction for timestamping / verification context.
   */
  clock?: EngineeringClock;

  /**
   * Explicit expected hash from an authenticated, trusted source (e.g., protected Hash Chain).
   * MUST have isTrustedSourceVerified = true to be accepted.
   */
  trustedExpectedHash?: string;
  isTrustedSourceVerified?: boolean;
}

export class TamperEvidenceVerifier {
  public static readonly VERIFIER_VERSION = '1.0.0';

  /**
   * Verifies an engineering artifact against trusted evidence and provenance.
   *
   * Core Algorithm:
   * 1. Resolve artifact identity.
   * 2. Canonicalize artifact using PATCH-009 CanonicalSerializer.
   * 3. Recompute canonical SHA-256 hash independently.
   * 4. Retrieve expected hash from verified trusted evidence or authenticated source.
   * 5. Compare recomputed actualHash with expectedHash.
   * 6. Verify Evidence Object via PATCH-012 Evidence Verification Engine.
   * 7. Verify Provenance Graph linkage via PATCH-013 Provenance Graph Verifier if supplied.
   * 8. Produce truthful verdict (PASS / FAIL / UNPROVEN / INCONCLUSIVE / INVALID).
   */
  public static verifyArtifact(
    artifact: unknown,
    options?: TamperEvidenceVerifyOptions
  ): TamperEvidenceResult {
    const clock = options?.clock || new WallClock();
    const reasons: string[] = [];

    // 1. Resolve Artifact Identity
    let artifactId = 'UNKNOWN_ARTIFACT';
    if (artifact && typeof artifact === 'object') {
      const artObj = artifact as Record<string, any>;
      artifactId =
        artObj.artifactId ||
        artObj.engineeringIdentityId ||
        artObj.identityId ||
        artObj.id ||
        artObj.name ||
        'ARTIFACT_001';
    }

    // 2. Canonical Serialization & Independent Hash Recomputation
    let actualHash = '';
    try {
      const serialization = CanonicalSerializer.serialize(artifact);
      actualHash = crypto
        .createHash('sha256')
        .update(serialization.canonicalString, 'utf8')
        .digest('hex');
    } catch (err: any) {
      return {
        artifactId,
        expectedHash: '',
        actualHash: '',
        hashMatch: false,
        evidencePresent: !!options?.trustedEvidence,
        evidenceValid: false,
        provenancePresent: !!options?.provenanceGraph,
        provenanceValid: false,
        tamperDetected: false,
        verdict: 'INVALID',
        reasons: [`Artifact canonical serialization failed: ${err?.message || String(err)}`]
      };
    }

    // 3. Resolve Trusted Expected Hash & Evidence Verification
    let expectedHash = '';
    let evidencePresent = false;
    let evidenceValid = false;
    let evidenceVerdict: string = 'UNPROVEN';

    if (options?.trustedEvidence) {
      evidencePresent = true;
      const evResult = EvidenceVerificationEngine.verifyEvidence(options.trustedEvidence);
      evidenceVerdict = evResult.verdict;

      if (evResult.valid) {
        evidenceValid = true;
        // Extract expected artifact hash from trusted evidence object
        expectedHash =
          options.trustedEvidence.artifact?.canonicalHash ||
          '';
      } else {
        evidenceValid = false;
        reasons.push(
          `Trusted evidence verification failed (${evResult.verdict}): ${evResult.errors.join('; ')}`
        );
      }
    } else if (options?.trustedExpectedHash) {
      if (options.isTrustedSourceVerified === true) {
        evidencePresent = true;
        evidenceValid = true;
        expectedHash = options.trustedExpectedHash;
      } else {
        evidencePresent = false;
        evidenceValid = false;
        reasons.push(
          'Unauthenticated caller-supplied hash rejected: Expected hash must originate from a verified Evidence Object or Hash Chain'
        );
      }
    } else {
      evidencePresent = false;
      evidenceValid = false;
      reasons.push('Trusted expected evidence is unavailable for artifact');
    }

    // 4. Provenance Graph Linkage Verification
    let provenancePresent = false;
    let provenanceValid = true;

    if (options?.provenanceGraph) {
      provenancePresent = true;
      const provResult = ProvenanceGraphVerifier.verifyGraph(options.provenanceGraph);
      if (provResult.status !== 'PASS') {
        provenanceValid = false;
        reasons.push(
          `Provenance graph verification status '${provResult.status}': ${provResult.violations.join('; ')}`
        );
      }
    }

    // 5. Evaluate Verdict & Tamper Detection
    // CASE A: Missing Evidence -> UNPROVEN (Missing evidence is NOT tampering)
    if (!evidencePresent) {
      return {
        artifactId,
        expectedHash: '',
        actualHash,
        hashMatch: false,
        evidencePresent: false,
        evidenceValid: false,
        provenancePresent,
        provenanceValid,
        tamperDetected: false,
        verdict: 'UNPROVEN',
        reasons
      };
    }

    // CASE B: Evidence Present but Invalid / Malformed Evidence Structure
    if (!evidenceValid) {
      const verdict =
        evidenceVerdict === 'INVALID' || evidenceVerdict === 'FAIL' ? 'INVALID' : 'INCONCLUSIVE';
      return {
        artifactId,
        expectedHash: '',
        actualHash,
        hashMatch: false,
        evidencePresent: true,
        evidenceValid: false,
        provenancePresent,
        provenanceValid,
        tamperDetected: false,
        verdict,
        reasons
      };
    }

    // CASE C: Evidence Present and Valid -> Compare Hashes
    const hashMatch = actualHash === expectedHash;

    if (!hashMatch) {
      // Recomputed hash contradicts trusted expected hash -> TAMPER DETECTED
      reasons.push(
        `Tamper Detected: Recomputed artifact canonical hash '${actualHash}' differs from trusted expected hash '${expectedHash}'`
      );
      return {
        artifactId,
        expectedHash,
        actualHash,
        hashMatch: false,
        evidencePresent: true,
        evidenceValid: true,
        provenancePresent,
        provenanceValid,
        tamperDetected: true,
        verdict: 'FAIL',
        reasons
      };
    }

    // CASE D: Hash Matches and Evidence Valid
    if (provenancePresent && !provenanceValid) {
      reasons.push('Provenance graph linkage contains errors or incomplete lineage');
      return {
        artifactId,
        expectedHash,
        actualHash,
        hashMatch: true,
        evidencePresent: true,
        evidenceValid: true,
        provenancePresent: true,
        provenanceValid: false,
        tamperDetected: false,
        verdict: 'UNPROVEN',
        reasons
      };
    }

    reasons.push('Artifact matches trusted expected hash, evidence verified, and provenance intact');
    return {
      artifactId,
      expectedHash,
      actualHash,
      hashMatch: true,
      evidencePresent: true,
      evidenceValid: true,
      provenancePresent,
      provenanceValid,
      tamperDetected: false,
      verdict: 'PASS',
      reasons
    };
  }

  /**
   * Batch verification for multiple engineering artifacts.
   */
  public static verifyArtifacts(
    items: Array<{ artifact: unknown; options?: TamperEvidenceVerifyOptions }>
  ): TamperEvidenceResult[] {
    return items.map(item => this.verifyArtifact(item.artifact, item.options));
  }
}
