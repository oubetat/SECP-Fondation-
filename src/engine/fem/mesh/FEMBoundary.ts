export type FEMBoundaryTag =
  | 'FIXED_SUPPORT'
  | 'LOAD_FACE'
  | 'PRESSURE_FACE'
  | 'SYMMETRY'
  | 'CONTACT'
  | 'THERMAL_BOUNDARY'
  | 'FLUID_BOUNDARY';

export interface FEMBoundary {
  id: string;
  name: string;
  tag: FEMBoundaryTag;
  nodeIds: string[];
  elementIds: string[];
  faceKeys?: string[]; // Face identifier keys e.g. "elemId_faceIndex"
  cadFaceId?: string;  // Link back to original CAD face
  persistentId?: string;
  normal?: { x: number; y: number; z: number };
  centroid?: { x: number; y: number; z: number };
  area?: number;
}
