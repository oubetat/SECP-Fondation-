/**
 * PATCH-SECP-073: Boundary Condition Engine
 * Applies physical constraints (fixed, rollers, pins) on structural mesh nodes.
 */

import { BoundaryCondition, BoundaryConditionType } from './StructuralPhysicsTypes';

export class BoundaryConditionEngine {
  public static createBoundaryCondition(
    id: string,
    nodeId: number,
    type: BoundaryConditionType
  ): BoundaryCondition {
    const constrainedDOFs = [false, false, false];

    if (type === 'FIXED') {
      constrainedDOFs[0] = true; // Constrain u_x
      constrainedDOFs[1] = true; // Constrain u_y
      constrainedDOFs[2] = true; // Constrain u_z
    } else if (type === 'ROLLER') {
      constrainedDOFs[1] = true; // Constrain vertical motion u_y only
    } else if (type === 'PINNED') {
      constrainedDOFs[0] = true;
      constrainedDOFs[1] = true;
    }

    return {
      id,
      nodeId,
      type,
      constrainedDOFs,
      prescribedDisplacements: [0, 0, 0]
    };
  }
}
