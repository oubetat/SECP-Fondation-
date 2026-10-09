import { Vector3D } from '../../cadKernel';
import { KinematicFrame } from './KinematicJointModel';

export interface KinematicMassProperties {
  mass: number;
  centerOfMass: Vector3D;
  inertiaTensor: number[][]; // 3x3 inertia tensor matrix
}

/**
 * Rigid-body kinematic representation referencing an actual CAD assembly component
 */
export interface KinematicBody {
  bodyId: string;
  componentId: string;
  parentBodyId?: string;
  localTransform: number[][];   // 4x4 matrix relative to parent
  worldTransform: number[][];   // 4x4 matrix in global reference coordinates
  massProperties?: KinematicMassProperties;
  referenceFrame: KinematicFrame;
  grounded: boolean;
}

/**
 * Creates an identity 4x4 transformation matrix
 */
export function createIdentityTransform(): number[][] {
  return [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
}

/**
 * Creates a default kinematic body from component parameters
 */
export function createKinematicBody(
  bodyId: string,
  componentId: string,
  grounded: boolean = false,
  origin: Vector3D = { x: 0, y: 0, z: 0 }
): KinematicBody {
  const transform = createIdentityTransform();
  transform[0][3] = origin.x;
  transform[1][3] = origin.y;
  transform[2][3] = origin.z;

  return {
    bodyId,
    componentId,
    parentBodyId: undefined,
    localTransform: transform,
    worldTransform: JSON.parse(JSON.stringify(transform)),
    referenceFrame: {
      origin: { ...origin },
      primaryAxis: { x: 0, y: 0, z: 1 },
      secondaryAxis: { x: 1, y: 0, z: 0 },
    },
    grounded,
  };
}
