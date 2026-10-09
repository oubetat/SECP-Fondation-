/**
 * SECP CAD Kernel — Feature History Subsystem
 * Phase 2 (PATCH-022)
 *
 * ARCHITECTURAL CONTRACT:
 * - Executable parametric engineering feature history.
 * - Manages FeatureNode creation, DAG construction, parameter mutations,
 *   transitive downstream invalidations, regeneration, suppression, and logical rollback.
 * - Provides full deterministic history hashing and provenance tracking.
 */

import { FeatureNode, FeatureId } from './FeatureNode';
import { CanonicalFeatureDefinition, FeatureType } from './FeatureDefinition';
import { FeatureDependencyGraph } from './FeatureDependency';
import { FeatureRegenerator, RegenerationResult, RegenerationOptions } from './FeatureRegenerator';
import { FeatureHistoryEvidence, FeatureHistoryEvidenceReport } from './FeatureHistoryEvidence';
import { FeatureHistoryValidator, HistoryValidationReport } from './FeatureHistoryValidator';
import { ToleranceContext } from '../tolerance';

export class FeatureHistory {
  public readonly documentId: string;
  private nodes: Map<FeatureId, FeatureNode> = new Map();
  private sequenceCounter: number = 0;
  private graph: FeatureDependencyGraph = new FeatureDependencyGraph();
  private activeRollbackTargetId?: FeatureId;

  constructor(documentId: string = 'DOC_SECP_PRIMARY') {
    this.documentId = documentId;
  }

  /**
   * Adds a new feature to the history tree.
   */
  public addFeature(
    type: FeatureType,
    name: string,
    definition: CanonicalFeatureDefinition,
    dependencyIds: FeatureId[] = [],
    parentId?: FeatureId,
    id?: FeatureId
  ): FeatureNode {
    this.sequenceCounter++;
    definition.type = definition.type || type;
    definition.name = definition.name || name;
    const node = new FeatureNode({
      id: id || (name && (name.startsWith('FEAT_') || name.startsWith('EXTRUDE_') || name.startsWith('BOX_')) ? name : undefined),
      documentId: this.documentId,
      type,
      name,
      definition,
      sequence: this.sequenceCounter,
      dependencyIds,
      parentId
    });

    this.nodes.set(node.id, node);
    this.graph.addNode(node);
    return node;
  }

  /**
   * Adds an existing FeatureNode instance into the history tree.
   */
  public addNode(node: FeatureNode): void {
    if (this.nodes.has(node.id)) {
      throw new Error(`[FeatureHistory] Duplicate feature ID detected: '${node.id}'`);
    }

    if (node.sequence > this.sequenceCounter) {
      this.sequenceCounter = node.sequence;
    }

    this.nodes.set(node.id, node);
    this.graph.addNode(node);
  }

  /**
   * Mutates a feature's parameters or definition and invalidates downstream features.
   */
  public updateFeatureDefinition(
    featureId: FeatureId,
    newDefinition: CanonicalFeatureDefinition
  ): void {
    const node = this.nodes.get(featureId);
    if (!node) {
      throw new Error(`[FeatureHistory] Feature '${featureId}' not found in history`);
    }

    // Update definition and recompute definition hash
    node.updateDefinition(newDefinition);
    node.state = 'STALE';
    node.outputGeometry = undefined;

    // Propagate invalidation to all downstream dependents
    const downstream = this.graph.getDownstreamDependents(featureId);
    for (const depId of downstream) {
      const depNode = this.nodes.get(depId);
      if (depNode) {
        depNode.state = 'STALE';
        depNode.regenerationStatus = 'PENDING';
        depNode.outputGeometry = undefined;
      }
    }
  }

  /**
   * Sets feature suppression state.
   */
  public setSuppressed(featureId: FeatureId, suppressed: boolean): void {
    const node = this.nodes.get(featureId);
    if (!node) {
      throw new Error(`[FeatureHistory] Feature '${featureId}' not found in history`);
    }

    node.suppressed = suppressed;
    if (suppressed) {
      node.state = 'SUPPRESSED';
      node.regenerationStatus = 'SKIPPED';
    } else {
      node.state = 'STALE';
      node.regenerationStatus = 'PENDING';
    }

    // Invalidate downstream
    const downstream = this.graph.getDownstreamDependents(featureId);
    for (const depId of downstream) {
      const depNode = this.nodes.get(depId);
      if (depNode) {
        depNode.state = 'STALE';
        depNode.regenerationStatus = 'PENDING';
      }
    }
  }

  /**
   * Rolls back the active view/execution to a specific Feature ID without mutating history.
   */
  public setRollbackTarget(featureId?: FeatureId): void {
    if (featureId && !this.nodes.has(featureId)) {
      throw new Error(`[FeatureHistory] Rollback target feature '${featureId}' does not exist`);
    }
    this.activeRollbackTargetId = featureId;
  }

  /**
   * Clears the rollback target.
   */
  public clearRollbackTarget(): void {
    this.activeRollbackTargetId = undefined;
  }

  /**
   * Regenerates the model state up to the active rollback target or full history.
   */
  public regenerate(options: RegenerationOptions = {}): RegenerationResult {
    const opts: RegenerationOptions = {
      ...options,
      rollbackTargetId: options.rollbackTargetId || this.activeRollbackTargetId
    };

    return FeatureRegenerator.regenerate(
      this.documentId,
      Array.from(this.nodes.values()),
      this.graph,
      opts
    );
  }

  /**
   * Validates history structural integrity.
   */
  public validate(): HistoryValidationReport {
    return FeatureHistoryValidator.validateHistory(
      Array.from(this.nodes.values()),
      this.graph
    );
  }

  /**
   * Generates canonical history hash.
   */
  public getHistoryHash(): string {
    return FeatureHistoryEvidence.computeHistoryHash(
      this.documentId,
      Array.from(this.nodes.values()),
      this.graph
    );
  }

  /**
   * Generates a complete Evidence report.
   */
  public generateEvidence(
    regenResult: RegenerationResult,
    toleranceContext?: ToleranceContext
  ): FeatureHistoryEvidenceReport {
    return FeatureHistoryEvidence.generateEvidence(
      this.documentId,
      Array.from(this.nodes.values()),
      this.graph,
      regenResult,
      toleranceContext
    );
  }

  public getFeature(id: FeatureId): FeatureNode | undefined {
    return this.nodes.get(id);
  }

  public getAllFeatures(): FeatureNode[] {
    return Array.from(this.nodes.values());
  }

  public getGraph(): FeatureDependencyGraph {
    return this.graph;
  }

  public getTopologicalOrder(): FeatureId[] {
    return this.graph.getTopologicalOrder();
  }

  /**
   * Creates a deep clone of the FeatureHistory.
   */
  public clone(): FeatureHistory {
    const cloned = new FeatureHistory(this.documentId);
    cloned.sequenceCounter = this.sequenceCounter;
    cloned.activeRollbackTargetId = this.activeRollbackTargetId;

    for (const node of this.nodes.values()) {
      const clonedNode = new FeatureNode({
        id: node.id,
        documentId: node.documentId,
        type: node.type,
        name: node.name,
        definition: JSON.parse(JSON.stringify(node.definition)),
        sequence: node.sequence,
        dependencyIds: [...node.dependencyIds],
        parentId: node.parentId,
        suppressed: node.suppressed
      });
      clonedNode.state = node.state;
      clonedNode.regenerationStatus = node.regenerationStatus;
      clonedNode.provenanceReference = node.provenanceReference;
      clonedNode.outputGeometry = node.outputGeometry ? JSON.parse(JSON.stringify(node.outputGeometry)) : undefined;
      clonedNode.outputReferences = [...node.outputReferences];
      
      cloned.addNode(clonedNode);
    }
    return cloned;
  }
}
