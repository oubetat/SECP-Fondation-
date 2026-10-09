/**
 * PATCH-194 & PATCH-195: Parametric Feature Tree & Model History Management
 * Implements an industrial Parametric Feature Tree with:
 * - Direct Parent/Child and Ancestor/Descendant causality
 * - Strict Feature Statuses (ACTIVE, SUPPRESSED, INVALID, OUT_OF_DATE, REBUILDING, FAILED, ROLLED_BACK)
 * - Safe Topological Feature Reorder with FeatureReorderValidator
 * - Rollback Bar Cursor (distinguished from suppression and deletion)
 * - Suppression & Unsuppression with Invalidation Propagation
 * - Transactional Snapshots with Undo / Redo
 * - Deterministic Hashing and JSON Serialization
 */

import {
  ParametricFeature,
  FeatureStatus,
  FeatureSuppressionState,
  FeatureRecomputeState,
  FeatureDiagnostic,
  TopologyReference,
  FeatureReorderValidationResult
} from './ParametricFeatureTypes';
import { FeatureDependencyGraph } from './FeatureDependencyGraph';
import { FeatureReorderValidator } from './FeatureReorderValidator';
import { generateDeterministicHashSync } from '../../lib/hash';

export interface FeatureTreeSnapshot {
  features: ParametricFeature[];
  featureOrder: string[];
  activeRollbackId?: string;
  revision: number;
  timestamp: string;
}

export class FeatureTree {
  private features: Map<string, ParametricFeature> = new Map();
  private featureOrder: string[] = []; // Chronological history sequence
  private rollbackTargetId?: string; // Rollback insertion cursor
  private undoStack: FeatureTreeSnapshot[] = [];
  private redoStack: FeatureTreeSnapshot[] = [];
  private revision: number = 1;
  private dependencyGraph: FeatureDependencyGraph = new FeatureDependencyGraph();

  constructor() {}

  /**
   * Returns internal dependency graph
   */
  public getDependencyGraph(): FeatureDependencyGraph {
    this.refreshGraph();
    return this.dependencyGraph;
  }

  /**
   * Refreshes internal dependency graph and parent/child relationships
   */
  public refreshGraph(): void {
    const all = this.getAllFeatures();
    this.dependencyGraph.buildFromParametricFeatures(all);

    // Sync parentFeatures and childFeatures arrays on each feature
    for (const f of all) {
      f.parentFeatures = this.dependencyGraph.getParents(f.id);
      f.childFeatures = this.dependencyGraph.getChildren(f.id);
      f.dependencies = [...f.parentFeatures];
      f.dependents = [...f.childFeatures];
    }
  }

  /**
   * Adds a feature to the tree and establishes history
   */
  public addFeature(feature: ParametricFeature): void {
    this.saveSnapshot();

    // Ensure required properties are filled
    const now = new Date().toISOString();
    const creationIndex = this.featureOrder.length;
    
    const parents = [
      ...(feature.parentFeatures || []),
      ...(feature.parentFeatureId ? [feature.parentFeatureId] : []),
      ...(feature.dependencies || [])
    ].filter(Boolean);

    const fullFeature: ParametricFeature = {
      ...feature,
      featureId: feature.id,
      featureType: feature.type,
      creationIndex,
      parentFeatures: Array.from(new Set(parents)),
      childFeatures: feature.childFeatures || [],
      inputReferences: feature.inputReferences || (feature.parentFeatureId ? [feature.parentFeatureId] : []),
      outputGeometry: feature.resultBody || feature.outputGeometry,
      resultBody: feature.resultBody || feature.outputGeometry,
      status: feature.status || (feature.suppressionState === 'SUPPRESSED' ? 'SUPPRESSED' : 'ACTIVE'),
      suppressed: feature.suppressionState === 'SUPPRESSED' || feature.suppressed === true,
      valid: feature.valid !== undefined ? feature.valid : (feature.recomputeState === 'VALID'),
      createdAt: feature.createdAt || feature.creationEvent?.timestamp || now,
      updatedAt: now,
      revision: feature.revision || 1
    };

    this.features.set(fullFeature.id, fullFeature);
    if (!this.featureOrder.includes(fullFeature.id)) {
      this.featureOrder.push(fullFeature.id);
    }

    this.refreshGraph();
    this.revision++;
  }

  /**
   * Retrieves a feature by ID
   */
  public getFeature(featureId: string): ParametricFeature | undefined {
    return this.features.get(featureId);
  }

  /**
   * Returns all features in history sequence order
   */
  public getAllFeatures(): ParametricFeature[] {
    return this.featureOrder
      .map(id => this.features.get(id)!)
      .filter(Boolean);
  }

  /**
   * Parent / Child & Ancestry Queries
   */
  public getParent(featureId: string): string | undefined {
    const parents = this.getParents(featureId);
    return parents.length > 0 ? parents[0] : undefined;
  }

  public getParents(featureId: string): string[] {
    this.refreshGraph();
    return this.dependencyGraph.getParents(featureId);
  }

  public getChildren(featureId: string): string[] {
    this.refreshGraph();
    return this.dependencyGraph.getChildren(featureId);
  }

  public getAncestors(featureId: string): string[] {
    this.refreshGraph();
    return this.dependencyGraph.getAncestors(featureId);
  }

  public getDescendants(featureId: string): string[] {
    this.refreshGraph();
    return this.dependencyGraph.getDescendants(featureId);
  }

  public getAffectedFeatures(featureId: string): string[] {
    this.refreshGraph();
    return this.dependencyGraph.getAffectedFeatures(featureId);
  }

  /**
   * Renames a feature
   */
  public renameFeature(featureId: string, newName: string): boolean {
    const feat = this.features.get(featureId);
    if (!feat) return false;
    this.saveSnapshot();
    feat.name = newName;
    feat.revision++;
    feat.updatedAt = new Date().toISOString();
    this.revision++;
    return true;
  }

  /**
   * Updates feature parameters
   */
  public updateParameters(
    featureId: string,
    params: Record<string, any>,
    reason = 'Parameter Edit'
  ): boolean {
    const feat = this.features.get(featureId);
    if (!feat) return false;
    this.saveSnapshot();

    feat.parameters = { ...feat.parameters, ...params };
    feat.revision++;
    feat.updatedAt = new Date().toISOString();
    feat.modificationHistory.push({
      revision: feat.revision,
      timestamp: feat.updatedAt,
      changedParams: params,
      reason
    });
    feat.recomputeState = 'INVALIDATED';
    feat.status = 'OUT_OF_DATE';
    this.revision++;
    return true;
  }

  /**
   * Suppresses a feature (disables it without deleting from history)
   */
  public suppressFeature(featureId: string): boolean {
    const feat = this.features.get(featureId);
    if (!feat) return false;
    this.saveSnapshot();
    feat.suppressionState = 'SUPPRESSED';
    feat.suppressed = true;
    feat.status = 'SUPPRESSED';
    feat.recomputeState = 'INVALIDATED';
    feat.updatedAt = new Date().toISOString();
    this.revision++;
    return true;
  }

  /**
   * Unsuppresses a feature
   */
  public unsuppressFeature(featureId: string): boolean {
    const feat = this.features.get(featureId);
    if (!feat) return false;
    this.saveSnapshot();
    feat.suppressionState = 'ACTIVE';
    feat.suppressed = false;
    feat.status = 'ACTIVE';
    feat.recomputeState = 'INVALIDATED';
    feat.updatedAt = new Date().toISOString();
    this.revision++;
    return true;
  }

  /**
   * Updates explicit feature status
   */
  public setFeatureStatus(featureId: string, status: FeatureStatus): boolean {
    const feat = this.features.get(featureId);
    if (!feat) return false;
    feat.status = status;
    feat.valid = (status === 'ACTIVE');
    if (status === 'SUPPRESSED') {
      feat.suppressionState = 'SUPPRESSED';
      feat.suppressed = true;
    } else if (status === 'ACTIVE') {
      feat.suppressionState = 'ACTIVE';
      feat.suppressed = false;
    }
    feat.updatedAt = new Date().toISOString();
    return true;
  }

  /**
   * Removes a feature from the tree
   */
  public removeFeature(featureId: string): boolean {
    if (!this.features.has(featureId)) return false;
    this.saveSnapshot();
    this.features.delete(featureId);
    this.featureOrder = this.featureOrder.filter(id => id !== featureId);
    this.refreshGraph();
    this.revision++;
    return true;
  }

  /**
   * Validates reorder request without applying it
   */
  public canReorder(featureId: string, targetIndex: number): FeatureReorderValidationResult {
    this.refreshGraph();
    return FeatureReorderValidator.validateReorder(
      featureId,
      targetIndex,
      this.featureOrder,
      this.features,
      this.dependencyGraph
    );
  }

  /**
   * Reorders a feature to a new target index if topologically and geometrically valid
   */
  public reorderFeature(featureId: string, targetIndex: number): FeatureReorderValidationResult {
    const validation = this.canReorder(featureId, targetIndex);
    if (!validation.valid) {
      return validation;
    }

    const currentIndex = this.featureOrder.indexOf(featureId);
    if (currentIndex === targetIndex) {
      return validation;
    }

    this.saveSnapshot();
    this.featureOrder.splice(currentIndex, 1);
    this.featureOrder.splice(targetIndex, 0, featureId);

    const feat = this.features.get(featureId);
    if (feat) {
      feat.revision++;
      feat.updatedAt = new Date().toISOString();
    }

    this.refreshGraph();
    this.revision++;
    return validation;
  }

  /**
   * Rollback tree state up to specified feature (Rollback Bar Marker)
   */
  public rollbackTo(featureId?: string): void {
    this.saveSnapshot();
    this.rollbackTargetId = featureId;

    // Update statuses according to rollback marker
    if (!featureId) {
      for (const feat of this.features.values()) {
        if (feat.status === 'ROLLED_BACK') {
          feat.status = feat.suppressed ? 'SUPPRESSED' : 'ACTIVE';
        }
      }
      return;
    }

    const rollbackIdx = this.featureOrder.indexOf(featureId);
    if (rollbackIdx === -1) return;

    for (let i = 0; i < this.featureOrder.length; i++) {
      const id = this.featureOrder[i];
      const feat = this.features.get(id);
      if (!feat) continue;

      if (i > rollbackIdx) {
        feat.status = 'ROLLED_BACK';
      } else {
        if (feat.status === 'ROLLED_BACK') {
          feat.status = feat.suppressed ? 'SUPPRESSED' : 'ACTIVE';
        }
      }
    }
  }

  public clearRollback(): void {
    this.rollbackTo(undefined);
  }

  public getRollbackTargetId(): string | undefined {
    return this.rollbackTargetId;
  }

  public isRolledBack(featureId: string): boolean {
    if (!this.rollbackTargetId) return false;
    const rollbackIdx = this.featureOrder.indexOf(this.rollbackTargetId);
    const featIdx = this.featureOrder.indexOf(featureId);
    return rollbackIdx !== -1 && featIdx > rollbackIdx;
  }

  /**
   * Returns active features up to rollback bar
   */
  public getActiveTimelineFeatures(): ParametricFeature[] {
    const all = this.getAllFeatures();
    if (!this.rollbackTargetId) return all;

    const rollbackIdx = this.featureOrder.indexOf(this.rollbackTargetId);
    if (rollbackIdx === -1) return all;

    return all.slice(0, rollbackIdx + 1);
  }

  /**
   * Undo / Redo Mechanics
   */
  public saveSnapshot(): void {
    const snapshot: FeatureTreeSnapshot = {
      features: this.getAllFeatures().map(f => JSON.parse(JSON.stringify(f))),
      featureOrder: [...this.featureOrder],
      activeRollbackId: this.rollbackTargetId,
      revision: this.revision,
      timestamp: new Date().toISOString()
    };
    this.undoStack.push(snapshot);
    this.redoStack = []; // Clear redo stack on new user operation
  }

  public undo(): boolean {
    if (this.undoStack.length === 0) return false;
    const currentSnapshot: FeatureTreeSnapshot = {
      features: this.getAllFeatures().map(f => JSON.parse(JSON.stringify(f))),
      featureOrder: [...this.featureOrder],
      activeRollbackId: this.rollbackTargetId,
      revision: this.revision,
      timestamp: new Date().toISOString()
    };
    this.redoStack.push(currentSnapshot);

    const prevSnapshot = this.undoStack.pop()!;
    this.restoreSnapshot(prevSnapshot);
    return true;
  }

  public redo(): boolean {
    if (this.redoStack.length === 0) return false;
    const currentSnapshot: FeatureTreeSnapshot = {
      features: this.getAllFeatures().map(f => JSON.parse(JSON.stringify(f))),
      featureOrder: [...this.featureOrder],
      activeRollbackId: this.rollbackTargetId,
      revision: this.revision,
      timestamp: new Date().toISOString()
    };
    this.undoStack.push(currentSnapshot);

    const nextSnapshot = this.redoStack.pop()!;
    this.restoreSnapshot(nextSnapshot);
    return true;
  }

  private restoreSnapshot(snapshot: FeatureTreeSnapshot): void {
    this.features.clear();
    this.featureOrder = [...snapshot.featureOrder];
    for (const f of snapshot.features) {
      this.features.set(f.id, f);
    }
    this.rollbackTargetId = snapshot.activeRollbackId;
    this.revision = snapshot.revision;
    this.refreshGraph();
  }

  /**
   * Serialization / Persistence
   */
  public serialize(): string {
    return JSON.stringify({
      features: this.getAllFeatures(),
      featureOrder: this.featureOrder,
      rollbackTargetId: this.rollbackTargetId,
      revision: this.revision
    });
  }

  public static deserialize(jsonStr: string): FeatureTree {
    const tree = new FeatureTree();
    const data = JSON.parse(jsonStr);
    for (const f of data.features || []) {
      tree.features.set(f.id, f);
    }
    tree.featureOrder = data.featureOrder || [];
    tree.rollbackTargetId = data.rollbackTargetId;
    tree.revision = data.revision || 1;
    tree.refreshGraph();
    return tree;
  }

  /**
   * Deterministic Hash of Feature Tree State
   */
  public getFeatureTreeHash(): string {
    const summary = this.getAllFeatures().map(f => ({
      name: f.name,
      type: f.type || f.featureType,
      params: f.parameters,
      suppressed: f.suppressed,
      status: f.status,
      parents: f.parentFeatures,
      revision: f.revision,
      index: f.creationIndex
    }));
    return generateDeterministicHashSync({
      featureCount: this.featureOrder.length,
      rollback: this.rollbackTargetId,
      features: summary
    });
  }

  public clear(): void {
    this.features.clear();
    this.featureOrder = [];
    this.undoStack = [];
    this.redoStack = [];
    this.rollbackTargetId = undefined;
    this.revision = 1;
    this.dependencyGraph = new FeatureDependencyGraph();
  }
}
