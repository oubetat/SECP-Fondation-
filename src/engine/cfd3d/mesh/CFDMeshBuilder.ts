/**
 * SECP Industrial OS v2 — CFD Mesh Builder Helper
 * PATCH-051 / PATCH-054
 */

import { CFDMesh3D, BoundaryType } from './CFDMeshTypes';

export class CFDMeshBuilder {

  /**
   * Builds a canonical 3D Cartesian hex mesh of size [nx, ny, nz] over domain [lx, ly, lz].
   */
  public static buildBoxMesh(
    dims: [number, number, number],
    domainSize: [number, number, number] = [1.0, 1.0, 1.0]
  ): { mesh: CFDMesh3D } {
    const [nx, ny, nz] = dims;
    const [lx, ly, lz] = domainSize;

    const dx = lx / nx;
    const dy = ly / ny;
    const dz = lz / nz;

    const cellVol = dx * dy * dz;
    const numCells = nx * ny * nz;

    const cells: CFDMesh3D['cells'] = [];
    const faces: CFDMesh3D['faces'] = [];

    // Helper cell indexing
    const getCellId = (i: number, j: number, k: number) => i + j * nx + k * nx * ny;

    for (let k = 0; k < nz; k++) {
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const cId = getCellId(i, j, k);
          const cx = (i + 0.5) * dx;
          const cy = (j + 0.5) * dy;
          const cz = (k + 0.5) * dz;

          cells.push({
            id: cId,
            center: [cx, cy, cz],
            volume: cellVol
          });
        }
      }
    }

    let faceId = 0;
    const inletFaceIds: number[] = [];
    const outletFaceIds: number[] = [];
    const wallFaceIds: number[] = [];

    // X-Faces
    for (let k = 0; k < nz; k++) {
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i <= nx; i++) {
          const isBnd = i === 0 || i === nx;
          const owner = i === nx ? getCellId(nx - 1, j, k) : getCellId(i, j, k);
          const neighbor = isBnd ? null : getCellId(i - 1, j, k);
          const nxNorm = i === 0 ? -1 : 1;

          const fIdx = faceId++;
          faces.push({
            id: fIdx,
            ownerCellId: owner,
            neighborCellId: neighbor,
            area: dy * dz,
            normal: [nxNorm, 0, 0],
            isBoundary: isBnd
          });

          if (i === 0) inletFaceIds.push(fIdx);
          else if (i === nx) outletFaceIds.push(fIdx);
        }
      }
    }

    // Y-Faces
    for (let k = 0; k < nz; k++) {
      for (let j = 0; j <= ny; j++) {
        for (let i = 0; i < nx; i++) {
          const isBnd = j === 0 || j === ny;
          const owner = j === ny ? getCellId(i, ny - 1, k) : getCellId(i, j, k);
          const neighbor = isBnd ? null : getCellId(i, j - 1, k);
          const nyNorm = j === 0 ? -1 : 1;

          const fIdx = faceId++;
          faces.push({
            id: fIdx,
            ownerCellId: owner,
            neighborCellId: neighbor,
            area: dx * dz,
            normal: [0, nyNorm, 0],
            isBoundary: isBnd
          });

          if (isBnd) wallFaceIds.push(fIdx);
        }
      }
    }

    // Z-Faces
    for (let k = 0; k <= nz; k++) {
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const isBnd = k === 0 || k === nz;
          const owner = k === nz ? getCellId(i, j, nz - 1) : getCellId(i, j, k);
          const neighbor = isBnd ? null : getCellId(i, j, k - 1);
          const nzNorm = k === 0 ? -1 : 1;

          const fIdx = faceId++;
          faces.push({
            id: fIdx,
            ownerCellId: owner,
            neighborCellId: neighbor,
            area: dx * dy,
            normal: [0, 0, nzNorm],
            isBoundary: isBnd
          });

          if (isBnd) wallFaceIds.push(fIdx);
        }
      }
    }


    const mesh: CFDMesh3D = {
      meshId: `hex-mesh-${nx}x${ny}x${nz}`,
      cells,
      faces,
      boundaryConditions: [
        { type: BoundaryType.INLET, faceIds: inletFaceIds },
        { type: BoundaryType.OUTLET, faceIds: outletFaceIds },
        { type: BoundaryType.WALL, faceIds: wallFaceIds }
      ]
    };

    return { mesh };
  }
}
