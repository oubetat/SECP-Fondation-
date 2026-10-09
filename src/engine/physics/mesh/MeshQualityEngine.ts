/**
 * SECP Industrial OS v2 — Mesh Quality Engine
 * PATCH-047: Mesh Abstraction
 */

import { MeshElement, MeshNode, MeshQualityReport } from './MeshTypes';

export class MeshQualityEngine {
  private static readonly EPSILON = 1e-12;

  public static computeMeshQuality(nodes: MeshNode[], elements: MeshElement[]): MeshQualityReport {
    const nodeMap = new Map<string, MeshNode>();
    for (const node of nodes) {
      nodeMap.set(node.nodeId, node);
    }

    const nonPositiveElements: string[] = [];
    const volumesOrAreas: number[] = [];
    const aspectRatios: number[] = [];

    for (const el of elements) {
      const elNodes = el.nodeIds.map(id => nodeMap.get(id)).filter((n): n is MeshNode => n !== undefined);
      if (elNodes.length !== el.nodeIds.length) {
        // Missing nodes; cannot compute quality
        continue;
      }

      let measure = 0;
      let aspect = 1.0;

      if (el.type === 'TRIANGLE') {
        measure = this.computeTriangleArea(elNodes[0], elNodes[1], elNodes[2]);
        aspect = this.computeTriangleAspectRatio(elNodes[0], elNodes[1], elNodes[2]);
      } else if (el.type === 'QUADRILATERAL') {
        measure = this.computeQuadArea(elNodes[0], elNodes[1], elNodes[2], elNodes[3]);
        aspect = this.computeQuadAspectRatio(elNodes[0], elNodes[1], elNodes[2], elNodes[3]);
      } else if (el.type === 'TETRAHEDRON') {
        measure = this.computeTetrahedronVolume(elNodes[0], elNodes[1], elNodes[2], elNodes[3]);
        aspect = this.computeTetrahedronAspectRatio(elNodes[0], elNodes[1], elNodes[2], elNodes[3]);
      } else if (el.type === 'HEXAHEDRON') {
        measure = this.computeHexahedronVolume(elNodes);
        aspect = 1.0; // Placeholder aspect ratio for hex
      }

      if (measure <= this.EPSILON) {
        nonPositiveElements.push(el.elementId);
      }

      volumesOrAreas.push(measure);
      aspectRatios.push(aspect);
    }

    if (volumesOrAreas.length === 0) {
      return {
        status: 'NOT_COMPUTED',
        elementCount: elements.length,
        nonPositiveElements: [],
        skewnessStatus: 'NOT_COMPUTED',
        orthogonalityStatus: 'NOT_COMPUTED'
      };
    }

    const minMeasure = Math.min(...volumesOrAreas);
    const maxMeasure = Math.max(...volumesOrAreas);
    const avgMeasure = volumesOrAreas.reduce((a, b) => a + b, 0) / volumesOrAreas.length;

    const minAspect = Math.min(...aspectRatios);
    const maxAspect = Math.max(...aspectRatios);
    const avgAspect = aspectRatios.reduce((a, b) => a + b, 0) / aspectRatios.length;

    return {
      status: nonPositiveElements.length > 0 ? 'INVALID' : 'COMPUTED',
      elementCount: elements.length,
      minVolumeOrArea: minMeasure,
      maxVolumeOrArea: maxMeasure,
      averageVolumeOrArea: avgMeasure,
      minAspectRatio: minAspect,
      maxAspectRatio: maxAspect,
      averageAspectRatio: avgAspect,
      nonPositiveElements,
      skewnessStatus: 'NOT_COMPUTED',
      orthogonalityStatus: 'NOT_COMPUTED'
    };
  }

  public static computeTriangleArea(n1: MeshNode, n2: MeshNode, n3: MeshNode): number {
    const p1 = n1.coordinates;
    const p2 = n2.coordinates;
    const p3 = n3.coordinates;

    if (p1.length >= 3 && p2.length >= 3 && p3.length >= 3) {
      // 3D triangle area via cross product
      const ax = p2[0] - p1[0];
      const ay = p2[1] - p1[1];
      const az = p2[2] - p1[2];

      const bx = p3[0] - p1[0];
      const by = p3[1] - p1[1];
      const bz = p3[2] - p1[2];

      const cx = ay * bz - az * by;
      const cy = az * bx - ax * bz;
      const cz = ax * by - ay * bx;

      return 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
    } else {
      // 2D signed area
      return 0.5 * ((p2[0] - p1[0]) * (p3[1] - p1[1]) - (p3[0] - p1[0]) * (p2[1] - p1[1]));
    }
  }

  public static computeTriangleAspectRatio(n1: MeshNode, n2: MeshNode, n3: MeshNode): number {
    const l1 = this.distance(n1, n2);
    const l2 = this.distance(n2, n3);
    const l3 = this.distance(n3, n1);

    const maxL = Math.max(l1, l2, l3);
    const minL = Math.min(l1, l2, l3);
    if (minL < this.EPSILON) return Infinity;
    return maxL / minL;
  }

  public static computeQuadArea(n1: MeshNode, n2: MeshNode, n3: MeshNode, n4: MeshNode): number {
    // Sum of two triangles: (n1, n2, n3) + (n1, n3, n4)
    const a1 = this.computeTriangleArea(n1, n2, n3);
    const a2 = this.computeTriangleArea(n1, n3, n4);
    return a1 + a2;
  }

  public static computeQuadAspectRatio(n1: MeshNode, n2: MeshNode, n3: MeshNode, n4: MeshNode): number {
    const l1 = this.distance(n1, n2);
    const l2 = this.distance(n2, n3);
    const l3 = this.distance(n3, n4);
    const l4 = this.distance(n4, n1);

    const maxL = Math.max(l1, l2, l3, l4);
    const minL = Math.min(l1, l2, l3, l4);
    if (minL < this.EPSILON) return Infinity;
    return maxL / minL;
  }

  public static computeTetrahedronVolume(n1: MeshNode, n2: MeshNode, n3: MeshNode, n4: MeshNode): number {
    const p1 = n1.coordinates;
    const p2 = n2.coordinates;
    const p3 = n3.coordinates;
    const p4 = n4.coordinates;

    const ax = p2[0] - p1[0];
    const ay = p2[1] - p1[1];
    const az = (p2[2] ?? 0) - (p1[2] ?? 0);

    const bx = p3[0] - p1[0];
    const by = p3[1] - p1[1];
    const bz = (p3[2] ?? 0) - (p1[2] ?? 0);

    const cx = p4[0] - p1[0];
    const cy = p4[1] - p1[1];
    const cz = (p4[2] ?? 0) - (p1[2] ?? 0);

    // Scalar triple product: a . (b x c)
    const det = ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
    return det / 6.0;
  }

  public static computeTetrahedronAspectRatio(n1: MeshNode, n2: MeshNode, n3: MeshNode, n4: MeshNode): number {
    const edges = [
      this.distance(n1, n2),
      this.distance(n1, n3),
      this.distance(n1, n4),
      this.distance(n2, n3),
      this.distance(n2, n4),
      this.distance(n3, n4)
    ];
    const maxE = Math.max(...edges);
    const minE = Math.min(...edges);
    if (minE < this.EPSILON) return Infinity;
    return maxE / minE;
  }

  public static computeHexahedronVolume(nodes: MeshNode[]): number {
    if (nodes.length < 8) return 0;
    // Standard 6-tetrahedra decomposition of a cube/hexahedron
    const t1 = this.computeTetrahedronVolume(nodes[0], nodes[1], nodes[3], nodes[4]);
    const t2 = this.computeTetrahedronVolume(nodes[1], nodes[2], nodes[3], nodes[6]);
    const t3 = this.computeTetrahedronVolume(nodes[1], nodes[4], nodes[5], nodes[6]);
    const t4 = this.computeTetrahedronVolume(nodes[3], nodes[4], nodes[6], nodes[7]);
    const t5 = this.computeTetrahedronVolume(nodes[1], nodes[3], nodes[4], nodes[6]);
    return Math.abs(t1) + Math.abs(t2) + Math.abs(t3) + Math.abs(t4) + Math.abs(t5);
  }

  private static distance(n1: MeshNode, n2: MeshNode): number {
    const p1 = n1.coordinates;
    const p2 = n2.coordinates;
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const dz = (p2[2] ?? 0) - (p1[2] ?? 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}
