/**
 * SECP CAD Kernel — Persistent Topology Identity & Topological Naming
 * Phase 2 (PATCH-KERNEL-005)
 *
 * Implements persistent topological identification for B-Rep entities (Faces, Edges, Vertices)
 * ensuring replay stability and topological reference resolution across feature modifications
 * (e.g. changing Extrude depth from 20 mm to 40 mm).
 */

import { TopoShape, Solid, Face, Edge, Vertex, TopoShapeEnum } from './TopologyContracts';
import { TopologyLineage, TopologyReference, TopologicalEntityType } from '../history/FeatureDefinition';
import { CanonicalDerivedArtifactBinding } from '../../topology/CanonicalDerivedArtifactBinding';

export interface TopologyResolutionContext {
  targetCadRevisionHash?: string;
  targetGeometryHash?: string;
}

export class PersistentTopologyNaming {
  /**
   * Computes a deterministic geometric signature for a topological entity.
   */
  public static computeGeometricSignature(entity: TopoShape): string {
    if (entity.shapeType === TopoShapeEnum.VERTEX) {
      const v = entity as Vertex;
      const x = v.geometry.x.toFixed(2);
      const y = v.geometry.y.toFixed(2);
      const z = v.geometry.z.toFixed(2);
      return `VERTEX|POS:${x},${y},${z}`;
    }

    if (entity.shapeType === TopoShapeEnum.EDGE) {
      const e = entity as Edge;
      const sx = e.startVertex.geometry.x.toFixed(2);
      const sy = e.startVertex.geometry.y.toFixed(2);
      const sz = e.startVertex.geometry.z.toFixed(2);
      const ex = e.endVertex.geometry.x.toFixed(2);
      const ey = e.endVertex.geometry.y.toFixed(2);
      const ez = e.endVertex.geometry.z.toFixed(2);
      const dx = e.endVertex.geometry.x - e.startVertex.geometry.x;
      const dy = e.endVertex.geometry.y - e.startVertex.geometry.y;
      const dz = e.endVertex.geometry.z - e.startVertex.geometry.z;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz).toFixed(2);
      return `EDGE|START:${sx},${sy},${sz}|END:${ex},${ey},${ez}|LEN:${len}`;
    }

    if (entity.shapeType === TopoShapeEnum.FACE) {
      const f = entity as Face;
      // Centroid of outer loop vertices
      let cx = 0, cy = 0, cz = 0;
      const numEdges = f.outerLoop?.orientedEdges?.length || 0;
      if (numEdges > 0) {
        const edges = Array.isArray(f.outerLoop?.orientedEdges) ? f.outerLoop.orientedEdges : [];
        for (const oe of edges) {
          cx += oe.edge.startVertex.geometry.x;
          cy += oe.edge.startVertex.geometry.y;
          cz += oe.edge.startVertex.geometry.z;
        }
        cx /= numEdges;
        cy /= numEdges;
        cz /= numEdges;
      }

      // Normal direction from geometry or surface
      let nx = 0, ny = 0, nz = 1;
      if (f.geometry && typeof (f.geometry as any).normal === 'object') {
        const norm = (f.geometry as any).normal;
        nx = norm.x ?? 0;
        ny = norm.y ?? 0;
        nz = norm.z ?? 1;
      } else if (f.geometry && typeof (f.geometry as any).normalAt === 'function') {
        const norm = (f.geometry as any).normalAt(0, 0);
        nx = norm.x; ny = norm.y; nz = norm.z;
      }

      return `FACE|NORM:${nx.toFixed(3)},${ny.toFixed(3)},${nz.toFixed(3)}|CENT:${cx.toFixed(2)},${cy.toFixed(2)},${cz.toFixed(2)}|EDGES:${numEdges}`;
    }

    return `${entity.shapeType}|ID:${entity.id}`;
  }

  /**
   * Assigns persistent topology identities, lineage, and topology references to all entities in a solid.
   */
  public static assignPersistentTopology(
    solid: Solid,
    createdByFeatureId: string,
    sourceEntityMap?: {
      profileEntities?: string[];
    }
  ): Solid {
    if (!solid.outerShell || !Array.isArray(solid.outerShell.orientedFaces)) {
      return solid;
    }

    const faces = solid.outerShell.orientedFaces.map(of => of.face);
    const sourceProfileEntities = sourceEntityMap?.profileEntities || [];

    // Separate Bottom (CapStart), Top (CapEnd), and Lateral Side Faces
    let sideFaceCounter = 0;

    faces.forEach((face, idx) => {
      // Check face normal orientation
      let nz = 0;
      if (face.geometry && typeof (face.geometry as any).normal === 'object') {
        nz = (face.geometry as any).normal.z ?? 0;
      }

      let semanticTag: string;
      let sourceEntities: string[];

      if (face.id.includes('bot') || nz < -0.9) {
        semanticTag = 'CapStart';
        sourceEntities = ['CapStart'];
      } else if (face.id.includes('top') || nz > 0.9) {
        semanticTag = 'CapEnd';
        sourceEntities = ['CapEnd'];
      } else {
        const sideIdx = sideFaceCounter++;
        semanticTag = `Side[${sideIndexOrSource(sideIdx, sourceProfileEntities)}]`;
        sourceEntities = [sourceProfileEntities[sideIdx] || `Side[${sideIdx}]`];
      }

      const persistentId = `${createdByFeatureId}:FACE:${semanticTag}`;
      const signature = this.computeGeometricSignature(face);

      const lineage: TopologyLineage = {
        createdByFeature: createdByFeatureId,
        sourceEntities,
        geometricSignature: signature
      };

      const topologyRef: TopologyReference = {
        entityType: 'FACE',
        persistentId,
        lineage,
        // Compatibility fields
        type: 'FACE',
        targetFeatureId: createdByFeatureId,
        entityId: face.id,
        persistentTag: persistentId,
        signature
      };

      face.persistentId = persistentId;
      face.lineage = lineage;
      face.topologyReference = topologyRef;

      // Assign persistent topology to Edges and Vertices of this face
      if (face.outerLoop && Array.isArray(face.outerLoop.orientedEdges)) {
        face.outerLoop.orientedEdges.forEach((oe, edgeIdx) => {
          const edge = oe.edge;
          const edgeSemantic = `${semanticTag}_Edge[${edgeIdx}]`;
          const edgePersistentId = `${createdByFeatureId}:EDGE:${edgeSemantic}`;
          const edgeSig = this.computeGeometricSignature(edge);

          const edgeLineage: TopologyLineage = {
            createdByFeature: createdByFeatureId,
            sourceEntities: [...sourceEntities, `Edge[${edgeIdx}]`],
            geometricSignature: edgeSig
          };

          const edgeRef: TopologyReference = {
            entityType: 'EDGE',
            persistentId: edgePersistentId,
            lineage: edgeLineage,
            type: 'EDGE',
            targetFeatureId: createdByFeatureId,
            entityId: edge.id,
            persistentTag: edgePersistentId,
            signature: edgeSig
          };

          edge.persistentId = edge.persistentId || edgePersistentId;
          edge.lineage = edge.lineage || edgeLineage;
          edge.topologyReference = edge.topologyReference || edgeRef;

          // Vertices
          [edge.startVertex, edge.endVertex].forEach((v, vIdx) => {
            if (v) {
              const vSemantic = `${edgeSemantic}_V[${vIdx}]`;
              const vPersistentId = `${createdByFeatureId}:VERTEX:${vSemantic}`;
              const vSig = this.computeGeometricSignature(v);

              const vLineage: TopologyLineage = {
                createdByFeature: createdByFeatureId,
                sourceEntities: [...sourceEntities, `Vertex[${vIdx}]`],
                geometricSignature: vSig
              };

              const vRef: TopologyReference = {
                entityType: 'VERTEX',
                persistentId: vPersistentId,
                lineage: vLineage,
                type: 'VERTEX',
                targetFeatureId: createdByFeatureId,
                entityId: v.id,
                persistentTag: vPersistentId,
                signature: vSig
              };

              v.persistentId = v.persistentId || vPersistentId;
              v.lineage = v.lineage || vLineage;
              v.topologyReference = v.topologyReference || vRef;
            }
          });
        });
      }
    });

    return solid;
  }

  /**
   * Extracts all TopologyReference objects from a BRep Solid.
   */
  public static extractOutputReferences(solid: Solid, createdByFeatureId: string): TopologyReference[] {
    const refs: TopologyReference[] = [];
    const seenIds = new Set<string>();

    if (!solid.outerShell || !Array.isArray(solid.outerShell.orientedFaces)) {
      return [{
        entityType: 'SOLID',
        persistentId: `${createdByFeatureId}:SOLID:Main`,
        lineage: {
          createdByFeature: createdByFeatureId,
          sourceEntities: ['Solid'],
          geometricSignature: `SOLID|ID:${solid.id}`
        },
        type: 'SOLID',
        targetFeatureId: createdByFeatureId,
        entityId: solid.id,
        persistentTag: `${createdByFeatureId}:SOLID:Main`
      }];
    }

    for (const of of solid.outerShell.orientedFaces) {
      const face = of.face;

      if (face.topologyReference && !seenIds.has(face.topologyReference.persistentId)) {
        seenIds.add(face.topologyReference.persistentId);
        refs.push(face.topologyReference);
      } else if (face.persistentId && !seenIds.has(face.persistentId)) {
        seenIds.add(face.persistentId);
        refs.push({
          entityType: 'FACE',
          persistentId: face.persistentId,
          lineage: face.lineage || {
            createdByFeature: createdByFeatureId,
            sourceEntities: [face.id],
            geometricSignature: this.computeGeometricSignature(face)
          },
          type: 'FACE',
          targetFeatureId: createdByFeatureId,
          entityId: face.id,
          persistentTag: face.persistentId
        });
      }

      // Collect Edge & Vertex references
      if (face.outerLoop && Array.isArray(face.outerLoop.orientedEdges)) {
        for (const oe of face.outerLoop.orientedEdges) {
          const edge = oe.edge;
          if (edge.topologyReference && !seenIds.has(edge.topologyReference.persistentId)) {
            seenIds.add(edge.topologyReference.persistentId);
            refs.push(edge.topologyReference);
          }

          if (edge.startVertex?.topologyReference && !seenIds.has(edge.startVertex.topologyReference.persistentId)) {
            seenIds.add(edge.startVertex.topologyReference.persistentId);
            refs.push(edge.startVertex.topologyReference);
          }

          if (edge.endVertex?.topologyReference && !seenIds.has(edge.endVertex.topologyReference.persistentId)) {
            seenIds.add(edge.endVertex.topologyReference.persistentId);
            refs.push(edge.endVertex.topologyReference);
          }
        }
      }
    }

    return refs;
  }

  /**
   * Resolves a TopologyReference against a solid's current topology.
   * Maintains persistent identity when features are modified (e.g. Extrude depth 20 -> 40 mm).
   */
  public static resolveTopologyReference(
    ref: TopologyReference | { persistentId?: string; entityId?: string; lineage?: TopologyLineage; entityType?: string; derivedArtifactBinding?: any },
    solid: Solid,
    targetContext?: TopologyResolutionContext
  ): TopoShape | undefined {
    if (!solid.outerShell || !Array.isArray(solid.outerShell.orientedFaces)) {
      return undefined;
    }

    // Fail-closed enforcement: if target revision context is provided, verify derived binding
    if (targetContext?.targetCadRevisionHash) {
      if (!ref.derivedArtifactBinding) {
        return undefined; // REJECT: Missing derived artifact binding
      }
      const verifyRes = CanonicalDerivedArtifactBinding.verifyBinding(
        ref.derivedArtifactBinding,
        targetContext.targetCadRevisionHash,
        targetContext.targetGeometryHash
      );
      if (!verifyRes.isValid) {
        return undefined; // REJECT: Binding failed cryptographic verification or revision mismatch
      }
    }

    const targetPersistentId = ref.persistentId;
    const targetEntityId = ref.entityId;
    const targetLineage = ref.lineage;
    const targetEntityType = ref.entityType || 'FACE';

    const candidateEntities: TopoShape[] = [];

    // Traverse all topological entities in solid
    for (const of of solid.outerShell.orientedFaces) {
      const face = of.face;
      candidateEntities.push(face);

      if (face.outerLoop && Array.isArray(face.outerLoop.orientedEdges)) {
        for (const oe of face.outerLoop.orientedEdges) {
          candidateEntities.push(oe.edge);
          if (oe.edge.startVertex) candidateEntities.push(oe.edge.startVertex);
          if (oe.edge.endVertex) candidateEntities.push(oe.edge.endVertex);
        }
      }
    }

    // 1. Direct persistentId match (Strongest)
    if (targetPersistentId) {
      const directMatch = candidateEntities.find(e => e.persistentId === targetPersistentId || e.topologyReference?.persistentId === targetPersistentId);
      if (directMatch) return directMatch;
    }

    // 2. Direct entityId match
    if (targetEntityId) {
      const entityMatch = candidateEntities.find(e => e.id === targetEntityId);
      if (entityMatch) return entityMatch;
    }

    // 3. Lineage match (createdByFeature + sourceEntities match)
    if (targetLineage) {
      const lineageMatch = candidateEntities.find(e => {
        const l = e.lineage || e.topologyReference?.lineage;
        if (!l) return false;
        return l.createdByFeature === targetLineage.createdByFeature &&
          l.sourceEntities.some(s => targetLineage.sourceEntities.includes(s));
      });
      if (lineageMatch) return lineageMatch;
    }

    return undefined;
  }
}

function sideIndexOrSource(idx: number, sources: string[]): string {
  if (sources && sources[idx]) {
    return sources[idx];
  }
  return `${idx}`;
}
