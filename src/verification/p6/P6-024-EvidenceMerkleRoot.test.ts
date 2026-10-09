import { describe, it, expect } from 'vitest';
import { EvidenceIntegrityEngine } from '../../engine/evidence/integrity/EvidenceIntegrityEngine';

describe('P6-024 — EVIDENCE MERKLE ROOT', () => {
  it('P6-024-A — Global Merkle root represents cumulative proof state', () => {
    const verification = EvidenceIntegrityEngine.verifyDeterministicHash();
    expect(verification.valid).toBe(true);
    expect(verification.expectedMerkleRoot).toBeDefined();
    expect(verification.expectedMerkleRoot).toContain('SHA256:');
  });
});
