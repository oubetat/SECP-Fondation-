/**
 * SECP Industrial OS v2 — Control Volume & Face Geometry
 * PATCH-052: Finite Volume Core
 */

import { CFDMesh, Face, Cell } from '../mesh/CFDMeshTypes';
import { MeshGeometry } from '../mesh/MeshGeometry';
import { FVMControlVolume, FVMFace } from './FvmTypes';

export class FVMGeometryCore {
  /**
   * Transforms a canonical mesh into FVM-optimized Control Volumes.
   */
  public static buildControlVolumes(mesh: CFDMesh): FVMControlVolume[] {
    const faceMap = new Map(mesh.faces.map(f => [f.id, f]));
    
    return mesh.cells.map(cell => {
      const neighborCellIds: number[] = [];
      const boundaryFaceIds: number[] = [];
      
      for (const fId of cell.faceIds) {
        const face = faceMap.get(fId);
        if (!face) continue;
        
        const otherCell = face.adjacentCellIds.find(id => id !== cell.id);
        if (otherCell !== undefined) {
          neighborCellIds.push(otherCell);
        } else if (face.boundaryId) {
          boundaryFaceIds.push(fId);
        }
      }
      
      // Use geometric metrics from MeshGeometry (calculated in PATCH-051)
      const { volume, centroid } = MeshGeometry.calculateCellVolumeAndCentroid(cell, mesh.faces, mesh.nodes);
      
      return {
        cellId: cell.id,
        volume,
        centroid,
        faceIds: cell.faceIds,
        neighborCellIds,
        boundaryFaceIds
      };
    });
  }

  /**
   * Transforms a mesh face into an FVM face with explicit ownership and normal orientation.
   * By convention, the normal points OUTWARD from the ownerCellId.
   */
  public static buildFVMFace(face: Face, mesh: CFDMesh, ownerCellId: number): FVMFace {
    const { area, normal } = MeshGeometry.calculateFaceAreaAndNormal(face, mesh.nodes);
    const centroid = MeshGeometry.calculateFaceCentroid(face, mesh.nodes);
    
    const neighborCellId = face.adjacentCellIds.find(id => id !== ownerCellId) ?? null;
    const boundaryEntry = mesh.boundaries.find(b => b.faceIds.includes(face.id));
    
    // Ensure normal points outward from owner
    const ownerCell = mesh.cells.find(c => c.id === ownerCellId);
    if (!ownerCell) throw new Error(`Owner cell ${ownerCellId} not found for face ${face.id}`);
    
    const { centroid: cellCentroid } = MeshGeometry.calculateCellVolumeAndCentroid(ownerCell, mesh.faces, mesh.nodes);
    const vToFace = [centroid[0] - cellCentroid[0], centroid[1] - cellCentroid[1], centroid[2] - cellCentroid[2]];
    const dot = vToFace[0] * normal[0] + vToFace[1] * normal[1] + vToFace[2] * normal[2];
    
    const outwardNormal: [number, number, number] = dot >= 0 ? normal : [-normal[0], -normal[1], -normal[2]];

    return {
      faceId: face.id,
      area,
      normal: outwardNormal,
      centroid,
      ownerCellId,
      neighborCellId,
      boundaryType: boundaryEntry?.boundaryType ?? null
    };
  }
}
