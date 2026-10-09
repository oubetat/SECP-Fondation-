/**
 * PATCH-SECP-072: Component Instance Engine
 * Responsible for cloning CADParts into unique component instances with relative reference frames.
 */

import { ComponentInstance, Transform3D } from './AssemblyTopologyTypes';
import { CADPart } from '../parametric-cad/ParametricCADTypes';

export class ComponentInstanceEngine {
  public static instantiatePart(
    part: CADPart,
    instanceIndex: number,
    transform?: Transform3D,
    parentInstanceId?: string
  ): ComponentInstance {
    const instanceId = `inst-${part.id}-${instanceIndex}`;
    
    const defaultTransform: Transform3D = transform || {
      translation: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 }
    };

    return {
      instanceId,
      partId: part.id,
      partReference: part,
      displayName: `${part.name} (Instance #${instanceIndex})`,
      transform: defaultTransform,
      parentInstanceId,
      childInstanceIds: [],
      configurationName: 'Default'
    };
  }

  public static updateLocalTransform(
    instance: ComponentInstance,
    newTransform: Transform3D
  ): ComponentInstance {
    return {
      ...instance,
      transform: newTransform
    };
  }
}
