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
   * This handles cases where fluid face IDs do not match structural node IDs.
   */
  public static mapFluidForcesToStructure(
    fluidMesh: FvmMesh3D,
    boundaryForces: FSIBoundaryForce[],
    structuralNodes: { id: number; x: number; y: number; z: number }[]
  ): { structuralLoads: FSINodeDisplacement[], diagnostic: MappingDiagnostic } {
    const structuralLoadsMap = new Map<number, { dx: number, dy: number, dz: number }>();
    let mappedCount = 0;
    
    for (const force of boundaryForces) {
      const face = fluidMesh.faces.find(f => f.faceId === force.faceId);
      if (!face) continue;

      // Find nearest structural node
      let nearestNode = structuralNodes[0];
      let minD = Infinity;
      
      for (const node of structuralNodes) {
        const dx = face.centroid.x - node.x;
        const dy = face.centroid.y - node.y;
        const dz = face.centroid.z - node.z;
        const d = dx*dx + dy*dy + dz*dz;
        if (d < minD) {
          minD = d;
          nearestNode = node;
        }
      }

      if (nearestNode) {
        const current = structuralLoadsMap.get(nearestNode.id) || { dx: 0, dy: 0, dz: 0 };
        structuralLoadsMap.set(nearestNode.id, {
          dx: current.dx + force.normalForceN.x,
          dy: current.dy + force.normalForceN.y,
          dz: current.dz + force.normalForceN.z,
        });
        mappedCount++;
      }
    }

    const structuralLoads: FSINodeDisplacement[] = Array.from(structuralLoadsMap.entries()).map(([id, val]) => ({
      nodeId: id,
      ...val
    }));

    return {
      structuralLoads,
      diagnostic: {
        totalFacesMapped: mappedCount,
        totalNodesMapped: structuralLoads.length,
        unmappedFaces: boundaryForces.length - mappedCount,
        unmappedNodes: structuralNodes.length - structuralLoads.length,
        status: (mappedCount > 0 && structuralLoads.length > 0) ? 'SUCCESS' : 'ERROR'
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
