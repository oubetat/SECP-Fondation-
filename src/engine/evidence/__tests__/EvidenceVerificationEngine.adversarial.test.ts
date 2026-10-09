/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-012: Evidence Verification Engine Adversarial Tests
 */

import { describe, it, expect } from 'vitest';
import { EngineeringEvidenceFactory } from '../EngineeringEvidence';
import { EngineeringIdentityFactory } from '../../identity/EngineeringIdentityFactory';
import { EngineeringObjectType } from '../../identity/CanonicalEngineeringIdentity';
import { EvidenceVerificationEngine } from '../EvidenceVerificationEngine';
import * as crypto from 'crypto';
import { CanonicalSerializer } from '../../serialization/CanonicalSerializer';

describe('PATCH-012 — Evidence Verification Engine Adversarial Tests', () => {

  const createValidEvidence = (id: string) => {
    const artId = EngineeringIdentityFactory.createIdentity({ objectType: EngineeringObjectType.GEOMETRY,
      projectId: `ADV-${id}`,
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {});

    const base: any = {
      evidenceId: `EV-ADV-${id}`,
      evidenceType: 'DESIGN',
      subject: { identityId: artId.identityId, identityType: artId.objectType },
      artifact: { artifactId: artId.identityId, artifactType: artId.objectType, canonicalHash: 'b'.repeat(64) },
      provenance: { producer: { type: 'ENGINE', id: 'ADV-E' } },
      canonicalization: { serializer: 'PATCH-009', version: '1.0.0', canonicalHash: '' },
      integrity: { hashAlgorithm: 'SHA-256', canonicalHash: '', integrityStatus: 'INTACT' },
      verification: { verdict: 'PASS', checks: [{ checkId: 'C1', name: 'X', status: 'PASS' }] },
      claims: [{ claimId: 'CL1', statement: 'X', claimType: 'IDENTITY', supportedBy: ['C1'] }],
      createdAt: '2026-08-18T08:00:00Z'
    };

    const h = EngineeringEvidenceFactory.computeEvidenceHash(base);
    base.canonicalization.canonicalHash = h;
    base.integrity.canonicalHash = h;

    return EngineeringEvidenceFactory.createEvidence(base);
  };

  it('ADVERSARIAL A: Payload changed but hash unchanged (detected by verifier)', () => {
    const ev = createValidEvidence('A');
    // Change payload without updating recorded hash
    const tampered = { ...ev, evidenceType: 'SIMULATION' as any };
    const result = EvidenceVerificationEngine.verifyEvidence(tampered);
    
    expect(result.verdict).toBe('FAIL');
    expect(result.checks.hash.status).toBe('FAIL');
  });

  it('ADVERSARIAL B: Payload changed and hash regenerated but signature (if it existed) unchanged', () => {
    // If we had signatures, this would be the classic "re-hash" attack where signature is still for old hash
    const ev = createValidEvidence('B');
    const tampered: any = { ...ev, evidenceType: 'SIMULATION' as any };
    
    // Regenerate hash for tampered payload
    const newHash = EngineeringEvidenceFactory.computeEvidenceHash(tampered);
    tampered.canonicalization = { ...tampered.canonicalization, canonicalHash: newHash };
    tampered.integrity = { ...tampered.integrity, canonicalHash: newHash };
    
    // Add a fake signature (which was valid for the OLD payload/hash)
    tampered.signature = {
      signature: 'valid-sig-for-old-hash',
      algorithm: 'RSA-SHA256',
      publicKeyId: 'K1',
      signedAt: '2026-01-01T00:00:00Z'
    };
    
    const result = EvidenceVerificationEngine.verifyEvidence(tampered);
    
    // Hash check will pass because we regenerated it!
    expect(result.checks.hash.status).toBe('PASS');
    
    // Signature check should be UNPROVEN (as per current implementation)
    // but in a real system it would FAIL because it's for the old hash.
    expect(result.checks.signature.status).toBe('UNPROVEN');
  });

  it('ADVERSARIAL F: Dependency changed (hash mismatch detected)', () => {
    const ev = createValidEvidence('F');
    const evWithDeps: any = {
      ...ev,
      canonicalization: { ...ev.canonicalization },
      integrity: { ...ev.integrity },
      inputs: [
        { dependencyId: 'D1', artifactId: 'A1', artifactType: 'T1', canonicalHash: 'h1'.repeat(32), required: true }
      ]
    };
    const h1 = EngineeringEvidenceFactory.computeEvidenceHash(evWithDeps);
    evWithDeps.canonicalization.canonicalHash = h1;
    evWithDeps.integrity.canonicalHash = h1;
    const evValid = EngineeringEvidenceFactory.createEvidence(evWithDeps);

    // Tamper with dependency hash
    const tampered = {
      ...evValid,
      inputs: [{ ...evValid.inputs![0], canonicalHash: 'h2'.repeat(32) }]
    };
    
    const result = EvidenceVerificationEngine.verifyEvidence(tampered);
    expect(result.verdict).toBe('FAIL');
    expect(result.checks.hash.status).toBe('FAIL'); // Because inputs are part of payload
  });
});
