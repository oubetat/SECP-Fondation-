/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-012: Evidence Verification Engine Acceptance Gate
 */

import { EvidenceVerificationEngine } from './EvidenceVerificationEngine';
import { EngineeringEvidenceFactory } from './EngineeringEvidence';
import { EngineeringIdentityFactory } from '../identity/EngineeringIdentityFactory';
import { EngineeringObjectType } from '../identity/CanonicalEngineeringIdentity';

export type GateVerdict = 'PASS' | 'FAIL' | 'UNPROVEN' | 'INCONCLUSIVE';

export interface GateCheck {
  id: string;
  name: string;
  passed: boolean;
  reason: string;
}

export interface GateEvaluationResult {
  gateId: 'GATE-EVIDENCE-VERIFICATION-ENGINE';
  verdict: GateVerdict;
  timestamp: string;
  checks: readonly GateCheck[];
  findings: readonly string[];
}

export class EvidenceVerificationGate {
  public static readonly GATE_ID = 'GATE-EVIDENCE-VERIFICATION-ENGINE';

  public static evaluate(): GateEvaluationResult {
    const checks: GateCheck[] = [];
    const findings: string[] = [];

    // 1. Valid Evidence Check
    try {
      const artId = EngineeringIdentityFactory.createIdentity({ objectType: EngineeringObjectType.GEOMETRY, projectId: 'GATE-012',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {});
      const base: any = {
        evidenceId: 'EV-GATE-012',
        evidenceType: 'DESIGN',
        subject: { identityId: artId.identityId, identityType: artId.objectType },
        artifact: { artifactId: artId.identityId, artifactType: artId.objectType, canonicalHash: 'f'.repeat(64) },
        provenance: { producer: { type: 'ENGINE', id: 'GATE-E' } },
        canonicalization: { serializer: 'PATCH-009', version: '1.0.0', canonicalHash: '' },
        integrity: { hashAlgorithm: 'SHA-256', canonicalHash: '', integrityStatus: 'INTACT' },
        verification: { verdict: 'PASS', checks: [{ checkId: 'C1', name: 'X', status: 'PASS' }] },
        claims: [{ claimId: 'CL1', statement: 'X', claimType: 'IDENTITY', supportedBy: ['C1'] }],
        createdAt: new Date().toISOString()
      };
      const h = EngineeringEvidenceFactory.computeEvidenceHash(base);
      base.canonicalization.canonicalHash = h;
      base.integrity.canonicalHash = h;

      const ev = EngineeringEvidenceFactory.createEvidence(base);
      const result = EvidenceVerificationEngine.verifyEvidence(ev);

      checks.push({
        id: 'CHECK-VALID-VERIFICATION',
        name: 'Verification of valid evidence object',
        passed: result.checks.hash.status === 'PASS' && result.checks.version.status === 'PASS',
        reason: result.checks.hash.status === 'PASS' ? 'Cryptographic recomputation matches' : 'Verification failed'
      });
    } catch (e: any) {
      checks.push({ id: 'CHECK-VALID-VERIFICATION', name: 'Verification of valid evidence object', passed: false, reason: e.message });
    }

    // 2. Hash Mismatch Detection
    try {
      const artId = EngineeringIdentityFactory.createIdentity({ objectType: EngineeringObjectType.GEOMETRY, projectId: 'GATE-012-T',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {});
      const base: any = {
        evidenceId: 'EV-GATE-T',
        evidenceType: 'DESIGN',
        subject: { identityId: artId.identityId, identityType: artId.objectType },
        artifact: { artifactId: artId.identityId, artifactType: artId.objectType, canonicalHash: 'e'.repeat(64) },
        provenance: { producer: { type: 'ENGINE', id: 'GATE-E' } },
        canonicalization: { serializer: 'P9', version: '1', canonicalHash: 'fake' },
        integrity: { hashAlgorithm: 'SHA-256', canonicalHash: 'fake', integrityStatus: 'INTACT' },
        verification: { verdict: 'PASS', checks: [{ checkId: 'C1', name: 'X', status: 'PASS' }] },
        claims: [{ claimId: 'CL1', statement: 'X', claimType: 'IDENTITY', supportedBy: ['C1'] }],
        createdAt: new Date().toISOString()
      };
      const ev = EngineeringEvidenceFactory.createEvidence(base);
      const result = EvidenceVerificationEngine.verifyEvidence(ev);

      checks.push({
        id: 'CHECK-HASH-MISMATCH-DETECTION',
        name: 'Detection of recorded hash mismatch',
        passed: result.checks.hash.status === 'FAIL',
        reason: result.checks.hash.status === 'FAIL' ? 'Tamper correctly detected' : 'Tamper NOT detected'
      });
    } catch (e: any) {
       checks.push({ id: 'CHECK-HASH-MISMATCH-DETECTION', name: 'Detection of recorded hash mismatch', passed: false, reason: e.message });
    }

    // 3. UNPROVEN preservation
    try {
      const artId = EngineeringIdentityFactory.createIdentity({ objectType: EngineeringObjectType.GEOMETRY, projectId: 'GATE-012-U',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {});
      const base: any = {
        evidenceId: 'EV-GATE-U',
        evidenceType: 'DESIGN',
        subject: { identityId: artId.identityId, identityType: artId.objectType },
        artifact: { artifactId: artId.identityId, artifactType: artId.objectType, canonicalHash: 'd'.repeat(64) },
        provenance: { producer: { type: 'UNKNOWN', id: '??' } }, // UNKNOWN provenance
        canonicalization: { serializer: 'P9', version: '1', canonicalHash: '' },
        integrity: { hashAlgorithm: 'SHA-256', canonicalHash: '', integrityStatus: 'UNPROVEN' },
        verification: { verdict: 'PASS', checks: [{ checkId: 'C1', name: 'X', status: 'PASS' }] },
        claims: [{ claimId: 'CL1', statement: 'X', claimType: 'IDENTITY', supportedBy: ['C1'] }],
        createdAt: new Date().toISOString()
      };
      const h = EngineeringEvidenceFactory.computeEvidenceHash(base);
      base.canonicalization.canonicalHash = h;
      base.integrity.canonicalHash = h;
      const ev = EngineeringEvidenceFactory.createEvidence(base);
      const result = EvidenceVerificationEngine.verifyEvidence(ev);

      checks.push({
        id: 'CHECK-UNPROVEN-PRESERVATION',
        name: 'Preservation of UNPROVEN status for unknown provenance',
        passed: result.checks.origin.status === 'UNPROVEN' && result.verdict === 'UNPROVEN',
        reason: result.verdict === 'UNPROVEN' ? 'Correctly identified as unproven' : 'Incorrectly validated'
      });
    } catch (e: any) {
      checks.push({ id: 'CHECK-UNPROVEN-PRESERVATION', name: 'Preservation of UNPROVEN status for unknown provenance', passed: false, reason: e.message });
    }

    const checksPassed = checks.filter(c => c.passed).length;
    const checksFailed = checks.length - checksPassed;
    
    let verdict: GateVerdict = 'FAIL';
    if (checks.length > 0 && checksFailed === 0) {
      verdict = 'PASS';
    } else if (checks.length === 0) {
      verdict = 'UNPROVEN';
    }

    return Object.freeze({
      gateId: this.GATE_ID,
      verdict,
      timestamp: new Date().toISOString(),
      checks: Object.freeze(checks),
      findings: Object.freeze(findings)
    });
  }
}
