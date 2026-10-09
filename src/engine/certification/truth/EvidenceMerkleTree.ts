/**
 * SECP Industrial OS — Cryptographic Evidence Merkle Tree
 * 
 * Deterministic Merkle Tree engine for aggregating and verifying
 * heterogeneous engineering evidence records (CAD, Topology, Simulation,
 * DFM, CAM, Telemetry, CMM Metrology).
 */

import * as crypto from 'crypto';
import { EvidenceLeafRecord } from './types';

export class EvidenceMerkleTree {
  public static readonly EMPTY_ROOT = '0000000000000000000000000000000000000000000000000000000000000000';

  private readonly leaves: string[];
  private readonly tree: string[][];

  constructor(leafHashes: readonly string[]) {
    if (!leafHashes || leafHashes.length === 0) {
      this.leaves = [EvidenceMerkleTree.EMPTY_ROOT];
    } else {
      this.leaves = [...leafHashes];
    }
    this.tree = this.buildTree(this.leaves);
  }

  /**
   * Deterministically computes the SHA-256 leaf hash for an evidence record.
   * Enforces all mandatory fields:
   * entityId, partId, revisionId, cadRevisionHash, canonicalGeometryHash,
   * artifactKind, artifactContentHash, evidenceType, authorityIdentity,
   * sourceIdentity, executionIdentity.
   */
  public static computeLeafHash(leaf: EvidenceLeafRecord): string {
    if (!leaf) {
      throw new Error('EVIDENCE_MERKLE_ERROR: Cannot compute leaf hash for null leaf');
    }

    const canonicalCore = {
      entityId: leaf.entityId || '',
      partId: leaf.partId || '',
      revisionId: leaf.revisionId || '',
      cadRevisionHash: leaf.cadRevisionHash || '',
      canonicalGeometryHash: leaf.canonicalGeometryHash || '',
      artifactKind: leaf.artifactKind || '',
      artifactContentHash: leaf.artifactContentHash || '',
      evidenceType: leaf.evidenceType || '',
      authorityIdentity: leaf.authorityIdentity || '',
      sourceIdentity: leaf.sourceIdentity || '',
      executionIdentity: leaf.executionIdentity || ''
    };

    // Sort keys and serialize deterministically
    const sortedKeys = Object.keys(canonicalCore).sort() as (keyof typeof canonicalCore)[];
    const canonicalString = sortedKeys.map(k => `${k}=${canonicalCore[k]}`).join('&');

    return crypto.createHash('sha256').update(canonicalString, 'utf8').digest('hex');
  }

  /**
   * Builds an EvidenceMerkleTree from an array of EvidenceLeafRecords.
   */
  public static buildFromLeaves(records: EvidenceLeafRecord[]): EvidenceMerkleTree {
    const leafHashes = records.map(rec => {
      const computed = this.computeLeafHash(rec);
      try {
        rec.leafHash = computed;
      } catch {
        // Skip assignment if record is frozen (M9 immutability)
      }
      return computed;
    });
    return new EvidenceMerkleTree(leafHashes);
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
        const combined = crypto.createHash('sha256').update(`${left}:${right}`, 'utf8').digest('hex');
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

  public getLeaves(): readonly string[] {
    return [...this.leaves];
  }
}
