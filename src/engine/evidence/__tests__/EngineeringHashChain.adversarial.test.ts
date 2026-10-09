/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-010: Engineering Hash Chain Adversarial Test Suite
 */

import { describe, it, expect } from 'vitest';
import { EngineeringHashChain } from '../EngineeringHashChain';
import { EngineeringIdentityFactory } from '../../identity/EngineeringIdentityFactory';
import { EngineeringHashNode } from '../types/EngineeringHashChainTypes';

describe('PATCH-010 — EngineeringHashChain Adversarial Suite', () => {
  const createTestChain = (): { chain: EngineeringHashNode[]; artifacts: Record<string, unknown> } => {
    const artDesign = {
      identity: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY',
        projectId: 'ADV-DESIGN-001',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
      cadFile: 'bracket_v1.step',
      massKg: 1.45
    };
    const artGeom = {
      identity: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY',
        projectId: 'ADV-GEOM-001',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
      meshCells: 45000
    };
    const artSim = {
      identity: EngineeringIdentityFactory.createIdentity({ objectType: 'SIMULATION',
        projectId: 'ADV-SIM-001',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
      stressPeakMPa: 310.2
    };
    const artResult = {
      identity: EngineeringIdentityFactory.createIdentity({ objectType: 'RESULT',
        projectId: 'ADV-RES-001',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
      passedYieldTest: true
    };

    const n1 = EngineeringHashChain.append({ stage: 'DESIGN', artifact: artDesign });
    const n2 = EngineeringHashChain.append({ stage: 'GEOMETRY', artifact: artGeom, previousNode: n1 });
    const n3 = EngineeringHashChain.append({ stage: 'SIMULATION', artifact: artSim, previousNode: n2 });
    const n4 = EngineeringHashChain.append({ stage: 'RESULT', artifact: artResult, previousNode: n3 });

    return {
      chain: [n1, n2, n3, n4],
      artifacts: {
        'ADV-DESIGN-001': artDesign,
        'ADV-GEOM-001': artGeom,
        'ADV-SIM-001': artSim,
        'ADV-RES-001': artResult
      }
    };
  };

  // ADVERSARIAL A: Change one character in the canonical payload
  it('ADVERSARIAL A: Change one character in the canonical payload is detected', () => {
    const { chain } = createTestChain();
    const target = chain[2]; // Simulation node

    // Flip 1 character in canonicalHash
    const tamperedCanonicalHash =
      target.canonicalHash.substring(0, target.canonicalHash.length - 1) +
      (target.canonicalHash.endsWith('a') ? 'b' : 'a');

    const forgedNode = { ...target, canonicalHash: tamperedCanonicalHash };
    const forgedChain = [...chain.slice(0, 2), forgedNode, ...chain.slice(3)];

    const verif = EngineeringHashChain.verify(forgedChain);
    expect(verif.valid).toBe(false);
    expect(verif.firstBrokenIndex).toBe(2);
    expect(verif.failureReason).toBe('HASH_MISMATCH');
  });

  // ADVERSARIAL B: Change artifact ID
  it('ADVERSARIAL B: Change artifact ID inside node is detected', () => {
    const { chain } = createTestChain();
    const forgedNode = { ...chain[1], artifactId: 'ADV-GEOM-FORGED' };
    const forgedChain = [chain[0], forgedNode, chain[2], chain[3]];

    const verif = EngineeringHashChain.verify(forgedChain);
    expect(verif.valid).toBe(false);
    expect(verif.firstBrokenIndex).toBe(1);
    expect(verif.failureReason).toBe('HASH_MISMATCH');
  });

  // ADVERSARIAL C: Change artifact type
  it('ADVERSARIAL C: Change artifact type inside node is detected', () => {
    const { chain } = createTestChain();
    const forgedNode = { ...chain[0], artifactType: 'TOOLPATH' };
    const forgedChain = [forgedNode, chain[1], chain[2], chain[3]];

    const verif = EngineeringHashChain.verify(forgedChain);
    expect(verif.valid).toBe(false);
    expect(verif.firstBrokenIndex).toBe(0);
    expect(verif.failureReason).toBe('HASH_MISMATCH');
  });

  // ADVERSARIAL D: Change canonicalization version
  it('ADVERSARIAL D: Change canonicalization version is detected and rejected', () => {
    const { chain } = createTestChain();
    const forgedNode = { ...chain[0], canonicalizationVersion: '2.0.0-UNSUPPORTED' };
    const forgedChain = [forgedNode, chain[1], chain[2], chain[3]];

    const verif = EngineeringHashChain.verify(forgedChain);
    expect(verif.valid).toBe(false);
    expect(verif.firstBrokenIndex).toBe(0);
    expect(verif.failureReason).toBe('UNSUPPORTED_CANONICALIZATION_VERSION');
  });

  // ADVERSARIAL E: Change previousHash
  it('ADVERSARIAL E: Change previousHash is detected', () => {
    const { chain } = createTestChain();
    const forgedNode = {
      ...chain[3],
      previousHash: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    };
    const forgedChain = [chain[0], chain[1], chain[2], forgedNode];

    const verif = EngineeringHashChain.verify(forgedChain);
    expect(verif.valid).toBe(false);
    expect(verif.firstBrokenIndex).toBe(3);
    expect(verif.failureReason).toBe('BROKEN_PREVIOUS_LINK');
  });

  // ADVERSARIAL F: Reorder chain nodes
  it('ADVERSARIAL F: Reordering chain nodes breaks linkage', () => {
    const { chain } = createTestChain();
    // Swap node 1 and node 2
    const swappedChain = [chain[0], chain[2], chain[1], chain[3]];

    const verif = EngineeringHashChain.verify(swappedChain);
    expect(verif.valid).toBe(false);
    expect(verif.firstBrokenIndex).toBe(1);
    expect(verif.failureReason).toBe('BROKEN_PREVIOUS_LINK');
  });

  // ADVERSARIAL G: Delete an intermediate node
  it('ADVERSARIAL G: Deleting an intermediate node breaks lineage continuity', () => {
    const { chain } = createTestChain();
    // Remove node 1 (GEOMETRY)
    const truncatedChain = [chain[0], chain[2], chain[3]];

    const verif = EngineeringHashChain.verify(truncatedChain);
    expect(verif.valid).toBe(false);
    expect(verif.firstBrokenIndex).toBe(1);
    expect(verif.failureReason).toBe('BROKEN_PREVIOUS_LINK');
    expect(verif.expectedHash).toBe(chain[0].chainHash);
    expect(verif.actualHash).toBe(chain[2].previousHash);
  });

  // ADVERSARIAL H: Insert an unauthorized node
  it('ADVERSARIAL H: Inserting an unauthorized node breaks downstream linkage', () => {
    const { chain } = createTestChain();
    const rogueNode = EngineeringHashChain.append({
      stage: 'GEOMETRY',
      artifact: {
        identity: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY',
          projectId: 'ROGUE-GEOM',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
        injected: true
      },
      previousNode: chain[0]
    });

    // Splice rogue node into chain
    const forgedChain = [chain[0], rogueNode, chain[1], chain[2], chain[3]];

    const verif = EngineeringHashChain.verify(forgedChain);
    expect(verif.valid).toBe(false);
    expect(verif.firstBrokenIndex).toBe(2);
    expect(verif.failureReason).toBe('BROKEN_PREVIOUS_LINK');
  });

  // ADVERSARIAL I: Replace an artifact with another artifact having the same display name / fields
  it('ADVERSARIAL I: Replacing artifact with modified fields is detected during artifact verification', () => {
    const { chain, artifacts } = createTestChain();
    const designNode = chain[0];

    // Altered CAD file name with identical artifactId
    const forgedArtifact = {
      identity: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY',
        projectId: 'ADV-DESIGN-001',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
      cadFile: 'bracket_v1_tampered.step',
      massKg: 1.45
    };

    const verif = EngineeringHashChain.verifyArtifact(designNode, forgedArtifact);
    expect(verif.valid).toBe(false);
    expect(verif.reason).toBe('ARTIFACT_MODIFIED');
  });

  // ADVERSARIAL J: Attempt to create a forged downstream node using an old previous hash
  it('ADVERSARIAL J: Attempting to graft old previous hash into new context is detected', () => {
    const { chain } = createTestChain();

    // Fabricate a node with old previous hash but forged payload
    const forgedPayload = {
      stage: 'RESULT' as const,
      artifactId: 'ADV-RES-001',
      artifactType: 'RESULT',
      canonicalHash: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      previousHash: chain[2].chainHash,
      canonicalizationVersion: '1.0.0',
      hashAlgorithm: 'SHA-256'
    };

    const forgedChainHash = EngineeringHashChain.computeChainHash(forgedPayload);

    const forgedResultNode: EngineeringHashNode = {
      stage: 'RESULT',
      artifactId: chain[3].artifactId,
      artifactType: 'RESULT',
      canonicalHash: forgedPayload.canonicalHash,
      previousHash: forgedPayload.previousHash,
      chainHash: forgedChainHash,
      canonicalizationVersion: '1.0.0',
      hashAlgorithm: 'SHA-256'
    };

    // Chain verifies structurally
    const forgedChain = [chain[0], chain[1], chain[2], forgedResultNode];
    const chainVerif = EngineeringHashChain.verify(forgedChain);
    expect(chainVerif.valid).toBe(true);

    // But artifact verification against actual artifact payload fails
    const artVerif = EngineeringHashChain.verifyArtifact(forgedResultNode, {
      identity: EngineeringIdentityFactory.createIdentity({ objectType: 'RESULT',
        projectId: 'ADV-RES-001',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
      passedYieldTest: true
    });

    expect(artVerif.valid).toBe(false);
    expect(artVerif.reason).toBe('ARTIFACT_MODIFIED');
  });
});
