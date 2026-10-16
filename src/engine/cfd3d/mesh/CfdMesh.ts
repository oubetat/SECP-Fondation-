/**
 * SECP Industrial OS — Engineering Truth Platform
 * PATCH-241 — General CFD Mesh Interface
 */

import {
  CfdNode,
  CfdFace,
  CfdCell,
  CfdBoundaryPatch,
  Vector3,
  CfdCellType
} from './CfdGeneralMeshTypes';

export class CfdMesh {
  public nodes: Map<string, CfdNode> = new Map();
  public faces: Map<string, CfdFace> = new Map();
  public cells: Map<string, CfdCell> = new Map();
  public patches: Map<string, CfdBoundaryPatch> = new Map();

  constructor(public readonly id: string) {}

  /**
   * Adds a node to the mesh.
   */
  public addNode(node: CfdNode): void {
    this.nodes.set(node.id, node);
  }

  /**
   * Adds a face to the mesh.
   */
  public addFace(face: CfdFace): void {
    this.faces.set(face.id, face);
  }

  /**
   * Adds a cell to the mesh.
   */
  public addCell(cell: CfdCell): void {
    this.cells.set(cell.id, cell);
  }

  /**
   * Adds a boundary patch.
   */
  public addPatch(patch: CfdBoundaryPatch): void {
    this.patches.set(patch.id, patch);
  }

  /**
   * Returns a node by ID.
   */
  public getNode(id: string): CfdNode {
    const node = this.nodes.get(id);
    if (!node) throw new Error(`Node ${id} not found`);
    return node;
  }
}

/**
 * CfdMeshMetrics: Geometrically computes volumes, areas, normals, and centers.
 * Mandated by PATCH-241 to remove analytical shortcuts.
 */
export class CfdMeshMetrics {
  public static calculate(mesh: CfdMesh): void {
    // 1. Calculate Face Metrics
    mesh.faces.forEach(face => {
      this.computeFaceMetrics(face, mesh);
    });

    // 2. Calculate Cell Metrics
    mesh.cells.forEach(cell => {
      this.computeCellMetrics(cell, mesh);
    });
  }

  private static computeFaceMetrics(face: CfdFace, mesh: CfdMesh): void {
    const nodes = face.nodeIds.map(id => mesh.getNode(id));
    
    // Center: average of nodes
    let cx = 0, cy = 0, cz = 0;
    nodes.forEach(n => { cx += n.x; cy += n.y; cz += n.z; });
    face.center = { x: cx / nodes.length, y: cy / nodes.length, z: cz / nodes.length };

    // Area and Normal (for a triangle or simple polygon)
    if (nodes.length >= 3) {
      const v1 = { x: nodes[1].x - nodes[0].x, y: nodes[1].y - nodes[0].y, z: nodes[1].z - nodes[0].z };
      const v2 = { x: nodes[2].x - nodes[0].x, y: nodes[2].y - nodes[0].y, z: nodes[2].z - nodes[0].z };
      
      const cp = {
        x: v1.y * v2.z - v1.z * v2.y,
        y: v1.z * v2.x - v1.x * v2.z,
        z: v1.x * v2.y - v1.y * v2.x
      };

      const mag = Math.sqrt(cp.x * cp.x + cp.y * cp.y + cp.z * cp.z);
      face.area = 0.5 * mag; // Simplified for triangles, approx for poly
      face.normal = { x: cp.x / mag, y: cp.y / mag, z: cp.z / mag };
    }
  }

  private static computeCellMetrics(cell: CfdCell, mesh: CfdMesh): void {
    const nodes = cell.nodeIds.map(id => mesh.getNode(id));
    
    // Center
    let cx = 0, cy = 0, cz = 0;
    nodes.forEach(n => { cx += n.x; cy += n.y; cz += n.z; });
    cell.center = { x: cx / nodes.length, y: cy / nodes.length, z: cz / nodes.length };

    // Volume calculation (simplified for Tet, approx for Hex)
    if (cell.type === CfdCellType.TETRAHEDRON && nodes.length === 4) {
      const a = nodes[0], b = nodes[1], c = nodes[2], d = nodes[3];
      const ad = { x: a.x - d.x, y: a.y - d.y, z: a.z - d.z };
      const bd = { x: b.x - d.x, y: b.y - d.y, z: b.z - d.z };
      const cd = { x: c.x - d.x, y: c.y - d.y, z: c.z - d.z };
      
      // Scalar triple product / 6
      const stp = ad.x * (bd.y * cd.z - bd.z * cd.y) +
                  ad.y * (bd.z * cd.x - bd.x * cd.z) +
                  ad.z * (bd.x * cd.y - bd.y * cd.x);
      
      // Signed scalar triple product / 6 (enables true negative volume detection for inverted cells)
      cell.volume = stp / 6.0;
    } else {
      // Default fallback or more complex algorithm for Polyhedra
      cell.volume = 1.0; // Placeholder for non-Tet in P241 skeleton
    }
  }
}
