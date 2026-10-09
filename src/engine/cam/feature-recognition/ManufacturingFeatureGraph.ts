/**
 * SECP Industrial OS v2 — CAM Production Engine
 * PATCH-255 — Manufacturing Feature Graph
 */

import { ManufacturingFeature } from './FeatureTypes';

export interface FeatureGraphNode {
  featureId: string;
  feature: ManufacturingFeature;
  parentFeatureIds: string[];
  childFeatureIds: string[];
  sharedFaceFeatureIds: string[];
  overlappingFeatureIds: string[];
}

export interface FeatureGraphEdge {
  fromFeatureId: string;
  toFeatureId: string;
  relationType: 'CHILD_OF' | 'MODIFIES' | 'SHARES_FACE' | 'OVERLAPS' | 'PRECEDES_IN_SETUP';
}

export class ManufacturingFeatureGraph {
  public nodes: Map<string, FeatureGraphNode> = new Map();
  public edges: FeatureGraphEdge[] = [];

  constructor(features: ManufacturingFeature[] = []) {
    for (const f of features) {
      this.addFeature(f);
    }
    this.buildRelationships(features);
  }

  public addFeature(feature: ManufacturingFeature) {
    if (!this.nodes.has(feature.id)) {
      this.nodes.set(feature.id, {
        featureId: feature.id,
        feature,
        parentFeatureIds: [],
        childFeatureIds: [],
        sharedFaceFeatureIds: [],
        overlappingFeatureIds: [],
      });
    }
  }

  private buildRelationships(features: ManufacturingFeature[]) {
    // Check shared faces and parent-child relations (e.g. Chamfer on top of Hole, Hole inside Pocket)
    for (let i = 0; i < features.length; i++) {
      for (let j = i + 1; j < features.length; j++) {
        const f1 = features[i];
        const f2 = features[j];

        // Shared faces
        const sharedFaces = f1.faceIds.filter(id => f2.faceIds.includes(id));
        if (sharedFaces.length > 0) {
          this.nodes.get(f1.id)?.sharedFaceFeatureIds.push(f2.id);
          this.nodes.get(f2.id)?.sharedFaceFeatureIds.push(f1.id);
          this.edges.push({
            fromFeatureId: f1.id,
            toFeatureId: f2.id,
            relationType: 'SHARES_FACE',
          });
        }

        // Pocket -> Hole relationship (Hole on pocket floor)
        if (f1.type.includes('POCKET') && f2.type.includes('HOLE')) {
          if (f1.parameters.type === 'POCKET' && f2.parameters.type === 'HOLE') {
            const pocketFloor = f1.parameters.params.floorFaceId;
            if (f2.faceIds.includes(pocketFloor) || sharedFaces.length > 0) {
              this.nodes.get(f1.id)?.childFeatureIds.push(f2.id);
              this.nodes.get(f2.id)?.parentFeatureIds.push(f1.id);
              this.edges.push({
                fromFeatureId: f1.id,
                toFeatureId: f2.id,
                relationType: 'CHILD_OF',
              });
            }
          }
        }
      }
    }
  }

  public getFeature(id: string): ManufacturingFeature | undefined {
    return this.nodes.get(id)?.feature;
  }

  public getAllFeatures(): ManufacturingFeature[] {
    return Array.from(this.nodes.values()).map(n => n.feature);
  }

  public getChildren(id: string): ManufacturingFeature[] {
    const node = this.nodes.get(id);
    if (!node) return [];
    return node.childFeatureIds.map(cid => this.nodes.get(cid)?.feature).filter(Boolean) as ManufacturingFeature[];
  }

  public getParents(id: string): ManufacturingFeature[] {
    const node = this.nodes.get(id);
    if (!node) return [];
    return node.parentFeatureIds.map(pid => this.nodes.get(pid)?.feature).filter(Boolean) as ManufacturingFeature[];
  }
}
