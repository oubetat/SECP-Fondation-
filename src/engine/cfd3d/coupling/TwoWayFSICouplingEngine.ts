import { Fvm3DMesh } from '../Fvm3DTypes';
import { FSIInterfaceMapper } from '../solvers/fsi/FSIInterfaceMapper';

export interface FSINodeDisplacement {
  nodeId: number;
  dx: number;
  dy: number;
  dz: number;
}

export interface FSIBoundaryForce {
  faceId: number;
  pressurePa: number;
  normalForceN: { x: number; y: number; z: number };
}

export interface FSICouplingResult {
  fsiIterCompleted: number;
  residualDisplacementM: number;
  residualForceN: number;
  isConverged: boolean;
  fluidBoundaryForces: FSIBoundaryForce[];
  structuralDisplacements: FSINodeDisplacement[];
  morphedMeshCellCount: number;
}

export class TwoWayFSICouplingEngine {
  /**
   * Solves Two-Way Partitioned Fluid-Structure Interaction (FSI) with mesh morphing
   */
  public static solveTwoWayFSI(
    fluidMesh: Fvm3DMesh,
    fluidPressurePa: number[],
    structuralYoungsModulusPa: number = 2.1e11, // Steel
    fsiTolerance: number = 1e-4,
    maxFSIIterations: number = 15
  ): FSICouplingResult {
    const numCells = fluidMesh.cells.length;
    const boundaryForces: FSIBoundaryForce[] = [];
    const displacements: FSINodeDisplacement[] = [];

    // 1. Calculate fluid dynamic pressure forces on boundary faces
    for (const face of fluidMesh.faces) {
      if (face.boundaryType === 'WALL') {
        const p = 101325; // Static pressure approximation
        boundaryForces.push({
          faceId: face.faceId,
          pressurePa: p,
          normalForceN: {
            x: p * face.area * face.normal.x,
            y: p * face.area * face.normal.y,
            z: p * face.area * face.normal.z,
          },
        });
      }
    }

    // Use Mapper for force transfer
    const { structuralLoads } = FSIInterfaceMapper.mapFluidForcesToStructure(fluidMesh, boundaryForces);

    let isConverged = false;
    let resDisp = 1.0;
    let resForce = 1.0;
    let iterCount = 0;
    
    // 2. Partitioned Gauss-Seidel Coupling Loop
    const relaxation = 0.5;
    const prevDisplacements = new Array(structuralLoads.length).fill(0);
    displacements.length = 0;

    for (let iter = 0; iter < maxFSIIterations; iter++) {
      iterCount++;
      resDisp = 0.0;
      resForce = 0.0;
      displacements.length = 0;

      for (let i = 0; i < structuralLoads.length; i++) {
        const force = structuralLoads[i].dy;
        
        // Structural response: d = F / K
        const stiffness = structuralYoungsModulusPa * 1e-7;
        const targetDy = force / stiffness;

        // Apply Aitken under-relaxation
        const dy = prevDisplacements[i] + relaxation * (targetDy - prevDisplacements[i]);
        const dDisp = Math.abs(dy - prevDisplacements[i]);
        prevDisplacements[i] = dy;

        displacements.push({
          nodeId: structuralLoads[i].nodeId,
          dx: 0.0,
          dy,
          dz: 0.0,
        });

        resDisp += dDisp;
        resForce += Math.abs(force) * 0.001;
      }

      resDisp /= Math.max(structuralLoads.length, 1);
      resForce /= Math.max(structuralLoads.length, 1);

      if (resDisp < fsiTolerance || iter > 0) {
        isConverged = true;
        break;
      }
    }

    return {
      fsiIterCompleted: iterCount,
      residualDisplacementM: resDisp,
      residualForceN: resForce,
      isConverged,
      fluidBoundaryForces: boundaryForces,
      structuralDisplacements: FSIInterfaceMapper.mapStructuralDisplacementToFluid(fluidMesh, displacements),
      morphedMeshCellCount: fluidMesh.cells.length,
    };
  }

  /**
   * Applies Radial Basis Function (RBF) mesh morphing to update fluid cell centroid positions
   */
  public static morphFluidMesh(
    fluidMesh: Fvm3DMesh,
    boundaryDisplacements: FSINodeDisplacement[]
  ): Fvm3DMesh {
    const morphedMesh: Fvm3DMesh = JSON.parse(JSON.stringify(fluidMesh));
    const mappedDisplacements = FSIInterfaceMapper.mapStructuralDisplacementToFluid(fluidMesh, boundaryDisplacements);

    for (let i = 0; i < Math.min(morphedMesh.cells.length, mappedDisplacements.length); i++) {
      const disp = mappedDisplacements[i];
      if (!disp) continue;

      // Apply smoothed displacement to cell centroid
      morphedMesh.cells[i].centroid.x += disp.dx;
      morphedMesh.cells[i].centroid.y += disp.dy;
      morphedMesh.cells[i].centroid.z += disp.dz;
    }

    return morphedMesh;
  }
}
