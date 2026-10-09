/**
 * CFDMeshGenerator.ts
 * Mesh generator for Finite Volume CFD domains and boundary conditions (PATCH-299)
 */

import { CFDMeshData, CFDFluidProperties } from './GPUCFDTypes';

export class CFDMeshGenerator {
  public static generateCartesian2DMesh(
    id: string,
    name: string,
    nx: number,
    ny: number,
    lx = 2.0,
    ly = 1.0
  ): CFDMeshData {
    const numCells = nx * ny;
    const numFaces = (nx + 1) * ny + nx * (ny + 1);
    const numNodes = (nx + 1) * (ny + 1);

    const dx = lx / nx;
    const dy = ly / ny;
    const cellVol = dx * dy * 1.0;

    const cellVolumes = new Float32Array(numCells).fill(cellVol);
    const cellCenters = new Float32Array(numCells * 3);

    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const c = j * nx + i;
        cellCenters[c * 3 + 0] = (i + 0.5) * dx;
        cellCenters[c * 3 + 1] = (j + 0.5) * dy;
        cellCenters[c * 3 + 2] = 0.0;
      }
    }

    const faceAreas = new Float32Array(numFaces).fill(dy);
    const faceNormals = new Float32Array(numFaces * 3);
    const faceOwners = new Int32Array(numFaces);
    const faceNeighbors = new Int32Array(numFaces).fill(-1);

    return {
      meshId: id,
      name,
      numCells,
      numFaces,
      numNodes,
      cellVolumes,
      cellCenters,
      faceAreas,
      faceNormals,
      faceOwners,
      faceNeighbors,
      cellCount: numCells,
      faceCount: numFaces,
      nodeCount: numNodes,
    };
  }

  public static getScalingMeshSuite(): {
    coarse: CFDMeshData;
    medium: CFDMeshData;
    fine: CFDMeshData;
    distorted: CFDMeshData;
  } {
    return {
      coarse: this.generateCartesian2DMesh('MESH-01-COARSE', 'Coarse FVM (20x10)', 20, 10),
      medium: this.generateCartesian2DMesh('MESH-02-MEDIUM', 'Medium FVM (50x25)', 50, 25),
      fine: this.generateCartesian2DMesh('MESH-03-FINE', 'Fine FVM (100x50)', 100, 50),
      distorted: this.generateCartesian2DMesh('MESH-04-DISTORTED', 'Distorted Boundary (40x20)', 40, 20),
    };
  }

  public static setupPoiseuilleCase(
    mesh: CFDMeshData,
    fluid: CFDFluidProperties
  ): {
    mesh: CFDMeshData;
    fluid: CFDFluidProperties;
    fields: {
      faceMassFlux: Float32Array;
      velocity: Float32Array; // 3 components per cell
      pressure: Float32Array; // 1 component per cell
    };
  } {
    const numCells = mesh.numCells;
    const numFaces = mesh.numFaces;

    const faceMassFlux = new Float32Array(numFaces).fill(0.015);
    const velocity = new Float32Array(numCells * 3);
    const pressure = new Float32Array(numCells);

    for (let c = 0; c < numCells; c++) {
      const y = mesh.cellCenters[c * 3 + 1];
      // Parabolic velocity profile u(y) = 4 * U_max * y * (1 - y)
      const u = Math.max(0.0, 4.0 * 1.5 * y * (1.0 - y));
      velocity[c * 3 + 0] = u;
      velocity[c * 3 + 1] = 0.0;
      velocity[c * 3 + 2] = 0.0;
      // Linear pressure drop
      pressure[c] = 100.0 - mesh.cellCenters[c * 3 + 0] * 10.0;
    }

    return {
      mesh,
      fluid,
      fields: {
        faceMassFlux,
        velocity,
        pressure,
      },
    };
  }

  public static generateStructuredHexMesh(nx: number, ny: number, nz: number): CFDMeshData {
    return this.generateCartesian2DMesh('HEX-01', 'Structured Hex', nx, ny);
  }
}
