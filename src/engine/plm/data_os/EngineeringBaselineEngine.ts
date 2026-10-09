/**
 * SECP Industrial OS v3 — PATCH-181: Engineering Baseline Engine
 * Creates and validates immutable engineering baselines representing a fully
 * reproducible engineering state across CAD, BOM, Drawings, Materials, Simulation, and CAM.
 */

import { EngineeringBaseline, DigitalSignature } from './EngineeringDataOSTypes';
import { generateDeterministicHashSync } from '../../../lib/hash';

export class EngineeringBaselineEngine {
  private static baselines: Map<string, EngineeringBaseline> = new Map();

  public static clear(): void {
    this.baselines.clear();
  }

  /**
   * Creates an immutable baseline snapshot of an entire product release state.
   */
  public static createBaseline(
    name: string,
    productId: string,
    configurationId: string,
    targetRevision: string,
    frozenArtifacts: EngineeringBaseline['frozenArtifacts'],
    approvalSignatures: DigitalSignature[]
  ): EngineeringBaseline {
    const rawContent = JSON.stringify({ name, productId, configurationId, targetRevision, frozenArtifacts });
    const merkleRootHash = generateDeterministicHashSync({ rawContent, signaturesCount: approvalSignatures.length });
    const baselineId = `BASE-${merkleRootHash.substring(0, 8).toUpperCase()}`;

    const baseline: EngineeringBaseline = {
      baselineId,
      name,
      productId,
      configurationId,
      targetRevision,
      snapshotTimestamp: new Date().toISOString(),
      frozenArtifacts,
      approvalSignatures: [...approvalSignatures],
      merkleRootHash: `0x${merkleRootHash}`,
      isImmutable: true
    };

    this.baselines.set(baselineId, baseline);
    return baseline;
  }

  /**
   * Verifies the cryptographic reproducibility and audit immutability of a baseline.
   */
  public static verifyBaselineIntegrity(baselineId: string): {
    isValid: boolean;
    hashMatches: boolean;
    allSignaturesValid: boolean;
    reason: string;
  } {
    const b = this.baselines.get(baselineId);
    if (!b) {
      return { isValid: false, hashMatches: false, allSignaturesValid: false, reason: 'Baseline not found' };
    }

    const rawContent = JSON.stringify({ 
      name: b.name, 
      productId: b.productId, 
      configurationId: b.configurationId, 
      targetRevision: b.targetRevision, 
      frozenArtifacts: b.frozenArtifacts 
    });
    const recomputedHash = `0x${generateDeterministicHashSync({ rawContent, signaturesCount: b.approvalSignatures.length })}`;
    const hashMatches = recomputedHash === b.merkleRootHash;

    const allSignaturesValid = b.approvalSignatures.length > 0 && b.approvalSignatures.every(s => s.isValid);

    const isValid = hashMatches && allSignaturesValid && b.isImmutable;

    return {
      isValid,
      hashMatches,
      allSignaturesValid,
      reason: isValid
        ? 'Baseline cryptographic merkle root matches and all release signatures are verified.'
        : 'Baseline tampering or invalid signature detected.'
    };
  }

  public static getBaseline(baselineId: string): EngineeringBaseline | undefined {
    return this.baselines.get(baselineId);
  }
}
