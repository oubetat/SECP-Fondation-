import { Node, Face, Cell, BoundaryRegistryEntry, MeshDiagnostic } from './CFDMeshTypes';

export class MeshTopology {
  public static validateReferences(
    nodes: Node[], 
    faces: Face[], 
    cells: Cell[], 
    boundaries: BoundaryRegistryEntry[]
  ): { valid: boolean; diagnostic?: MeshDiagnostic; errors: string[] } {
    const nodeIds = new Set(nodes.map(n => n.id));
    const faceIds = new Set(faces.map(f => f.id));
    const cellIds = new Set(cells.map(c => c.id));
    const errors: string[] = [];
    const diagnostics: MeshDiagnostic[] = [];

    if (nodeIds.size !== nodes.length) {
      errors.push('Duplicate node IDs detected');
      return { valid: false, diagnostic: MeshDiagnostic.DUPLICATE_ID, errors };
    }

    if (cellIds.size !== cells.length) {
      errors.push('Duplicate cell IDs detected');
      return { valid: false, diagnostic: MeshDiagnostic.DUPLICATE_ID, errors };
    }

    if (faceIds.size !== faces.length) {
      errors.push('Duplicate face IDs detected');
      return { valid: false, diagnostic: MeshDiagnostic.DUPLICATE_ID, errors };
    }

    for (const face of faces) {
      for (const nodeId of face.nodeIds) {
        if (!nodeIds.has(nodeId)) {
          errors.push(`Face ${face.id} references non-existent node ${nodeId}`);
          return { valid: false, diagnostic: MeshDiagnostic.OUT_OF_BOUNDS_INDEX, errors };
        }
      }
      
      for (const cellId of face.adjacentCellIds) {
        if (!cellIds.has(cellId)) {
          errors.push(`Face ${face.id} references non-existent cell ${cellId}`);
          return { valid: false, diagnostic: MeshDiagnostic.OUT_OF_BOUNDS_INDEX, errors };
        }
      }
      
      if (face.adjacentCellIds.length === 0) {
        errors.push(`Face ${face.id} has no adjacent cells`);
        diagnostics.push(MeshDiagnostic.INVALID_TOPOLOGY);
      }
      
      if (face.adjacentCellIds.length > 2) {
        errors.push(`Non-manifold face detected: Face ${face.id} has ${face.adjacentCellIds.length} adjacent cells`);
        diagnostics.push(MeshDiagnostic.NON_MANIFOLD_MESH);
      }
    }

    for (const cell of cells) {
      for (const nodeId of cell.nodeIds) {
        if (!nodeIds.has(nodeId)) {
          errors.push(`Cell ${cell.id} references non-existent node ${nodeId}`);
          return { valid: false, diagnostic: MeshDiagnostic.OUT_OF_BOUNDS_INDEX, errors };
        }
      }
      for (const faceId of cell.faceIds) {
        if (!faceIds.has(faceId)) {
          errors.push(`Cell ${cell.id} references non-existent face ${faceId}`);
          return { valid: false, diagnostic: MeshDiagnostic.OUT_OF_BOUNDS_INDEX, errors };
        }
      }
    }

    for (const boundary of boundaries) {
      for (const faceId of boundary.faceIds) {
        if (!faceIds.has(faceId)) {
          errors.push(`Boundary ${boundary.id} references non-existent face ${faceId}`);
          return { valid: false, diagnostic: MeshDiagnostic.OUT_OF_BOUNDS_INDEX, errors };
        }
      }
    }

    return { valid: errors.length === 0, diagnostic: diagnostics[0], errors };
  }

  public static checkOrientation(faces: Face[], cells: Cell[], nodes: Node[]): { valid: boolean; diagnostic?: MeshDiagnostic; errors: string[] } {
    return { valid: true, errors: [] };
  }
}
