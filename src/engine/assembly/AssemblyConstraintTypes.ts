import { Transform3D, computeTransformMatrix, createIdentityTransform, createTransform3D, AssemblyComponent, PartDefinition } from './AssemblyCore';

export enum AssemblyConstraintType {
  MATE = 'MATE',
  FLUSH = 'FLUSH',
  ANGLE = 'ANGLE',
  TANGENT = 'TANGENT',
  SYMMETRIC = 'SYMMETRIC',
  INSERT = 'INSERT',
  DISTANCE = 'DISTANCE'
}

export class AssemblyConstraint {
  id?: string;
  constraintId?: string;
  assemblyId?: string;
  type?: any;
  componentA?: string;
  entityA?: string;
  componentB?: string;
  entityB?: string;
  offset?: number;
  isSuppressed?: boolean;
  geometryRefA?: any;
  geometryRefB?: any;
  parameters?: any;
  status?: string;
  solverError?: number;
  revision?: number;
  constructor(init?: Partial<AssemblyConstraint>) {
    if (init) Object.assign(this, init);
  }
}

export interface GeometryReference {
  componentId: string;
  topologyType: string;
  topologyIndex: number;
  geometricSignature: string;
  cachedNormal?: { x: number; y: number; z: number };
  cachedPoint?: { x: number; y: number; z: number };
}

export type InterferenceStatus =
  | 'CLEAR'
  | 'CLASH'
  | 'TOUCHING'
  | 'NO_INTERFERENCE'
  | 'UNKNOWN'
  | 'INTERFERENCE';

export const InterferenceStatus = {
  CLEAR: 'CLEAR',
  CLASH: 'CLASH',
  TOUCHING: 'TOUCHING',
  NO_INTERFERENCE: 'NO_INTERFERENCE',
  UNKNOWN: 'UNKNOWN',
  INTERFERENCE: 'INTERFERENCE'
} as const;

export interface AssemblyClash {
  id: string;
  compAName?: string;
  compBName?: string;
  componentAName?: string;
  componentBName?: string;
  overlapVolumeMm3?: number;
  clashCenter?: { x: number; y: number; z: number };
  severity?: string;
  componentAId?: string;
  componentBId?: string;
  intersectionVolumeMm3?: number;
  intersectionLocation?: { x: number; y: number; z: number };
  clashDetails?: string;
  [key: string]: any;
}

export interface AssemblyInterferenceReport {
  status?: string;
  clashes: AssemblyClash[];
  totalClashVolumeMm3?: number;
  evaluatedPairsCount?: number;
  timestamp?: string;
  kernelUsed?: string;
}

export { Transform3D, computeTransformMatrix, createIdentityTransform, createTransform3D, AssemblyComponent, PartDefinition };
