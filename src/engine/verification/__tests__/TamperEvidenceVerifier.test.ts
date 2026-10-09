/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-014: Tamper-Evidence Verifier Unit & Adversarial Test Suite
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { TamperEvidenceVerifier } from '../TamperEvidenceVerifier';
import { CanonicalSerializer } from '../../serialization/CanonicalSerializer';
import { EngineeringEvidenceFactory } from '../../evidence/EngineeringEvidence';
import { EngineeringEvidence } from '../../evidence/EngineeringEvidenceTypes';
import { HardAcceptanceGate014 } from '../../validation/HardAcceptanceGate014';
import { ProvenanceGraphBuilder } from '../../provenance/ProvenanceGraphBuilder';

describe('PATCH-014 — Tamper-Evidence Verifier & Gate Test Suite', () => {
  function createSampleArtifact() {
    return {
      artifactId: 'SECP:GEOMETRY:BRACKET-001',
      name: 'Structural Support Bracket',
      version: '1.0.0',
      material: {
        type: 'ALUMINUM-7075-T6',
        densityKgM3: 2810,
        elasticModulusGpa: 71.7
      },
      dimensions: {
        widthMm: 100,
        heightMm: 150,
        thicknessMm: 10
      }
    };
  }

  function createEvidenceForArtifact(artifact: any): EngineeringEvidence {
    const serialization = CanonicalSerializer.serialize(artifact);
    const hash = crypto
      .createHash('sha256')
      .update(serialization.canonicalString, 'utf8')
      .digest('hex');

    const draft: Partial<EngineeringEvidence> = {
      evidenceId: `EV-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      evidenceType: 'DESIGN',
      schemaVersion: '1.0.0',
      subject: {
        identityId: 'SECP:IDENTITY:BRACKET-001',
        identityType: 'DESIGN'
      },
      artifact: {
        artifactId: artifact.artifactId || 'SECP:GEOMETRY:BRACKET-001',
        artifactType: 'GEOMETRY',
        canonicalHash: hash,
        version: '1.0.0'
      },
      provenance: {
        producer: {
          type: 'ENGINE',
          id: 'SECP-CAD-ENGINE'
        }
      },
      canonicalization: {
        serializer: 'CanonicalSerializer',
        version: '1.0.0',
        canonicalHash: ''
      },
      integrity: {
        hashAlgorithm: 'SHA-256',
        canonicalHash: hash,
        integrityStatus: 'INTACT'
      },
      verification: {
        verdict: 'PASS',
        checks: [
          {
            checkId: 'CHK-001',
            name: 'CANONICAL_HASH_VERIFICATION',
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
      createdAt: new Date().toISOString()
    };

    const evidenceHash = EngineeringEvidenceFactory.computeEvidenceHash(draft);
    return EngineeringEvidenceFactory.createEvidence({
      ...draft,
      canonicalization: {
        serializer: 'CanonicalSerializer',
        version: '1.0.0',
        canonicalHash: evidenceHash
      }
    });
  }

  it('TEST-01: Untouched artifact evaluates to PASS with tamperDetected = false', () => {
    const artifact = createSampleArtifact();
    const evidence = createEvidenceForArtifact(artifact);

    const result = TamperEvidenceVerifier.verifyArtifact(artifact, {
      trustedEvidence: evidence
    });

    expect(result.verdict).toBe('PASS');
    expect(result.hashMatch).toBe(true);
    expect(result.evidencePresent).toBe(true);
    expect(result.evidenceValid).toBe(true);
    expect(result.tamperDetected).toBe(false);
    expect(result.reasons.some(r => r.includes('matches trusted expected hash'))).toBe(true);
  });

  it('TEST-02: Single-field canonical mutation is detected as FAIL with tamperDetected = true', () => {
    const artifact = createSampleArtifact();
    const evidence = createEvidenceForArtifact(artifact);

    // Mutate a single canonical field
    const mutatedArtifact = JSON.parse(JSON.stringify(artifact));
    mutatedArtifact.dimensions.thicknessMm = 12; // 10 -> 12

    const result = TamperEvidenceVerifier.verifyArtifact(mutatedArtifact, {
      trustedEvidence: evidence
    });

    expect(result.verdict).toBe('FAIL');
    expect(result.hashMatch).toBe(false);
    expect(result.tamperDetected).toBe(true);
    expect(result.actualHash).not.toBe(result.expectedHash);
    expect(result.reasons.some(r => r.includes('Tamper Detected'))).toBe(true);
  });

  it('TEST-03: Multiple-field mutation is detected as FAIL with tamperDetected = true', () => {
    const artifact = createSampleArtifact();
    const evidence = createEvidenceForArtifact(artifact);

    // Mutate multiple canonical fields
    const mutatedArtifact = JSON.parse(JSON.stringify(artifact));
    mutatedArtifact.material.type = 'ALUMINUM-6061-T6';
    mutatedArtifact.dimensions.heightMm = 200;

    const result = TamperEvidenceVerifier.verifyArtifact(mutatedArtifact, {
      trustedEvidence: evidence
    });

    expect(result.verdict).toBe('FAIL');
    expect(result.hashMatch).toBe(false);
    expect(result.tamperDetected).toBe(true);
  });

  it('TEST-04: Restoring original artifact clears tamper state and returns PASS', () => {
    const artifact = createSampleArtifact();
    const evidence = createEvidenceForArtifact(artifact);

    // 1. Mutate
    const mutatedArtifact = JSON.parse(JSON.stringify(artifact));
    mutatedArtifact.dimensions.widthMm = 999;
    const resMutated = TamperEvidenceVerifier.verifyArtifact(mutatedArtifact, { trustedEvidence: evidence });
    expect(resMutated.tamperDetected).toBe(true);
    expect(resMutated.verdict).toBe('FAIL');

    // 2. Restore exactly
    const restoredArtifact = JSON.parse(JSON.stringify(mutatedArtifact));
    restoredArtifact.dimensions.widthMm = 100;
    const resRestored = TamperEvidenceVerifier.verifyArtifact(restoredArtifact, { trustedEvidence: evidence });
    expect(resRestored.tamperDetected).toBe(false);
    expect(resRestored.verdict).toBe('PASS');
  });

  it('TEST-05: Missing trusted evidence returns UNPROVEN (NOT PASS, NOT tamperDetected)', () => {
    const artifact = createSampleArtifact();

    const result = TamperEvidenceVerifier.verifyArtifact(artifact); // No trusted evidence supplied

    expect(result.verdict).toBe('UNPROVEN');
    expect(result.evidencePresent).toBe(false);
    expect(result.tamperDetected).toBe(false);
    expect(result.reasons.some(r => r.includes('unavailable'))).toBe(true);
  });

  it('TEST-06: Malformed evidence returns INVALID / INCONCLUSIVE according to PATCH-012', () => {
    const artifact = createSampleArtifact();
    const validEvidence = createEvidenceForArtifact(artifact);

    // Create malformed evidence violating schema version
    const malformedEvidence = {
      ...validEvidence,
      schemaVersion: '99.0.0'
    } as any;

    const result = TamperEvidenceVerifier.verifyArtifact(artifact, {
      trustedEvidence: malformedEvidence
    });

    expect(result.verdict === 'INVALID' || result.verdict === 'INCONCLUSIVE').toBe(true);
    expect(result.evidenceValid).toBe(false);
    expect(result.tamperDetected).toBe(false);
  });

  it('TEST-07: Mutation behavior follows canonicalization contract (undefined properties omitted vs unsupported functions rejected)', () => {
    const artifact = createSampleArtifact();
    const evidence = createEvidenceForArtifact(artifact);

    // 1. Adding an undefined property (omitted by canonical serializer per contract)
    const artifactWithUndefined = {
      ...artifact,
      optionalNote: undefined
    };

    const resUndefined = TamperEvidenceVerifier.verifyArtifact(artifactWithUndefined, {
      trustedEvidence: evidence
    });

    // The canonical hash is unchanged because undefined object properties are omitted per canonical serializer contract
    expect(resUndefined.verdict).toBe('PASS');
    expect(resUndefined.hashMatch).toBe(true);

    // 2. Adding an unsupported function property (rejected by canonical serializer per contract)
    const artifactWithFunction = {
      ...artifact,
      computeMass: function () {
        return 123;
      }
    };

    const resFunction = TamperEvidenceVerifier.verifyArtifact(artifactWithFunction, {
      trustedEvidence: evidence
    });

    // Throws UnsupportedTypeError during canonical serialization -> INVALID
    expect(resFunction.verdict).toBe('INVALID');
    expect(resFunction.evidenceValid).toBe(false);
  });

  it('TEST-08: Hash recomputation is independent from stored expected hash', () => {
    const artifact = createSampleArtifact();
    const evidence = createEvidenceForArtifact(artifact);

    // Mutate the artifact, but do NOT update evidence
    const mutatedArtifact = { ...artifact, version: '1.0.1' };

    const result = TamperEvidenceVerifier.verifyArtifact(mutatedArtifact, {
      trustedEvidence: evidence
    });

    // Hash recomputation re-runs CanonicalSerializer on mutatedArtifact directly
    const recomputedString = CanonicalSerializer.serialize(mutatedArtifact).canonicalString;
    const expectedRecomputedHash = crypto.createHash('sha256').update(recomputedString).digest('hex');

    expect(result.actualHash).toBe(expectedRecomputedHash);
    expect(result.actualHash).not.toBe(evidence.artifact.canonicalHash);
    expect(result.tamperDetected).toBe(true);
  });

  it('TEST-09: HardAcceptanceGate014 does not import from *.test.ts or __tests__ files', () => {
    const gateFilePath = path.resolve(process.cwd(), 'src/engine/validation/HardAcceptanceGate014.ts');
    const content = fs.readFileSync(gateFilePath, 'utf8');

    expect(content).not.toMatch(/from\s+['"].*\.test['"]/);
    expect(content).not.toMatch(/from\s+['"].*__tests__['"]/);
  });

  it('TEST-10: HardAcceptanceGate014 evaluates dynamic scenarios without hardcoded PASS', () => {
    const gateFilePath = path.resolve(process.cwd(), 'src/engine/validation/HardAcceptanceGate014.ts');
    const content = fs.readFileSync(gateFilePath, 'utf8');

    // Must execute TamperEvidenceVerifier and compute verdict dynamically
    expect(content).toContain('TamperEvidenceVerifier.verifyArtifact');
    expect(content).toContain('allScenariosPassed');

    // Run the gate itself and check real execution output
    const gateResult = HardAcceptanceGate014.evaluateGate();
    expect(gateResult.gateId).toBe('PATCH-014');
    expect(gateResult.verdict).toBe('PASS');
    expect(gateResult.artifactsChecked).toBeGreaterThanOrEqual(6);
  });

  it('ADVERSARIAL TEST: Refuses caller-supplied hash when not authenticated by trusted evidence source', () => {
    const artifact = createSampleArtifact();
    const mutatedArtifact = { ...artifact, name: 'Forged Support Bracket' };

    // Attacker manually computes mutated artifact hash and supplies it as expected hash
    const attackerHash = crypto
      .createHash('sha256')
      .update(CanonicalSerializer.serialize(mutatedArtifact).canonicalString)
      .digest('hex');

    // Attempt verification by supplying unauthenticated expected hash without evidence object
    const result = TamperEvidenceVerifier.verifyArtifact(mutatedArtifact, {
      trustedExpectedHash: attackerHash,
      isTrustedSourceVerified: false // Unauthenticated
    });

    // Must NOT accept caller-supplied unauthenticated expected hash
    expect(result.verdict).toBe('UNPROVEN');
    expect(result.evidencePresent).toBe(false);
    expect(result.reasons.some(r => r.includes('Unauthenticated caller-supplied hash rejected'))).toBe(true);
  });

  it('INTEGRATION TEST: Verifies artifact with both Evidence and Provenance Graph linkage', () => {
    const artifact = createSampleArtifact();
    const evidence = createEvidenceForArtifact(artifact);

    // Build Provenance Graph containing artifact node
    const builder = new ProvenanceGraphBuilder();
    builder.addNode({
      type: 'GEOMETRY',
      engineeringIdentityId: 'SECP:IDENTITY:BRACKET-001',
      canonicalHash: evidence.artifact.canonicalHash,
      version: '1.0.0'
    });
    const provenanceGraph = builder.build();

    const result = TamperEvidenceVerifier.verifyArtifact(artifact, {
      trustedEvidence: evidence,
      provenanceGraph
    });

    expect(result.verdict).toBe('PASS');
    expect(result.provenancePresent).toBe(true);
    expect(result.provenanceValid).toBe(true);
  });
});
