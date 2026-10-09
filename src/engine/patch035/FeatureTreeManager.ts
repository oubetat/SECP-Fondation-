/**
 * SECP PATCH-035: Feature Tree & Regeneration Manager
 * 
 * Manages the parametric history of a part. Ensures that if an upstream feature
 * is modified, all downstream features are regenerated correctly.
 */

import { EngineeringDomain, DesignOperation } from './DesignWorkbenchTypes';

export interface CADFeature {
  id: string;
  operation: DesignOperation;
  parentIds: string[];
  childIds: string[];
  geometryHash: string;
  status: 'VALID' | 'STALE' | 'FAILED';
  suppressed: boolean;
}

export class FeatureTreeManager {
  private featureTree: CADFeature[] = [];

  /**
   * Adds a new feature to the tree and performs initial build.
   */
  public addFeature(op: DesignOperation, parents: string[] = []): string {
    const featureId = `FEAT-${op.domain}-${this.featureTree.length + 1}`;
    
    const newFeature: CADFeature = {
      id: featureId,
      operation: op,
      parentIds: parents,
      childIds: [],
      geometryHash: 'INIT',
      status: 'STALE',
      suppressed: false
    };

    // Update parent's child lists
    parents.forEach(pId => {
      const parent = this.featureTree.find(f => f.id === pId);
      if (parent) parent.childIds.push(featureId);
    });

    this.featureTree.push(newFeature);
    this.regenerateFrom(featureId);
    
    return featureId;
  }

  /**
   * Modifies an existing feature and triggers a downstream regeneration.
   */
  public updateFeature(id: string, updates: Partial<DesignOperation>): void {
    const feature = this.featureTree.find(f => f.id === id);
    if (!feature) return;

    feature.operation = { ...feature.operation, ...updates };
    feature.status = 'STALE';
    
    console.log(`[Rebuild] Feature ${id} modified. Starting downstream regeneration...`);
    this.regenerateFrom(id);
  }

  /**
   * Parametric Rebuild Engine: Regenerates the feature and all its dependents.
   */
  public regenerateFrom(startId: string): void {
    const feature = this.featureTree.find(f => f.id === startId);
    if (!feature) return;

    // Simulate geometric solver execution
    // Deterministic hash based on operation content to ensure Rule 01 (Engineering SOT)
    const opContent = JSON.stringify(feature.operation.parameters || {});
    feature.geometryHash = `GEO-HASH-${feature.operation.domain}-${opContent.length}-${feature.id}`;
    feature.status = 'VALID';

    // Recursive regeneration of children
    feature.childIds.forEach(childId => {
      this.regenerateFrom(childId);
    });
  }

  public getFeatureTree(): CADFeature[] {
    return this.featureTree;
  }

  public getActiveFeaturesCount(): number {
    return this.featureTree.filter(f => !f.suppressed).length;
  }
}
