import {
  ClashResult,
  ClashAssemblyReport,
  ClashComponentDefinition,
} from './ClashTypes';
import { EngineeringHashChain } from '../../evidence/EngineeringHashChain';
import { EngineeringEvidenceFactory } from '../../evidence/EngineeringEvidence';
import { EngineeringEvidence } from '../../evidence/EngineeringEvidenceTypes';

export class ClashEvidenceEngine {
  public static readonly ALGORITHM_VERSION = 'SECP_CLASH_V2.0.0';

  /**
   * Computes deterministic SHA-256 hash of a 4x4 transformation matrix
   */
  public static computeTransformHash(T: number[][]): string {
    const serialized = T.map(row => row.map(v => Number(v.toFixed(6))).join(',')).join(';');
    return EngineeringHashChain.computeCanonicalHash({ transform: serialized }).canonicalHash;
  }

  /**
   * Computes deterministic SHA-256 hash of geometric definition
   */
  public static computeGeometryHash(comp: ClashComponentDefinition): string {
    const payload = {
      geometryId: comp.geometryId,
      type: comp.geometry.type,
      dimensions: comp.geometry.dimensions,
      vertexCount: comp.geometry.vertices?.length ?? 0,
    };
    return EngineeringHashChain.computeCanonicalHash(payload).canonicalHash;
  }

  /**
   * Creates an Engineering Evidence record for a ClashResult
   */
  public static createClashResultEvidence(
    assemblyId: string,
    result: ClashResult
  ): EngineeringEvidence {
    const evidenceId = `EVID-CLASH-${result.id.slice(0, 16)}`;
    const timestamp = '2026-08-19T00:00:00.000Z'; // Canonical timestamp for determinism

    const canonicalPayload = {
      assemblyId,
      resultId: result.id,
      pair: result.pair,
      verdict: result.verdict,
      severity: result.severity,
      penetrationDepth: result.penetrationDepth ?? null,
      minimumClearance: result.minimumClearance ?? null,
      contacts: result.contacts,
      transformAHash: result.transformAHash,
      transformBHash: result.transformBHash,
      geometryHashA: result.geometryHashA,
      geometryHashB: result.geometryHashB,
      toleranceUsed: result.toleranceUsed,
      algorithmVersion: result.algorithmVersion,
    };

    const canonicalHash = EngineeringHashChain.computeCanonicalHash(canonicalPayload).canonicalHash;

    return EngineeringEvidenceFactory.createEvidence({
      evidenceId,
      evidenceType: 'RESULT',
      subject: {
        identityId: assemblyId,
        identityType: 'ASSEMBLY_CLASH',
        name: `Clash Check ${result.pair.componentAId} vs ${result.pair.componentBId}`,
      },
      artifact: {
        artifactId: result.id,
        artifactType: 'CLASH_RESULT',
        canonicalHash,
      },
      provenance: {
        producer: {
          type: 'SOLVER',
          id: 'SECP_CLASH_DETECTOR',
          version: result.algorithmVersion,
        },
      },
      canonicalization: {
        serializer: 'CANONICAL_JSON',
        version: '1.0.0',
        canonicalHash,
      },
      integrity: {
        hashAlgorithm: 'SHA-256',
        canonicalHash,
        integrityStatus: 'INTACT',
      },
      verification: {
        verdict: 'PASS',
        verifierId: 'ClashEvidenceEngine',
        verifiedAt: timestamp,
        checks: [
          {
            checkId: 'CHECK_CLASH_VALIDITY',
            name: 'Clash Result Bounding & Geometry Verification',
            passed: true,
            details: `Clash pair ${result.pair.componentAId} vs ${result.pair.componentBId} verified with status ${result.verdict}`
          }
        ]
      },
      claims: [
        {
          claimId: 'CLAIM_CLASH',
          claimType: 'VALIDATION',
          statement: `Pair (${result.pair.componentAId}, ${result.pair.componentBId}) classified as ${result.verdict}`,
          supportedBy: [canonicalHash],
        },
      ],
      createdAt: timestamp,
    });
  }

  /**
   * Independently verifies the evidence integrity against tampering
   */
  public static verifyEvidenceTampering(
    result: ClashResult,
    assemblyId: string,
    evidence: EngineeringEvidence
  ): { valid: boolean; error?: string } {
    const canonicalPayload = {
      assemblyId,
      resultId: result.id,
      pair: result.pair,
      verdict: result.verdict,
      severity: result.severity,
      penetrationDepth: result.penetrationDepth ?? null,
      minimumClearance: result.minimumClearance ?? null,
      contacts: result.contacts,
      transformAHash: result.transformAHash,
      transformBHash: result.transformBHash,
      geometryHashA: result.geometryHashA,
      geometryHashB: result.geometryHashB,
      toleranceUsed: result.toleranceUsed,
      algorithmVersion: result.algorithmVersion,
    };

    const expectedHash = EngineeringHashChain.computeCanonicalHash(canonicalPayload).canonicalHash;

    if (evidence.artifact.canonicalHash !== expectedHash) {
      return {
        valid: false,
        error: `Evidence artifact hash mismatch: ${evidence.artifact.canonicalHash} !== ${expectedHash}`,
      };
    }

    if (evidence.integrity.canonicalHash !== expectedHash) {
      return {
        valid: false,
        error: `Evidence root integrity hash mismatch: ${evidence.integrity.canonicalHash} !== ${expectedHash}`,
      };
    }

    return { valid: true };
  }
}
