/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-011: Engineering Evidence Adversarial Tests
 */

import { describe, it, expect } from 'vitest';
import { EngineeringEvidenceFactory } from '../EngineeringEvidence';
import { EngineeringIdentityFactory } from '../../identity/EngineeringIdentityFactory';
import { EngineeringObjectType } from '../../identity/CanonicalEngineeringIdentity';
import { CanonicalSerializer } from '../../serialization/CanonicalSerializer';
import * as crypto from 'crypto';

describe('PATCH-011 — Engineering Evidence Adversarial Tests', () => {

  const createValidEvidence = (id: string) => {
    const designId = EngineeringIdentityFactory.createIdentity({ objectType: EngineeringObjectType.GEOMETRY,
      projectId: `ADV-${id}`,
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {});

    const base: any = {
      evidenceId: `EV-ADV-${id}`,
      evidenceType: 'DESIGN',
      subject: { identityId: designId.identityId, identityType: designId.objectType },
      artifact: { artifactId: designId.identityId, artifactType: designId.objectType, canonicalHash: 'b'.repeat(64) },
      provenance: { producer: { type: 'ENGINE', id: 'ADV-E' } },
      canonicalization: { serializer: 'P9', version: '1', canonicalHash: '' },
      integrity: { hashAlgorithm: 'SHA256', canonicalHash: '', integrityStatus: 'INTACT' },
      verification: { verdict: 'PASS', checks: [{ checkId: 'C1', name: 'X', status: 'PASS' }] },
      claims: [{ claimId: 'CL1', statement: 'X', claimType: 'IDENTITY', supportedBy: ['C1'] }],
      createdAt: '2026-08-18T08:00:00Z'
    };

    const h = EngineeringEvidenceFactory.computeEvidenceHash(base);
    base.canonicalization.canonicalHash = h;
    base.integrity.canonicalHash = h;

    return EngineeringEvidenceFactory.createEvidence(base);
  };

  it('ADVERSARIAL A: Change one character in artifact hash', () => {
    const ev = createValidEvidence('A');
    const tampered = { 
      ...ev, 
      artifact: { ...ev.artifact, canonicalHash: ev.artifact.canonicalHash.replace('b', 'c') } 
    };
    const verif = EngineeringEvidenceFactory.verifyEngineeringEvidence(tampered);
    expect(verif.valid).toBe(false);
    expect(verif.errors).toContain('Evidence integrity hash mismatch');
  });

  it('ADVERSARIAL B: Change evidence type', () => {
    const ev = createValidEvidence('B');
    const tampered = { ...ev, evidenceType: 'SIMULATION' as any };
    const verif = EngineeringEvidenceFactory.verifyEngineeringEvidence(tampered);
    expect(verif.valid).toBe(false);
    expect(verif.errors).toContain('Evidence integrity hash mismatch');
  });

  it('ADVERSARIAL G: Replace verification verdict', () => {
    const ev = createValidEvidence('G');
    const tampered = { ...ev, verification: { ...ev.verification, verdict: 'FAIL' as any } };
    const verif = EngineeringEvidenceFactory.verifyEngineeringEvidence(tampered);
    expect(verif.valid).toBe(false);
    expect(verif.errors).toContain('Evidence integrity hash mismatch');
  });

  it('ADVERSARIAL I: Replace external producer with SECP producer (type change)', () => {
    const ev = createValidEvidence('I');
    const tampered = { ...ev, provenance: { ...ev.provenance, producer: { ...ev.provenance.producer, type: 'VERIFIER' as any } } };
    const verif = EngineeringEvidenceFactory.verifyEngineeringEvidence(tampered);
    expect(verif.valid).toBe(false);
    expect(verif.errors).toContain('Evidence integrity hash mismatch');
  });

  it('ADVERSARIAL K: Reorder dependency entries (if they existed)', () => {
    // Our implementation uses CanonicalSerializer which sorts keys and handles arrays.
    // If we reorder an array in the object, the canonical string will reflect the new order,
    // and thus the hash will change.
    const ev = createValidEvidence('K');
    const evWithDeps: any = {
      ...ev,
      canonicalization: { ...ev.canonicalization },
      integrity: { ...ev.integrity },
      inputs: [
        { dependencyId: 'D1', artifactId: 'A1', artifactType: 'T1', canonicalHash: 'h1', required: true },
        { dependencyId: 'D2', artifactId: 'A2', artifactType: 'T2', canonicalHash: 'h2', required: true }
      ]
    };
    // Re-hash to make it valid first
    const h1 = EngineeringEvidenceFactory.computeEvidenceHash(evWithDeps);
    evWithDeps.canonicalization.canonicalHash = h1;
    evWithDeps.integrity.canonicalHash = h1;
    const evValid = EngineeringEvidenceFactory.createEvidence(evWithDeps);

    // Tamper by reordering
    const tampered = {
      ...evValid,
      inputs: [evValid.inputs![1], evValid.inputs![0]]
    };
    const verif = EngineeringEvidenceFactory.verifyEngineeringEvidence(tampered);
    expect(verif.valid).toBe(false);
    expect(verif.errors).toContain('Evidence integrity hash mismatch');
  });
});
