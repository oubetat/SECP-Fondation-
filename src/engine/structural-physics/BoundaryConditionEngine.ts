import { BoundaryCondition } from './StructuralPhysicsTypes';

export class BoundaryConditionEngine {
  public static createBoundaryCondition(
    id: string,
    nodeId: number,
    type: 'FIXED' | 'DISPLACEMENT' | string,
    constrainedDOFs: boolean[]
  ): BoundaryCondition {
    return {
      id,
      nodeId,
      type,
      constrainedDOFs
    };
  }
}
