/**
 * SECP Industrial OS v3 — Collision Authority Core
 * P7 Canonical Identity Model
 * Mission: COLLISION-ENGINE-P7-TRUTH-THREAD-DETERMINISTIC-PERSISTENCE-001
 * 
 * ARCHITECTURAL CONTRACT:
 * Explicitly distinguishes and structures all engineering and operational identity layers:
 * 1. Document Identity (documentId)
 * 2. Revision Identity (revisionId)
 * 3. Geometry Identity (geometryId)
 * 4. Geometry Snapshot Identity (snapshotId) - Deterministic hash of engineering state, NOT random UUID
 * 5. Transform Identity (transformRevision)
 * 6. Motion Identity (motionRevision)
 * 7. Execution Identity (executionId) - Operational
 * 8. Result Identity (resultId) - Engineering Truth
 * 9. Evidence Identity (evidenceId) - Cryptographic Proof
 * 10. Event Identity (eventId) - Truth Thread Sequence
 * 11. Provider Identity (providerId)
 * 12. Algorithm Identity (algorithmVersion)
 */

import * as crypto from 'crypto';
import { CanonicalSerializer } from '../../serialization/CanonicalSerializer';

export interface EngineeringDocumentIdentity {
  documentId: string;
}

export interface EngineeringRevisionIdentity {
  revisionId: string;
  revisionIndex: number;
}

export interface GeometryIdentity {
  geometryId: string;
  cadRevisionId: string;
}

export interface GeometrySnapshotIdentity {
  snapshotId: string; // Deterministic SHA-256 hash of geometry + topology
  geometryHash: string;
  topologyIdentity?: string;
  vertexCount: number;
  triangleCount: number;
}

export interface TransformIdentity {
  transformRevision: string;
  coordinateFrame: 'WCS' | 'MCS' | 'TCS';
  units: 'MILLIMETERS' | 'INCHES';
}

export interface MotionIdentity {
  motionRevision: string;
  motionType: string;
}

export interface ExecutionIdentity {
  executionId: string; // Operational unique ID per run
  timestampIso: string;
}

export interface ResultIdentity {
  resultId: string; // Deterministic hash of Canonical Result Engineering Truth
}

export interface EvidenceIdentity {
  evidenceId: string; // Cryptographic Evidence Ledger ID
  evidenceHash: string;
}

export interface EventIdentity {
  eventId: string; // Truth Thread Event ID
  sequenceNumber: number;
  eventHash: string;
  previousEventHash: string;
}

export interface ProviderIdentity {
  providerId: string;
  algorithmVersion: string;
  exactnessLevel: string;
}

export interface FullCanonicalIdentityGraph {
  document: EngineeringDocumentIdentity;
  revision: EngineeringRevisionIdentity;
  geometry: GeometryIdentity;
  snapshot: GeometrySnapshotIdentity;
  transform: TransformIdentity;
  motion: MotionIdentity;
  execution: ExecutionIdentity;
  result: ResultIdentity;
  evidence: EvidenceIdentity;
  event: EventIdentity;
  provider: ProviderIdentity;
}

export class CanonicalIdentityFactory {
  /**
   * Computes a deterministic Geometry Snapshot ID based on canonical geometry state.
   */
  public static computeSnapshotId(geometryData: {
    geometryHash: string;
    topologyIdentity?: string;
    cadRevisionId: string;
    tessellatedTriangles?: any[];
  }): string {
    const payload = {
      geometryHash: geometryData.geometryHash,
      topologyIdentity: geometryData.topologyIdentity || 'TOPOLOGY_NONE',
      cadRevisionId: geometryData.cadRevisionId,
      triangleCount: geometryData.tessellatedTriangles?.length || 0
    };
    const serialized = CanonicalSerializer.serialize(payload);
    const hash = crypto.createHash('sha256').update(serialized.canonicalString, 'utf8').digest('hex');
    return `SNAP_${hash.substring(0, 16).toUpperCase()}`;
  }

  /**
   * Computes a deterministic Result ID for a Canonical Collision Result's engineering state.
   */
  public static computeResultId(result: any): string {
    const truthPayload = {
      status: result.status,
      severity: result.severity,
      exactness: result.exactness,
      provenSafe: result.provenSafe,
      metrics: result.metrics,
      contactCount: result.contactManifold?.length || 0,
      temporalInfo: result.temporalInfo,
      failureState: result.failureState,
      provenance: {
        cadDocumentRevisionId: result.provenance?.cadDocumentRevisionId,
        geometryHash: result.provenance?.geometryHash,
        algorithmVersion: result.provenance?.algorithmVersion
      }
    };
    const serialized = CanonicalSerializer.serialize(truthPayload);
    const hash = crypto.createHash('sha256').update(serialized.canonicalString, 'utf8').digest('hex');
    return `RES_${hash.substring(0, 20).toUpperCase()}`;
  }

  /**
   * Computes deterministic Evidence ID from execution truth.
   */
  public static computeEvidenceId(resultId: string, geometryHash: string, providerId: string): string {
    const payload = `${resultId}:${geometryHash}:${providerId}`;
    const hash = crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
    return `EVID_${hash.substring(0, 16).toUpperCase()}`;
  }

  /**
   * Computes deterministic Truth Thread Event ID.
   */
  public static computeEventId(executionId: string, resultId: string, sequenceNumber: number): string {
    const payload = `${executionId}:${resultId}:${sequenceNumber}`;
    const hash = crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
    return `EVT_${sequenceNumber.toString().padStart(6, '0')}_${hash.substring(0, 12).toUpperCase()}`;
  }
}
