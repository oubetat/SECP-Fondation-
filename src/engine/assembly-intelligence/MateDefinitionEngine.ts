/**
 * PATCH-SECP-072: Mate Definition Engine
 * Definess primary assembly mates including standard and mechanical mates (e.g. Gears).
 */

import { MechanicalMate, AssemblyMateType } from './AssemblyTopologyTypes';

export class MateDefinitionEngine {
  public static createMate(
    type: AssemblyMateType,
    primaryInstanceId: string,
    primaryEntityId: string,
    secondaryInstanceId: string,
    secondaryEntityId: string,
    value?: number,
    direction?: number
  ): MechanicalMate {
    const mateId = `mate-${type.toLowerCase()}-${primaryInstanceId}-${secondaryInstanceId}-${Date.now()}`;
    return {
      mateId,
      type,
      primaryInstanceId,
      primaryEntityId,
      secondaryInstanceId,
      secondaryEntityId,
      value,
      direction
    };
  }
}
