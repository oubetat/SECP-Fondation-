/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-073: Forensic CFD Evidence Framework Tests
 */

import { describe, it, expect } from 'vitest';
import { ForensicCFDEvidenceEngine } from '../ForensicCFDEvidenceEngine';
import { MerkleEvidenceTree } from '../MerkleEvidenceTree';
import { HardAcceptanceGate073 } from '../HardAcceptanceGate073';

describe('PATCH-073: Forensic CFD Evidence Framework Tests', () => {
  it('1. Artifact Registration & Canonical Hashing', () => {
    const engine = new ForensicCFDEvidenceEngine();
    const art = engine.registry.registerArtifact({
      type: 'MESH',
      pathOrRef: 'case/mesh/mesh.fvm',
      payload: { cellCount: 1000, skewness: 0.1 },
      producer: 'SECP-Mesh-Core',
      producerVersion: '2.0.0'
    });

    expect(art.hash).toBeDefined();
    expect(art.hash.length).toBe(64);
    expect(engine.registry.verifyArtifactIntegrity(art.artifactId)).toBe(true);
  });

  it('2. Chain of Custody & Snapshots', () => {
    const engine = new ForensicCFDEvidenceEngine();
    engine.custody.appendCustodyEvent({
      evidenceId: 'ev-01',
      actor: 'Auditor-01',
      action: 'CAPTURED',
      source: 'sim/output',
      destination: 'vault/custody',
      reason: 'Initial capture',
      authorization: 'AUTH-1',
      resultingArtifactId: 'art-01',
      payloadHash: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    });

    const verify = engine.custody.verifyCustodyChain();
    expect(verify.isValid).toBe(true);
  });

  it('3. Merkle Tree & Inclusion Proof Verification', () => {
    const leaves = [
      'hash111111111111111111111111111111111111111111111111111111111111',
      'hash222222222222222222222222222222222222222222222222222222222222',
      'hash333333333333333333333333333333333333333333333333333333333333'
    ];
    const tree = new MerkleEvidenceTree(leaves);
    const proof = tree.generateInclusionProof(leaves[1]);
    expect(proof).toBeDefined();
    if (proof) {
      expect(MerkleEvidenceTree.verifyProof(proof)).toBe(true);
    }
  });

  it('4. Hard Acceptance Gate 073 Evaluation', async () => {
    const res = await HardAcceptanceGate073.evaluate();
    expect(res.passed).toBe(true);
    expect(res.patch).toBe('PATCH-073');
  });
});
