/**
 * CPUMeshingReference.ts
 * Analytical and Deterministic CPU Golden Reference for Mesh Generation,
 * Quality Metric Evaluation, Spatial Welding, and Smoothing.
 */

import {
  CADBRepGeometry,
  CADSurfaceDefinition,
  GPUMeshData,
  MeshQualityReport,
} from './GPUMeshingTypes';

export class CPUMeshingReference {
  /**
   * Discretizes a parametric CAD surface into a 2D regular triangulation on CPU
   */
  public static discretizeSurface(
    geometry: CADBRepGeometry,
    surface: CADSurfaceDefinition,
    divisionsU = 16,
    divisionsV = 8
  ): GPUMeshData {
    const numVertsU = divisionsU + 1;
    const numVertsV = divisionsV + 1;
    const totalVerts = numVertsU * numVertsV;

    const positions = new Float32Array(totalVerts * 3);
    const normals = new Float32Array(totalVerts * 3);
    const uvs = new Float32Array(totalVerts * 2);

    const stepU = (surface.uMax - surface.uMin) / divisionsU;
    const stepV = (surface.vMax - surface.vMin) / divisionsV;

    let vIdx = 0;
    for (let j = 0; j <= divisionsV; j++) {
      const v = surface.vMin + j * stepV;
      for (let i = 0; i <= divisionsU; i++) {
        const u = surface.uMin + i * stepU;

        uvs[vIdx * 2 + 0] = u;
        uvs[vIdx * 2 + 1] = v;

        let px = 0;
        let py = 0;
        let pz = 0;
        let nx = 0;
        let ny = 0;
        let nz = 1;

        if (surface.type === 'PLANE') {
          px = u;
          py = v;
          pz = 0.0;
          nx = 0.0;
          ny = 0.0;
          nz = 1.0;
        } else if (surface.type === 'CYLINDER') {
          const radius = surface.parameters?.radius ?? 0.5;
          const theta = u;
          px = radius * Math.cos(theta);
          py = radius * Math.sin(theta);
          pz = v;
          nx = Math.cos(theta);
          ny = Math.sin(theta);
          nz = 0.0;
        } else if (surface.type === 'SPHERE') {
          const radius = surface.parameters?.radius ?? 1.0;
          const theta = u;
          const phi = v;
          px = radius * Math.cos(phi) * Math.cos(theta);
          py = radius * Math.cos(phi) * Math.sin(theta);
          pz = radius * Math.sin(phi);
          const len = Math.hypot(px, py, pz) || 1.0;
          nx = px / len;
          ny = py / len;
          nz = pz / len;
        } else if (surface.type === 'CONE') {
          const radius = surface.parameters?.radius ?? 1.0;
          const height = surface.parameters?.height ?? 2.0;
          const r = radius * (1.0 - v / Math.max(height, 1e-4));
          px = r * Math.cos(u);
          py = r * Math.sin(u);
          pz = v;
          const len = Math.hypot(px, py);
          nx = len > 1e-6 ? px / len : 0;
          ny = len > 1e-6 ? py / len : 0;
          nz = 0.5;
          const nLen = Math.hypot(nx, ny, nz);
          nx /= nLen;
          ny /= nLen;
          nz /= nLen;
        } else if (surface.type === 'HIGH_CURVATURE') {
          const paramA = surface.parameters?.amplitude ?? 0.3;
          const z = paramA * Math.sin(u * 4.0) * Math.cos(v * 4.0);
          px = u;
          py = v;
          pz = z;
          const dzdu = 4.0 * paramA * Math.cos(u * 4.0) * Math.cos(v * 4.0);
          const dzdv = -4.0 * paramA * Math.sin(u * 4.0) * Math.sin(v * 4.0);
          const nLen = Math.hypot(-dzdu, -dzdv, 1.0);
          nx = -dzdu / nLen;
          ny = -dzdv / nLen;
          nz = 1.0 / nLen;
        } else {
          px = u;
          py = v;
          pz = 0.0;
        }

        positions[vIdx * 3 + 0] = px;
        positions[vIdx * 3 + 1] = py;
        positions[vIdx * 3 + 2] = pz;

        normals[vIdx * 3 + 0] = nx;
        normals[vIdx * 3 + 1] = ny;
        normals[vIdx * 3 + 2] = nz;

        vIdx++;
      }
    }

    // Build triangular connectivity (2 triangles per grid quad)
    const numTris = divisionsU * divisionsV * 2;
    const indices = new Uint32Array(numTris * 3);
    let triIdx = 0;

    for (let j = 0; j < divisionsV; j++) {
      for (let i = 0; i < divisionsU; i++) {
        const row1 = j * numVertsU;
        const row2 = (j + 1) * numVertsU;

        indices[triIdx * 3 + 0] = row1 + i;
        indices[triIdx * 3 + 1] = row1 + i + 1;
        indices[triIdx * 3 + 2] = row2 + i + 1;
        triIdx++;

        indices[triIdx * 3 + 0] = row1 + i;
        indices[triIdx * 3 + 1] = row2 + i + 1;
        indices[triIdx * 3 + 2] = row2 + i;
        triIdx++;
      }
    }

    return {
      meshId: `MESH-CPU-${geometry.geometryId || 'GEO-01'}`,
      geometryId: geometry.geometryId || geometry.id || 'GEO-01',
      geometryRevision: geometry.revision || 'REV-A',
      elementType: 'TRI3',
      numVertices: totalVerts,
      positions,
      normals,
      uvs,
      numElements: numTris,
      indices,
      // Compatibility
      nodeCount: totalVerts,
      elementCount: numTris,
    };
  }

  /**
   * Evaluates aspect ratios, skewness, angles, and degeneracies
   */
  public static evaluateMeshQuality(mesh: GPUMeshData): MeshQualityReport {
    const aspectRatios: number[] = [];
    const skewnesses: number[] = [];
    const minAngles: number[] = [];
    const maxAngles: number[] = [];
    let degenCount = 0;
    const RAD_TO_DEG = 180.0 / Math.PI;

    const numTriangles = mesh.numElements || (mesh.indices.length / 3);

    for (let e = 0; e < numTriangles; e++) {
      const i0 = mesh.indices[e * 3 + 0];
      const i1 = mesh.indices[e * 3 + 1];
      const i2 = mesh.indices[e * 3 + 2];

      const p0x = mesh.positions[i0 * 3 + 0];
      const p0y = mesh.positions[i0 * 3 + 1];
      const p0z = mesh.positions[i0 * 3 + 2];

      const p1x = mesh.positions[i1 * 3 + 0];
      const p1y = mesh.positions[i1 * 3 + 1];
      const p1z = mesh.positions[i1 * 3 + 2];

      const p2x = mesh.positions[i2 * 3 + 0];
      const p2y = mesh.positions[i2 * 3 + 1];
      const p2z = mesh.positions[i2 * 3 + 2];

      const d10x = p1x - p0x;
      const d10y = p1y - p0y;
      const d10z = p1z - p0z;

      const d21x = p2x - p1x;
      const d21y = p2y - p1y;
      const d21z = p2z - p1z;

      const d02x = p0x - p2x;
      const d02y = p0y - p2y;
      const d02z = p0z - p2z;

      const a = Math.hypot(d10x, d10y, d10z);
      const b = Math.hypot(d21x, d21y, d21z);
      const c = Math.hypot(d02x, d02y, d02z);

      // Cross product (p1 - p0) x (p2 - p0)
      const d20x = p2x - p0x;
      const d20y = p2y - p0y;
      const d20z = p2z - p0z;

      const cx = d10y * d20z - d10z * d20y;
      const cy = d10z * d20x - d10x * d20z;
      const cz = d10x * d20y - d10y * d20x;
      const area = 0.5 * Math.hypot(cx, cy, cz);

      if (area < 1e-12 || a < 1e-8 || b < 1e-8 || c < 1e-8) {
        degenCount++;
      }

      const s = (a + b + c) * 0.5;
      let aspectRatio = 1.0;
      if (area > 1e-12 && s > 0.0) {
        const rIn = area / s;
        const rCirc = (a * b * c) / (4.0 * area);
        aspectRatio = Math.max(1.0, rCirc / (2.0 * rIn));
      } else {
        aspectRatio = 999.0;
      }

      // Angles via law of cosines
      const cos0 = Math.max(-1.0, Math.min(1.0, (b * b + c * c - a * a) / (2.0 * Math.max(b * c, 1e-10))));
      const cos1 = Math.max(-1.0, Math.min(1.0, (a * a + c * c - b * b) / (2.0 * Math.max(a * c, 1e-10))));
      const cos2 = Math.max(-1.0, Math.min(1.0, (a * a + b * b - c * c) / (2.0 * Math.max(a * b, 1e-10))));

      const ang0 = Math.acos(cos0) * RAD_TO_DEG;
      const ang1 = Math.acos(cos1) * RAD_TO_DEG;
      const ang2 = Math.acos(cos2) * RAD_TO_DEG;

      const minAng = Math.min(ang0, ang1, ang2);
      const maxAng = Math.max(ang0, ang1, ang2);

      const skewMax = (maxAng - 60.0) / 120.0;
      const skewMin = (60.0 - minAng) / 60.0;
      const skewness = Math.max(0.0, Math.min(1.0, Math.max(skewMax, skewMin)));

      aspectRatios.push(aspectRatio);
      skewnesses.push(skewness);
      minAngles.push(minAng);
      maxAngles.push(maxAng);
    }

    const mean = (arr: number[]) => (arr.length > 0 ? arr.reduce((acc, v) => acc + v, 0) / arr.length : 0);
    const sortedAspect = [...aspectRatios].sort((x, y) => x - y);
    const sortedSkew = [...skewnesses].sort((x, y) => x - y);

    const report: MeshQualityReport = {
      meshId: mesh.meshId,
      totalElements: numTriangles,
      validElements: numTriangles - degenCount,
      degenerateElements: degenCount,
      invertedElements: 0,
      aspectRatioStats: {
        min: aspectRatios.length > 0 ? Math.min(...aspectRatios) : 1.0,
        max: aspectRatios.length > 0 ? Math.max(...aspectRatios) : 1.0,
        mean: mean(aspectRatios),
        p95: sortedAspect[Math.floor(sortedAspect.length * 0.95)] || 1.0,
      },
      skewnessStats: {
        min: skewnesses.length > 0 ? Math.min(...skewnesses) : 0.0,
        max: skewnesses.length > 0 ? Math.max(...skewnesses) : 0.0,
        mean: mean(skewnesses),
        p95: sortedSkew[Math.floor(sortedSkew.length * 0.95)] || 0.0,
      },
      minAngleStats: {
        min: minAngles.length > 0 ? Math.min(...minAngles) : 60.0,
        max: minAngles.length > 0 ? Math.max(...minAngles) : 60.0,
        mean: mean(minAngles),
      },
      maxAngleStats: {
        min: maxAngles.length > 0 ? Math.min(...maxAngles) : 60.0,
        max: maxAngles.length > 0 ? Math.max(...maxAngles) : 60.0,
        mean: mean(maxAngles),
      },
      histogramBins: [
        {
          metricName: 'AspectRatio',
          binEdges: [1.0, 1.2, 1.5, 2.0, 3.0, 5.0, 10.0],
          counts: [0, 0, 0, 0, 0, 0],
        },
      ],
      worstElementIndex: 0,
      overallStatus: degenCount === 0 ? 'PASSED' : 'FAILED',
      // Legacy compatibility
      minAspectRatio: aspectRatios.length > 0 ? Math.min(...aspectRatios) : 1.0,
      maxAspectRatio: aspectRatios.length > 0 ? Math.max(...aspectRatios) : 1.0,
      meanAspectRatio: mean(aspectRatios),
      invertedElementsCount: 0,
      passedQualityCheck: degenCount === 0,
    };

    return report;
  }

  /**
   * Spatial hash-based duplicate vertex detection and welding
   */
  public static detectAndWeldDuplicates(
    positions: Float32Array,
    tolerance = 1e-5
  ): { uniquePositions: Float32Array; numUnique: number; indexRemap: Uint32Array } {
    const totalVerts = Math.floor(positions.length / 3);
    const indexRemap = new Uint32Array(totalVerts);
    const uniquePositionsList: number[] = [];
    const invTol = 1.0 / Math.max(tolerance, 1e-8);

    const map = new Map<string, number>();
    let uniqueCount = 0;

    for (let i = 0; i < totalVerts; i++) {
      const x = positions[i * 3 + 0];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];

      const kx = Math.round(x * invTol);
      const ky = Math.round(y * invTol);
      const kz = Math.round(z * invTol);
      const key = `${kx},${ky},${kz}`;

      if (map.has(key)) {
        indexRemap[i] = map.get(key)!;
      } else {
        map.set(key, uniqueCount);
        indexRemap[i] = uniqueCount;
        uniquePositionsList.push(x, y, z);
        uniqueCount++;
      }
    }

    return {
      uniquePositions: new Float32Array(uniquePositionsList),
      numUnique: uniqueCount,
      indexRemap,
    };
  }

  /**
   * Applies iterative Laplacian smoothing to interior vertices
   */
  public static applyLaplacianSmoothing(
    mesh: GPUMeshData,
    isBoundary: Uint8Array,
    iterations = 2,
    lambda = 0.2
  ): GPUMeshData {
    const numVerts = mesh.numVertices;
    const currentPositions = new Float32Array(mesh.positions);

    // Build vertex-vertex adjacency list
    const adj: Set<number>[] = Array.from({ length: numVerts }, () => new Set<number>());
    const numTriangles = Math.floor(mesh.indices.length / 3);

    for (let e = 0; e < numTriangles; e++) {
      const i0 = mesh.indices[e * 3 + 0];
      const i1 = mesh.indices[e * 3 + 1];
      const i2 = mesh.indices[e * 3 + 2];

      adj[i0].add(i1);
      adj[i0].add(i2);
      adj[i1].add(i0);
      adj[i1].add(i2);
      adj[i2].add(i0);
      adj[i2].add(i1);
    }

    for (let iter = 0; iter < iterations; iter++) {
      const nextPositions = new Float32Array(currentPositions);

      for (let i = 0; i < numVerts; i++) {
        if (isBoundary[i]) continue; // Preserve feature boundaries

        const neighbors = Array.from(adj[i]);
        if (neighbors.length === 0) continue;

        let avgX = 0;
        let avgY = 0;
        let avgZ = 0;

        for (const n of neighbors) {
          avgX += currentPositions[n * 3 + 0];
          avgY += currentPositions[n * 3 + 1];
          avgZ += currentPositions[n * 3 + 2];
        }

        avgX /= neighbors.length;
        avgY /= neighbors.length;
        avgZ /= neighbors.length;

        nextPositions[i * 3 + 0] = (1 - lambda) * currentPositions[i * 3 + 0] + lambda * avgX;
        nextPositions[i * 3 + 1] = (1 - lambda) * currentPositions[i * 3 + 1] + lambda * avgY;
        nextPositions[i * 3 + 2] = (1 - lambda) * currentPositions[i * 3 + 2] + lambda * avgZ;
      }

      currentPositions.set(nextPositions);
    }

    return {
      ...mesh,
      positions: currentPositions,
    };
  }

  /**
   * Compatibility method for generic CAD generation
   */
  public static generateMesh(geom: CADBRepGeometry): GPUMeshData {
    if (geom.surfaces && geom.surfaces.length > 0) {
      return this.discretizeSurface(geom, geom.surfaces[0], 16, 8);
    }
    const totalVerts = 4;
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
    const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
    const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
    const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);

    return {
      meshId: `MESH-${geom.geometryId || 'GEO'}`,
      geometryId: geom.geometryId || 'GEO',
      geometryRevision: geom.revision || 'REV-A',
      elementType: 'TRI3',
      numVertices: totalVerts,
      positions,
      normals,
      uvs,
      numElements: 2,
      indices,
      nodeCount: totalVerts,
      elementCount: 2,
    };
  }
}
