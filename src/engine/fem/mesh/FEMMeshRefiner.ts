import { FEMMesh } from './FEMMesh';
import { FEMNode } from './FEMNode';
import { FEMElement } from './FEMElement';
import { FEMBoundary } from './FEMBoundary';
import { FEMConnectivityBuilder } from './FEMConnectivity';
import { FEMMeshDeterminism } from './FEMMeshDeterminism';
import { FEMMeshQualityCalculator } from './FEMMeshQuality';

export class FEMMeshRefiner {
  /**
   * Refine a FEMMesh globally.
   */
  public static refineGlobal(mesh: FEMMesh): FEMMesh {
    return this.refineSelected(mesh, () => true);
  }

  /**
   * Refine elements inside a specific region.
   */
  public static refineRegion(mesh: FEMMesh, regionId: string): FEMMesh {
    return this.refineSelected(mesh, (elem) => elem.regionId === regionId);
  }

  /**
   * General-purpose mesh refinement based on a selection predicate.
   */
  private static refineSelected(mesh: FEMMesh, selectPredicate: (elem: FEMElement) => boolean): FEMMesh {
    const nodesMap = new Map<string, FEMNode>(mesh.nodes.map(n => [n.id, n]));
    const nextNodes = [...mesh.nodes];
    const nextElements: FEMElement[] = [];

    // Map to cache created edge midpoints: "nodeId1_nodeId2" -> midpointNodeId
    const edgeMidpointCache = new Map<string, string>();
    
    // Helper to get or create edge midpoint node
    const getOrCreateMidpoint = (id1: string, id2: string): string => {
      const key = [id1, id2].sort().join('_');
      if (edgeMidpointCache.has(key)) {
        return edgeMidpointCache.get(key)!;
      }
      
      const n1 = nodesMap.get(id1)!;
      const n2 = nodesMap.get(id2)!;
      const midId = `n_mid_${key}`;
      
      const midNode: FEMNode = {
        id: midId,
        x: (n1.x + n2.x) / 2,
        y: (n1.y + n2.y) / 2,
        z: (n1.z + n2.z) / 2,
        boundaryTags: Array.from(new Set([...n1.boundaryTags, ...n2.boundaryTags])),
        regionIds: Array.from(new Set([...n1.regionIds, ...n2.regionIds])),
      };
      
      nextNodes.push(midNode);
      edgeMidpointCache.set(key, midId);
      return midId;
    };

    // Helper to create a centroid node
    const createCentroid = (ids: string[], elementId: string, suffix: string): string => {
      const pNodes = ids.map(id => nodesMap.get(id)!);
      const centId = `n_cent_${elementId}_${suffix}`;
      const sum = pNodes.reduce((acc, curr) => ({ x: acc.x + curr.x, y: acc.y + curr.y, z: acc.z + curr.z }), { x: 0, y: 0, z: 0 });
      const count = pNodes.length;
      
      const centNode: FEMNode = {
        id: centId,
        x: sum.x / count,
        y: sum.y / count,
        z: sum.z / count,
        boundaryTags: [],
        regionIds: pNodes[0]?.regionIds || [],
      };
      nextNodes.push(centNode);
      return centId;
    };

    let elemCounter = 0;
    const generateElemId = (type: string) => `e_ref_${type}_${elemCounter++}`;

    for (const elem of mesh.elements) {
      if (!selectPredicate(elem)) {
        // Keep original element unchanged
        nextElements.push(elem);
        continue;
      }

      const ids = elem.nodeIds;
      if (elem.type === 'TRI') {
        const ab = getOrCreateMidpoint(ids[0], ids[1]);
        const bc = getOrCreateMidpoint(ids[1], ids[2]);
        const ca = getOrCreateMidpoint(ids[2], ids[0]);

        // Divide into 4 triangles
        nextElements.push(
          { ...elem, id: generateElemId('TRI'), nodeIds: [ids[0], ab, ca] },
          { ...elem, id: generateElemId('TRI'), nodeIds: [ids[1], bc, ab] },
          { ...elem, id: generateElemId('TRI'), nodeIds: [ids[2], ca, bc] },
          { ...elem, id: generateElemId('TRI'), nodeIds: [ab, bc, ca] }
        );
      } 
      else if (elem.type === 'QUAD') {
        const ab = getOrCreateMidpoint(ids[0], ids[1]);
        const bc = getOrCreateMidpoint(ids[1], ids[2]);
        const cd = getOrCreateMidpoint(ids[2], ids[3]);
        const da = getOrCreateMidpoint(ids[3], ids[0]);
        const cent = createCentroid(ids, elem.id, 'quad');

        // Divide into 4 quads
        nextElements.push(
          { ...elem, id: generateElemId('QUAD'), nodeIds: [ids[0], ab, cent, da] },
          { ...elem, id: generateElemId('QUAD'), nodeIds: [ab, ids[1], bc, cent] },
          { ...elem, id: generateElemId('QUAD'), nodeIds: [cent, bc, ids[2], cd] },
          { ...elem, id: generateElemId('QUAD'), nodeIds: [da, cent, cd, ids[3]] }
        );
      } 
      else if (elem.type === 'TET') {
        const ab = getOrCreateMidpoint(ids[0], ids[1]);
        const bc = getOrCreateMidpoint(ids[1], ids[2]);
        const ca = getOrCreateMidpoint(ids[2], ids[0]);
        const ad = getOrCreateMidpoint(ids[0], ids[3]);
        const bd = getOrCreateMidpoint(ids[1], ids[3]);
        const cd = getOrCreateMidpoint(ids[2], ids[3]);

        // Divide into 8 tets:
        // 4 corner tets
        nextElements.push(
          { ...elem, id: generateElemId('TET'), nodeIds: [ids[0], ab, ca, ad] },
          { ...elem, id: generateElemId('TET'), nodeIds: [ids[1], bc, ab, bd] },
          { ...elem, id: generateElemId('TET'), nodeIds: [ids[2], ca, bc, cd] },
          { ...elem, id: generateElemId('TET'), nodeIds: [ids[3], ad, bd, cd] }
        );
        // 4 interior tets from dividing the inner octahedron around diagonal ab-cd
        nextElements.push(
          { ...elem, id: generateElemId('TET'), nodeIds: [ab, bc, ca, cd] },
          { ...elem, id: generateElemId('TET'), nodeIds: [ab, ca, ad, cd] },
          { ...elem, id: generateElemId('TET'), nodeIds: [ab, bc, bd, cd] },
          { ...elem, id: generateElemId('TET'), nodeIds: [ab, bd, ad, cd] }
        );
      } 
      else if (elem.type === 'HEX') {
        const e01 = getOrCreateMidpoint(ids[0], ids[1]);
        const e12 = getOrCreateMidpoint(ids[1], ids[2]);
        const e23 = getOrCreateMidpoint(ids[2], ids[3]);
        const e30 = getOrCreateMidpoint(ids[3], ids[0]);
        
        const e45 = getOrCreateMidpoint(ids[4], ids[5]);
        const e56 = getOrCreateMidpoint(ids[5], ids[6]);
        const e67 = getOrCreateMidpoint(ids[6], ids[7]);
        const e74 = getOrCreateMidpoint(ids[7], ids[4]);
        
        const e04 = getOrCreateMidpoint(ids[0], ids[4]);
        const e15 = getOrCreateMidpoint(ids[1], ids[5]);
        const e26 = getOrCreateMidpoint(ids[2], ids[6]);
        const e37 = getOrCreateMidpoint(ids[3], ids[7]);

        // Centroids of 6 faces
        const fBottom = createCentroid([ids[0], ids[1], ids[2], ids[3]], elem.id, 'f_bot');
        const fTop = createCentroid([ids[4], ids[5], ids[6], ids[7]], elem.id, 'f_top');
        const fFront = createCentroid([ids[0], ids[1], ids[5], ids[4]], elem.id, 'f_front');
        const fRight = createCentroid([ids[1], ids[2], ids[6], ids[5]], elem.id, 'f_right');
        const fBack = createCentroid([ids[2], ids[3], ids[7], ids[6]], elem.id, 'f_back');
        const fLeft = createCentroid([ids[3], ids[0], ids[4], ids[7]], elem.id, 'f_left');

        // Hex overall centroid
        const cent = createCentroid(ids, elem.id, 'hex_cent');

        // Split hex into 8 smaller hexes
        nextElements.push(
          { ...elem, id: generateElemId('HEX'), nodeIds: [ids[0], e01, fBottom, e30, e04, fFront, cent, fLeft] },
          { ...elem, id: generateElemId('HEX'), nodeIds: [e01, ids[1], e12, fBottom, fFront, e15, fRight, cent] },
          { ...elem, id: generateElemId('HEX'), nodeIds: [fBottom, e12, ids[2], e23, cent, fRight, e26, fBack] },
          { ...elem, id: generateElemId('HEX'), nodeIds: [e30, fBottom, e23, ids[3], fLeft, cent, fBack, e37] },
          { ...elem, id: generateElemId('HEX'), nodeIds: [e04, fFront, cent, fLeft, ids[4], e45, fTop, e74] },
          { ...elem, id: generateElemId('HEX'), nodeIds: [fFront, e15, fRight, cent, e45, ids[5], e56, fTop] },
          { ...elem, id: generateElemId('HEX'), nodeIds: [cent, fRight, e26, fBack, fTop, e56, ids[6], e67] },
          { ...elem, id: generateElemId('HEX'), nodeIds: [fLeft, cent, fBack, e37, e74, fTop, e67, ids[7]] }
        );
      }
    }

    // Map updated node IDs for Boundary tags preservation
    const updatedBoundaries: FEMBoundary[] = mesh.boundaries.map(boundary => {
      const bNodes = new Set(boundary.nodeIds);
      // For any edge midpoint created where both endpoints were in this boundary, add midpoint to boundary
      edgeMidpointCache.forEach((midId, edgeKey) => {
        const [id1, id2] = edgeKey.split('_');
        if (bNodes.has(id1) && bNodes.has(id2)) {
          bNodes.add(midId);
        }
      });
      return {
        ...boundary,
        nodeIds: Array.from(bNodes),
      };
    });

    // Rebuild connectivity and quality metrics
    const conn = FEMConnectivityBuilder.build(nextNodes, nextElements);
    const quality = FEMMeshQualityCalculator.analyze(nextNodes, nextElements);
    const hashes = FEMMeshDeterminism.calculateHashes(
      'REFINED_MESH',
      { parentMeshId: mesh.id },
      nextNodes,
      nextElements,
      updatedBoundaries,
      mesh.regions,
      quality
    );

    return {
      id: `mesh_refined_${Date.now()}`,
      nodes: nextNodes,
      elements: nextElements,
      boundaries: updatedBoundaries,
      regions: mesh.regions,
      connectivity: conn,
      meshHash: hashes.meshHash,
      topologyHash: hashes.topologyHash,
      geometryHash: hashes.geometryHash,
      qualityHash: hashes.qualityHash,
      timestamp: Date.now(),
      diagnostics: `Refined mesh. Nodes: ${nextNodes.length}, Elements: ${nextElements.length}. Quality: ${quality.overallClassification}`,
    };
  }
}
