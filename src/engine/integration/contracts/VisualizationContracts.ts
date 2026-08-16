/**
 * PATCH-SECP-084: Result Visualization Contracts
 * Defines precise payload schemas for UI viewport visualization overlays
 * with verified analytical schemas and numerical field definitions.
 */

export interface BRepVisualizationContract {
  faceCount: number;
  edgeCount: number;
  vertexCount: number;
  isManifold: boolean;
  boundaryCurves: { start: [number, number, number]; end: [number, number, number] }[];
  surfacePatchGrid: { u: number; v: number; x: number; y: number; z: number }[][];
  deviationMapMaxMm: number;
  openEdgeCount: number;
}

export interface ClassAVisualizationContract {
  continuityType: 'DISCONTINUOUS' | 'G0' | 'G1' | 'G2' | 'G3';
  maxG0DiscontinuityMm: number;
  maxG1AngularDeviationDeg: number;
  maxG2CurvatureDeviationPercentage: number;
  maxG3TorsionDeviationPercentage: number;
  meanCurvatureGrid: { u: number; v: number; curvature: number }[];
  gaussianCurvatureGrid: { u: number; v: number; curvature: number }[];
  zebraStripes: { u: number; v: number; reflectionAngleRad: number; intensity: number }[];
  isClassACompliant: boolean;
}

export interface FeaVisualizationContract {
  nodeCount: number;
  elementCount: number;
  maxVonMisesStressMPa: number;
  maxDisplacementMm: number;
  minSafetyFactor: number;
  stressField: { nodeId: number; stressMPa: number; x: number; y: number; z: number }[];
  displacementField: { nodeId: number; dx: number; dy: number; dz: number; magnitudeMm: number }[];
  deformedMeshNodes: { id: number; x: number; y: number; z: number }[];
}

export interface CfdVisualizationContract {
  gridCellCount: number;
  maxVelocityMS: number;
  minPressurePa: number;
  maxPressurePa: number;
  pressureDropPa: number;
  dragCoefficientCd: number;
  liftCoefficientCl: number;
  velocityField: { cellId: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; magMS: number }[];
  streamlineTrajectories: { x: number; y: number; z: number }[][];
  residualHistory: { iteration: number; uResidual: number; vResidual: number; pResidual: number }[];
}

export interface Cam5AxisVisualizationContract {
  totalClPoints: number;
  totalGcodeBlocks: number;
  toolType: string;
  toolDiameterMm: number;
  totalPathLengthMm: number;
  estimatedMachiningTimeSec: number;
  maxGougeDepthMm: number;
  hasGougeViolation: boolean;
  hasHolderCollision: boolean;
  toolpathPoints: {
    x: number;
    y: number;
    z: number;
    i: number;
    j: number;
    k: number;
    feedrate: number;
    isGougeFree: boolean;
  }[];
  gcodePreview: string[];
}

export interface AssemblyVisualizationContract {
  componentCount: number;
  jointCount: number;
  unconstrainedDofs: number;
  hasInterference: boolean;
  interferenceVolumeMm3: number;
  jointStates: {
    jointId: string;
    jointType: string;
    value: number;
    minLimit: number;
    maxLimit: number;
  }[];
  componentTransformations: {
    componentId: string;
    translation: [number, number, number];
    rotationEulerDeg: [number, number, number];
  }[];
}
