/**
 * SECP Industrial OS — Engineering Truth Platform
 * PATCH-241 — CFD Mesh Connectivity Engine
 */

import { CfdMesh } from './CfdMesh';
import { CfdFace } from './CfdGeneralMeshTypes';

export class CfdConnectivity {
  /**
   * Builds topological connectivity across cells, faces, and boundary patches.
   * - Maps faces to owner and neighbour cells based on shared node incidence.
   * - Wires reciprocal cell-to-face mappings.
   * - Binds boundary patches to boundary faces bidirectionally.
   */
  public static build(mesh: CfdMesh): void {
    // Reset cell-face associations
    mesh.cells.forEach(cell => {
      cell.faceIds = [];
    });

    // Match faces to cells
    mesh.faces.forEach(face => {
      const matchingCells: string[] = [];

      mesh.cells.forEach(cell => {
        // A face belongs to a cell if all face nodes are in the cell's nodeIds
        const isIncident = face.nodeIds.every(nId => cell.nodeIds.includes(nId));
        if (isIncident) {
          matchingCells.push(cell.id);
          if (!cell.faceIds.includes(face.id)) {
            cell.faceIds.push(face.id);
          }
        }
      });

      if (matchingCells.length >= 1) {
        face.ownerCellId = matchingCells[0];
      }
      if (matchingCells.length >= 2) {
        face.neighbourCellId = matchingCells[1];
      } else {
        face.neighbourCellId = null;
      }
    });

    // Wire patch associations bidirectionally
    mesh.patches.forEach(patch => {
      patch.faceIds.forEach(faceId => {
        const face = mesh.faces.get(faceId);
        if (face) {
          face.boundaryPatchId = patch.id;
        }
      });
    });
  }
}
