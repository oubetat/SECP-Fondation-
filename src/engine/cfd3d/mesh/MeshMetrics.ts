/**
 * SECP Industrial OS v2 — Mesh Metrics
 * PATCH-051: CFD Mesh Infrastructure
 */

import { CFDMesh, MeshQualityMetrics, MeshDiagnostic } from './CFDMeshTypes';
import { MeshGeometry } from './MeshGeometry';

export class MeshMetrics {
  public static calculateMetrics(mesh: CFDMesh): MeshQualityMetrics {
    let minVol = Infinity;
    let maxVol = -Infinity;
    let totalVol = 0;
    let minArea = Infinity;
    let maxArea = -Infinity;
    let degenerateCellCount = 0;
    let zeroAreaFaceCount = 0;
    let invertedCellCount = 0;
    let nonManifoldFaceCount = 0;

    const tol = mesh.toleranceConfig;

    for (const cell of mesh.cells) {
      const { volume } = MeshGeometry.calculateCellVolumeAndCentroid(cell, mesh.faces, mesh.nodes);
      if (!Number.isFinite(volume)) {
        invertedCellCount++;
        continue;
      }
      if (volume <= tol.volumeTolerance) {
        if (volume < -tol.volumeTolerance) invertedCellCount++;
        else degenerateCellCount++;
      }
      minVol = Math.min(minVol, volume);
      maxVol = Math.max(maxVol, volume);
      totalVol += volume;
    }

    for (const face of mesh.faces) {
      const { area } = MeshGeometry.calculateFaceAreaAndNormal(face, mesh.nodes);
      if (!Number.isFinite(area)) {
        zeroAreaFaceCount++;
        continue;
      }
      if (area < tol.areaTolerance) zeroAreaFaceCount++;
      minArea = Math.min(minArea, area);
      maxArea = Math.max(maxArea, area);
      
      if (face.adjacentCellIds.length > 2) {
        nonManifoldFaceCount++;
      }
    }

    return {
      minVolume: minVol === Infinity ? 0 : minVol,
      maxVolume: maxVol === -Infinity ? 0 : maxVol,
      totalVolume: totalVol,
      minFaceArea: minArea === Infinity ? 0 : minArea,
      maxFaceArea: maxArea === -Infinity ? 0 : maxArea,
      degenerateCellCount,
      zeroAreaFaceCount,
      invertedCellCount,
      nonManifoldFaceCount,
      disconnectedComponentCount: 0, // Requires graph traversal, keep 0 for now
      cellCount: mesh.cells.length,
      faceCount: mesh.faces.length,
      nodeCount: mesh.nodes.length
    };
  }
}
