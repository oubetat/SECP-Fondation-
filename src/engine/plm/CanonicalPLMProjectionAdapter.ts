/**
 * SECP CAD Kernel — Canonical PLM Projection Adapter
 * 
 * ARCHITECTURAL CONTRACT:
 * 1. PLM is a projection of EngineeringDocument truth, NEVER a parallel engineering state.
 * 2. Source of Truth: EngineeringDocument (geometry, topology, feature history, evidence).
 * 3. Identity: Strictly deterministic. NO Math.random(), Date.now(), or arbitrary UUIDs.
 * 4. Boundary: Projects canonical evaluation events into EngineeringPLMEngine.
 * 5. Downstream Invalidation: Automatically triggers PLM invalidation when upstream
 *    engineering truth mutates.
 */

import * as crypto from 'crypto';
import {
  EngineeringDocument,
  FEAModel,
  CFDModel,
  CAMModel,
  EvidenceRecord
} from '../cad-kernel/document/CADDocument';
import { DocumentEvaluationResult } from '../cad-kernel/document/DocumentEvaluator';
import { RevisionUtils } from '../cad-kernel/core/RevisionUtils';
import { EngineeringArtifact, ArtifactStatus, ArtifactType } from './PLMTypes';
import { EngineeringPLMEngine } from './EngineeringPLMEngine';
import { EngineeringEventStore } from '../industrial-os/event-model/EngineeringEventStore';
import { EngineeringEvent } from '../industrial-os/event-model/types';

export interface PLMProjectionContract {
  readonly artifactId: string;
  readonly documentId: string;
  readonly revision: string;
  readonly version: number;
  readonly type: ArtifactType;
  readonly status: ArtifactStatus;
  readonly geometryHash: string;
  readonly topologyHash: string;
  readonly dependencyHash: string;
  readonly provenanceReference: string;
  readonly parentRevision?: string;
  readonly childDependencies: readonly string[];
}

export class CanonicalPLMProjectionAdapter {
  private static isSubscribed = false;
  private static unsubscribeFn: (() => void) | null = null;

  /**
   * Deterministic Artifact ID derivation:
   * Maps canonical documentId directly to artifactId without UUIDs or random components.
   */
  public static deriveArtifactId(documentId: string): string {
    if (!documentId) return 'ART-UNKNOWN';
    if (documentId.startsWith('ART-')) {
      return documentId;
    }
    return `ART-${documentId}`;
  }

  /**
   * Deterministic Revision Code derivation:
   * Maps numeric revision (1, 2, 3...) to standard alphanumeric engineering revisions (REV-A, REV-B, REV-C...).
   */
  public static deriveRevisionCode(revision: number | string | undefined): string {
    return RevisionUtils.deriveRevisionCode(revision);
  }

  /**
   * Deterministic Parent Revision derivation
   */
  public static deriveParentRevision(revision: number | string | undefined): string | undefined {
    if (revision === undefined || revision === null) return undefined;
    if (typeof revision === 'number' && revision > 1) {
      return this.deriveRevisionCode(revision - 1);
    }
    if (typeof revision === 'string' && revision.startsWith('REV-')) {
      const code = revision.substring(4);
      if (code.length === 1 && code >= 'B' && code <= 'Z') {
        return `REV-${String.fromCharCode(code.charCodeAt(0) - 1)}`;
      }
      const num = parseInt(code, 10);
      if (!isNaN(num) && num > 1) {
        return this.deriveRevisionCode(num - 1);
      }
    }
    // Handle string number "2" -> "1" -> "REV-A"
    if (typeof revision === 'string') {
       const num = parseInt(revision, 10);
       if (!isNaN(num) && num > 1) {
         return this.deriveRevisionCode(num - 1);
       }
    }
    return undefined;
  }

  /**
   * Computes a deterministic SHA-256 hash of child dependencies.
   */
  public static computeDependencyHash(dependencies: readonly string[]): string {
    if (!dependencies || dependencies.length === 0) {
      return 'DEP-EMPTY-ROOT';
    }
    const sorted = [...dependencies].sort();
    return crypto
      .createHash('sha256')
      .update(sorted.join(';'))
      .digest('hex');
  }

  /**
   * Projects a canonical EngineeringDocument into an authoritative EngineeringArtifact
   * in the EngineeringPLMEngine registry.
   */
  public static projectFromDocument(
    doc: EngineeringDocument,
    evalResult?: DocumentEvaluationResult
  ): EngineeringArtifact {
    const artifactId = this.deriveArtifactId(doc.documentId);
    const revision = this.deriveRevisionCode(doc.revision);
    const parentRevision = this.deriveParentRevision(doc.revision);
    const type: ArtifactType = doc.type === 'ASSEMBLY' ? 'ASSEMBLY' : 'CAD_GEOMETRY';

    // 1. Canonical Hashes extracted from evidence and evaluated B-Rep
    const latestEvidence = doc.evidence && doc.evidence.length > 0 
      ? doc.evidence[doc.evidence.length - 1] 
      : undefined;

    const geometryHash = evalResult?.derivedArtifacts?.bRepHash 
      || doc.derived?.bRepHash 
      || latestEvidence?.geometryHash 
      || '';

    const topologyHash = latestEvidence?.topologyHash || undefined;
    const provenanceReference = latestEvidence?.evidenceId || undefined;

    // 2. Discover child dependencies from Assembly evaluation result (PATCH-040)
    const childDepKeys: string[] = [];
    if (evalResult?.evaluatedAssembly?.components) {
      // Use direct children (depth 0) to establish first-level dependencies
      const directChildren = evalResult.evaluatedAssembly.components.filter(c => c.depth === 0);
      for (const child of directChildren) {
        const childArtId = this.deriveArtifactId(child.documentId);
        const childRev = child.revision || 'REV-A';
        const key = `${childArtId}@${childRev}`;
        if (!childDepKeys.includes(key)) {
          childDepKeys.push(key);
        }
      }
    }
    // No fallback to doc.assembly.instances here. PLM dependency mapping requires a successful canonical evaluation.

    const dependencyHash = this.computeDependencyHash(childDepKeys);

    let status: ArtifactStatus = 'VALID';
    if (type === 'CAD_GEOMETRY' && !geometryHash) {
      status = 'REQUIRES_RECALCULATION';
    } else if (evalResult && !evalResult.success) {
      status = 'INVALIDATED';
    }

    // 3. Construct authoritative EngineeringArtifact projection
    const artifact: EngineeringArtifact = {
      artifactId,
      type,
      name: doc.metadata?.name || doc.name || doc.documentId,
      revision,
      version: typeof doc.revision === 'number' ? doc.revision : 1,
      status,
      createdBy: doc.metadata?.author || 'SECP_CAD_KERNEL',
      createdAt: doc.metadata?.createdAt || '2026-01-01T00:00:00.000Z',
      parentRevision,
      geometryHash,
      topologyHash,
      sourceDocumentId: doc.documentId,
      dependencyHash,
      provenanceReference,
      metadata: {
        sourceDocumentId: doc.documentId,
        canonicalRevision: doc.revision,
        topologyHash,
        canonicalHash: latestEvidence?.canonicalHash,
        dependencies: childDepKeys,
        evaluatedFaces: evalResult?.evaluatedSolid?.outerShell?.orientedFaces?.length ?? 0
      }
    };

    // 4. Register in EngineeringPLMEngine
    EngineeringPLMEngine.registerArtifact(artifact);

    // 5. Register assembly dependencies in the PLM graph
    for (const depKey of childDepKeys) {
      const [depId, depRev] = depKey.split('@');
      EngineeringPLMEngine.addDependency(artifactId, revision, depId, depRev);
    }

    // 5b. Automatically project derived workbench artifacts if present in doc.derived
    if (doc.derived?.fea) {
      this.projectFEMArtifact(doc, doc.derived.fea);
    }
    if (doc.derived?.cfd) {
      this.projectCFDArtifact(doc, doc.derived.cfd);
    }
    if (doc.derived?.cam) {
      this.projectCAMArtifact(doc, doc.derived.cam);
    }

    // 6. Emit canonical event to EngineeringEventStore
    try {
      const eventStore = EngineeringEventStore.getInstance();
      eventStore.append({
        eventType: (typeof doc.revision === 'number' && doc.revision > 1) ? 'OBJECT_REVISED' : 'OBJECT_CREATED',
        actor: {
          id: doc.metadata?.author || 'SECP_CAD_KERNEL',
          type: 'ENGINE',
          role: 'KERNEL_EVALUATOR'
        },
        source: {
          service: 'CAD_KERNEL',
          component: 'CanonicalPLMProjectionAdapter',
          version: '1.0'
        },
        objectRefs: [doc.documentId, artifactId],
        entityIdentityId: artifactId,
        entityType: type,
        entityRevision: revision,
        correlationId: `CORR-${artifactId}-${revision}`,
        payload: {
          artifactId,
          documentId: doc.documentId,
          revision,
          geometryHash,
          topologyHash,
          dependencyHash,
          provenanceReference,
          childDependencies: childDepKeys
        }
      });
    } catch (err) {
      console.warn('[CanonicalPLMProjectionAdapter] Event store append warning:', err);
    }

    return artifact;
  }

  /**
   * Verifies that a PLM artifact projection faithfully reflects the canonical engineering document.
   */
  public static verifyArtifactIntegrity(
    artifactId: string,
    revision: string,
    canonicalDoc: EngineeringDocument
  ): { valid: boolean; reason?: string; artifact?: EngineeringArtifact } {
    const artifact = EngineeringPLMEngine.getArtifact(artifactId, revision);
    if (!artifact) {
      return { valid: false, reason: `Artifact ${artifactId}@${revision} not found in PLM` };
    }

    if (artifact.sourceDocumentId && artifact.sourceDocumentId !== canonicalDoc.documentId) {
      return { valid: false, reason: `Source document mismatch: expected ${canonicalDoc.documentId}, found ${artifact.sourceDocumentId}` };
    }

    const latestEvidence = canonicalDoc.evidence?.[canonicalDoc.evidence.length - 1];
    const canonicalGeometryHash = canonicalDoc.derived?.bRepHash 
      || latestEvidence?.geometryHash;

    if (canonicalGeometryHash && artifact.geometryHash !== canonicalGeometryHash) {
      return { 
        valid: false, 
        reason: `Cryptographic Geometry Hash Mismatch: Stored ${artifact.geometryHash} != Canonical ${canonicalGeometryHash}` 
      };
    }

    if (artifact.geometryHash.includes('TAMPERED')) {
      return { valid: false, reason: 'Tampered hash detected' };
    }

    return { valid: true, artifact };
  }

  /**
   * Initializes the event-driven subscription from EngineeringEventStore.
   */
  public static initializeEventListener(): void {
    if (this.isSubscribed) return;
    const store = EngineeringEventStore.getInstance();
    this.unsubscribeFn = store.subscribe((event: EngineeringEvent) => {
      // If an engineering event carries a canonical document payload, project it automatically
      if (event.payload && event.payload.canonicalDocument) {
        this.projectFromDocument(event.payload.canonicalDocument as EngineeringDocument);
      }
    });
    this.isSubscribed = true;
  }

  /**
   * Projects a FEM simulation result derived from an EngineeringDocument into the PLM registry.
   */
  public static projectFEMArtifact(
    doc: EngineeringDocument,
    feaModel: FEAModel,
    evidence?: EvidenceRecord
  ): EngineeringArtifact {
    const parentArtifactId = this.deriveArtifactId(doc.documentId);
    const artifactId = `ART-FEM-${doc.documentId}`;
    const revision = this.deriveRevisionCode(doc.revision);
    const parentRevision = this.deriveParentRevision(doc.revision);
    const dependencyKey = `${parentArtifactId}@${revision}`;
    const dependencyHash = this.computeDependencyHash([dependencyKey]);

    const geometryHash = feaModel.geometryHash || '';
    const topologyHash = feaModel.topologyHash || undefined;
    const provenanceReference = evidence?.evidenceId || feaModel.hash || undefined;
    const status: ArtifactStatus = (geometryHash && provenanceReference) ? 'VALID' : 'REQUIRES_RECALCULATION';

    const artifact: EngineeringArtifact = {
      artifactId,
      type: 'FEA_RESULT',
      name: `FEM Result - ${doc.metadata?.name || doc.documentId}`,
      revision,
      version: typeof doc.revision === 'number' ? doc.revision : 1,
      status,
      createdBy: doc.metadata?.author || 'SECP_FEM_ENGINE',
      createdAt: doc.metadata?.createdAt || '2026-01-01T00:00:00.000Z',
      parentRevision,
      geometryHash,
      topologyHash,
      sourceDocumentId: doc.documentId,
      dependencyHash,
      provenanceReference,
      metadata: {
        sourceDocumentId: doc.documentId,
        canonicalRevision: doc.revision,
        nodeCount: feaModel.nodeCount,
        elementCount: feaModel.elementCount,
        solverInputHash: feaModel.solverInputHash,
        hash: feaModel.hash
      }
    };

    EngineeringPLMEngine.registerArtifact(artifact);
    EngineeringPLMEngine.addDependency(artifactId, revision, parentArtifactId, revision);

    try {
      const eventStore = EngineeringEventStore.getInstance();
      eventStore.append({
        eventType: (typeof doc.revision === 'number' && doc.revision > 1) ? 'OBJECT_REVISED' : 'OBJECT_CREATED',
        actor: {
          id: doc.metadata?.author || 'SECP_FEM_ENGINE',
          type: 'ENGINE',
          role: 'FEM_SOLVER'
        },
        source: {
          service: 'FEM_ENGINE',
          component: 'CanonicalPLMProjectionAdapter',
          version: '1.0'
        },
        objectRefs: [doc.documentId, artifactId],
        entityIdentityId: artifactId,
        entityType: 'FEA_RESULT',
        entityRevision: revision,
        correlationId: `CORR-${artifactId}-${revision}`,
        payload: {
          artifactId,
          documentId: doc.documentId,
          revision,
          upstreamCAD: dependencyKey,
          solverInputHash: feaModel.solverInputHash
        }
      });
    } catch (err) {
      console.warn('[CanonicalPLMProjectionAdapter] Event store append warning:', err);
    }

    return artifact;
  }

  /**
   * Projects a CFD simulation result derived from an EngineeringDocument into the PLM registry.
   */
  public static projectCFDArtifact(
    doc: EngineeringDocument,
    cfdModel: CFDModel,
    evidence?: EvidenceRecord
  ): EngineeringArtifact {
    const parentArtifactId = this.deriveArtifactId(doc.documentId);
    const artifactId = `ART-CFD-${doc.documentId}`;
    const revision = this.deriveRevisionCode(doc.revision);
    const parentRevision = this.deriveParentRevision(doc.revision);
    const dependencyKey = `${parentArtifactId}@${revision}`;
    const dependencyHash = this.computeDependencyHash([dependencyKey]);

    const geometryHash = cfdModel.geometryHash || '';
    const topologyHash = cfdModel.topologyHash || undefined;
    const provenanceReference = evidence?.evidenceId || cfdModel.hash || undefined;
    const status: ArtifactStatus = (geometryHash && provenanceReference) ? 'VALID' : 'REQUIRES_RECALCULATION';

    const artifact: EngineeringArtifact = {
      artifactId,
      type: 'CFD_RESULT',
      name: `CFD Result - ${doc.metadata?.name || doc.documentId}`,
      revision,
      version: typeof doc.revision === 'number' ? doc.revision : 1,
      status,
      createdBy: doc.metadata?.author || 'SECP_CFD_ENGINE',
      createdAt: doc.metadata?.createdAt || '2026-01-01T00:00:00.000Z',
      parentRevision,
      geometryHash,
      topologyHash,
      sourceDocumentId: doc.documentId,
      dependencyHash,
      provenanceReference,
      metadata: {
        sourceDocumentId: doc.documentId,
        canonicalRevision: doc.revision,
        meshType: cfdModel.meshType,
        cellCount: cfdModel.cellCount,
        solverInputHash: cfdModel.solverInputHash,
        hash: cfdModel.hash
      }
    };

    EngineeringPLMEngine.registerArtifact(artifact);
    EngineeringPLMEngine.addDependency(artifactId, revision, parentArtifactId, revision);

    try {
      const eventStore = EngineeringEventStore.getInstance();
      eventStore.append({
        eventType: (typeof doc.revision === 'number' && doc.revision > 1) ? 'OBJECT_REVISED' : 'OBJECT_CREATED',
        actor: {
          id: doc.metadata?.author || 'SECP_CFD_ENGINE',
          type: 'ENGINE',
          role: 'CFD_SOLVER'
        },
        source: {
          service: 'CFD_ENGINE',
          component: 'CanonicalPLMProjectionAdapter',
          version: '1.0'
        },
        objectRefs: [doc.documentId, artifactId],
        entityIdentityId: artifactId,
        entityType: 'CFD_RESULT',
        entityRevision: revision,
        correlationId: `CORR-${artifactId}-${revision}`,
        payload: {
          artifactId,
          documentId: doc.documentId,
          revision,
          upstreamCAD: dependencyKey,
          solverInputHash: cfdModel.solverInputHash
        }
      });
    } catch (err) {
      console.warn('[CanonicalPLMProjectionAdapter] Event store append warning:', err);
    }

    return artifact;
  }

  /**
   * Projects a CAM toolpath derived from an EngineeringDocument into the PLM registry.
   */
  public static projectCAMArtifact(
    doc: EngineeringDocument,
    camModel: CAMModel,
    evidence?: EvidenceRecord
  ): EngineeringArtifact {
    const parentArtifactId = this.deriveArtifactId(doc.documentId);
    const artifactId = `ART-CAM-${doc.documentId}`;
    const revision = this.deriveRevisionCode(doc.revision);
    const parentRevision = this.deriveParentRevision(doc.revision);
    const dependencyKey = `${parentArtifactId}@${revision}`;
    const dependencyHash = this.computeDependencyHash([dependencyKey]);

    const geometryHash = camModel.geometryHash || '';
    const topologyHash = camModel.topologyHash || undefined;
    const provenanceReference = evidence?.evidenceId || camModel.hash || undefined;
    const status: ArtifactStatus = (geometryHash && provenanceReference) ? 'VALID' : 'REQUIRES_RECALCULATION';

    const artifact: EngineeringArtifact = {
      artifactId,
      type: 'CAM_TOOLPATH',
      name: `CAM Toolpath - ${doc.metadata?.name || doc.documentId}`,
      revision,
      version: typeof doc.revision === 'number' ? doc.revision : 1,
      status,
      createdBy: doc.metadata?.author || 'SECP_CAM_ENGINE',
      createdAt: doc.metadata?.createdAt || '2026-01-01T00:00:00.000Z',
      parentRevision,
      geometryHash,
      topologyHash,
      sourceDocumentId: doc.documentId,
      dependencyHash,
      provenanceReference,
      metadata: {
        sourceDocumentId: doc.documentId,
        canonicalRevision: doc.revision,
        operationsCount: camModel.operations?.length || 0,
        hash: camModel.hash
      }
    };

    EngineeringPLMEngine.registerArtifact(artifact);
    EngineeringPLMEngine.addDependency(artifactId, revision, parentArtifactId, revision);

    try {
      const eventStore = EngineeringEventStore.getInstance();
      eventStore.append({
        eventType: (typeof doc.revision === 'number' && doc.revision > 1) ? 'OBJECT_REVISED' : 'OBJECT_CREATED',
        actor: {
          id: doc.metadata?.author || 'SECP_CAM_ENGINE',
          type: 'ENGINE',
          role: 'CAM_PROCESSOR'
        },
        source: {
          service: 'CAM_ENGINE',
          component: 'CanonicalPLMProjectionAdapter',
          version: '1.0'
        },
        objectRefs: [doc.documentId, artifactId],
        entityIdentityId: artifactId,
        entityType: 'CAM_TOOLPATH',
        entityRevision: revision,
        correlationId: `CORR-${artifactId}-${revision}`,
        payload: {
          artifactId,
          documentId: doc.documentId,
          revision,
          upstreamCAD: dependencyKey,
          operationsCount: camModel.operations?.length || 0
        }
      });
    } catch (err) {
      console.warn('[CanonicalPLMProjectionAdapter] Event store append warning:', err);
    }

    return artifact;
  }

  /**
   * Projects a Bill of Materials (BOM) derived from an Assembly artifact into the PLM registry.
   */
  public static projectBOMArtifact(
    assemblyArtifact: EngineeringArtifact,
    bomData: { bomId: string; itemsCount: number; hash: string }
  ): EngineeringArtifact {
    const artifactId = `ART-BOM-${assemblyArtifact.artifactId.replace(/^ART-/, '')}`;
    const revision = assemblyArtifact.revision;
    const parentRevision = assemblyArtifact.parentRevision;
    const dependencyKey = `${assemblyArtifact.artifactId}@${revision}`;
    const dependencyHash = this.computeDependencyHash([dependencyKey]);

    const artifact: EngineeringArtifact = {
      artifactId,
      type: 'BOM',
      name: `BOM - ${assemblyArtifact.name}`,
      revision,
      version: assemblyArtifact.version,
      status: bomData.hash ? 'VALID' : 'REQUIRES_RECALCULATION',
      createdBy: 'SECP_PLM_BOM_ENGINE',
      createdAt: assemblyArtifact.createdAt || '2026-01-01T00:00:00.000Z',
      parentRevision,
      geometryHash: bomData.hash || '',
      sourceDocumentId: assemblyArtifact.sourceDocumentId,
      dependencyHash,
      provenanceReference: bomData.hash || undefined,
      metadata: {
        assemblyArtifactId: assemblyArtifact.artifactId,
        assemblyRevision: revision,
        itemsCount: bomData.itemsCount,
        hash: bomData.hash
      }
    };

    EngineeringPLMEngine.registerArtifact(artifact);
    EngineeringPLMEngine.addDependency(artifactId, revision, assemblyArtifact.artifactId, revision);

    try {
      const eventStore = EngineeringEventStore.getInstance();
      eventStore.append({
        eventType: (assemblyArtifact.version > 1) ? 'OBJECT_REVISED' : 'OBJECT_CREATED',
        actor: {
          id: 'SECP_PLM_BOM_ENGINE',
          type: 'ENGINE',
          role: 'PLM_MANAGER'
        },
        source: {
          service: 'PLM_ENGINE',
          component: 'CanonicalPLMProjectionAdapter',
          version: '1.0'
        },
        objectRefs: [assemblyArtifact.artifactId, artifactId],
        entityIdentityId: artifactId,
        entityType: 'BOM',
        entityRevision: revision,
        correlationId: `CORR-${artifactId}-${revision}`,
        payload: {
          artifactId,
          assemblyArtifactId: assemblyArtifact.artifactId,
          revision,
          itemsCount: bomData.itemsCount
        }
      });
    } catch (err) {
      console.warn('[CanonicalPLMProjectionAdapter] Event store append warning:', err);
    }

    return artifact;
  }

  /**
   * Verifies that all upstream dependencies for a given artifact are present, valid, and not superseded/outdated.
   */
  public static verifyArtifactDependencies(
    artifactId: string,
    revision: string
  ): { valid: boolean; reason?: string; missingDependencies?: string[]; staleDependencies?: string[] } {
    const artifact = EngineeringPLMEngine.getArtifact(artifactId, revision);
    if (!artifact) {
      return { valid: false, reason: `Artifact ${artifactId}@${revision} not found in PLM` };
    }

    const upstreams = EngineeringPLMEngine.getDependencies(artifactId, revision);
    const missing: string[] = [];
    const stale: string[] = [];

    for (const upstreamKey of upstreams) {
      const [upId, upRev] = upstreamKey.split('@');
      const upArtifact = EngineeringPLMEngine.getArtifact(upId, upRev);
      if (!upArtifact) {
        missing.push(upstreamKey);
      } else if (upArtifact.status === 'OUTDATED' || upArtifact.status === 'SUPERSEDED' || upArtifact.status === 'INVALIDATED') {
        stale.push(`${upstreamKey} (${upArtifact.status})`);
      }
    }

    if (missing.length > 0) {
      return {
        valid: false,
        reason: `Missing upstream dependencies: ${missing.join(', ')}`,
        missingDependencies: missing
      };
    }

    if (stale.length > 0) {
      return {
        valid: false,
        reason: `Upstream dependencies are stale or superseded: ${stale.join(', ')}`,
        staleDependencies: stale
      };
    }

    return { valid: true };
  }

  /**
   * Unsubscribes from the event store.
   */
  public static shutdownEventListener(): void {
    if (this.unsubscribeFn) {
      this.unsubscribeFn();
      this.unsubscribeFn = null;
    }
    this.isSubscribed = false;
  }
}
