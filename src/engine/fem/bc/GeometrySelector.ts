/**
 * SECP CAD/CAE Platform - Geometry Selector & Mesh Projection Engine
 * PATCH-235 — Boundary Condition Engine
 *
 * Provides deterministic mapping from high-level CAD / Geometric entities
 * (Faces, Edges, Vertices, Regions, NodeSets) to finite element mesh entities
 * (Nodes, Elements, Element Surfaces).
 */

import { FEMMesh } from '../mesh/FEMMesh';
import { FEMNode } from '../mesh/FEMNode';
import { FEMElement } from '../mesh/FEMElement';
import { GeometryTargetSelection, Vector3D } from './BoundaryConditionTypes';

export interface ProjectedMeshSelection {
  nodeIds: string[];
  elementIds: string[];
  faceKeys: string[]; // "elementId_faceIndex"
  targetHash: string;
  isStale: boolean;
  diagnostics: string[];
}

export class GeometrySelector {
  /**
   * Projects a geometry target selection onto a FEM mesh deterministically.
   * Ensures sorted node IDs and element IDs for reproducible equation ordering.
   */
  public static projectSelection(
    target: GeometryTargetSelection,
    mesh: FEMMesh
  ): ProjectedMeshSelection {
    const diagnostics: string[] = [];
    const affectedNodeIds = new Set<string>();
    const affectedElementIds = new Set<string>();
    const faceKeys: string[] = [];

    if (!mesh || mesh.nodes.length === 0) {
      return {
        nodeIds: [],
        elementIds: [],
        faceKeys: [],
        targetHash: 'EMPTY_MESH',
        isStale: false,
        diagnostics: ['Mesh is empty or null']
      };
    }

    switch (target.type) {
      case 'NODE_SET': {
        if (target.nodeIds && target.nodeIds.length > 0) {
          const meshNodeMap = new Map<string, FEMNode>();
          mesh.nodes.forEach((n) => meshNodeMap.set(n.id, n));
          for (const nid of target.nodeIds) {
            if (meshNodeMap.has(nid)) {
              affectedNodeIds.add(nid);
            } else {
              diagnostics.push(`Target node ${nid} does not exist in current mesh`);
            }
          }
        }
        break;
      }

      case 'ELEMENT_SET': {
        if (target.elementIds && target.elementIds.length > 0) {
          const elemMap = new Map<string, FEMElement>();
          mesh.elements.forEach((e) => elemMap.set(e.id, e));
          for (const eid of target.elementIds) {
            const elem = elemMap.get(eid);
            if (elem) {
              affectedElementIds.add(eid);
              elem.nodeIds.forEach((nid) => affectedNodeIds.add(nid));
            } else {
              diagnostics.push(`Target element ${eid} does not exist in current mesh`);
            }
          }
        }
        break;
      }

      case 'FACE':
      case 'SURFACE_REGION': {
        // 1. Direct CAD face link if available
        if (target.cadFaceIds && target.cadFaceIds.length > 0) {
          mesh.boundaries.forEach((b) => {
            if (b.cadFaceId && target.cadFaceIds!.includes(b.cadFaceId)) {
              b.nodeIds.forEach((nid) => affectedNodeIds.add(nid));
              b.elementIds.forEach((eid) => affectedElementIds.add(eid));
              if (b.faceKeys) {
                b.faceKeys.forEach((fk) => faceKeys.push(fk));
              }
            }
          });
        }

        // 2. Spatial / Bounding plane filter if entityIds or bounding specified
        if (affectedNodeIds.size === 0 && target.boundingCenter) {
          const tol = 1e-3;
          mesh.nodes.forEach((node) => {
            const dx = Math.abs(node.x - target.boundingCenter!.x);
            const dy = Math.abs(node.y - target.boundingCenter!.y);
            const dz = Math.abs(node.z - target.boundingCenter!.z);
            if (dx <= tol && dy <= tol && dz <= tol) {
              affectedNodeIds.add(node.id);
            }
          });
        }

        // 3. Boundary tag search fallback
        if (affectedNodeIds.size === 0 && target.entityIds && target.entityIds.length > 0) {
          mesh.boundaries.forEach((b) => {
            if (target.entityIds.includes(b.id) || target.entityIds.includes(b.name)) {
              b.nodeIds.forEach((nid) => affectedNodeIds.add(nid));
              b.elementIds.forEach((eid) => affectedElementIds.add(eid));
              if (b.faceKeys) {
                b.faceKeys.forEach((fk) => faceKeys.push(fk));
              }
            }
          });
        }
        break;
      }

      case 'EDGE': {
        if (target.cadEdgeIds && target.cadEdgeIds.length > 0) {
          mesh.boundaries.forEach((b) => {
            if (b.cadFaceId && target.cadEdgeIds!.includes(b.cadFaceId)) {
              b.nodeIds.forEach((nid) => affectedNodeIds.add(nid));
            }
          });
        }
        if (affectedNodeIds.size === 0 && target.boundingCenter) {
          const tol = 1e-3;
          mesh.nodes.forEach((node) => {
            const dist = Math.sqrt(
              Math.pow(node.x - target.boundingCenter!.x, 2) +
                Math.pow(node.y - target.boundingCenter!.y, 2) +
                Math.pow(node.z - target.boundingCenter!.z, 2)
            );
            if (dist <= tol) {
              affectedNodeIds.add(node.id);
            }
          });
        }
        break;
      }

      case 'VERTEX': {
        if (target.boundingCenter) {
          let closestNode: FEMNode | null = null;
          let minDist = Infinity;
          mesh.nodes.forEach((node) => {
            const dist = Math.sqrt(
              Math.pow(node.x - target.boundingCenter!.x, 2) +
                Math.pow(node.y - target.boundingCenter!.y, 2) +
                Math.pow(node.z - target.boundingCenter!.z, 2)
            );
            if (dist < minDist) {
              minDist = dist;
              closestNode = node;
            }
          });
          if (closestNode) {
            affectedNodeIds.add((closestNode as FEMNode).id);
          }
        }
        break;
      }

      case 'VOLUME_REGION': {
        if (target.entityIds && target.entityIds.length > 0) {
          const targetRegionIds = mesh.regions
            .filter((r) => target.entityIds.includes(r.id) || target.entityIds.includes(r.name))
            .map((r) => r.id);
          mesh.elements.forEach((e) => {
            if (targetRegionIds.includes(e.regionId)) {
              affectedElementIds.add(e.id);
            }
          });
          mesh.elements.forEach((e) => {
            if (affectedElementIds.has(e.id)) {
              e.nodeIds.forEach((nid) => affectedNodeIds.add(nid));
            }
          });
        }
        break;
      }
    }

    // Sort node and element IDs deterministically
    const sortedNodeIds = Array.from(affectedNodeIds).sort((a, b) => a.localeCompare(b));
    const sortedElementIds = Array.from(affectedElementIds).sort((a, b) => a.localeCompare(b));

    // Construct target Hash
    const rawTargetStr = `${target.type}:${sortedNodeIds.join(',')}:${sortedElementIds.join(',')}`;
    const targetHash = GeometrySelector.simpleHash(rawTargetStr);

    return {
      nodeIds: sortedNodeIds,
      elementIds: sortedElementIds,
      faceKeys,
      targetHash,
      isStale: false,
      diagnostics
    };
  }

  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `HASH_${Math.abs(hash).toString(16)}`;
  }
}
