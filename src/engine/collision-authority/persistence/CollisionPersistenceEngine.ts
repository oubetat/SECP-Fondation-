import {
  CanonicalCollisionInput,
  CanonicalCollisionResult,
  CollisionStatus
} from '../types';
import {
  CollisionPersistedRecord,
  CollisionEvidencePackage,
  RevisionBindingMetadata,
  VerificationStatus,
  ProvenanceGraph,
  ProvenanceTraceNode
} from './types';
import { CollisionTruthThread } from './CollisionTruthThread';
import { CanonicalCollisionResultEquivalence } from './CanonicalCollisionResultEquivalence';
import { CollisionAuthority } from '../CollisionAuthority';

function joinPath(...parts: string[]): string {
  return parts.join('/').replace(/\\/g, '/').replace(/\/+/g, '/');
}

function basenamePath(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || '';
}

function getNodeFs(): any {
  if (typeof process !== 'undefined' && process.versions?.node && typeof require === 'function') {
    try {
      return require('fs');
    } catch {
      return null;
    }
  }
  return null;
}

export class CollisionPersistenceEngine {
  private static inMemoryStore = new Map<string, string>();

  public static getStorageDir(): string {
    if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
      return joinPath(process.cwd(), '.collision_records');
    }
    return '.collision_records';
  }

  public static serializeRecord(record: unknown): string {
    return JSON.stringify(record, (_key, value) => {
      if (typeof value === 'number') {
        if (value === Infinity) {
          return { '@__p7_special_num__': '+Infinity' };
        }
        if (value === -Infinity) {
          return { '@__p7_special_num__': '-Infinity' };
        }
        if (Number.isNaN(value)) {
          return { '@__p7_special_num__': 'NaN' };
        }
      }
      return value;
    }, 2);
  }

  public static deserializeRecord<T = unknown>(json: string): T {
    return JSON.parse(json, (_key, value) => {
      if (value && typeof value === 'object' && value['@__p7_special_num__']) {
        const marker = value['@__p7_special_num__'];
        if (marker === '+Infinity') return Infinity;
        if (marker === '-Infinity') return -Infinity;
        if (marker === 'NaN') return NaN;
      }
      return value;
    });
  }

  private static ensureStorageDir(): void {
    const fsNode = getNodeFs();
    if (fsNode && fsNode.existsSync) {
      try {
        const dir = this.getStorageDir();
        if (dir && !fsNode.existsSync(dir)) {
          fsNode.mkdirSync(dir, { recursive: true });
        }
      } catch {
        // Fallback
      }
    }
  }

  public static clearStorage(): void {
    this.inMemoryStore.clear();
    CollisionTruthThread.reset();
    const fsNode = getNodeFs();
    if (fsNode && fsNode.existsSync && fsNode.rmSync) {
      try {
        const dir = this.getStorageDir();
        // SAFEGUARD: Only delete if dir is specifically named .collision_records
        if (dir && dir.endsWith('.collision_records') && fsNode.existsSync(dir)) {
          fsNode.rmSync(dir, { recursive: true, force: true });
        }
      } catch {
        // ignore
      }
    }
  }

  public static extractRevisionBinding(
    input: CanonicalCollisionInput,
    result: CanonicalCollisionResult
  ): RevisionBindingMetadata {
    const geom = input.canonicalGeometry || input.geometry;
    const documentId = geom?.documentId || 'DOC_UNKNOWN';
    const revisionId = geom?.revisionId || input.cadRevisionId || result.provenance?.cadDocumentRevisionId || 'REV_UNKNOWN';
    const geometryId = geom?.geometryId || 'GEOM_DEFAULT';
    const geometryRevision = geom?.geometryRevision ?? 1;
    const geometryHash = geom?.geometryHash || result.provenance?.geometryHash || 'HASH_MISSING';
    const topologyIdentity = geom?.topologyIdentity || 'TOPOLOGY_DEFAULT';
    const transformRevision = geom?.coordinateFrame || input.coordinateFrame || 'WCS';
    const motionRevision = input.motionSegment ? `MOTION_${input.motionSegment.motionType}` : 'STATIC';

    const snapshotId = geom?.snapshotId ||
      CollisionTruthThread.computeGeometrySnapshotIdentity(documentId, revisionId, geometryId, geometryHash, topologyIdentity);

    return {
      documentId,
      revisionId,
      geometryId,
      geometryRevision,
      snapshotId,
      topologyIdentity,
      geometryHash,
      transformRevision,
      motionRevision
    };
  }

  public static async persist(
    input: CanonicalCollisionInput,
    result: CanonicalCollisionResult,
    providerIdOverride?: string,
    algorithmVersionOverride?: string
  ): Promise<CollisionPersistedRecord> {
    this.ensureStorageDir();

    const executionId = result.executionId;
    const resultId = `RES_${executionId}`;
    const evidenceId = `EVID_${executionId}`;
    const providerId = providerIdOverride || 'EXACT_NARROW_PHASE';
    const algorithmVersion = algorithmVersionOverride || result.provenance?.algorithmVersion || '1.0.0';

    const revisionBinding = this.extractRevisionBinding(input, result);

    const inputHash = CollisionTruthThread.computeInputHash(input);
    const resultHash = CollisionTruthThread.computeResultHash(result);

    const rawEvidence: Omit<CollisionEvidencePackage, 'evidenceHash'> = {
      evidenceId,
      resultId,
      executionId,
      inputHash,
      resultHash,
      geometryHash: revisionBinding.geometryHash,
      snapshotId: revisionBinding.snapshotId,
      revisionBinding,
      providerId,
      algorithmVersion,
      exactness: result.exactness,
      status: result.status,
      provenSafe: result.provenSafe,
      timestampIso: result.timestampIso
    };

    const evidenceHash = CollisionTruthThread.computeEvidenceHash(rawEvidence as Record<string, unknown>);
    const evidencePackage: CollisionEvidencePackage = Object.freeze({
      ...rawEvidence,
      evidenceHash
    });

    const event = CollisionTruthThread.recordEvent({
      eventType: 'COLLISION_PERSISTED',
      executionId,
      resultId,
      evidenceId,
      input,
      result,
      revisionBinding,
      evidenceHash,
      providerId,
      algorithmVersion
    });

    const recordId = `REC_${executionId}`;
    const persistedAtIso = new Date().toISOString();

    const unhashedRecord = {
      recordId,
      executionId,
      resultId,
      evidenceId,
      eventId: event.eventId,
      input,
      result,
      evidence: evidencePackage,
      event,
      revisionBinding,
      persistedAtIso
    };

    const canonicalHash = CollisionTruthThread.computeInputHash(unhashedRecord as any);

    const record: CollisionPersistedRecord = Object.freeze({
      ...unhashedRecord,
      canonicalHash
    });

    const recordJson = this.serializeRecord(record);
    const filePath = joinPath(this.getStorageDir(), `record_${executionId}.json`);
    const fsNode = getNodeFs();

    try {
      if (fsNode && fsNode.writeFileSync) {
        fsNode.writeFileSync(filePath, recordJson, 'utf8');
      } else {
        this.inMemoryStore.set(filePath, recordJson);
      }
    } catch {
      this.inMemoryStore.set(filePath, recordJson);
    }

    let readBackJson: string | null = null;
    try {
      if (fsNode && fsNode.readFileSync && fsNode.existsSync && fsNode.existsSync(filePath)) {
        readBackJson = fsNode.readFileSync(filePath, 'utf8');
      } else {
        readBackJson = this.inMemoryStore.get(filePath) || null;
      }
    } catch {
      readBackJson = this.inMemoryStore.get(filePath) || null;
    }

    if (!readBackJson) {
      throw new Error(`[P7_EVIDENCE_WRITE_FAILED] Disk read-back failed for file: ${filePath}`);
    }

    const parsedRecord = this.deserializeRecord<CollisionPersistedRecord>(readBackJson);
    if (parsedRecord.canonicalHash !== record.canonicalHash || parsedRecord.executionId !== record.executionId) {
      throw new Error(`[P7_EVIDENCE_WRITE_FAILED] Read-back canonical hash mismatch for file: ${filePath}`);
    }

    return record;
  }

  public static async listExecutionIds(): Promise<string[]> {
    this.ensureStorageDir();
    const ids: string[] = [];
    const fsNode = getNodeFs();
    try {
      if (fsNode && fsNode.readdirSync && fsNode.existsSync) {
        const dir = this.getStorageDir();
        if (fsNode.existsSync(dir)) {
          const files = fsNode.readdirSync(dir);
          for (const file of files) {
            if (file.startsWith('record_') && file.endsWith('.json')) {
              ids.push(file.slice('record_'.length, -'.json'.length));
            }
          }
        }
      }
    } catch {
      // ignore filesystem errors
    }
    for (const key of this.inMemoryStore.keys()) {
      const base = basenamePath(key);
      if (base.startsWith('record_') && base.endsWith('.json')) {
        const id = base.slice('record_'.length, -'.json'.length);
        if (!ids.includes(id)) {
          ids.push(id);
        }
      }
    }
    return ids;
  }

  public static async reload(executionId: string): Promise<{
    record: CollisionPersistedRecord | null;
    verificationStatus: VerificationStatus;
    errors: string[];
  }> {
    this.ensureStorageDir();
    const filePath = joinPath(this.getStorageDir(), `record_${executionId}.json`);
    const fsNode = getNodeFs();

    let readBackJson: string | null = null;
    try {
      if (fsNode && fsNode.readFileSync && fsNode.existsSync && fsNode.existsSync(filePath)) {
        readBackJson = fsNode.readFileSync(filePath, 'utf8');
      } else {
        readBackJson = this.inMemoryStore.get(filePath) || null;
      }
    } catch {
      readBackJson = this.inMemoryStore.get(filePath) || null;
    }

    if (!readBackJson) {
      return {
        record: null,
        verificationStatus: 'NOT_AUTHORITATIVE',
        errors: [`Record file not found for executionId: ${executionId}`]
      };
    }

    let record: CollisionPersistedRecord;
    try {
      record = this.deserializeRecord<CollisionPersistedRecord>(readBackJson);
    } catch (e: any) {
      return {
        record: null,
        verificationStatus: 'INTEGRITY_FAILURE',
        errors: [`JSON deserialization failed: ${e.message}`]
      };
    }

    const errors: string[] = [];

    const calcInputHash = CollisionTruthThread.computeInputHash(record.input);
    if (calcInputHash !== record.event.inputHash) {
      errors.push(`Input hash mismatch: stored '${record.event.inputHash}', calculated '${calcInputHash}'`);
    }

    const calcResultHash = CollisionTruthThread.computeResultHash(record.result);
    if (calcResultHash !== record.event.resultHash) {
      errors.push(`Result hash mismatch: stored '${record.event.resultHash}', calculated '${calcResultHash}'`);
    }

    const { canonicalHash, ...unhashedRecord } = record;
    const calcCanonicalHash = CollisionTruthThread.computeInputHash(unhashedRecord as any);
    if (record.canonicalHash && calcCanonicalHash !== record.canonicalHash) {
      errors.push(`Canonical record hash mismatch: stored '${record.canonicalHash}', calculated '${calcCanonicalHash}'`);
    }

    const rawEvidence = {
      evidenceId: record.evidence.evidenceId,
      resultId: record.evidence.resultId,
      executionId: record.evidence.executionId,
      inputHash: record.evidence.inputHash,
      resultHash: record.evidence.resultHash,
      geometryHash: record.evidence.geometryHash,
      snapshotId: record.evidence.snapshotId,
      revisionBinding: record.evidence.revisionBinding,
      providerId: record.evidence.providerId,
      algorithmVersion: record.evidence.algorithmVersion,
      exactness: record.evidence.exactness,
      status: record.evidence.status,
      provenSafe: record.evidence.provenSafe,
      timestampIso: record.evidence.timestampIso
    };
    const calcEvidenceHash = CollisionTruthThread.computeEvidenceHash(rawEvidence);
    if (calcEvidenceHash !== record.evidence.evidenceHash || calcEvidenceHash !== record.event.evidenceHash) {
      errors.push(`Evidence hash mismatch: stored '${record.evidence.evidenceHash}', calculated '${calcEvidenceHash}'`);
    }

    const isFailedStatus = [
      CollisionStatus.ANALYSIS_FAILED,
      CollisionStatus.INVALID_GEOMETRY,
      CollisionStatus.UNKNOWN,
      CollisionStatus.UNSUPPORTED,
      CollisionStatus.TIMEOUT,
      CollisionStatus.NUMERICAL_FAILURE,
      CollisionStatus.AMBIGUOUS
    ].includes(record.result.status);

    if (record.result.provenSafe && (record.result.status !== CollisionStatus.NO_COLLISION || isFailedStatus)) {
      errors.push(`Invariant Violation: provenSafe=true but status is '${record.result.status}'`);
    }

    if (errors.length > 0) {
      return {
        record: null,
        verificationStatus: 'INTEGRITY_FAILURE',
        errors
      };
    }

    const docResolver = CollisionAuthority.getResolver();
    const docId = record.revisionBinding.documentId;
    const revId = record.revisionBinding.revisionId;

    if (docResolver.has(docId)) {
      const currentDoc = docResolver.resolve(docId, revId);
      if (!currentDoc) {
        return {
          record,
          verificationStatus: 'STALE_RESULT',
          errors: [`Stale result: document '${docId}' revision '${revId}' no longer exists in CAD registry.`]
        };
      }
    }

    return {
      record,
      verificationStatus: 'AUTHORITATIVE',
      errors: []
    };
  }

  public static buildProvenanceGraph(record: CollisionPersistedRecord): ProvenanceGraph {
    const rb = record.revisionBinding;
    const nodes: ProvenanceTraceNode[] = [
      { level: 'DOCUMENT', id: rb.documentId, hash: rb.documentId, verified: true },
      { level: 'REVISION', id: rb.revisionId, hash: rb.revisionId, verified: true },
      { level: 'GEOMETRY', id: rb.geometryId, hash: rb.geometryHash, verified: !!rb.geometryHash },
      { level: 'SNAPSHOT', id: rb.snapshotId, hash: rb.snapshotId, verified: !!rb.snapshotId },
      { level: 'INPUT', id: record.executionId, hash: record.event.inputHash, verified: !!record.event.inputHash },
      { level: 'EXECUTION', id: record.executionId, hash: record.executionId, verified: true },
      { level: 'PROVIDER', id: record.event.providerId, hash: record.event.providerId, verified: true },
      { level: 'RESULT', id: record.resultId, hash: record.event.resultHash, verified: !!record.event.resultHash },
      { level: 'VERIFICATION', id: `VERIF_${record.executionId}`, hash: record.evidence.evidenceHash, verified: true },
      { level: 'EVIDENCE', id: record.evidenceId, hash: record.evidence.evidenceHash, verified: !!record.evidence.evidenceHash },
      { level: 'EVENT', id: record.eventId, hash: record.event.eventHash, verified: !!record.event.eventHash }
    ];

    const isUnbrokenChain = nodes.every(n => n.verified);

    return {
      documentId: rb.documentId,
      revisionId: rb.revisionId,
      geometryId: rb.geometryId,
      snapshotId: rb.snapshotId,
      executionId: record.executionId,
      resultId: record.resultId,
      evidenceId: record.evidenceId,
      eventId: record.eventId,
      nodes,
      isUnbrokenChain
    };
  }
}
