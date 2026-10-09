/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-014: Tamper-Evidence Hard Acceptance Gate
 *
 * Evaluates the SECP Tamper-Evidence Core capabilities:
 * 1. Untouched Artifact Verification -> PASS
 * 2. Single-Field Mutation Detection -> FAIL (tamperDetected = true)
 * 3. Restored Artifact Re-verification -> PASS (no lingering state)
 * 4. Missing Evidence Handling -> UNPROVEN (missing evidence != tampering)
 * 5. Malformed Evidence Rejection -> INVALID / INCONCLUSIVE
 * 6. Adversarial Caller-Supplied Hash Rejection -> Refuses untrusted hashes
 */

import fs from 'fs';
import path from 'path';
import * as crypto from 'crypto';
import { CanonicalSerializer } from '../serialization/CanonicalSerializer';
import { EngineeringEvidenceFactory } from '../evidence/EngineeringEvidence';
import { EngineeringEvidence } from '../evidence/EngineeringEvidenceTypes';
import {
  TamperEvidenceVerifier,
  TamperEvidenceResult
} from '../verification/TamperEvidenceVerifier';
import { WallClock } from '../core/clock';

export interface TamperEvidenceGateResult {
  gateId: 'PATCH-014';
  verdict: 'PASS' | 'FAIL' | 'UNPROVEN' | 'INCONCLUSIVE' | 'INVALID';

  tamperDetected: boolean;

  artifactsChecked: number;
  artifactsPassed: number;
  artifactsFailed: number;

  verificationResults: TamperEvidenceResult[];

  reasons: string[];

  timestamp?: string;
}

export class HardAcceptanceGate014 {
  public static evaluateGate(): TamperEvidenceGateResult {
    const clock = new WallClock();
    const timestamp = clock.iso();
    const verificationResults: TamperEvidenceResult[] = [];
    const reasons: string[] = [];

    // --- STEP 1: Create Deterministic Artifact ---
    const baseArtifact = {
      artifactId: 'SECP:BRACKET-GATE-014',
      name: 'Titanium Aerospace Bracket',
      version: '1.0.0',
      material: {
        spec: 'Ti-6Al-4V',
        densityKgM3: 4430,
        yieldStrengthMpa: 880
      },
      geometry: {
        volumeM3: 0.00125,
        thicknessMm: 12.0
      }
    };

    // --- STEP 2: Canonicalize and Build Trusted Evidence Object ---
    const serialization = CanonicalSerializer.serialize(baseArtifact);
    const artifactCanonicalHash = crypto
      .createHash('sha256')
      .update(serialization.canonicalString, 'utf8')
      .digest('hex');

    const trustedEvidenceDraft: Partial<EngineeringEvidence> = {
      evidenceId: 'EV-GATE-014-001',
      evidenceType: 'DESIGN',
      schemaVersion: '1.0.0',
      subject: {
        identityId: 'SECP:IDENTITY:BRACKET-GATE-014',
        identityType: 'DESIGN'
      },
      artifact: {
        artifactId: 'SECP:BRACKET-GATE-014',
        artifactType: 'DESIGN_MODEL',
        canonicalHash: artifactCanonicalHash,
        version: '1.0.0'
      },
      provenance: {
        producer: {
          type: 'ENGINE',
          id: 'SECP-DESIGN-ENGINE',
          version: '2.0.0'
        }
      },
      canonicalization: {
        serializer: 'CanonicalSerializer',
        version: '1.0.0',
        canonicalHash: ''
      },
      integrity: {
        hashAlgorithm: 'SHA-256',
        canonicalHash: artifactCanonicalHash,
        integrityStatus: 'INTACT'
      },
      verification: {
        verdict: 'PASS',
        checks: [
          {
            checkId: 'CHK-001',
            name: 'CANONICAL_HASH_CHECK',
            status: 'PASS'
          }
        ]
      },
      claims: [
        {
          claimId: 'CLM-001',
          statement: 'Artifact matches design spec',
          claimType: 'INTEGRITY',
          supportedBy: ['CHK-001']
        }
      ],
      createdAt: timestamp
    };

    const evidenceHash = EngineeringEvidenceFactory.computeEvidenceHash(trustedEvidenceDraft);
    const trustedEvidenceInput: Partial<EngineeringEvidence> = {
      ...trustedEvidenceDraft,
      canonicalization: {
        serializer: 'CanonicalSerializer',
        version: '1.0.0',
        canonicalHash: evidenceHash
      }
    };

    const trustedEvidence = EngineeringEvidenceFactory.createEvidence(trustedEvidenceInput);

    // --- SCENARIO 1: Untouched Artifact Verification ---
    const resUntouched = TamperEvidenceVerifier.verifyArtifact(baseArtifact, {
      trustedEvidence
    });
    verificationResults.push(resUntouched);

    const untouchedValid =
      resUntouched.verdict === 'PASS' &&
      resUntouched.hashMatch === true &&
      resUntouched.tamperDetected === false;

    if (!untouchedValid) {
      reasons.push(`Scenario 1 failed: Expected PASS for untouched artifact, got ${resUntouched.verdict}`);
    }

    // --- SCENARIO 2: Single-Field Mutation Verification ---
    const mutatedArtifact = JSON.parse(JSON.stringify(baseArtifact));
    mutatedArtifact.material.yieldStrengthMpa = 920; // Mutated property

    const resMutated = TamperEvidenceVerifier.verifyArtifact(mutatedArtifact, {
      trustedEvidence // Verifying against ORIGINAL trusted evidence
    });
    verificationResults.push(resMutated);

    const mutatedValid =
      resMutated.verdict === 'FAIL' &&
      resMutated.hashMatch === false &&
      resMutated.tamperDetected === true;

    if (!mutatedValid) {
      reasons.push(`Scenario 2 failed: Expected FAIL with tamperDetected=true for mutated artifact, got ${resMutated.verdict}`);
    }

    // --- SCENARIO 3: Restored Artifact Re-verification ---
    const restoredArtifact = JSON.parse(JSON.stringify(mutatedArtifact));
    restoredArtifact.material.yieldStrengthMpa = 880; // Restored

    const resRestored = TamperEvidenceVerifier.verifyArtifact(restoredArtifact, {
      trustedEvidence
    });
    verificationResults.push(resRestored);

    const restoredValid =
      resRestored.verdict === 'PASS' &&
      resRestored.hashMatch === true &&
      resRestored.tamperDetected === false;

    if (!restoredValid) {
      reasons.push(`Scenario 3 failed: Expected PASS for restored artifact, got ${resRestored.verdict}`);
    }

    // --- SCENARIO 4: Missing Evidence Handling ---
    const resMissing = TamperEvidenceVerifier.verifyArtifact(baseArtifact);
    verificationResults.push(resMissing);

    const missingValid =
      resMissing.verdict === 'UNPROVEN' &&
      resMissing.tamperDetected === false &&
      resMissing.evidencePresent === false;

    if (!missingValid) {
      reasons.push(`Scenario 4 failed: Expected UNPROVEN for missing evidence, got ${resMissing.verdict}`);
    }

    // --- SCENARIO 5: Malformed Evidence Rejection ---
    const malformedEvidence = { ...trustedEvidence, schemaVersion: '9.9.9' } as any;
    const resMalformed = TamperEvidenceVerifier.verifyArtifact(baseArtifact, {
      trustedEvidence: malformedEvidence
    });
    verificationResults.push(resMalformed);

    const malformedValid =
      (resMalformed.verdict === 'INVALID' || resMalformed.verdict === 'INCONCLUSIVE') &&
      resMalformed.evidenceValid === false;

    if (!malformedValid) {
      reasons.push(`Scenario 5 failed: Expected INVALID/INCONCLUSIVE for malformed evidence, got ${resMalformed.verdict}`);
    }

    // --- SCENARIO 6: Adversarial Caller-Supplied Hash Rejection ---
    const mutatedHash = crypto
      .createHash('sha256')
      .update(CanonicalSerializer.serialize(mutatedArtifact).canonicalString)
      .digest('hex');

    const resAdversarial = TamperEvidenceVerifier.verifyArtifact(mutatedArtifact, {
      trustedExpectedHash: mutatedHash,
      isTrustedSourceVerified: false // Unauthenticated caller attempt
    });
    verificationResults.push(resAdversarial);

    const adversarialValid =
      resAdversarial.verdict === 'UNPROVEN' &&
      resAdversarial.evidencePresent === false;

    if (!adversarialValid) {
      reasons.push(`Scenario 6 failed: Expected UNPROVEN when caller supplies unauthenticated hash, got ${resAdversarial.verdict}`);
    }

    // --- AGGREGATE DECISION ---
    const allScenariosPassed =
      untouchedValid &&
      mutatedValid &&
      restoredValid &&
      missingValid &&
      malformedValid &&
      adversarialValid;

    const overallVerdict = allScenariosPassed ? 'PASS' : 'FAIL';

    const artifactsChecked = verificationResults.length;
    const artifactsPassed = verificationResults.filter(r => r.verdict === 'PASS').length;
    const artifactsFailed = verificationResults.filter(r => r.verdict === 'FAIL').length;

    const gateResult: TamperEvidenceGateResult = {
      gateId: 'PATCH-014',
      verdict: overallVerdict,
      tamperDetected: false, // Overall gate execution passed integrity validation
      artifactsChecked,
      artifactsPassed,
      artifactsFailed,
      verificationResults,
      reasons: reasons.length === 0 ? ['All tamper-evidence verification scenarios passed successfully'] : reasons,
      timestamp
    };

    // Save evidence record file
    try {
      const reportPath = path.resolve(process.cwd(), 'reports/SECP-PATCH-014-TAMPER-EVIDENCE-RECORD.json');
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, JSON.stringify(gateResult, null, 2), 'utf8');
    } catch {
      // Non-blocking report write fallback
    }

    return gateResult;
  }
}
