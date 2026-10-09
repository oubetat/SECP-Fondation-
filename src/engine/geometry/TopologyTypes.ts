/**
 * SECP Topology Types
 * Definitions for topological exploration and mapping.
 */

export interface TopologyMap {
  vertices: number;
  edges: number;
  wires: number;
  faces: number;
  shells: number;
  solids: number;
}

export interface EdgeData {
  length: number;
  isCurve: boolean;
  isClosed: boolean;
}

export interface FaceData {
  area: number;
  isPlanar: boolean;
  isNurbs: boolean;
}
