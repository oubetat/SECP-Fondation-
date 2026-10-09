/**
 * PATCH-SECP-072: Assembly Design Intent Engine
 * Dynamically updates mating planes and concentric alignments when component dimensions are adjusted.
 */

import { AssemblyStructure } from './AssemblyTopologyTypes';

export class AssemblyDesignIntentEngine {
  public static preserveAssemblyIntent(
    assembly: AssemblyStructure,
    modifiedPartId: string,
    scaleFactor: number
  ): AssemblyStructure {
    const updatedInstances = { ...assembly.instances };

    // When an underlying part is regenerated, adjust component positions to preserve alignment intent
    Object.keys(updatedInstances).forEach(id => {
      const inst = updatedInstances[id];
      if (inst.partId === modifiedPartId) {
        updatedInstances[id] = {
          ...inst,
          transform: {
            translation: {
              x: inst.transform.translation.x * scaleFactor,
              y: inst.transform.translation.y * scaleFactor,
              z: inst.transform.translation.z
            },
            rotation: inst.transform.rotation
          }
        };
      }
    });

    return {
      ...assembly,
      instances: updatedInstances
    };
  }
}
