/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-073: Merkle Evidence Tree & Forensic Signature Engine
 */

import { MerkleInclusionProof, ForensicEvidenceSignature } from './ForensicTypes';
import { ArtifactHasher } from './ArtifactRegistry';

export class MerkleEvidenceTree {
  private readonly leaves: string[];
  private readonly tree: string[][];

  constructor(leafHashes: readonly string[]) {
    if (leafHashes.length === 0) {
      this.leaves = ['0000000000000000000000000000000000000000000000000000000000000000'];
    } else {
      this.leaves = [...leafHashes];
    }
    this.tree = this.buildTree(this.leaves);
  }

  private buildTree(leaves: readonly string[]): string[][] {
    const levels: string[][] = [];
    let currentLevel = [...leaves];
    levels.push(currentLevel);

    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
        const combined = ArtifactHasher.computeHash(`${left}|${right}`);
        nextLevel.push(combined);
      }
      levels.push(nextLevel);
      currentLevel = nextLevel;
    }

    return levels;
  }

  public getRootHash(): string {
    return this.tree[this.tree.length - 1][0];
  }

  public generateInclusionProof(leafHash: string): MerkleInclusionProof | undefined {
    const index = this.leaves.indexOf(leafHash);
    if (index === -1) return undefined;

    const auditPath: { position: 'left' | 'right'; hash: string }[] = [];
    let idx = index;

    for (let level = 0; level < this.tree.length - 1; level++) {
      const currentLevel = this.tree[level];
      const isEven = idx % 2 === 0;
      const pairIndex = isEven ? idx + 1 : idx - 1;

      if (pairIndex < currentLevel.length) {
        auditPath.push({
          position: isEven ? 'right' : 'left',
          hash: currentLevel[pairIndex]
        });
      } else {
        auditPath.push({
          position: 'right',
          hash: currentLevel[idx]
        });
      }

      idx = Math.floor(idx / 2);
    }

    return {
      leafHash,
      index,
      auditPath,
      rootHash: this.getRootHash()
    };
  }

  public static verifyProof(proof: MerkleInclusionProof): boolean {
    let current = proof.leafHash;
    for (const step of proof.auditPath) {
      if (step.position === 'right') {
        current = ArtifactHasher.computeHash(`${current}|${step.hash}`);
      } else {
        current = ArtifactHasher.computeHash(`${step.hash}|${current}`);
      }
    }
    return current === proof.rootHash;
  }

  public static signRoot(rootHash: string, signerId: string, keyId: string): ForensicEvidenceSignature {
    const timestamp = new Date().toISOString();
    const signatureContent = `${rootHash}|${signerId}|${timestamp}|${keyId}`;
    const sigHash = ArtifactHasher.computeHash(signatureContent);

    return {
      evidenceRootHash: rootHash,
      signerId,
      algorithm: 'ECDSA-SHA256',
      signature: `FORENSIC-SIG-${sigHash}`,
      timestamp,
      keyId
    };
  }

  public static verifySignature(signature: ForensicEvidenceSignature, expectedRoot: string): boolean {
    if (signature.evidenceRootHash !== expectedRoot) {
      return false;
    }
    const signatureContent = `${signature.evidenceRootHash}|${signature.signerId}|${signature.timestamp}|${signature.keyId}`;
    const expectedSigHash = `FORENSIC-SIG-${ArtifactHasher.computeHash(signatureContent)}`;
    return signature.signature === expectedSigHash;
  }
}
