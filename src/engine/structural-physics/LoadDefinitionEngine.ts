/**
 * PATCH-SECP-073: Load Definition Engine
 * Defines concentrated force vectors, distributed loads, and structural load cases.
 */

import { LoadDefinition } from './StructuralPhysicsTypes';

export class LoadDefinitionEngine {
  public static createLoad(
    id: string,
    nodeId: number,
    fx: number,
    fy: number,
    fz: number
  ): LoadDefinition {
    return {
      id,
      nodeId,
      forceVector: { x: fx, y: fy, z: fz }
    };
  }
}
