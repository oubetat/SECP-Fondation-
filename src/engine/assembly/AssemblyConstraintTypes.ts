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

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface ComponentDOFState {
  occurrenceId: string;
  initialDOF: number;
  remainingDOF: number;
  translational: { x: boolean; y: boolean; z: boolean };
  rotational: { x: boolean; y: boolean; z: boolean };
  constrainedAxes: string[];
  freeAxes: string[];
  status: 'FULLY_CONSTRAINED' | 'PARTIALLY_CONSTRAINED' | 'FREE' | 'CONFLICTED' | 'OVER_CONSTRAINED' | 'UNDER_CONSTRAINED' | 'UNCONSTRAINED' | 'FIXED';
}

export interface ComponentDOF {
  instanceId?: string;
  componentId?: string;
  isFixed?: boolean;
  translationalDOF?: number;
  rotationalDOF?: number;
  translation?: { tx: boolean; ty: boolean; tz: boolean };
  rotation?: { rx: boolean; ry: boolean; rz: boolean };
  remainingDofCount?: number;
  activeConstraintIds?: string[];
  statusMessage?: string;
  state?: ComponentDOFState | string;
  unconstrainedAxes?: string[];
}

export interface RankTolerance {
  rankThreshold?: number;
  singularValueThreshold?: number;
}

export interface DOFTolerancePolicy {
  zeroThreshold?: number;
  rankTolerance?: RankTolerance;
  rankRelativeTolerance?: number;
  rankAbsoluteTolerance?: number;
  geometricTolerance?: number;
  angularTolerance?: number;
  conditioningThreshold?: number;
}

export interface ComponentNode {
  id: string;
  name: string;
  dofState?: ComponentDOFState | string;
  isFixed?: boolean;
}

export interface ConstraintEdge {
  id?: string;
  constraintId?: string;
  sourceComponentId?: string;
  targetComponentId?: string;
  constraintType?: AssemblyConstraintType | string;
  type?: string;
  source?: string;
  target?: string;
  status?: string;
}

export interface ConstraintGraph {
  nodes: ComponentNode[];
  edges: ConstraintEdge[];
  connectedComponents?: string[][];
}

export interface DOFEvidence {
  assemblyId?: string;
  assemblyRevision?: string;
  componentCount?: number;
  variableCount?: number;
  constraintCount?: number;
  jacobianRows?: number;
  jacobianColumns?: number;
  jacobianRank?: number;
  initialDOF?: number;
  remainingDOF?: number;
  componentDOF?: ComponentDOFState[];
  redundantConstraints?: string[];
  conflictingConstraints?: string[];
  singularityStatus?: string;
  conditioningStatus?: string;
  tolerancePolicyHash?: string;
  geometryStateHash?: string;
  constraintGraphHash?: string;
  evidenceHash?: string;
  constraintGraph: ConstraintGraph;
  totalDOF: number;
}

export type SolverOutcomeStatus =
  | 'CONVERGED'
  | 'SINGULAR_MATRIX'
  | 'MAX_ITERATIONS_REACHED'
  | 'UNSATISFIED_CONSTRAINTS'
  | 'SOLVED'
  | 'CONFLICTING'
  | 'OVER_CONSTRAINED'
  | 'UNDER_CONSTRAINED'
  | 'INVALID';

export interface AssemblySolverReport {
  status: SolverOutcomeStatus | string;
  satisfiedConstraintsCount?: number;
  totalActiveConstraintsCount?: number;
  iterationsTaken?: number;
  convergenceResidual?: number;
  totalAssemblyDof?: number;
  componentDofs?: Record<string, ComponentDOF>;
  diagnostics?: string[];
  solvedTimestamp?: string;
  isDeterministic?: boolean;
  iterations?: number;
  residualNorm?: number;
  updatedTransforms?: Record<string, Transform3D>;
}

export type KinematicJointType =
  | 'REVOLUTE'
  | 'PRISMATIC'
  | 'CYLINDRICAL'
  | 'SPHERICAL'
  | 'PLANAR'
  | 'FIXED'
  | 'GEAR'
  | 'RACK_PINION';

export interface KinematicJoint {
  id: string;
  jointType?: KinematicJointType;
  type?: string;
  componentAId?: string;
  componentA?: string;
  componentBId?: string;
  componentB?: string;
  name?: string;
  parameters?: any;
  currentPosition?: number;
  motionRange?: { min?: number; max?: number };
  parentComponentId?: string;
  childComponentId?: string;
  [key: string]: any;
}

export type TopologyType = 'FACE' | 'EDGE' | 'VERTEX' | 'AXIS' | 'PLANE';

export class AssemblyConstraint {
  id?: string;
  constraintId?: string;
  assemblyId?: string;
  name?: string;
  type?: any;
  componentA?: string;
  entityA?: string;
  componentB?: string;
  entityB?: string;
  offset?: number;
  isSuppressed?: boolean;
  suppressionState?: 'ACTIVE' | 'SUPPRESSED';
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

export type ConstraintDiagnosticStatus =
  | 'DANGLING_REFERENCE'
  | 'CONFLICTING'
  | 'OVER_CONSTRAINED'
  | 'VALID'
  | 'UNSATISFIED'
  | 'SUPPRESSED';

export interface ConstraintDiagnosticResult {
  constraintId?: string;
  status: ConstraintDiagnosticStatus | string;
  affectedComponents: string[];
  affectedDOF: number;
  conflictsWith?: string[];
  residual: number;
  message?: string;
  [key: string]: any;
}

export interface AssemblyConfiguration {
  id: string;
  name: string;
  description?: string;
  componentOverrides: Record<string, { suppressed?: boolean; position?: any; rotation?: any }>;
  constraintOverrides?: Record<string, { suppressed?: boolean }>;
}

export { Transform3D, computeTransformMatrix, createIdentityTransform, createTransform3D, AssemblyComponent, PartDefinition };
