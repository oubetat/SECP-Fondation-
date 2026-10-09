/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-073: Forensic CFD Evidence Adversarial Battery
 */

import { describe, it, expect } from 'vitest';
import { ForensicCFDEvidenceEngine } from '../ForensicCFDEvidenceEngine';
import { ForensicTimeline } from '../ForensicTimeline';
import { ChainOfCustodyEngine } from '../ChainOfCustodyEngine';
import { MerkleEvidenceTree } from '../MerkleEvidenceTree';

describe('PATCH-073: Forensic CFD Evidence Adversarial Battery', () => {
  it('1. Artifact tampering detection', () => {
    const engine = new ForensicCFDEvidenceEngine();
    const art = engine.registry.registerArtifact({
      type: 'RESIDUALS',
      pathOrRef: 'case/residuals.json',
      payload: { finalResidual: 1e-6 },
      producer: 'Solver',
      producerVersion: '2.0'
    });

    // Mutate internal payload directly (tampering)
    (art as any).payload = { finalResidual: 1e-3 };

    expect(engine.registry.verifyArtifactIntegrity(art.artifactId)).toBe(false);
  });

  it('2. Broken custody chain detection', () => {
    const custody = new ChainOfCustodyEngine();
    custody.appendCustodyEvent({
      evidenceId: 'ev-1',
      actor: 'UserA',
      action: 'CAPTURED',
      source: 'sim',
      destination: 'vault',
      reason: 'init',
      authorization: 'A1',
      resultingArtifactId: 'art-1',
      payloadHash: 'hash1'
    });

    const event2 = custody.appendCustodyEvent({
      evidenceId: 'ev-2',
      actor: 'UserB',
      action: 'ANALYZED',
      source: 'vault',
      destination: 'vault2',
      reason: 'check',
      authorization: 'A2',
      resultingArtifactId: 'art-2',
      payloadHash: 'hash2'
    });

    // Tamper with previousHash in event2
    (event2 as any).previousHash = 'tampered_previous_hash_000000000000000000000000000000000000';

    const check = custody.verifyCustodyChain();
    expect(check.isValid).toBe(false);
    expect(check.brokenAtEventId).toBe(event2.custodyEventId);
  });

  it('3. Timeline anomaly & time-reversal detection', () => {
    const timeline = new ForensicTimeline();
    timeline.recordEvent('SOLVER_COMPLETED', 'run-01', '2026-08-20T01:00:00.000Z');
    // Time reversal: started event logged with earlier timestamp than completed, but recorded after in sequence
    timeline.recordEvent('SOLVER_STARTED', 'run-01', '2026-08-20T00:30:00.000Z');

    const audit = timeline.auditTimeline();
    expect(audit.isConsistent).toBe(false);
    expect(audit.anomalies.some(a => a.includes('TIME_REVERSAL'))).toBe(true);
  });

  it('4. Cross-check contradiction detection (fatal log vs CONVERGED)', () => {
    const engine = new ForensicCFDEvidenceEngine();
    const crossCheck = engine.performCrossChecks({
      rawLog: 'FATAL: SIGSEGV floating point exception NaN detected at iter 42',
      parsedStatus: 'CONVERGED',
      rawResidual: 1e-6,
      reportedResidual: 1e-6,
      meshCellCount: 100,
      fieldLength: 100
    });

    expect(crossCheck.isConsistent).toBe(false);
    expect(crossCheck.discrepancies.some(d => d.includes('LOG_CONVERGENCE_CONTRADICTION'))).toBe(true);
  });

  it('5. Merkle Signature verification failure on altered root', () => {
    const root = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const sig = MerkleEvidenceTree.signRoot(root, 'Auditor-Key', 'KEY-01');

    const tamperedRoot = '9999999999abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const verified = MerkleEvidenceTree.verifySignature(sig, tamperedRoot);
    expect(verified).toBe(false);
  });
});
