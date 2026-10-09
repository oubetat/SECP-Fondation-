/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-010: Engineering Hash Chain Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { EngineeringHashChain } from '../EngineeringHashChain';
import { EngineeringIdentityFactory } from '../../identity/EngineeringIdentityFactory';
import { EngineeringObjectType } from '../../identity/CanonicalEngineeringIdentity';
import { MissingArtifactIdentityError, InvalidChainStageError } from '../EngineeringHashChainErrors';

describe('PATCH-010 — Engineering Hash Chain Unit Test Suite', () => {
  // TEST 1: Same artifact -> same canonicalHash
  it('TEST 1: Same artifact produces identical canonicalHash', () => {
    const artifact = {
      identity: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY',
        projectId: 'CAD-PART-100',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
      dimensions: { width: 100, length: 200, height: 50 },
      material: 'Aluminum 6061-T6'
    };

    const res1 = EngineeringHashChain.computeCanonicalHash(artifact);
    const res2 = EngineeringHashChain.computeCanonicalHash(artifact);

    expect(res1.canonicalHash).toBe(res2.canonicalHash);
    expect(res1.canonicalHash).toMatch(/^[a-f0-9]{64}$/);
    expect(res1.canonicalizationVersion).toBe('1.0.0');
  });

  // TEST 2: Equivalent canonical objects (key order permutation) -> same canonicalHash
  it('TEST 2: Equivalent canonical objects with permuted key order produce same canonicalHash', () => {
    const matIdentity = EngineeringIdentityFactory.createIdentity({
      objectType: 'MATERIAL',
      projectId: 'MAT-STEEL-4340',
      revisionId: "rev-01",
      createdBy: "system",
      seed: "seed",
      timestamp: '2026-01-01T00:00:00.000Z'
    }, {});

    const artA = {
      identity: matIdentity,
      yieldStrengthMPa: 850,
      densityKgM3: 7850,
      poissonsRatio: 0.29
    };

    const artB = {
      densityKgM3: 7850,
      poissonsRatio: 0.29,
      yieldStrengthMPa: 850,
      identity: matIdentity
    };

    const resA = EngineeringHashChain.computeCanonicalHash(artA);
    const resB = EngineeringHashChain.computeCanonicalHash(artB);

    expect(resA.canonicalHash).toBe(resB.canonicalHash);
  });

  // TEST 3: Changed artifact -> different canonicalHash
  it('TEST 3: Changed artifact produces different canonicalHash', () => {
    const base = {
      identity: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY',
        projectId: 'SHAFT-001',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
      radiusMm: 25.0
    };

    const modified = {
      identity: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY',
        projectId: 'SHAFT-001',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
      radiusMm: 25.001 // tiny change
    };

    const resBase = EngineeringHashChain.computeCanonicalHash(base);
    const resMod = EngineeringHashChain.computeCanonicalHash(modified);

    expect(resBase.canonicalHash).not.toBe(resMod.canonicalHash);
  });

  // TEST 4: Genesis node produces deterministic chainHash
  it('TEST 4: Genesis node produces deterministic chainHash with previousHash = null', () => {
    const designArtifact = {
      identity: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY',
        projectId: 'DESIGN-TURBINE-001',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
      inletAngleDeg: 45.0,
      bladesCount: 24
    };

    const node1 = EngineeringHashChain.append({ stage: 'DESIGN', artifact: designArtifact });
    const node2 = EngineeringHashChain.append({ stage: 'DESIGN', artifact: designArtifact });

    expect(node1.previousHash).toBeNull();
    expect(node2.previousHash).toBeNull();
    expect(node1.chainHash).toBe(node2.chainHash);
    expect(node1.chainHash).toMatch(/^[a-f0-9]{64}$/);
  });

  // TEST 5: Appending a second node correctly references the first chainHash
  it('TEST 5: Appending a second node correctly references the first chainHash', () => {
    const designNode = EngineeringHashChain.append({
      stage: 'DESIGN',
      artifact: {
        identity: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY',
          projectId: 'DESIGN-001',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
        spec: 'High-pressure nozzle'
      }
    });

    const geomNode = EngineeringHashChain.append({
      stage: 'GEOMETRY',
      artifact: {
        identity: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY',
          projectId: 'GEOM-001',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
        brepFaces: 48
      },
      previousNode: designNode
    });

    expect(geomNode.previousHash).toBe(designNode.chainHash);
    expect(geomNode.chainHash).not.toBe(designNode.chainHash);
    expect(EngineeringHashChain.verifyNode(geomNode, designNode)).toBe(true);
  });

  // TEST 6: Three-node chain verifies successfully
  it('TEST 6: Three-node chain verifies successfully', () => {
    const n1 = EngineeringHashChain.append({
      stage: 'DESIGN',
      artifact: {
        identity: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY',
          projectId: 'ART-DESIGN',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
        flowRate: 150
      }
    });

    const n2 = EngineeringHashChain.append({
      stage: 'GEOMETRY',
      artifact: {
        identity: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY',
          projectId: 'ART-GEOMETRY',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
        meshElements: 50000
      },
      previousNode: n1
    });

    const n3 = EngineeringHashChain.append({
      stage: 'SIMULATION',
      artifact: {
        identity: EngineeringIdentityFactory.createIdentity({ objectType: 'SIMULATION',
          projectId: 'ART-SIMULATION',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
        maxStressMPa: 198.5
      },
      previousNode: n2
    });

    const chain = [n1, n2, n3];
    const verif = EngineeringHashChain.verify(chain);

    expect(verif.valid).toBe(true);
    expect(verif.checkedNodes).toBe(3);
    expect(verif.firstBrokenIndex).toBeNull();
    expect(verif.failureReason).toBe('NONE');
    expect(EngineeringHashChain.getRoot(chain)).toBe(n1);
    expect(EngineeringHashChain.getHead(chain)).toBe(n3);
  });

  // TEST 7: Tampering with a node's chainHash is detected
  it("TEST 7: Tampering with a node's chainHash is detected", () => {
    const n1 = EngineeringHashChain.append({
      stage: 'DESIGN',
      artifact: {
        identity: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY',
          projectId: 'D1',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
        val: 1
      }
    });
    const n2 = EngineeringHashChain.append({
      stage: 'GEOMETRY',
      artifact: {
        identity: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY',
          projectId: 'G1',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
        val: 2
      },
      previousNode: n1
    });

    const tamperedN2 = { ...n2, chainHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' };
    const chain = [n1, tamperedN2];
    const verif = EngineeringHashChain.verify(chain);

    expect(verif.valid).toBe(false);
    expect(verif.firstBrokenIndex).toBe(1);
    expect(verif.failureReason).toBe('HASH_MISMATCH');
    expect(verif.brokenArtifactId).toBe('G1');
  });

  // TEST 8: Tampering with previousHash is detected
  it('TEST 8: Tampering with previousHash is detected', () => {
    const n1 = EngineeringHashChain.append({
      stage: 'DESIGN',
      artifact: {
        identity: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY',
          projectId: 'D1',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
        val: 1
      }
    });
    const n2 = EngineeringHashChain.append({
      stage: 'GEOMETRY',
      artifact: {
        identity: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY',
          projectId: 'G1',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
        val: 2
      },
      previousNode: n1
    });

    const tamperedN2 = { ...n2, previousHash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' };
    const chain = [n1, tamperedN2];
    const verif = EngineeringHashChain.verify(chain);

    expect(verif.valid).toBe(false);
    expect(verif.firstBrokenIndex).toBe(1);
    expect(verif.failureReason).toBe('BROKEN_PREVIOUS_LINK');
  });

  // TEST 9: Changing an upstream artifact invalidates its artifact verification
  it('TEST 9: Changing an upstream artifact invalidates its artifact verification', () => {
    const originalArtifact = {
      identity: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY',
        projectId: 'ORIGINAL-CAD-001',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
      wallThicknessMm: 3.5
    };

    const node = EngineeringHashChain.append({ stage: 'DESIGN', artifact: originalArtifact });

    // Verify against original
    const verifOriginal = EngineeringHashChain.verifyArtifact(node, originalArtifact);
    expect(verifOriginal.valid).toBe(true);
    expect(verifOriginal.reason).toBe('VALID');

    // Verify against modified
    const tamperedArtifact = {
      ...originalArtifact,
      wallThicknessMm: 3.2
    };

    const verifTampered = EngineeringHashChain.verifyArtifact(node, tamperedArtifact);
    expect(verifTampered.valid).toBe(false);
    expect(verifTampered.reason).toBe('ARTIFACT_MODIFIED');
  });

  // TEST 10: Changing an upstream artifact does not magically preserve the old lineage
  it('TEST 10: Changing an upstream artifact invalidates downstream lineage in full lineage verification', () => {
    const designA = {
      identity: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY',
        projectId: 'DESIGN-PUMP-001',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
      rpm: 3600
    };
    const geomA = {
      identity: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY',
        projectId: 'GEOM-PUMP-001',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
      impellerRadius: 120
    };

    const nodeD = EngineeringHashChain.append({ stage: 'DESIGN', artifact: designA });
    const nodeG = EngineeringHashChain.append({ stage: 'GEOMETRY', artifact: geomA, previousNode: nodeD });

    const chain = [nodeD, nodeG];

    // Correct lineage verification
    const verifOk = EngineeringHashChain.verifyFullLineage(chain, {
      'DESIGN-PUMP-001': designA,
      'GEOM-PUMP-001': geomA
    });
    expect(verifOk.valid).toBe(true);

    // Modified Design A -> Design B
    const designB = {
      identity: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY',
        projectId: 'DESIGN-PUMP-001',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
      rpm: 4200 // modified rpm
    };

    const verifBad = EngineeringHashChain.verifyFullLineage(chain, {
      'DESIGN-PUMP-001': designB,
      'GEOM-PUMP-001': geomA
    });
    expect(verifBad.valid).toBe(false);
    expect(verifBad.tamperedArtifacts).toContain('DESIGN-PUMP-001');
  });

  // TEST 11: Repeated execution produces identical hashes
  it('TEST 11: Repeated execution produces identical hashes across runs', () => {
    const art = {
      identity: EngineeringIdentityFactory.createIdentity({ objectType: 'SIMULATION',
        projectId: 'SIM-REPEAT-001',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
      iterations: 500,
      convergence: 1e-6
    };

    const hashes = Array.from({ length: 10 }, () => {
      const n = EngineeringHashChain.append({ stage: 'SIMULATION', artifact: art });
      return { canonical: n.canonicalHash, chain: n.chainHash };
    });

    const first = hashes[0];
    for (const h of hashes) {
      expect(h.canonical).toBe(first.canonical);
      expect(h.chain).toBe(first.chain);
    }
  });

  // TEST 12: No timestamp/random value participates in cryptographic payload
  it('TEST 12: createdAt provenance metadata does NOT alter canonicalHash or chainHash', () => {
    const art = {
      identity: EngineeringIdentityFactory.createIdentity({ objectType: 'RESULT',
        projectId: 'RESULT-001',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
      safetyMargin: 2.15
    };

    const n1 = EngineeringHashChain.append({
      stage: 'RESULT',
      artifact: art,
      createdAt: '2026-01-01T00:00:00.000Z'
    });
    const n2 = EngineeringHashChain.append({
      stage: 'RESULT',
      artifact: art,
      createdAt: '2026-12-31T23:59:59.999Z'
    });

    expect(n1.canonicalHash).toBe(n2.canonicalHash);
    expect(n1.chainHash).toBe(n2.chainHash);
    expect(n1.createdAt).not.toBe(n2.createdAt);
  });

  // TEST 13: Missing identity/canonical data produces explicit error / non-valid result
  it('TEST 13: Missing identity/canonical data throws MissingArtifactIdentityError without fabricating data', () => {
    expect(() => {
      EngineeringHashChain.append({
        stage: 'DESIGN',
        artifact: { someAnonymousObject: true }
      });
    }).toThrow(MissingArtifactIdentityError);
  });

  it('TEST 14: Invalid stage throws InvalidChainStageError', () => {
    expect(() => {
      EngineeringHashChain.append({
        stage: 'INVALID_STAGE' as any,
        artifact: {
          identity: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY',
            projectId: 'TEST-001',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {})
        }
      });
    }).toThrow(InvalidChainStageError);
  });
});
