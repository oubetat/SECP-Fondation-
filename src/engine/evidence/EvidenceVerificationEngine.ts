/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-012: Evidence Verification Engine
 */

import { EngineeringEvidence, EvidenceVerificationVerdict } from './EngineeringEvidenceTypes';
import { DetailedVerificationResult, VerificationCheck } from './EvidenceVerificationTypes';
import { EvidenceHashVerifier } from './EvidenceHashVerifier';
import { EvidenceSignatureVerifier } from './EvidenceSignatureVerifier';
import { EvidenceOriginVerifier } from './EvidenceOriginVerifier';
import { EvidenceVersionVerifier } from './EvidenceVersionVerifier';
import { EvidenceTimestampVerifier } from './EvidenceTimestampVerifier';
import { EvidenceDependencyVerifier } from './EvidenceDependencyVerifier';
import { WallClock } from '../core/clock';

export class EvidenceVerificationEngine {
  public static readonly VERIFIER_VERSION = '1.0.0';

  /**
   * Orchestrates the full verification pipeline for an Engineering Evidence object.
   */
  public static verifyEvidence(evidence: EngineeringEvidence): DetailedVerificationResult {
    const clock = new WallClock();
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Execute all checks in deterministic order
    const hashCheck = EvidenceHashVerifier.verify(evidence);
    const signatureCheck = EvidenceSignatureVerifier.verify(evidence);
    const originCheck = EvidenceOriginVerifier.verify(evidence);
    const versionCheck = EvidenceVersionVerifier.verify(evidence);
    const timestampCheck = EvidenceTimestampVerifier.verify(evidence);
    const dependencyCheck = EvidenceDependencyVerifier.verify(evidence);

    const checks = {
      hash: hashCheck,
      signature: signatureCheck,
      origin: originCheck,
      version: versionCheck,
      timestamp: timestampCheck,
      dependencies: dependencyCheck
    };

    // 2. Aggregate Errors/Warnings
    this.collectIssues(checks, errors, warnings);

    // 3. Compute Aggregate Verdict
    const verdict = this.computeAggregateVerdict(checks);

    // Backward compatibility: valid means no FAIL or INVALID
    const valid = !Object.values(checks).some(c => c.status === 'FAIL' || c.status === 'INVALID');

    return {
      valid,
      evidenceId: evidence.evidenceId,
      verdict,
      checks,
      verifiedAt: clock.iso(),
      verifierVersion: this.VERIFIER_VERSION,
      errors,
      warnings,
      evidenceFingerprint: evidence.canonicalization.canonicalHash
    };
  }

  private static collectIssues(checks: any, errors: string[], warnings: string[]): void {
    for (const key in checks) {
      const check = checks[key] as VerificationCheck;
      if (check.status === 'FAIL' || check.status === 'INVALID') {
        errors.push(check.reason);
      } else if (check.status === 'UNPROVEN' || check.status === 'INCONCLUSIVE') {
        warnings.push(check.reason);
      }
    }
  }

  /**
   * Aggregate Verdict Rules:
   * - PASS: All mandatory checks passed.
   * - FAIL: Any check failed.
   * - INVALID: Any check returned INVALID.
   * - UNPROVEN: No FAIL/INVALID, but some checks are UNPROVEN.
   */
  private static computeAggregateVerdict(checks: { [key: string]: VerificationCheck }): EvidenceVerificationVerdict {
    const statuses = Object.values(checks).map(c => c.status);

    if (statuses.includes('INVALID')) return 'INVALID';
    if (statuses.includes('FAIL')) return 'FAIL';
    
    // If anything is UNPROVEN or INCONCLUSIVE, the whole thing is UNPROVEN (or INCONCLUSIVE)
    if (statuses.includes('UNPROVEN')) return 'UNPROVEN';
    if (statuses.includes('INCONCLUSIVE')) return 'INCONCLUSIVE';

    // Only if ALL are PASS
    return 'PASS';
  }
}
