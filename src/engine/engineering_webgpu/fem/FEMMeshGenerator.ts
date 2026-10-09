/**
 * FEMMeshGenerator.ts
 * Mesh generator for FEM benchmark and verification meshes: QUAD4, TET4, HEX8
 */

import { FEMElementType } from './GPUFEMTypes';

export interface FEMMesh {
  meshId: string;
  name: string;
  elementType: FEMElementType;
  nodeCount: number;
  elementCount: number;
  nodes: Float32Array; // 3 floats per node: x, y, z
  elements: Uint32Array; // indices per element
  dofPerNode: number;
  totalDofs: number;
  material: {
    elasticModulusPa: number;
    poissonsRatio: number;
    densityKgM3: number;
    thicknessM: number;
  };
}

export class FEMMeshGenerator {
  public static createQuad4CantileverBeam(
    nx = 10,
    ny = 2,
    lx = 1.0,
    ly = 0.2,
    E = 210e9,
    nu = 0.3,
    density = 7850,
    thickness = 0.01
  ): FEMMesh {
    const nodeCount = (nx + 1) * (ny + 1);
    const elementCount = nx * ny;
    const nodes = new Float32Array(nodeCount * 3);
    const elements = new Uint32Array(elementCount * 4);

    const dx = lx / nx;
    const dy = ly / ny;

    let nIdx = 0;
    for (let j = 0; j <= ny; j++) {
      for (let i = 0; i <= nx; i++) {
        nodes[nIdx * 3 + 0] = i * dx;
        nodes[nIdx * 3 + 1] = j * dy;
        nodes[nIdx * 3 + 2] = 0.0;
        nIdx++;
      }
    }

    let eIdx = 0;
    const numNodesX = nx + 1;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const n0 = j * numNodesX + i;
        const n1 = j * numNodesX + (i + 1);
        const n2 = (j + 1) * numNodesX + (i + 1);
        const n3 = (j + 1) * numNodesX + i;

        elements[eIdx * 4 + 0] = n0;
        elements[eIdx * 4 + 1] = n1;
        elements[eIdx * 4 + 2] = n2;
        elements[eIdx * 4 + 3] = n3;
        eIdx++;
      }
    }

    return {
      meshId: `FEM-QUAD4-${nx}x${ny}`,
      name: `Cantilever Beam (${nx}x${ny} QUAD4)`,
      elementType: 'QUAD4',
      nodeCount,
      elementCount,
      nodes,
      elements,
      dofPerNode: 2,
      totalDofs: nodeCount * 2,
      material: {
        elasticModulusPa: E,
        poissonsRatio: nu,
        densityKgM3: density,
        thicknessM: thickness,
      },
    };
  }

  public static createTet4BracketMesh(): FEMMesh {
    // 5-node 2-tetrahedron reference structure
    const nodeCount = 5;
    const elementCount = 2;
    const nodes = new Float32Array([
      0.0, 0.0, 0.0,
      1.0, 0.0, 0.0,
      0.5, 1.0, 0.0,
      0.5, 0.5, 1.0,
      1.0, 1.0, 1.0,
    ]);
    const elements = new Uint32Array([
      0, 1, 2, 3,
      1, 2, 4, 3,
    ]);

    return {
      meshId: 'FEM-TET4-BRACKET',
      name: 'Bracket TET4 Assembly',
      elementType: 'TET4',
      nodeCount,
      elementCount,
      nodes,
      elements,
      dofPerNode: 3,
      totalDofs: nodeCount * 3,
      material: {
        elasticModulusPa: 210e9,
        poissonsRatio: 0.3,
        densityKgM3: 7850,
        thicknessM: 0.01,
      },
    };
  }

  public static createHex8SolidBeam(nx = 4, ny = 2, nz = 2): FEMMesh {
    const nodeCount = (nx + 1) * (ny + 1) * (nz + 1);
    const elementCount = nx * ny * nz;
    const nodes = new Float32Array(nodeCount * 3);
    const elements = new Uint32Array(elementCount * 8);

    const dx = 1.0 / nx;
    const dy = 0.5 / ny;
    const dz = 0.5 / nz;

    let nIdx = 0;
    for (let k = 0; k <= nz; k++) {
      for (let j = 0; j <= ny; j++) {
        for (let i = 0; i <= nx; i++) {
          nodes[nIdx * 3 + 0] = i * dx;
          nodes[nIdx * 3 + 1] = j * dy;
          nodes[nIdx * 3 + 2] = k * dz;
          nIdx++;
        }
      }
    }

    let eIdx = 0;
    const nX = nx + 1;
    const nXY = (nx + 1) * (ny + 1);

    for (let k = 0; k < nz; k++) {
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const base0 = k * nXY + j * nX + i;
          const base1 = (k + 1) * nXY + j * nX + i;

          elements[eIdx * 8 + 0] = base0;
          elements[eIdx * 8 + 1] = base0 + 1;
          elements[eIdx * 8 + 2] = base0 + 1 + nX;
          elements[eIdx * 8 + 3] = base0 + nX;

          elements[eIdx * 8 + 4] = base1;
          elements[eIdx * 8 + 5] = base1 + 1;
          elements[eIdx * 8 + 6] = base1 + 1 + nX;
          elements[eIdx * 8 + 7] = base1 + nX;
          eIdx++;
        }
      }
    }

    return {
      meshId: `FEM-HEX8-${nx}x${ny}x${nz}`,
      name: `Solid Beam (${nx}x${ny}x${nz} HEX8)`,
      elementType: 'HEX8',
      nodeCount,
      elementCount,
      nodes,
      elements,
      dofPerNode: 3,
      totalDofs: nodeCount * 3,
      material: {
        elasticModulusPa: 210e9,
        poissonsRatio: 0.3,
        densityKgM3: 7850,
        thicknessM: 0.01,
      },
    };
  }

  public static generateMesh(elementType: FEMElementType, nx: number, ny: number, nz: number) {
    if (elementType === 'HEX8') {
      return this.createHex8SolidBeam(nx, ny, nz);
    }
    if (elementType === 'TET4') {
      return this.createTet4BracketMesh();
    }
    return this.createQuad4CantileverBeam(nx, ny);
  }
}
