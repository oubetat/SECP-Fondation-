import { ContactSurfaceData } from "./types";

export interface SurfaceNode {
  id: string;
  index: number; // Index in node array
  initialCoords: number[];
  currentCoords: number[];
}

export interface SurfaceFacet {
  facetId: string;
  nodeIds: string[];
  elementId?: string;
}

export class ContactSurface {
  readonly surfaceId: string;
  readonly bodyId: string;
  readonly role: 'MASTER' | 'SLAVE' | 'NEUTRAL';
  readonly normalConvention: 'OUTWARD' | 'INWARD';
  
  private nodes: Map<string, SurfaceNode> = new Map();
  private facets: SurfaceFacet[] = [];

  constructor(data: ContactSurfaceData & { nodes?: any[]; facets?: any[] }, nodes?: SurfaceNode[], facets?: SurfaceFacet[]) {
    this.surfaceId = data.surfaceId;
    this.bodyId = data.bodyId;
    this.role = data.role;
    this.normalConvention = data.normalConvention;

    const rawNodes = nodes || data.nodes || [];
    const rawFacets = facets || data.facets || [];

    rawNodes.forEach((node: any, idx: number) => {
      this.nodes.set(node.id, {
        id: node.id,
        index: node.index ?? idx,
        initialCoords: [...(node.initialCoords || node.originalCoords || [0,0,0])],
        currentCoords: [...(node.currentCoords || [0,0,0])]
      });
    });

    this.facets = rawFacets.map((f: any) => ({ ...f, nodeIds: [...f.nodeIds] }));
  }

  getNodes(): SurfaceNode[] {
    return Array.from(this.nodes.values());
  }

  getNode(id: string): SurfaceNode | undefined {
    return this.nodes.get(id);
  }

  getFacets(): SurfaceFacet[] {
    return this.facets;
  }

  /**
   * Updates current coordinates of surface nodes from global displacement vector.
   */
  updateDisplacements(nodalDisplacements: Map<string, number[]>): void {
    for (const [nodeId, node] of this.nodes.entries()) {
      const disp = nodalDisplacements.get(nodeId);
      if (disp) {
        for (let i = 0; i < node.initialCoords.length; i++) {
          node.currentCoords[i] = node.initialCoords[i] + (disp[i] || 0.0);
        }
      }
    }
  }

  /**
   * Calculates Axis-Aligned Bounding Box (AABB) for the surface.
   */
  computeAABB(expansionMargin: number = 0.0): { min: number[]; max: number[] } {
    const dim = this.getNodes()[0]?.currentCoords.length || 3;
    const min = new Array(dim).fill(Infinity);
    const max = new Array(dim).fill(-Infinity);

    for (const node of this.nodes.values()) {
      for (let d = 0; d < dim; d++) {
        if (node.currentCoords[d] < min[d]) min[d] = node.currentCoords[d];
        if (node.currentCoords[d] > max[d]) max[d] = node.currentCoords[d];
      }
    }

    for (let d = 0; d < dim; d++) {
      min[d] -= expansionMargin;
      max[d] += expansionMargin;
    }

    return { min, max };
  }

  /**
   * Computes unit outward normal for a surface facet.
   */
  computeFacetNormal(facet: SurfaceFacet): number[] {
    const coords = facet.nodeIds.map(nid => this.nodes.get(nid)!.currentCoords);
    if (coords.length === 2) {
      // 2D line segment [x1, y1], [x2, y2]
      const dx = coords[1][0] - coords[0][0];
      const dy = coords[1][1] - coords[0][1];
      const len = Math.hypot(dx, dy);
      if (len < 1e-12) return [0, 1]; // Fallback for degenerate segment
      // Outward normal convention: [-dy / len, dx / len]
      const n = [-dy / len, dx / len];
      return this.normalConvention === 'INWARD' ? [-n[0], -n[1]] : n;
    } else if (coords.length >= 3) {
      // 3D facet: cross product of two edge vectors (v1 = p2-p1, v2 = p3-p1)
      const v1 = [coords[1][0] - coords[0][0], coords[1][1] - coords[0][1], (coords[1][2] || 0) - (coords[0][2] || 0)];
      const v2 = [coords[2][0] - coords[0][0], coords[2][1] - coords[0][1], (coords[2][2] || 0) - (coords[0][2] || 0)];
      const nx = v1[1] * v2[2] - v1[2] * v2[1];
      const ny = v1[2] * v2[0] - v1[0] * v2[2];
      const nz = v1[0] * v2[1] - v1[1] * v2[0];
      const len = Math.hypot(nx, ny, nz);
      if (len < 1e-12) return [0, 0, 1];
      const n = [nx / len, ny / len, nz / len];
      return this.normalConvention === 'INWARD' ? [-n[0], -n[1], -n[2]] : n;
    }
    return [0, 1];
  }

  toData(): ContactSurfaceData {
    return {
      surfaceId: this.surfaceId,
      bodyId: this.bodyId,
      nodeIds: Array.from(this.nodes.keys()),
      faceIds: this.facets.map(f => f.facetId),
      elementIds: Array.from(new Set(this.facets.map(f => f.elementId).filter(Boolean) as string[])),
      role: this.role,
      normalConvention: this.normalConvention
    };
  }
}
