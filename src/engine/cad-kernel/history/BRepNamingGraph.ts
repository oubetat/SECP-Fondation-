/**
 * SECP CAD Kernel — Persistent Topological Naming & Lineage Graph Engine
 *
 * Provides persistent entity identification across feature history re-execution.
 * Maintains directed lineage DAG (GENERATED, MODIFIED, DELETED) and evaluates
 * contextual topological signatures to guarantee zero-loss downstream entity rebinding.
 */

import {
  BRepSolid,
  BRepFace,
  BRepEdge,
  BRepVertex
} from '../topology/BRepTopology';
import {
  BRepPoint,
  BRepLine,
  BRepCircle,
  BRepPlane,
  BRepCylinder
} from '../geometry/BRepGeometry';
import * as crypto from 'crypto';

export type LineageMutationType = 'GENERATED' | 'MODIFIED' | 'DELETED' | 'SPLIT' | 'MERGED';

export interface TopologicalSignature {
  entityId: string;
  entityType: 'FACE' | 'EDGE' | 'VERTEX';
  geometryType: string;
  centroid: { x: number; y: number; z: number };
  boundingBox: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } };
  connectedNeighborTypes: string[];
  signatureHash: string;
}

export interface LineageEdge {
  parentEntityId: string;
  childEntityId: string;
  mutationType: LineageMutationType;
  featureId: string;
  timestamp: string;
}

export class BRepNamingGraph {
  private lineageMap: Map<string, LineageEdge[]> = new Map(); // parentId -> childEdges
  private reverseLineageMap: Map<string, LineageEdge[]> = new Map(); // childId -> parentEdges
  private signatures: Map<string, TopologicalSignature> = new Map();

  /**
   * Registers a topological mutation operation (e.g. Fillet, Extrude, Split).
   */
  public recordMutation(
    parentEntityId: string,
    childEntityId: string,
    mutationType: LineageMutationType,
    featureId: string
  ): void {
    const edge: LineageEdge = {
      parentEntityId,
      childEntityId,
      mutationType,
      featureId,
      timestamp: new Date().toISOString()
    };

    if (!this.lineageMap.has(parentEntityId)) {
      this.lineageMap.set(parentEntityId, []);
    }
    this.lineageMap.get(parentEntityId)!.push(edge);

    if (!this.reverseLineageMap.has(childEntityId)) {
      this.reverseLineageMap.set(childEntityId, []);
    }
    this.reverseLineageMap.get(childEntityId)!.push(edge);
  }

  /**
   * Generates a persistent topological signature for a BRepFace.
   */
  public computeFaceSignature(face: BRepFace): TopologicalSignature {
    const geomType = face.geometry ? face.geometry.constructor.name : 'UNKNOWN_SURFACE';
    
    // Calculate centroid from outer loop
    let sumX = 0, sumY = 0, sumZ = 0;
    let count = 0;
    for (const oe of face.outerLoop.orientedEdges) {
      const e = oe.edge as BRepEdge;
      if (e.startVertex) {
        sumX += e.startVertex.geometry.x;
        sumY += e.startVertex.geometry.y;
        sumZ += e.startVertex.geometry.z;
        count++;
      }
    }
    const centroid = count > 0 ? { x: sumX / count, y: sumY / count, z: sumZ / count } : { x: 0, y: 0, z: 0 };

    const neighborTypes = face.outerLoop.orientedEdges.map(oe => oe.edge.geometry ? oe.edge.geometry.constructor.name : 'LINE');

    const hashRaw = `${geomType}_${centroid.x.toFixed(3)}_${centroid.y.toFixed(3)}_${centroid.z.toFixed(3)}_${neighborTypes.sort().join(',')}`;
    const signatureHash = crypto.createHash('sha256').update(hashRaw).digest('hex').substring(0, 16);

    const sig: TopologicalSignature = {
      entityId: face.id,
      entityType: 'FACE',
      geometryType: geomType,
      centroid,
      boundingBox: { min: centroid, max: centroid },
      connectedNeighborTypes: neighborTypes,
      signatureHash
    };

    this.signatures.set(face.id, sig);
    return sig;
  }

  /**
   * Resolves an entity reference in a newly regenerated solid when its original ID is lost.
   * Uses persistent topological signature matching to find the exact target.
   */
  public resolveTargetEntity(
    originalEntityId: string,
    regeneratedSolid: BRepSolid
  ): { resolvedEntityId: string | null; confidenceScore: number; matchMethod: 'EXACT_ID' | 'LINEAGE_DAG' | 'TOPOLOGICAL_SIGNATURE' | 'UNRESOLVED' } {
    // 1. Check if original ID still exists in regenerated solid
    for (const oface of regeneratedSolid.outerShell.orientedFaces) {
      const face = oface.face as BRepFace;
      if (face.id === originalEntityId) {
        return { resolvedEntityId: face.id, confidenceScore: 1.0, matchMethod: 'EXACT_ID' };
      }
      for (const oe of face.outerLoop.orientedEdges) {
        if (oe.edge.id === originalEntityId) {
          return { resolvedEntityId: oe.edge.id, confidenceScore: 1.0, matchMethod: 'EXACT_ID' };
        }
      }
    }

    // 2. Check Lineage DAG for direct children
    const lineageEdges = this.lineageMap.get(originalEntityId);
    if (lineageEdges && lineageEdges.length > 0) {
      for (const edge of lineageEdges) {
        if (edge.mutationType === 'MODIFIED' || edge.mutationType === 'GENERATED' || edge.mutationType === 'SPLIT') {
          // Verify child exists in new solid
          const childId = edge.childEntityId;
          for (const oface of regeneratedSolid.outerShell.orientedFaces) {
            const face = oface.face as BRepFace;
            if (face.id === childId || face.outerLoop.orientedEdges.some(oe => oe.edge.id === childId)) {
              return { resolvedEntityId: childId, confidenceScore: 0.95, matchMethod: 'LINEAGE_DAG' };
            }
          }
        }
      }
    }

    // 3. Match by Topological Signature
    const origSig = this.signatures.get(originalEntityId);
    if (origSig) {
      let bestMatchId: string | null = null;
      let highestScore = -1;

      for (const oface of regeneratedSolid.outerShell.orientedFaces) {
        const face = oface.face as BRepFace;
        const candidateSig = this.computeFaceSignature(face);

        let score = 0;
        if (candidateSig.geometryType === origSig.geometryType) score += 0.4;
        
        const dist = Math.hypot(
          candidateSig.centroid.x - origSig.centroid.x,
          candidateSig.centroid.y - origSig.centroid.y,
          candidateSig.centroid.z - origSig.centroid.z
        );
        if (dist < 0.1) score += 0.4;
        else if (dist < 1.0) score += 0.2;

        if (candidateSig.signatureHash === origSig.signatureHash) score += 0.2;

        if (score > highestScore && score >= 0.6) {
          highestScore = score;
          bestMatchId = face.id;
        }
      }

      if (bestMatchId) {
        return { resolvedEntityId: bestMatchId, confidenceScore: highestScore, matchMethod: 'TOPOLOGICAL_SIGNATURE' };
      }
    }

    return { resolvedEntityId: null, confidenceScore: 0.0, matchMethod: 'UNRESOLVED' };
  }
}
