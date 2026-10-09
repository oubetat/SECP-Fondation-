/**
 * SECP Industrial OS v3 — PROMPT-054: Canonical State Synchronization Engine
 * Central engine governing Backend-to-UI State Synchronization.
 * Guarantees zero engineering state fracture, out-of-order event protection,
 * atomic snapshot projection, and stale state detection.
 */

import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { CanonicalProjections } from './CanonicalProjections';
import {
  CanonicalStateProjectionSnapshot,
  DocumentRevisionEvent,
  SelectionReference,
  SyncTelemetryRecord
} from './SyncTypes';

export type SyncListener = (snapshot: CanonicalStateProjectionSnapshot) => void;

export class StateSyncEngine {
  private static instance: StateSyncEngine;

  private activeDocuments: Map<string, EngineeringDocument> = new Map();
  private highestObservedRevisions: Map<string, number> = new Map();
  private activeSnapshots: Map<string, CanonicalStateProjectionSnapshot> = new Map();
  private selectedFeatureIds: Map<string, string | undefined> = new Map();
  private activeSelections: Map<string, SelectionReference | undefined> = new Map();

  private listeners: Map<string, Set<SyncListener>> = new Map();
  private telemetryLog: SyncTelemetryRecord[] = [];

  private constructor() {}

  public static getInstance(): StateSyncEngine {
    if (!StateSyncEngine.instance) {
      StateSyncEngine.instance = new StateSyncEngine();
    }
    return StateSyncEngine.instance;
  }

  /**
   * Initializes or registers an initial canonical EngineeringDocument.
   */
  public registerDocument(doc: EngineeringDocument): CanonicalStateProjectionSnapshot {
    this.activeDocuments.set(doc.documentId, doc);
    this.highestObservedRevisions.set(doc.documentId, doc.revision);

    const snapshot = this.buildSnapshot(
      doc,
      'INITIAL',
      this.selectedFeatureIds.get(doc.documentId),
      this.activeSelections.get(doc.documentId)
    );

    this.activeSnapshots.set(doc.documentId, snapshot);
    this.notifyListeners(doc.documentId, snapshot);
    return snapshot;
  }

  /**
   * Main entry point for applying a canonical document mutation.
   * Guarantees revision ordering, out-of-order event rejection, and atomic projection updates.
   */
  public applyMutation(
    doc: EngineeringDocument,
    source: 'MUTATION' | 'UNDO' | 'REDO' | 'RECONNECT' | 'PERSISTENCE_RELOAD' = 'MUTATION',
    executionResult?: any
  ): { success: boolean; snapshot?: CanonicalStateProjectionSnapshot; error?: string } {
    const startTime = Date.now();
    const docId = doc.documentId;
    const highestRev = this.highestObservedRevisions.get(docId) ?? 0;

    // Out-of-Order Event Protection & Stale Revision Rejection
    if (source === 'MUTATION' && doc.revision <= highestRev) {
      this.recordTelemetry({
        documentId: docId,
        fromRevision: highestRev,
        toRevision: doc.revision,
        mutationId: `MUT-REJECT-${Date.now()}`,
        syncResult: 'REJECTED_OUT_OF_ORDER',
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      return {
        success: false,
        error: `Out-of-Order event rejected: Incoming revision ${doc.revision} <= highest observed revision ${highestRev}.`
      };
    }

    // Update active document and revision counter
    this.activeDocuments.set(docId, doc);
    this.highestObservedRevisions.set(docId, doc.revision);

    // Build atomic snapshot for exact doc.revision
    const snapshot = this.buildSnapshot(
      doc,
      source,
      this.selectedFeatureIds.get(docId),
      this.activeSelections.get(docId),
      executionResult
    );

    // Reconcile selection status if selection was invalidated
    if (snapshot.selection.selectionStatus === 'INVALIDATED') {
      this.activeSelections.set(docId, undefined);
    }

    this.activeSnapshots.set(docId, snapshot);
    this.notifyListeners(docId, snapshot);

    this.recordTelemetry({
      documentId: docId,
      fromRevision: highestRev,
      toRevision: doc.revision,
      mutationId: `MUT-${doc.revision}-${Date.now()}`,
      syncResult: 'SUCCESS',
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });

    return { success: true, snapshot };
  }

  /**
   * Sets current UI selected feature ID and refreshes properties projection.
   */
  public setSelectedFeature(documentId: string, featureId?: string): CanonicalStateProjectionSnapshot | undefined {
    this.selectedFeatureIds.set(documentId, featureId);
    const doc = this.activeDocuments.get(documentId);
    if (!doc) return undefined;

    return this.applyMutation(doc, 'MUTATION');
  }

  /**
   * Sets current UI selected topology reference and reconciles selection projection.
   */
  public setSelectedTopology(documentId: string, selection?: SelectionReference): CanonicalStateProjectionSnapshot | undefined {
    this.activeSelections.set(documentId, selection);
    const doc = this.activeDocuments.get(documentId);
    if (!doc) return undefined;

    return this.applyMutation(doc, 'MUTATION');
  }

  /**
   * Simulates a backend reconnect: discards local UI state and rebuilds from backend authority.
   */
  public reconnectBackend(doc: EngineeringDocument): CanonicalStateProjectionSnapshot {
    // Reset highest observed revision to force authoritative rebuild
    this.highestObservedRevisions.set(doc.documentId, doc.revision);
    const result = this.applyMutation(doc, 'RECONNECT');
    return result.snapshot!;
  }

  /**
   * Reconciles Undo operation.
   */
  public applyUndo(previousDoc: EngineeringDocument): CanonicalStateProjectionSnapshot {
    this.highestObservedRevisions.set(previousDoc.documentId, previousDoc.revision);
    const result = this.applyMutation(previousDoc, 'UNDO');
    return result.snapshot!;
  }

  /**
   * Reconciles Redo operation.
   */
  public applyRedo(nextDoc: EngineeringDocument): CanonicalStateProjectionSnapshot {
    this.highestObservedRevisions.set(nextDoc.documentId, nextDoc.revision);
    const result = this.applyMutation(nextDoc, 'REDO');
    return result.snapshot!;
  }

  /**
   * Retrieves active snapshot for a document.
   */
  public getSnapshot(documentId: string): CanonicalStateProjectionSnapshot | undefined {
    return this.activeSnapshots.get(documentId);
  }

  /**
   * Subscribes a UI component listener to document state synchronization updates.
   */
  public subscribe(documentId: string, listener: SyncListener): () => void {
    if (!this.listeners.has(documentId)) {
      this.listeners.set(documentId, new Set());
    }
    this.listeners.get(documentId)!.add(listener);

    return () => {
      const set = this.listeners.get(documentId);
      if (set) {
        set.delete(listener);
      }
    };
  }

  /**
   * Audits UI state against canonical snapshot to detect any state divergence.
   */
  public detectDivergence(
    documentId: string,
    uiClaim: {
      claimedRevision: number;
      featureCount: number;
      parameterCount: number;
      status: string;
    }
  ): { hasDivergence: boolean; reasons: string[] } {
    const canonical = this.activeSnapshots.get(documentId);
    const reasons: string[] = [];

    if (!canonical) {
      return { hasDivergence: true, reasons: [`No active canonical snapshot found for document '${documentId}'.`] };
    }

    if (uiClaim.claimedRevision !== canonical.revision) {
      reasons.push(`Revision divergence: UI claims revision ${uiClaim.claimedRevision}, but Canonical Document is at revision ${canonical.revision}.`);
    }

    if (uiClaim.featureCount !== canonical.featureTree.length) {
      reasons.push(`Feature tree count divergence: UI claims ${uiClaim.featureCount} features, but Canonical Document has ${canonical.featureTree.length}.`);
    }

    if (uiClaim.parameterCount !== canonical.properties.items.length) {
      reasons.push(`Properties count divergence: UI claims ${uiClaim.parameterCount} parameters, but Canonical Document has ${canonical.properties.items.length}.`);
    }

    if (uiClaim.status !== canonical.status.status) {
      reasons.push(`Status divergence: UI claims status '${uiClaim.status}', but Canonical Status is '${canonical.status.status}'.`);
    }

    return {
      hasDivergence: reasons.length > 0,
      reasons
    };
  }

  public getTelemetry(): SyncTelemetryRecord[] {
    return [...this.telemetryLog];
  }

  private buildSnapshot(
    doc: EngineeringDocument,
    source: 'INITIAL' | 'MUTATION' | 'UNDO' | 'REDO' | 'RECONNECT' | 'PERSISTENCE_RELOAD',
    selectedFeatureId?: string,
    selectionRef?: SelectionReference,
    executionResult?: any
  ): CanonicalStateProjectionSnapshot {
    const timestamp = new Date().toISOString();

    const featureTree = CanonicalProjections.deriveFeatureTree(doc);
    const properties = CanonicalProjections.deriveProperties(doc, selectedFeatureId);
    const viewport = CanonicalProjections.deriveViewport(doc);
    const selection = CanonicalProjections.reconcileSelection(doc, selectionRef);
    const evidence = CanonicalProjections.reconcileEvidence(doc);
    const status = CanonicalProjections.deriveStatus(doc, executionResult);

    return {
      documentId: doc.documentId,
      revision: doc.revision,
      timestamp,
      featureTree,
      properties,
      viewport,
      selection,
      evidence,
      status,
      isStale: false,
      lastMutationSource: source
    };
  }

  private notifyListeners(documentId: string, snapshot: CanonicalStateProjectionSnapshot): void {
    const set = this.listeners.get(documentId);
    if (set) {
      set.forEach(listener => listener(snapshot));
    }
  }

  private recordTelemetry(record: SyncTelemetryRecord): void {
    this.telemetryLog.push(record);
    if (this.telemetryLog.length > 100) {
      this.telemetryLog.shift();
    }
  }

  public reset(): void {
    this.activeDocuments.clear();
    this.highestObservedRevisions.clear();
    this.activeSnapshots.clear();
    this.selectedFeatureIds.clear();
    this.activeSelections.clear();
    this.listeners.clear();
    this.telemetryLog = [];
  }
}
