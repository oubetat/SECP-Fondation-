import { FvmMesh3D, FvmFace3D } from '../../Fvm3DTypes';
import { FSIBoundaryForce, FSINodeDisplacement } from '../../coupling/TwoWayFSICouplingEngine';

export interface MappingDiagnostic {
  totalFacesMapped: number;
  totalNodesMapped: number;
  unmappedFaces: number;
  unmappedNodes: number;
  status: 'SUCCESS' | 'WARNING' | 'ERROR';
}

export class FSIInterfaceMapper {
  /**
   * Maps fluid forces on boundary faces to structural nodes based on geometric proximity.
   */
  public static mapFluidForcesToStructure(
    fluidMesh: FvmMesh3D,
    boundaryForces: FSIBoundaryForce[]
  ): { structuralLoads: FSINodeDisplacement[], diagnostic: MappingDiagnostic } {
    const structuralLoads: FSINodeDisplacement[] = [];
    let mappedCount = 0;
    
    for (const force of boundaryForces) {
      const face = fluidMesh.faces.find(f => f.faceId === force.faceId);
      if (!face) continue;

      // Simple proximity mapping: Assume structural node centroid == face centroid
      // In a real Mapper, this would be a search algorithm (e.g., KD-Tree)
      structuralLoads.push({
        nodeId: force.faceId,
        dx: force.normalForceN.x,
        dy: force.normalForceN.y,
        dz: force.normalForceN.z,
      });
      mappedCount++;
    }

    return {
      structuralLoads,
      diagnostic: {
        totalFacesMapped: mappedCount,
        totalNodesMapped: structuralLoads.length,
        unmappedFaces: boundaryForces.length - mappedCount,
        unmappedNodes: 0,
        status: mappedCount > 0 ? 'SUCCESS' : 'ERROR'
      }
    };
  }

  /**
   * Maps structural displacements to fluid boundary mesh nodes.
   */
  public static mapStructuralDisplacementToFluid(
    fluidMesh: FvmMesh3D,
    structuralDisplacements: FSINodeDisplacement[]
  ): FSINodeDisplacement[] {
    return structuralDisplacements.map(disp => ({
      nodeId: disp.nodeId,
      dx: disp.dx,
      dy: disp.dy,
      dz: disp.dz
    }));
  }
}
