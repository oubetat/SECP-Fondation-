/**
 * SECP Industrial OS — Engineering Truth OS
 * DynamicMeshManager.ts
 *
 * Manages Arbitrary Lagrangian-Eulerian (ALE) dynamic mesh morphing,
 * boundary coordinate propagation, and geometric validity/inversion auditing
 * for 3D finite volume CFD grids in FSI coupling.
 */

import { FvmMesh3D, FvmCell3D, FvmFace3D, Vector3D, MeshQualityReport3D } from '../../Fvm3DTypes';
import { Fvm3DMeshGenerator } from '../../Fvm3DMeshGenerator';

export interface BoundaryDisplacement3D {
  faceId: number;
  dx: number;
  dy: number;
  dz: number;
}

export interface DynamicMeshResult {
  success: boolean;
  morphedMesh: FvmMesh3D;
  facesUpdatedCount: number;
  cellsUpdatedCount: number;
  maxDisplacementNorm: number;
  quality: MeshQualityReport3D;
  error?: string;
}

export class DynamicMeshManager {
  /**
   * Applies boundary interface displacements to the fluid mesh with distance-decay smoothing,
   * updates face and cell geometries, updates cell volumes, and audits for element inversion or degeneracy.
   * If any element inverts or coordinates become invalid, the mutation is rejected
   * and the original mesh is returned unmodified.
   */
  public static deformMesh(
    originalMesh: FvmMesh3D,
    boundaryDisplacements: BoundaryDisplacement3D[],
    decayRadius: number = 0.5
  ): DynamicMeshResult {
    // 1. Sanity check inputs for finiteness
    let maxDispNorm = 0;
    for (const d of boundaryDisplacements) {
      if (!Number.isFinite(d.dx) || !Number.isFinite(d.dy) || !Number.isFinite(d.dz)) {
        return {
          success: false,
          morphedMesh: originalMesh,
          facesUpdatedCount: 0,
          cellsUpdatedCount: 0,
          maxDisplacementNorm: NaN,
          quality: originalMesh.quality,
          error: 'REJECTED: Non-finite displacement encountered (NaN / Infinity)'
        };
      }
      const norm = Math.sqrt(d.dx * d.dx + d.dy * d.dy + d.dz * d.dz);
      if (norm > maxDispNorm) maxDispNorm = norm;
    }

    // Fast-path: zero displacement -> no mutation needed
    if (boundaryDisplacements.length === 0 || maxDispNorm < 1e-15) {
      return {
        success: true,
        morphedMesh: originalMesh,
        facesUpdatedCount: 0,
        cellsUpdatedCount: 0,
        maxDisplacementNorm: 0,
        quality: originalMesh.quality
      };
    }

    // 2. Deep clone mesh to guarantee atomicity (rollback on failure)
    const morphedMesh: FvmMesh3D = JSON.parse(JSON.stringify(originalMesh));

    // Map face displacements by faceId for boundary updates
    const dispMap = new Map<number, Vector3D>();
    for (const d of boundaryDisplacements) {
      dispMap.set(d.faceId, { x: d.dx, y: d.dy, z: d.dz });
    }

    // 3. Update boundary face centroids and collect boundary conditions for smoothing
    let facesUpdatedCount = 0;
    const boundaryPositions: Array<{ pos: Vector3D; disp: Vector3D }> = [];

    for (const face of morphedMesh.faces) {
      const disp = dispMap.get(face.faceId);
      if (disp) {
        // Record original position for distance smoothing
        boundaryPositions.push({
          pos: { x: face.centroid.x, y: face.centroid.y, z: face.centroid.z },
          disp
        });

        face.centroid.x += disp.x;
        face.centroid.y += disp.y;
        face.centroid.z += disp.z;
        facesUpdatedCount++;
      }
    }

    // 4. Update cell volumes and check for immediate inversion
    for (const cell of morphedMesh.cells) {
      const originalVolume = cell.volume;
      let deltaV = 0;
      const faceIds = cell.faceIds || cell.faceIndices || [];
      for (const faceId of faceIds) {
        const disp = dispMap.get(faceId);
        if (disp) {
          const face = morphedMesh.faces.find(f => f.faceId === faceId);
          if (face) {
            const sign = (face.ownerCellId === cell.cellId || face.ownerCell === cell.cellId) ? 1.0 : -1.0;
            const normProj = (disp.x * face.normal.x + disp.y * face.normal.y + disp.z * face.normal.z) * sign;
            deltaV += normProj * face.area;
          }
        }
      }

      cell.volume += deltaV;

      // Inversion check: Relative threshold (0.01% of original volume)
      // This ensures scale-invariance for industrial vs micro models.
      const relativeThreshold = Math.max(originalVolume * 1e-4, 1e-24); 
      if (!Number.isFinite(cell.volume) || cell.volume <= relativeThreshold) {
        return {
          success: false,
          morphedMesh: originalMesh, // Atomic rollback
          facesUpdatedCount: 0,
          cellsUpdatedCount: 0,
          maxDisplacementNorm: maxDispNorm,
          quality: originalMesh.quality,
          error: `REJECTED: Element inversion/degeneracy! Cell ${cell.cellId} volume ${cell.volume.toExponential(4)} (Threshold: ${relativeThreshold.toExponential(4)}, Original: ${originalVolume.toExponential(4)})`
        };
      }
    }

    // 5. Propagate displacement to cell centroids with inverse-distance decay
    let cellsUpdatedCount = 0;
    const R = Math.max(decayRadius, 1e-4);
    const Rsq = R * R;

    for (const cell of morphedMesh.cells) {
      let totalWeight = 0;
      let dispX = 0;
      let dispY = 0;
      let dispZ = 0;

      for (const bp of boundaryPositions) {
        const dx = cell.centroid.x - bp.pos.x;
        const dy = cell.centroid.y - bp.pos.y;
        const dz = cell.centroid.z - bp.pos.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < Rsq) {
          const w = Math.pow(1 - distSq / Rsq, 2);
          dispX += bp.disp.x * w;
          dispY += bp.disp.y * w;
          dispZ += bp.disp.z * w;
          totalWeight += w;
        }
      }

      if (totalWeight > 0) {
        const factor = Math.min(totalWeight, 1.0);
        cell.centroid.x += (dispX / totalWeight) * factor;
        cell.centroid.y += (dispY / totalWeight) * factor;
        cell.centroid.z += (dispZ / totalWeight) * factor;
        cellsUpdatedCount++;
      }

      if (!Number.isFinite(cell.centroid.x) || !Number.isFinite(cell.centroid.y) || !Number.isFinite(cell.centroid.z)) {
        return {
          success: false,
          morphedMesh: originalMesh,
          facesUpdatedCount: 0,
          cellsUpdatedCount: 0,
          maxDisplacementNorm: maxDispNorm,
          quality: originalMesh.quality,
          error: `REJECTED: Non-finite centroid encountered in cell ${cell.cellId}`
        };
      }
    }

    // 6. Update mesh nodes (vertices) if they exist in the model
    if (morphedMesh.nodes && morphedMesh.nodes.length > 0) {
      for (const node of morphedMesh.nodes) {
        let totalWeight = 0;
        let dispX = 0;
        let dispY = 0;
        let dispZ = 0;

        for (const bp of boundaryPositions) {
          const dx = node.x - bp.pos.x;
          const dy = node.y - bp.pos.y;
          const dz = node.z - bp.pos.z;
          const distSq = dx * dx + dy * dy + dz * dz;

          if (distSq < Rsq) {
            const w = Math.pow(1 - distSq / Rsq, 2);
            dispX += bp.disp.x * w;
            dispY += bp.disp.y * w;
            dispZ += bp.disp.z * w;
            totalWeight += w;
          }
        }

        if (totalWeight > 0) {
          const factor = Math.min(totalWeight, 1.0);
          node.x += (dispX / totalWeight) * factor;
          node.y += (dispY / totalWeight) * factor;
          node.z += (dispZ / totalWeight) * factor;
        }
      }
    }

    // 7. Update interior face centroids based on updated cell centroids
    for (const face of morphedMesh.faces) {
      if (face.boundaryType === 'INTERNAL' || (face.neighborCellId !== undefined && face.neighborCellId >= 0)) {
        const owner = morphedMesh.cells[face.ownerCellId];
        const neighbor = morphedMesh.cells[face.neighborCellId!];
        if (owner && neighbor) {
          face.centroid.x = 0.5 * (owner.centroid.x + neighbor.centroid.x);
          face.centroid.y = 0.5 * (owner.centroid.y + neighbor.centroid.y);
          face.centroid.z = 0.5 * (owner.centroid.z + neighbor.centroid.z);
        }
      }
    }

    // 8. Final Audit of Mesh Quality
    const finalQuality = Fvm3DMeshGenerator.auditMeshQuality(morphedMesh.cells, morphedMesh.faces);
    
    if (!finalQuality.passed || finalQuality.hasDegenerateCells || finalQuality.minCellVolume <= 1e-18) {
      return {
        success: false,
        morphedMesh: originalMesh, // Rollback
        facesUpdatedCount: 0,
        cellsUpdatedCount: 0,
        maxDisplacementNorm: maxDispNorm,
        quality: finalQuality,
        error: `REJECTED: Post-deformation quality audit failed. Min volume: ${finalQuality.minCellVolume.toExponential(4)}, Max Aspect Ratio: ${finalQuality.maxAspectRatio.toFixed(2)}`
      };
    }

    morphedMesh.quality = finalQuality;

    return {
      success: true,
      morphedMesh,
      facesUpdatedCount,
      cellsUpdatedCount,
      maxDisplacementNorm: maxDispNorm,
      quality: finalQuality
    };
  }

  /**
   * Validates whether a mesh is physically consistent and non-inverted.
   */
  public static validateMesh(mesh: FvmMesh3D): { isValid: boolean; error?: string } {
    const q = Fvm3DMeshGenerator.auditMeshQuality(mesh.cells, mesh.faces);
    if (!q.hasPositiveVolumes || q.minCellVolume <= 1e-18) {
      return { isValid: false, error: `Mesh has non-positive or near-zero cell volumes: ${q.minCellVolume.toExponential(4)}` };
    }
    if (q.hasDegenerateCells) {
      return { isValid: false, error: `Mesh has degenerate elements (max aspect ratio: ${q.maxAspectRatio.toFixed(2)})` };
    }
    return { isValid: true };
  }
}
