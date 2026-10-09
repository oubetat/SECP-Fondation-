import { EngineeringDocument } from './CADDocument';
import { RevisionUtils } from '../core/RevisionUtils';

export interface DocumentResolutionResult {
  status: 'RESOLVED' | 'MISSING' | 'CYCLIC' | 'DEPTH_EXCEEDED' | 'UNRESOLVED' | 'STALE' | string;
  document?: EngineeringDocument;
  documentId: string;
  error?: string;
}

export interface IDocumentResolver {
  resolveDocument?: (docId: string) => EngineeringDocument | null | undefined;
  resolve?: (documentId: string, revisionId?: string | number) => EngineeringDocument | undefined;
  resolveWithStatus?: (documentId: string, context?: DocumentEvaluationContext) => DocumentResolutionResult;
  register?: (doc: EngineeringDocument) => void;
  has?: (documentId: string) => boolean;
}

export type DocumentResolutionStatus = 'RESOLVED' | 'NOT_FOUND' | 'UNRESOLVED' | 'STALE' | 'MISSING' | 'CYCLIC' | 'DEPTH_EXCEEDED' | string;

export interface DocumentEvaluationContext {
  resolver?: IDocumentResolver;
  documentId?: string;
  revisionId?: string | number;
  depth?: number;
  maxDepth?: number;
  visitedDocIds?: Set<string>;
  [key: string]: any;
}

export class InMemoryDocumentResolver implements IDocumentResolver {
  private registry = new Map<string, EngineeringDocument>();
  private unregisteredIds = new Set<string>();

  constructor(initialDocs?: readonly EngineeringDocument[] | EngineeringDocument[]) {
    if (initialDocs && Array.isArray(initialDocs)) {
      for (const doc of initialDocs) {
        this.register(doc);
      }
    }
  }

  public register(doc: EngineeringDocument): void {
    const docId = doc.documentId || doc.id || '';
    const rev = doc.revision;
    
    // Register specific revision
    this.registry.set(`${docId}_${rev}`, doc);
    
    // Register canonical alpha revision if it differs from raw revision
    const canonicalRev = RevisionUtils.deriveRevisionCode(rev);
    if (String(canonicalRev) !== String(rev)) {
      this.registry.set(`${docId}_${canonicalRev}`, doc);
    }

    // Explicitly record the latest version for bare documentId resolution
    this.registry.set(docId, doc);
    this.unregisteredIds.delete(docId);
  }

  /**
   * Resolves a document by ID and optional revision.
   * If revisionId is provided, it attempts to find that exact revision.
   * If revisionId is undefined, it returns the latest registered version for that documentId.
   */
  public resolve(documentId: string, revisionId?: string | number): EngineeringDocument | undefined {
    if (revisionId !== undefined) {
      const exactKey = `${documentId}_${revisionId}`;
      const doc = this.registry.get(exactKey);
      if (doc) return doc;

      // Try canonical version if not found
      const canonicalRev = RevisionUtils.deriveRevisionCode(revisionId);
      if (String(canonicalRev) !== String(revisionId)) {
        return this.registry.get(`${documentId}_${canonicalRev}`);
      }
      return undefined;
    }
    
    return this.registry.get(documentId);
  }

  /**
   * Authoritative resolution with status metadata for forensic traceability.
   */
  public resolveWithStatus(documentId: string, context?: DocumentEvaluationContext): DocumentResolutionResult {
    // 1. Depth Check
    if (context && context.depth !== undefined && context.maxDepth !== undefined) {
      if (context.depth >= context.maxDepth) {
        return {
          status: 'DEPTH_EXCEEDED',
          documentId,
          error: `Maximum evaluation depth (${context.maxDepth}) exceeded during resolution of ${documentId}`
        };
      }
    }

    // 2. Cyclic Check
    if (context && context.visitedDocIds && context.visitedDocIds.has(documentId)) {
      return {
        status: 'CYCLIC',
        documentId,
        error: `Cyclic document reference detected: ${documentId} is already in the current evaluation stack`
      };
    }

    // 3. Registry Lookup
    const doc = this.resolve(documentId, context?.revisionId);
    if (!doc) {
      return {
        status: 'MISSING',
        documentId,
        error: `Referenced document not found in registry: ${documentId}`
      };
    }

    return {
      status: 'RESOLVED',
      document: doc,
      documentId
    };
  }

  public has(documentId: string): boolean {
    return Array.from(this.registry.keys()).some(k => k.startsWith(documentId));
  }

  public isUnregistered(documentId: string): boolean {
    return this.unregisteredIds.has(documentId);
  }

  public unregister(documentId: string, revision?: number): void {
    this.unregisteredIds.add(documentId);
    if (revision !== undefined) {
      this.registry.delete(`${documentId}_${revision}`);
    } else {
      this.registry.delete(documentId);
      for (const key of Array.from(this.registry.keys())) {
        if (key.startsWith(`${documentId}_`) || key === documentId) {
          this.registry.delete(key);
        }
      }
    }
  }

  public clear(): void {
    this.registry.clear();
    this.unregisteredIds.clear();
  }
}
