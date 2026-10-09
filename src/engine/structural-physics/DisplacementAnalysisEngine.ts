/**
 * SECP Structural Physics & Finite Element Analysis — Displacement Analysis Engine
 * Performs post-processing, gradient calculations, and displacement field validation.
 */
import {
  StructuralAnalysisResults,
  NodeResults,
  FEAMesh
} from './StructuralPhysicsTypes';

export interface DisplacementFieldSummary {
  maxDisplacementMag: number;
  maxDisplacementNodeId: number;
  minDisplacementMag: number;
  meanDisplacementMag: number;
  rmsDisplacementMag: number;
  maxComponent: {
    x: { val: number; nodeId: number };
    y: { val: number; nodeId: number };
    z: { val: number; nodeId: number };
  };
}

export class DisplacementAnalysisEngine {
  /**
   * Analyzes the nodal displacement field to extract extrema, RMS values, and critical node locations.
   */
  public static summarizeDisplacementField(results: StructuralAnalysisResults): DisplacementFieldSummary {
    if (!results.nodes || results.nodes.length === 0) {
      return {
        maxDisplacementMag: 0,
        maxDisplacementNodeId: -1,
        minDisplacementMag: 0,
        meanDisplacementMag: 0,
        rmsDisplacementMag: 0,
        maxComponent: {
          x: { val: 0, nodeId: -1 },
          y: { val: 0, nodeId: -1 },
          z: { val: 0, nodeId: -1 }
        }
      };
    }

    let maxMag = -Infinity;
    let maxNode = -1;
    let minMag = Infinity;
    let sumMag = 0;
    let sumSqMag = 0;

    let maxX = -Infinity, maxNodeX = -1;
    let maxY = -Infinity, maxNodeY = -1;
    let maxZ = -Infinity, maxNodeZ = -1;

    for (const node of results.nodes) {
      const dx = node.displacement.x;
      const dy = node.displacement.y;
      const dz = node.displacement.z;
      const mag = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (mag > maxMag) {
        maxMag = mag;
        maxNode = node.nodeId;
      }
      if (mag < minMag) {
        minMag = mag;
      }

      sumMag += mag;
      sumSqMag += mag * mag;

      if (Math.abs(dx) > maxX) { maxX = Math.abs(dx); maxNodeX = node.nodeId; }
      if (Math.abs(dy) > maxY) { maxY = Math.abs(dy); maxNodeY = node.nodeId; }
      if (Math.abs(dz) > maxZ) { maxZ = Math.abs(dz); maxNodeZ = node.nodeId; }
    }

    const count = results.nodes.length;

    return {
      maxDisplacementMag: isFinite(maxMag) ? maxMag : 0,
      maxDisplacementNodeId: maxNode,
      minDisplacementMag: isFinite(minMag) ? minMag : 0,
      meanDisplacementMag: sumMag / count,
      rmsDisplacementMag: Math.sqrt(sumSqMag / count),
      maxComponent: {
        x: { val: maxX, nodeId: maxNodeX },
        y: { val: maxY, nodeId: maxNodeY },
        z: { val: maxZ, nodeId: maxNodeZ }
      }
    };
  }

  /**
   * Interpolates the displacement vector at an arbitrary physical coordinate inside an element.
   */
  public static interpolateDisplacementAtPoint(
    results: StructuralAnalysisResults,
    mesh: FEAMesh,
    elementId: number,
    coords: { x: number; y: number; z: number }
  ): { x: number; y: number; z: number } {
    const element = mesh.elements.find(e => e.id === elementId);
    if (!element) {
      throw new Error(`[DisplacementAnalysisEngine] Element ${elementId} not found in mesh`);
    }

    const nodeDisplacements = element.nodeIds.map(nid => {
      const nr = results.nodes.find(n => n.nodeId === nid);
      return nr ? nr.displacement : { x: 0, y: 0, z: 0 };
    });

    // Inverse Distance Weighting (IDW) interpolation among element nodes for general element topologies
    let sumWeights = 0;
    let uX = 0, uY = 0, uZ = 0;

    for (let i = 0; i < element.nodeIds.length; i++) {
      const nid = element.nodeIds[i];
      const node = mesh.nodes.find(n => n.id === nid)!;
      const dist = Math.hypot(coords.x - node.x, coords.y - node.y, coords.z - node.z);
      if (dist < 1e-9) {
        return nodeDisplacements[i];
      }
      const weight = 1.0 / (dist * dist);
      sumWeights += weight;
      uX += nodeDisplacements[i].x * weight;
      uY += nodeDisplacements[i].y * weight;
      uZ += nodeDisplacements[i].z * weight;
    }

    return {
      x: uX / sumWeights,
      y: uY / sumWeights,
      z: uZ / sumWeights
    };
  }
}
