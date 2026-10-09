/**
 * SECP Industrial OS v2 — Mesh Canonicalizer
 * PATCH-051: CFD Mesh Infrastructure
 */

import { CFDMesh } from './CFDMeshTypes';
import * as crypto from 'crypto';

export class MeshCanonicalizer {
  /**
   * Generates a deterministic hash for a mesh.
   */
  public static calculateHash(mesh: CFDMesh): string {
    const canonicalNodes = [...mesh.nodes].sort((a, b) => a.id - b.id).map(n => ({
      id: n.id,
      coords: n.coords
    }));

    const canonicalFaces = [...mesh.faces].sort((a, b) => a.id - b.id).map(f => ({
      id: f.id,
      nodeIds: [...f.nodeIds].sort((a, b) => a - b),
      adjacentCellIds: [...f.adjacentCellIds].sort((a, b) => a - b),
      boundaryId: f.boundaryId || null
    }));

    const canonicalCells = [...mesh.cells].sort((a, b) => a.id - b.id).map(c => ({
      id: c.id,
      nodeIds: [...c.nodeIds].sort((a, b) => a - b),
      faceIds: [...c.faceIds].sort((a, b) => a - b),
      cellType: c.cellType
    }));

    const canonicalBoundaries = [...mesh.boundaries].sort((a, b) => a.id.localeCompare(b.id)).map(b => ({
      id: b.id,
      name: b.name,
      boundaryType: b.boundaryType,
      faceIds: [...b.faceIds].sort((a, b) => a - b)
    }));

    const payload = JSON.stringify({
      nodes: canonicalNodes,
      faces: canonicalFaces,
      cells: canonicalCells,
      boundaries: canonicalBoundaries,
      dimensionality: mesh.dimensionality,
      toleranceConfig: mesh.toleranceConfig
    });

    return crypto.createHash('sha256').update(payload).digest('hex');
  }
}
