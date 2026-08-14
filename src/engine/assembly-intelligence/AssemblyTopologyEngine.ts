/**
 * PATCH-SECP-072: Assembly Topology Engine
 * Manages parent/child structures, assemblies, configurations, and coordinate transformations.
 */

import { AssemblyStructure, ComponentInstance, Transform3D } from './AssemblyTopologyTypes';
import { CADPart } from '../parametric-cad/ParametricCADTypes';

export class AssemblyTopologyEngine {
  public static createAssembly(id: string, name: string): AssemblyStructure {
    return {
      assemblyId: id,
      displayName: name,
      instances: {},
      mates: [],
      joints: [],
      degreesOfFreedom: 0
    };
  }

  public static addInstance(
    assembly: AssemblyStructure,
    instance: ComponentInstance
  ): AssemblyStructure {
    const updatedInstances = {
      ...assembly.instances,
      [instance.instanceId]: instance
    };

    // Propagate parent-child relationship
    if (instance.parentInstanceId && updatedInstances[instance.parentInstanceId]) {
      const parent = updatedInstances[instance.parentInstanceId];
      if (!parent.childInstanceIds.includes(instance.instanceId)) {
        updatedInstances[instance.parentInstanceId] = {
          ...parent,
          childInstanceIds: [...parent.childInstanceIds, instance.instanceId]
        };
      }
    }

    return {
      ...assembly,
      instances: updatedInstances
    };
  }

  public static computeWorldTransform(
    assembly: AssemblyStructure,
    instanceId: string
  ): Transform3D {
    const instance = assembly.instances[instanceId];
    if (!instance) {
      return {
        translation: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 }
      };
    }

    if (!instance.parentInstanceId) {
      return instance.transform;
    }

    const parentTransform = this.computeWorldTransform(assembly, instance.parentInstanceId);
    
    // Simple matrix-translation cascade for nested reference frames
    return {
      translation: {
        x: parentTransform.translation.x + instance.transform.translation.x,
        y: parentTransform.translation.y + instance.transform.translation.y,
        z: parentTransform.translation.z + instance.transform.translation.z
      },
      // Simplified quaternion composition simulation
      rotation: {
        x: parentTransform.rotation.x + instance.transform.rotation.x,
        y: parentTransform.rotation.y + instance.transform.rotation.y,
        z: parentTransform.rotation.z + instance.transform.rotation.z,
        w: parentTransform.rotation.w * instance.transform.rotation.w
      }
    };
  }
}
