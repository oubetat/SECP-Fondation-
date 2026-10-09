/**
 * SECP Industrial OS v2 — Mesh Geometry
 * PATCH-051: CFD Mesh Infrastructure
 */

import { Node, Face, Cell } from './CFDMeshTypes';

export class MeshGeometry {
  /**
   * Calculate face centroid as arithmetic mean of nodes.
   */
  public static calculateFaceCentroid(face: Face, nodes: Node[]): [number, number, number] {
    const nodeMap = new Map(nodes.map(n => [n.id, n.coords]));
    let x = 0, y = 0, z = 0;
    const n = face.nodeIds.length;
    
    for (const id of face.nodeIds) {
      const coords = nodeMap.get(id);
      if (!coords) throw new Error(`Node ${id} not found in mesh for face ${face.id}`);
      x += coords[0];
      y += coords[1];
      z += coords[2];
    }
    
    return [x / n, y / n, z / n];
  }

  /**
   * Calculate face area and normal using Newell's method for planar/non-planar polygons.
   */
  public static calculateFaceAreaAndNormal(face: Face, nodes: Node[]): { area: number, normal: [number, number, number] } {
    const nodeMap = new Map(nodes.map(n => [n.id, n.coords]));
    let nx = 0, ny = 0, nz = 0;
    
    for (let i = 0; i < face.nodeIds.length; i++) {
      const id1 = face.nodeIds[i];
      const id2 = face.nodeIds[(i + 1) % face.nodeIds.length];
      const v1 = nodeMap.get(id1)!;
      const v2 = nodeMap.get(id2)!;
      
      nx += (v1[1] - v2[1]) * (v1[2] + v2[2]);
      ny += (v1[2] - v2[2]) * (v1[0] + v2[0]);
      nz += (v1[0] - v2[0]) * (v1[1] + v2[1]);
    }
    
    const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (length < 1e-15) {
      return { area: 0, normal: [0, 0, 0] };
    }
    
    return {
      area: 0.5 * length,
      normal: [nx / length, ny / length, nz / length]
    };
  }

  /**
   * Calculate cell volume and centroid using divergence theorem.
   * V = (1/3) * sum(face_area * face_centroid . face_outward_normal)
   */
  public static calculateCellVolumeAndCentroid(cell: Cell, faces: Face[], nodes: Node[]): { volume: number, centroid: [number, number, number] } {
    const faceMap = new Map(faces.map(f => [f.id, f]));
    let totalVol = 0;
    let cx = 0, cy = 0, cz = 0;
    
    // We need a reference point, let's use the first node of the cell if available, else origin.
    const nodeMap = new Map(nodes.map(n => [n.id, n.coords]));
    const ref = nodeMap.get(cell.nodeIds[0]) || [0, 0, 0];

    for (const fId of cell.faceIds) {
      const face = faceMap.get(fId);
      if (!face) throw new Error(`Face ${fId} not found for cell ${cell.id}`);
      
      const { area, normal } = this.calculateFaceAreaAndNormal(face, nodes);
      const faceCentroid = this.calculateFaceCentroid(face, nodes);
      
      // Determine if normal is outward or inward
      // For polyhedral cells, we usually expect face nodes to be ordered such that normal is outward.
      // However, we can check against cell reference point.
      let outwardNormal = normal;
      const vToFace = [faceCentroid[0] - ref[0], faceCentroid[1] - ref[1], faceCentroid[2] - ref[2]];
      const dot = vToFace[0] * normal[0] + vToFace[1] * normal[1] + vToFace[2] * normal[2];
      
      // If dot < 0, normal points towards ref point. 
      // But ref point is usually INSIDE if it's one of the vertices.
      // Wait, Newell's method gives a consistent normal based on winding.
      // We assume face winding is consistent for the cell.
      
      // Pyramid volume for this face
      const volContribution = (1/3) * area * dot;
      totalVol += volContribution;
      
      // Centroid contribution (weighted by volume)
      // Centroid of pyramid is (3/4) * face_centroid + (1/4) * ref
      cx += volContribution * (0.75 * faceCentroid[0] + 0.25 * ref[0]);
      cy += volContribution * (0.75 * faceCentroid[1] + 0.25 * ref[1]);
      cz += volContribution * (0.75 * faceCentroid[2] + 0.25 * ref[2]);
    }
    
    if (Math.abs(totalVol) < 1e-15) {
      return { volume: 0, centroid: ref };
    }
    
    return {
      volume: totalVol,
      centroid: [cx / totalVol, cy / totalVol, cz / totalVol]
    };
  }
}
