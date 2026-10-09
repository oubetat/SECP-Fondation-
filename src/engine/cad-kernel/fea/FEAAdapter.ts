/**
 * SECP CAD Kernel — FEA Adapter
 * Phase 2 (PATCH-KERNEL-007)
 *
 * Converts BRep solids (BRepSolid / Solid) into finite element meshes (FEAMesh)
 * preserving BRep topology, geometry boundaries, node mappings, and cryptographic hashes.
 */

import { Solid } from '../topology/TopologyContracts';
import { NodeInput, ElementInput } from '../../fem/solver/types';
import { EngineeringHashChain } from '../../evidence/EngineeringHashChain';
import { BRepTessellator } from '../tessellation/BRepTessellator';

export interface FEAMeshOptions {
  elementKind?: 'TRI3' | 'BAR2' | 'QUAD4' | 'TET4';
  youngModulusPa?: number;
  poissonsRatio?: number;
  thicknessMeters?: number;
  crossSectionAreaM2?: number;
}

export interface FEAMesh {
  id: string;
  nodes: NodeInput[];
  elements: ElementInput[];
  brepSourceId: string;
  brepHash: string;
  meshHash: string;
  boundaryNodes: {
    fixedNodeIds: string[];
    loadNodeIds: string[];
  };
}

export class FEAAdapter {
  /**
   * Converts authoritative B-Rep geometry into a discretized FEA Mesh artifact.
   */
  public static meshFromBRep(solid: Solid, options?: FEAMeshOptions): FEAMesh {
    const meshId = `FEA_MESH_${solid?.id || 'BREP'}`;

    if (!solid || !solid.outerShell || !Array.isArray(solid.outerShell.orientedFaces)) {
      const emptyBrepHash = BRepTessellator.computeBRepHash(solid);
      return {
        id: meshId,
        nodes: [],
        elements: [],
        brepSourceId: solid?.id || 'UNKNOWN',
        brepHash: emptyBrepHash,
        meshHash: EngineeringHashChain.computeCanonicalHash({ nodes: [], elements: [] }).canonicalHash,
        boundaryNodes: { fixedNodeIds: [], loadNodeIds: [] }
      };
    }

    // Tessellate BRep solid to extract topology and vertices
    const tessellated = BRepTessellator.tessellate(solid);
    const rawVerts = tessellated.vertices; // x, y, z

    const nodes: NodeInput[] = [];
    const nodeMapByCoordKey = new Map<string, NodeInput>();

    // Construct FEA Nodes from raw BRep vertices
    for (let i = 0; i < rawVerts.length; i += 3) {
      const x = rawVerts[i];
      const y = rawVerts[i + 1];
      const z = rawVerts[i + 2];
      const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;

      if (!nodeMapByCoordKey.has(key)) {
        const nodeIdx = nodes.length;
        const node: NodeInput = {
          id: `N${nodeIdx}`,
          index: nodeIdx,
          coordinates: [x, y, z]
        };
        nodes.push(node);
        nodeMapByCoordKey.set(key, node);
      }
    }

    // Determine min/max coordinates to identify physical boundaries
    let minX = Infinity, maxX = -Infinity;
    for (const n of nodes) {
      if (n.coordinates[0] < minX) minX = n.coordinates[0];
      if (n.coordinates[0] > maxX) maxX = n.coordinates[0];
    }

    const fixedNodeIds: string[] = [];
    const loadNodeIds: string[] = [];

    const tol = 1e-5;
    for (const n of nodes) {
      if (Math.abs(n.coordinates[0] - minX) <= tol) {
        fixedNodeIds.push(n.id);
      }
      if (Math.abs(n.coordinates[0] - maxX) <= tol) {
        loadNodeIds.push(n.id);
      }
    }

    // Fallback if min/max collapsed
    if (fixedNodeIds.length === 0 && nodes.length > 0) fixedNodeIds.push(nodes[0].id);
    if (loadNodeIds.length === 0 && nodes.length > 0) loadNodeIds.push(nodes[nodes.length - 1].id);

    const elemKind = options?.elementKind || 'TRI3';
    const elements: ElementInput[] = [];

    const defaultMaterial = {
      E: options?.youngModulusPa || 200e9,
      nu: options?.poissonsRatio || 0.3,
      thickness: options?.thicknessMeters || 0.01,
      area: options?.crossSectionAreaM2 || 0.001
    };

    if (elemKind === 'TRI3') {
      const triangles = tessellated.indices;
      for (let i = 0; i < triangles.length; i += 3) {
        const i0 = triangles[i];
        const i1 = triangles[i + 1];
        const i2 = triangles[i + 2];

        // Map tessellated vertex indices back to FEA node IDs
        const x0 = rawVerts[i0 * 3], y0 = rawVerts[i0 * 3 + 1], z0 = rawVerts[i0 * 3 + 2];
        const x1 = rawVerts[i1 * 3], y1 = rawVerts[i1 * 3 + 1], z1 = rawVerts[i1 * 3 + 2];
        const x2 = rawVerts[i2 * 3], y2 = rawVerts[i2 * 3 + 1], z2 = rawVerts[i2 * 3 + 2];

        const key0 = `${x0.toFixed(6)},${y0.toFixed(6)},${z0.toFixed(6)}`;
        const key1 = `${x1.toFixed(6)},${y1.toFixed(6)},${z1.toFixed(6)}`;
        const key2 = `${x2.toFixed(6)},${y2.toFixed(6)},${z2.toFixed(6)}`;

        const n0 = nodeMapByCoordKey.get(key0)!;
        const n1 = nodeMapByCoordKey.get(key1)!;
        const n2 = nodeMapByCoordKey.get(key2)!;

        // Ensure 3 distinct nodes for valid TRI3 element
        if (n0 && n1 && n2 && n0.id !== n1.id && n1.id !== n2.id && n0.id !== n2.id) {
          elements.push({
            id: `E${elements.length}`,
            type: 'TRI3',
            nodeIds: [n0.id, n1.id, n2.id],
            material: { ...defaultMaterial }
          });
        }
      }
    } else if (elemKind === 'BAR2') {
      // Connect adjacent nodes along BRep geometry
      for (let i = 0; i < nodes.length - 1; i++) {
        elements.push({
          id: `E${i}`,
          type: 'BAR2',
          nodeIds: [nodes[i].id, nodes[i + 1].id],
          material: { ...defaultMaterial }
        });
      }
    }

    const brepHash = BRepTessellator.computeBRepHash(solid);
    const meshHash = EngineeringHashChain.computeCanonicalHash({
      nodesCount: nodes.length,
      elementsCount: elements.length,
      nodes: nodes.map(n => n.coordinates.map(c => Number(c.toFixed(6)))),
      elements: elements.map(e => e.nodeIds)
    }).canonicalHash;

    return {
      id: meshId,
      nodes,
      elements,
      brepSourceId: solid.id,
      brepHash,
      meshHash,
      boundaryNodes: {
        fixedNodeIds,
        loadNodeIds
      }
    };
  }
}
