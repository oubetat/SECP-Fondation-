import { FEMNode } from './FEMNode';
import { FEMElement } from './FEMElement';

export interface FEMConnectivity {
  nodeToElements: Map<string, string[]>;        // nodeId -> elementIds
  elementToNeighbors: Map<string, string[]>;   // elementId -> neighbor elementIds
  elementToFaces: Map<string, string[][]>;     // elementId -> list of faces (each face is array of nodeIds)
  faceToNeighbors: Map<string, string[]>;      // faceKey (sorted nodeIds joined) -> elementIds sharing this face
  boundaryFaceToRegion: Map<string, string>;   // faceKey -> regionId (if it sits on boundary)
}

export interface ConnectivityAuditResult {
  ok: boolean;
  orphanNodes: string[];
  duplicateNodes: string[][]; // list of node ID pairs/groups
  duplicateElements: string[][]; // list of element ID groups
  invalidNodeReferences: { elementId: string; nodeId: string }[];
  invertedElements: string[]; // element IDs
  nonManifoldConnectivity: string[]; // faceKeys with > 2 elements
  disconnectedComponents: string[][]; // groups of element IDs
}

export class FEMConnectivityBuilder {
  /**
   * Normalize face/edge nodes to create a deterministic hash key.
   */
  public static getFaceKey(nodeIds: string[]): string {
    return [...nodeIds].sort().join('_');
  }

  /**
   * Get faces of an element based on its type.
   */
  public static getElementFaces(element: FEMElement): string[][] {
    const nodes = element.nodeIds;
    switch (element.type) {
      case 'TRI':
        // 3 edges (represented as 2-node arrays)
        return [
          [nodes[0], nodes[1]],
          [nodes[1], nodes[2]],
          [nodes[2], nodes[0]],
        ];
      case 'QUAD':
        // 4 edges
        return [
          [nodes[0], nodes[1]],
          [nodes[1], nodes[2]],
          [nodes[2], nodes[3]],
          [nodes[3], nodes[0]],
        ];
      case 'TET':
        // 4 triangular faces
        return [
          [nodes[0], nodes[2], nodes[1]],
          [nodes[0], nodes[1], nodes[3]],
          [nodes[1], nodes[2], nodes[3]],
          [nodes[0], nodes[3], nodes[2]],
        ];
      case 'HEX':
        // 6 quadrilateral faces
        return [
          [nodes[0], nodes[3], nodes[2], nodes[1]],
          [nodes[0], nodes[1], nodes[5], nodes[4]],
          [nodes[1], nodes[2], nodes[6], nodes[5]],
          [nodes[2], nodes[3], nodes[7], nodes[6]],
          [nodes[3], nodes[0], nodes[4], nodes[7]],
          [nodes[4], nodes[5], nodes[6], nodes[7]],
        ];
      default:
        return [];
    }
  }

  /**
   * Build complete topological connectivity maps.
   */
  public static build(nodes: FEMNode[], elements: FEMElement[]): FEMConnectivity {
    const nodeToElements = new Map<string, string[]>();
    const elementToNeighbors = new Map<string, string[]>();
    const elementToFaces = new Map<string, string[][]>();
    const faceToNeighbors = new Map<string, string[]>();
    const boundaryFaceToRegion = new Map<string, string>();

    // Initialize node maps
    for (const node of nodes) {
      nodeToElements.set(node.id, []);
    }

    // Populate nodeToElements and elementToFaces and faceToNeighbors
    for (const elem of elements) {
      elementToFaces.set(elem.id, this.getElementFaces(elem));

      for (const nid of elem.nodeIds) {
        if (nodeToElements.has(nid)) {
          nodeToElements.get(nid)!.push(elem.id);
        }
      }

      const faces = this.getElementFaces(elem);
      for (const face of faces) {
        const key = this.getFaceKey(face);
        if (!faceToNeighbors.has(key)) {
          faceToNeighbors.set(key, []);
        }
        faceToNeighbors.get(key)!.push(elem.id);
      }
    }

    // Build elementToNeighbors based on shared faces
    for (const elem of elements) {
      const neighbors = new Set<string>();
      const faces = elementToFaces.get(elem.id) || [];
      for (const face of faces) {
        const key = this.getFaceKey(face);
        const sharing = faceToNeighbors.get(key) || [];
        for (const otherId of sharing) {
          if (otherId !== elem.id) {
            neighbors.add(otherId);
          }
        }
      }
      elementToNeighbors.set(elem.id, Array.from(neighbors));
    }

    // Determine boundary faces (faces shared by exactly 1 element)
    for (const [key, sharing] of faceToNeighbors.entries()) {
      if (sharing.length === 1) {
        // Find element
        const elemId = sharing[0];
        const elem = elements.find(e => e.id === elemId);
        if (elem) {
          boundaryFaceToRegion.set(key, elem.regionId);
        }
      }
    }

    return {
      nodeToElements,
      elementToNeighbors,
      elementToFaces,
      faceToNeighbors,
      boundaryFaceToRegion,
    };
  }

  /**
   * Audit connectivity maps for defects.
   */
  public static audit(
    nodes: FEMNode[],
    elements: FEMElement[],
    connectivity: FEMConnectivity,
    invertedElementDetector: (elem: FEMElement, nodesMap: Map<string, FEMNode>) => boolean
  ): ConnectivityAuditResult {
    const nodesMap = new Map<string, FEMNode>(nodes.map(n => [n.id, n]));
    const orphanNodes: string[] = [];
    const duplicateNodes: string[][] = [];
    const duplicateElements: string[][] = [];
    const invalidNodeReferences: { elementId: string; nodeId: string }[] = [];
    const invertedElements: string[] = [];
    const nonManifoldConnectivity: string[] = [];

    // 1. Orphan Nodes
    for (const node of nodes) {
      const associated = connectivity.nodeToElements.get(node.id) || [];
      if (associated.length === 0) {
        orphanNodes.push(node.id);
      }
    }

    // 2. Duplicate Nodes (using spatial tolerance)
    const tol = 1e-6;
    const checked = new Set<string>();
    for (let i = 0; i < nodes.length; i++) {
      const ni = nodes[i];
      if (checked.has(ni.id)) continue;
      const dupGroup = [ni.id];
      for (let j = i + 1; j < nodes.length; j++) {
        const nj = nodes[j];
        const dist = Math.hypot(ni.x - nj.x, ni.y - nj.y, ni.z - nj.z);
        if (dist < tol) {
          dupGroup.push(nj.id);
          checked.add(nj.id);
        }
      }
      if (dupGroup.length > 1) {
        duplicateNodes.push(dupGroup);
      }
    }

    // 3. Invalid Node References and Inverted Elements
    for (const elem of elements) {
      for (const nid of elem.nodeIds) {
        if (!nodesMap.has(nid)) {
          invalidNodeReferences.push({ elementId: elem.id, nodeId: nid });
        }
      }

      // Check if element is inverted
      if (elem.nodeIds.every(nid => nodesMap.has(nid))) {
        if (invertedElementDetector(elem, nodesMap)) {
          invertedElements.push(elem.id);
        }
      }
    }

    // 4. Duplicate Elements (same node set)
    const elemChecked = new Set<string>();
    for (let i = 0; i < elements.length; i++) {
      const ei = elements[i];
      if (elemChecked.has(ei.id)) continue;
      const group = [ei.id];
      const sortedI = [...ei.nodeIds].sort().join(',');

      for (let j = i + 1; j < elements.length; j++) {
        const ej = elements[j];
        const sortedJ = [...ej.nodeIds].sort().join(',');
        if (sortedI === sortedJ) {
          group.push(ej.id);
          elemChecked.add(ej.id);
        }
      }
      if (group.length > 1) {
        duplicateElements.push(group);
      }
    }

    // 5. Non-Manifold (face shared by > 2 elements)
    for (const [faceKey, sharing] of connectivity.faceToNeighbors.entries()) {
      if (sharing.length > 2) {
        nonManifoldConnectivity.push(faceKey);
      }
    }

    // 6. Disconnected Components (via BFS on elements)
    const visited = new Set<string>();
    const components: string[][] = [];

    for (const elem of elements) {
      if (visited.has(elem.id)) continue;

      const comp: string[] = [];
      const queue: string[] = [elem.id];
      visited.add(elem.id);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        comp.push(curr);

        const neighbors = connectivity.elementToNeighbors.get(curr) || [];
        for (const neigh of neighbors) {
          if (!visited.has(neigh)) {
            visited.add(neigh);
            queue.push(neigh);
          }
        }
      }
      components.push(comp);
    }

    const ok =
      orphanNodes.length === 0 &&
      duplicateNodes.length === 0 &&
      duplicateElements.length === 0 &&
      invalidNodeReferences.length === 0 &&
      invertedElements.length === 0 &&
      nonManifoldConnectivity.length === 0 &&
      components.length <= 1;

    return {
      ok,
      orphanNodes,
      duplicateNodes,
      duplicateElements,
      invalidNodeReferences,
      invertedElements,
      nonManifoldConnectivity,
      disconnectedComponents: components,
    };
  }
}
