/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-012: Evidence Verification Engine Types
 */

import { 
  EvidenceVerificationVerdict, 
  EvidenceCheck,
  EngineeringEvidence
} from './EngineeringEvidenceTypes';

export interface VerificationCheck {
  readonly status: 'PASS' | 'FAIL' | 'UNPROVEN' | 'INCONCLUSIVE' | 'INVALID';
  readonly executed: boolean;
  readonly reason: string;
  readonly expected?: string;
  readonly observed?: string;
  readonly method?: string;
}

export interface DetailedVerificationResult {
  readonly valid: boolean;
  readonly evidenceId: string;
  readonly verdict: EvidenceVerificationVerdict;
  readonly checks: {
    readonly hash: VerificationCheck;
    readonly signature: VerificationCheck;
    readonly origin: VerificationCheck;
    readonly version: VerificationCheck;
    readonly timestamp: VerificationCheck;
    readonly dependencies: VerificationCheck;
  };
  readonly verifiedAt: string;
  readonly verifierVersion: string;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly evidenceFingerprint?: string;
}

export interface EvidenceSignature {
  readonly signature: string;
  readonly algorithm: string;
  readonly publicKeyId: string;
  readonly signedAt: string;
}

/**
 * Extension for EngineeringEvidence to support signatures
 */
export interface SignedEngineeringEvidence extends EngineeringEvidence {
  readonly signature?: EvidenceSignature;
}
