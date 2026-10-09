import { EnterpriseEvidenceEngine } from './EnterpriseEvidenceEngine';
import { IndependentEnterpriseEvidenceVerifier } from './IndependentEnterpriseEvidenceVerifier';
import { EvidenceProvenance, EnterpriseEvidence } from './types';

export class HardAcceptanceGate121 {
  public static evaluate(): { passed: boolean; checks: any[] } {
    const engine = new EnterpriseEvidenceEngine();
    const checks: any[] = [];

    // 1. Evidence Generation & Identity
    const evidence = engine.generateEvidence({
      evidenceType: 'REVISION_EVIDENCE',
      subjectId: 'PART-001',
      subjectType: 'PART',
      subjectVersion: 'R1',
      subjectHash: 'HASH-P1-R1',
      scope: 'REVISION',
      createdBy: 'ENGINEER-01'
    });

    checks.push({
      id: 'GATE-121-01',
      name: 'Enterprise Evidence Identity & Generation',
      passed: evidence.evidenceId.startsWith('EVID-') && evidence.status === 'GENERATED',
      details: `Generated Evidence ID: ${evidence.evidenceId}`
    });

    // 2. Deterministic Hashing
    const evidence2 = engine.generateEvidence({
      evidenceType: 'REVISION_EVIDENCE',
      subjectId: 'PART-001',
      subjectType: 'PART',
      subjectVersion: 'R1',
      subjectHash: 'HASH-P1-R1',
      scope: 'REVISION',
      createdBy: 'ENGINEER-01'
    });
    // Hashes should match for identical inputs (excluding timestamp/randomness in ID generation if not handled)
    // Actually our generateEvidence uses Date.now() for ID, but computeEvidenceHash uses specific fields
    const hash1 = evidence.evidenceHash;
    const hash2 = evidence2.evidenceHash;

    checks.push({
      id: 'GATE-121-02',
      name: 'Deterministic Evidence Hashing',
      passed: hash1 === hash2,
      details: `Hash 1: ${hash1}, Hash 2: ${hash2}`
    });

    // 3. Evidence Linking & Causality
    const changeEvidence = engine.generateEvidence({
      evidenceType: 'CHANGE_EVIDENCE',
      subjectId: 'ECO-101',
      subjectType: 'ECO',
      subjectVersion: '1.0',
      subjectHash: 'HASH-ECO-101',
      scope: 'ENTITY'
    });

    const link = engine.addLink({
      sourceEvidenceId: changeEvidence.evidenceId,
      targetEvidenceId: evidence.evidenceId,
      relationship: 'VERIFIES',
      reason: 'Change verifies initial revision'
    });

    checks.push({
      id: 'GATE-121-03',
      name: 'Evidence Linking & Causal Relationships',
      passed: link.linkId.startsWith('LNK-') && link.relationship === 'VERIFIES',
      details: `Link created: ${link.sourceEvidenceId} -> ${link.targetEvidenceId}`
    });

    // 4. Evidence Bundle & Provenance
    const provenance: EvidenceProvenance = {
      source: 'PLM-CORE',
      sourceType: 'ENGINE',
      sourceVersion: '2.0',
      generator: 'EVIDENCE-GEN',
      generatorVersion: '1.0',
      actor: 'SYSTEM',
      timestamp: new Date().toISOString(),
      inputHashes: [evidence.subjectHash, changeEvidence.subjectHash],
      outputHash: 'TO_BE_SET',
      method: 'CANONICAL_AGGREGATION',
      algorithm: 'SHA-256',
      environment: { os: 'LINUX', runtime: 'NODEJS' }
    };

    const bundle = engine.createBundle('BUNDLE-001', [evidence.evidenceId, changeEvidence.evidenceId], provenance);
    // Note: In a real scenario, outputHash would be set to a known stable value (like subjectHash)
    // before bundle creation to avoid circularity.

    checks.push({
      id: 'GATE-121-04',
      name: 'Evidence Bundle & Provenance Tracking',
      passed: bundle.bundleHash !== '' && bundle.evidenceItems.length === 2,
      details: `Bundle Hash: ${bundle.bundleHash}`
    });

    // 5. Independent Verification
    const verification = IndependentEnterpriseEvidenceVerifier.verifyBundle(bundle);
    checks.push({
      id: 'GATE-121-05',
      name: 'Independent Evidence Verifier Integrity Check',
      passed: verification.verdict === 'VALID',
      details: 'Independent verifier confirmed bundle and link integrity'
    });

    // 6. Enterprise Root Hash (Merkle-style)
    const rootHash = engine.computeRootHash();
    checks.push({
      id: 'GATE-121-06',
      name: 'Enterprise Evidence Root Hash (Merkle Aggregation)',
      passed: rootHash !== '0'.repeat(64),
      details: `Root Hash: ${rootHash}`
    });

    const passed = checks.every(c => c.passed);
    return { passed, checks };
  }
}
