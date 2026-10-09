/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-012: Evidence Verification Engine Tests
 */

import { describe, it, expect } from 'vitest';
import { EngineeringEvidenceFactory } from '../EngineeringEvidence';
import { EngineeringIdentityFactory } from '../../identity/EngineeringIdentityFactory';
import { EngineeringObjectType } from '../../identity/CanonicalEngineeringIdentity';
import { EvidenceVerificationEngine } from '../EvidenceVerificationEngine';
import { EngineeringEvidence } from '../EngineeringEvidenceTypes';

describe('PATCH-012 — Evidence Verification Engine Tests', () => {

  const createValidEvidenceBase = (id: string) => {
    const artId = EngineeringIdentityFactory.createIdentity({ objectType: EngineeringObjectType.GEOMETRY,
      projectId: `ART-${id}`,
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {});

    const base: any = {
      evidenceId: `EV-${id}`,
      evidenceType: 'DESIGN',
      subject: { identityId: artId.identityId, identityType: artId.objectType },
      artifact: { artifactId: artId.identityId, artifactType: artId.objectType, canonicalHash: 'a'.repeat(64) },
      provenance: { producer: { type: 'ENGINE', id: 'TEST-ENGINE' } },
      canonicalization: { serializer: 'PATCH-009', version: '1.0.0', canonicalHash: '' },
      integrity: { hashAlgorithm: 'SHA-256', canonicalHash: '', integrityStatus: 'INTACT' },
      verification: { verdict: 'PASS', checks: [{ checkId: 'C1', name: 'X', status: 'PASS' }] },
      claims: [{ claimId: 'CL1', statement: 'X', claimType: 'IDENTITY', supportedBy: ['C1'] }],
      createdAt: '2026-08-18T08:00:00Z'
    };

    const h = EngineeringEvidenceFactory.computeEvidenceHash(base);
    base.canonicalization.canonicalHash = h;
    base.integrity.canonicalHash = h;

    return base;
  };

  it('TEST 1: Fully valid evidence producing PASS (if all available checks pass)', () => {
    // Note: Signature and Origin are UNPROVEN currently as per engine logic,
    // so aggregate will be UNPROVEN.
    const base = createValidEvidenceBase('V1');
    const ev = EngineeringEvidenceFactory.createEvidence(base);
    const result = EvidenceVerificationEngine.verifyEvidence(ev);
    
    expect(result.checks.hash.status).toBe('PASS');
    expect(result.checks.version.status).toBe('PASS');
    expect(result.checks.timestamp.status).toBe('PASS');
  });

  it('TEST 2: Modified payload produces hash FAIL', () => {
    const base = createValidEvidenceBase('V2');
    const ev = EngineeringEvidenceFactory.createEvidence(base);
    
    // Tamper with payload (evidenceType)
    const tampered = { ...ev, evidenceType: 'SIMULATION' as any };
    const result = EvidenceVerificationEngine.verifyEvidence(tampered);
    
    expect(result.verdict).toBe('FAIL');
    expect(result.checks.hash.status).toBe('FAIL');
    expect(result.checks.hash.reason).toContain('Evidence integrity hash mismatch');
  });

  it('TEST 3: Modified recorded hash produces hash FAIL', () => {
    const base = createValidEvidenceBase('V3');
    const ev = EngineeringEvidenceFactory.createEvidence(base);
    
    // Tamper with recorded hash
    const tampered = { 
      ...ev, 
      canonicalization: { ...ev.canonicalization, canonicalHash: 'c'.repeat(64) } 
    };
    const result = EvidenceVerificationEngine.verifyEvidence(tampered);
    
    expect(result.verdict).toBe('FAIL');
    expect(result.checks.hash.status).toBe('FAIL');
  });

  it('TEST 10: Incompatible version produces version FAIL', () => {
    const base = createValidEvidenceBase('V10');
    const ev = EngineeringEvidenceFactory.createEvidence(base);
    
    const tampered = { ...ev, schemaVersion: '9.9.9' };
    const result = EvidenceVerificationEngine.verifyEvidence(tampered);
    
    expect(result.checks.version.status).toBe('FAIL');
    expect(result.checks.version.reason).toContain('Unsupported schema version');
  });

  it('TEST 13: Malformed timestamp produces timestamp INVALID', () => {
    const base = createValidEvidenceBase('V13');
    const ev = EngineeringEvidenceFactory.createEvidence(base);
    
    const tampered = { ...ev, createdAt: 'garbage' };
    const result = EvidenceVerificationEngine.verifyEvidence(tampered);
    
    expect(result.checks.timestamp.status).toBe('INVALID');
    expect(result.verdict).toBe('INVALID');
  });

  it('TEST 18: Dependency cycle detected produces dependency FAIL', () => {
    const base = createValidEvidenceBase('V18');
    base.inputs = [
      { dependencyId: 'D1', artifactId: base.artifact.artifactId, artifactType: base.artifact.artifactType, canonicalHash: base.artifact.canonicalHash, required: true }
    ];
    
    // Re-hash
    const h = EngineeringEvidenceFactory.computeEvidenceHash(base);
    base.canonicalization.canonicalHash = h;
    base.integrity.canonicalHash = h;
    
    const ev = EngineeringEvidenceFactory.createEvidence(base);
    const result = EvidenceVerificationEngine.verifyEvidence(ev);
    
    expect(result.checks.dependencies.status).toBe('FAIL');
    expect(result.checks.dependencies.reason).toContain('DEPENDENCY_CYCLE_DETECTED');
  });

  it('TEST 23: Deterministic verification producing the same result for same input', () => {
    const base = createValidEvidenceBase('V23');
    const ev = EngineeringEvidenceFactory.createEvidence(base);
    
    const r1 = EvidenceVerificationEngine.verifyEvidence(ev);
    const r2 = EvidenceVerificationEngine.verifyEvidence(ev);
    
    // verifiedAt might change if not using DeterministicClock, but verdict and checks should match
    expect(r1.verdict).toBe(r2.verdict);
    expect(JSON.stringify(r1.checks)).toBe(JSON.stringify(r2.checks));
  });
});
