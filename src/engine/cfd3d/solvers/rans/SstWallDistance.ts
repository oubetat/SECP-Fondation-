/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-064: Wall Distance Calculator
 */

import { CFDMesh3D } from '../../mesh/CFDMeshTypes';

export class SstWallDistance {
  public static compute(mesh: CFDMesh3D): number[] {
    const wallFaces = mesh.faces.filter(f => f.isBoundary);
    
    // Fallback if no wall boundary is marked
    if (wallFaces.length === 0) {
      return new Array(mesh.cells.length).fill(0.1);
    }

    const cellDistances: number[] = [];

    for (const cell of mesh.cells) {
      const cc = cell.center;
      let minDistance = Infinity;

      for (const face of wallFaces) {
        // We use the cell center of adjacent face boundary center as a proxy
        // Since face has no center directly, we'll project from owner cell or use a small offset
        const ownerCell = mesh.cells.find(c => c.id === face.ownerCellId);
        if (ownerCell) {
          const fc = ownerCell.center;
          const dx = cc[0] - fc[0];
          const dy = cc[1] - fc[1];
          const dz = cc[2] - fc[2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < minDistance) {
            minDistance = dist;
          }
        }
      }

      // Safeguard against exactly 0
      if (minDistance <= 0 || minDistance === Infinity) {
        minDistance = 1e-4;
      }
      cellDistances.push(minDistance);
    }

    return cellDistances;
  }
}
