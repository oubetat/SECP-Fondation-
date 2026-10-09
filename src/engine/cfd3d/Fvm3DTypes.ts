/**
 * PATCH-SECP-082: 3D Finite Volume Navier-Stokes CFD Data Types & Interfaces
 * 
 * Defines 3D control volumes (cells), faces, boundary conditions, fluid properties,
 * numerical fields, SIMPLE solver states, turbulence parameters, and aerodynamic monitors.
 */

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export type BoundaryType3D = 
  | 'INLET' 
  | 'OUTLET' 
  | 'WALL' 
  | 'SYMMETRY' 
  | 'INTERNAL'
  | 'PRESSURE_INLET'
  | 'PRESSURE_OUTLET'
  | 'WALL_NO_SLIP'
  | 'WALL_SLIP'
  | 'WALL_MOVING'
  | 'FARFIELD'
  | 'PRESSURE_FARFIELD';

export interface FvmFace3D {
  faceId: number;
  area: number;                   // Positive scalar area (m^2)
  normal: Vector3D;               // Unit normal vector pointing from owner to neighbor
  centroid: Vector3D;             // Centroid (x, y, z)
  ownerCellId: number;            // Index of owner cell
  neighborCellId: number;         // Index of neighbor cell (-1 if boundary face)
  ownerCell?: number;             // Alias for ownerCellId
  neighborCell?: number;          // Alias for neighborCellId
  boundaryType: BoundaryType3D;   // Boundary classification
  u_bc?: number;                  // Prescribed u-velocity at boundary (m/s)
  v_bc?: number;                  // Prescribed v-velocity at boundary (m/s)
  w_bc?: number;                  // Prescribed w-velocity at boundary (m/s)
  p_bc?: number;                  // Prescribed pressure at boundary (Pa)
}

export interface FvmCell3D {
  cellId: number;
  volume: number;                 // Positive scalar cell volume (m^3)
  centroid: Vector3D;             // Cell center (x, y, z)
  faceIds: number[];              // References to bounding faces
  faceIndices?: number[];         // Alias for faceIds
  neighborCellIds: number[];      // Neighboring cell indices
  boundaryFaceIds: number[];      // Boundary face indices
  skewness: number;               // Mesh skewness metric (0 = ideal, > 0.8 bad)
  aspectRatio: number;            // Cell aspect ratio (1 = isotropic cube)
  nonOrthogonalityDeg: number;    // Angle between face normal and cell-center vector (degrees)
  dx?: number;
  dy?: number;
  dz?: number;
}

export interface MeshQualityReport3D {
  totalCells: number;
  totalFaces: number;
  totalBoundaryFaces: number;
  minCellVolume: number;
  maxCellVolume: number;
  maxSkewness: number;
  maxAspectRatio: number;
  maxNonOrthogonalityDeg: number;
  hasPositiveVolumes: boolean;
  hasNonzeroAreas: boolean;
  isClosedTopology: boolean;
  isNeighborConsistent: boolean;
  hasDegenerateCells: boolean;
  meshQualityStatus: 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'DEGENERATE';
  passed: boolean;
}

export interface FvmMesh3D {
  meshId: string;
  cells: FvmCell3D[];
  faces: FvmFace3D[];
  nodes?: Vector3D[];
  quality: MeshQualityReport3D;
  boundingBox: {
    min: Vector3D;
    max: Vector3D;
  };
}

export type Fvm3DMesh = FvmMesh3D;

export interface FluidProperties3D {
  densityKgM3: number;            // Fluid density rho (kg/m^3)
  viscosityPaS: number;           // Dynamic viscosity mu (Pa.s)
  temperatureK?: number;          // Temperature (K)
}

export interface BoundaryConditionSpec3D {
  inletVelocityMS: Vector3D;      // (u, v, w) at inlet
  outletPressurePa: number;       // Pressure at outlet (Pa)
  wallTurbulenceIntensity?: number; // % intensity
}

export interface SolverConfig3D {
  maxIterations: number;
  continuityTol: number;
  momentumTol: number;
  underRelaxationVelocity: number; // alpha_u (default 0.7)
  underRelaxationPressure: number; // alpha_p (default 0.3)
  underRelaxationTurbulentViscosity?: number; // alpha_nut (default 1.0)
  useTurbulenceModel: boolean;
  turbulenceScheme: 'LAMINAR' | 'K_EPSILON' | 'SST_K_OMEGA';
  upwindScheme: 'FIRST_ORDER_UPWIND' | 'CENTRAL_DIFFERENCE';
}

export interface VelocityField3D {
  u: number[];                    // u-velocity at cell centers (m/s)
  v: number[];                    // v-velocity at cell centers (m/s)
  w: number[];                    // w-velocity at cell centers (m/s)
}

export interface TurbulenceField3D {
  k: number[];                    // Turbulent kinetic energy (m^2/s^2)
  epsilon?: number[];             // Dissipation rate (m^2/s^3)
  omega?: number[];               // Specific dissipation rate (1/s)
  nut: number[];                  // Turbulent eddy viscosity (Pa.s or m^2/s * rho)
}

export interface CfdIterationLog3D {
  iteration: number;
  continuityResidual: number;
  uMomentumResidual: number;
  vMomentumResidual: number;
  wMomentumResidual: number;
  pressureChange: number;
  globalMassImbalanceKgS: number;
  maxVelocityMS: number;
  kResidual?: number;
  omegaResidual?: number;
  kMin?: number;
  kMax?: number;
  omegaMin?: number;
  omegaMax?: number;
  nutMin?: number;
  nutMax?: number;
  cl?: number;
  cd?: number;
  cm?: number;
  alpha_u?: number;
  alpha_p?: number;
  maxDeltaNut?: number;
  maxRelDeltaNut?: number;
  maxDeltaK?: number;
  maxDeltaOmega?: number;
  pressureCorrection?: number;
  velocityCorrection?: number;
  momentumLinf?: number;
  momentumL1?: number;
  momentumL2?: number;
  continuityLinf?: number;
  continuityL1?: number;
  continuityL2?: number;
  numberOfNutClippedCells?: number;
  meanNut?: number;
  kSolveConverged?: boolean;
  omegaSolveConverged?: boolean;
  maxNut?: number;
  minNut?: number;
  maxVelocity?: number;
  minPressure?: number;
  maxPressure?: number;
}

export interface MomentEvidence3D {
  value: number;
  referencePoint: {
    x: number;
    y: number;
    z: number;
  };
  referenceAxis: "Z";
  dimensionalMoment: number;
  pressureMoment: number;
  viscousMoment: number;
  wallFaceCount: number;
}

export interface YPlusEvidence3D {
  min: number;
  max: number;
  mean: number;
  areaWeightedMean: number;
  p95: number;
  wallFaceCount: number;
  wallDistanceMin: number;
  wallDistanceMax: number;
  source: "LIVE_WALL_SOLUTION";
}

export interface VectorComponents3D {
  Fx: number;
  Fy: number;
  Fz: number;
}

export interface ForcesEvidence3D {
  pressure: VectorComponents3D;
  viscous: VectorComponents3D;
  total: VectorComponents3D;
  windAxis: {
    lift: number;
    drag: number;
  };
  coefficients: {
    CL: number;
    CD: number;
  };
}

export interface FlowReferenceEvidence3D {
  rho: number;
  Uinf: number;
  dynamicPressure: number;
  chord: number;
  referenceArea: number;
  angleOfAttackDeg: number;
}

export interface ForceStabilityEvidence3D {
  passed: boolean;
  clDeltaWindow: number;
  cdDeltaWindow: number;
  cmDeltaWindow: number;
  clRelativeWindowChange: number;
  cdRelativeWindowChange: number;
  cmRelativeWindowChange: number;
  windowSize: number;
}

export interface ContinuityAudit3D {
  local: {
    l1: number;
    l2: number;
    linf: number;
    maxCellId: number;
  };
  globalBoundaryBalance: {
    inletMassFlow: number;
    outletMassFlowRaw: number;
    outletMassFlowScaled: number;
    absoluteImbalanceRaw: number;
    relativeImbalanceRaw: number;
    absoluteImbalanceAfterScaling: number;
    relativeImbalanceAfterScaling: number;
  };
  outletScaling: {
    enabled: boolean;
    scaleFactor: number;
    minAllowed: number;
    maxAllowed: number;
    invariantSatisfied: boolean;
    invariantDiff: number;
  };
  rawMassImbalance: number;
  postScalingMassImbalance: number;
  rawConservationPassed: boolean;
  scaledConservationPassed: boolean;
}

export interface MetricProvenanceDetails {
  value: number;
  metricDefinition: string;
  normalization: string;
  units: string;
  threshold: number;
  source: string;
  isMeshDependent?: boolean;
}

export interface WallTreatmentEvidence3D {
  wallTreatment: "LOG_LAW_WALL_FUNCTIONS" | "WALL_RESOLVED_LOW_RE";
  requiredYPlusRegime: "LOG_LAW_RANGE_30_TO_300" | "VISCOUS_SUB_LAYER_LESS_THAN_1";
  measuredYPlus: {
    min: number;
    mean: number;
    max: number;
    p95: number;
  };
  compatible: boolean;
  explanation: string;
}

export interface ConvergenceAudit3D {
  converged: boolean;
  iteration: number;
  effectiveMaxIterations: number;
  effectiveMinIterations: number;
  terminationReason: 'CONVERGED' | 'MAX_ITERATIONS_REACHED' | 'DIVERGED' | 'FAILED';
  terminationIteration: number;
  continuityPassed: boolean;
  momentumPassed: boolean;
  velocityPassed: boolean;
  pressurePassed: boolean;
  forceStabilityPassed: boolean;
  continuity: {
    l1: number;
    l2: number;
    linf: number;
    maxCellId: number;
  };
  momentum: number;
  momentumResidualL1: number;
  momentumResidualL2: number;
  momentumResidualLinf: number;
  momentumTolerance: number;
  blockingMomentumMetric: 'MOMENTUM_LINF' | 'MOMENTUM_L1' | 'MOMENTUM_L2';
  momentumDetails?: MetricProvenanceDetails;
  pressureCorrection: number;
  pressureCorrectionDetails?: MetricProvenanceDetails;
  velocityCorrection: number;
  velocityCorrectionDetails?: MetricProvenanceDetails;
  turbulence: {
    kResidual: number;
    omegaResidual: number;
    kLinearResidual?: number;
    omegaLinearResidual?: number;
    kFieldUpdate?: number;
    omegaFieldUpdate?: number;
    nutFieldUpdate?: number;
    kDetails?: MetricProvenanceDetails;
    omegaDetails?: MetricProvenanceDetails;
    kLinearResidualDetails?: MetricProvenanceDetails;
    omegaLinearResidualDetails?: MetricProvenanceDetails;
    kFieldUpdateDetails?: MetricProvenanceDetails;
    omegaFieldUpdateDetails?: MetricProvenanceDetails;
    nutFieldUpdateDetails?: MetricProvenanceDetails;
    sstAssemblyCount?: number;
    kSolveCount?: number;
    omegaSolveCount?: number;
    nuTUpdateCount?: number;
  };
  flow: {
    maxVelocity: number;
    minPressure: number;
    maxPressure: number;
  };
  limiters?: {
    velocityClamped: number;
    pressureClamped: number;
    turbulenceClamped: number;
  };
  forceStability?: ForceStabilityEvidence3D;
  rhieChowNorm?: number;
  faceFluxCorrectionNorm?: number;
  outletScaleFactor?: number;
  wallTreatmentEvidence?: WallTreatmentEvidence3D;
}

export interface AerodynamicMonitors3D {
  pressureDropPa: number;        // Inlet avg pressure - Outlet avg pressure
  dragForceN: number;             // Total drag force on wall surfaces (N)
  liftForceN: number;             // Total lift force on wall surfaces (N)
  pitchingMomentNm?: number;      // Total pitching moment about quarter-chord
  pressureDragForceN: number;     // Pressure contribution to drag
  viscousDragForceN: number;      // Viscous shear contribution to drag
  dragCoefficientCd: number;      // Drag coefficient Cd
  liftCoefficientCl: number;      // Lift coefficient Cl
  pitchingMomentCm?: number;      // Pitching moment coefficient Cm
  referenceAreaM2: number;        // Reference area for Cd, Cl
  referenceVelocityMS: number;    // Reference velocity U_infinity
  moment?: MomentEvidence3D;
  yPlus?: YPlusEvidence3D;
  forces?: ForcesEvidence3D;
  reference?: FlowReferenceEvidence3D;
}

export interface CfdSolution3D {
  mesh: FvmMesh3D;
  fluid: FluidProperties3D;
  reynoldsNumber: number;
  flowRegime: 'LAMINAR' | 'TURBULENT';
  velocity: VelocityField3D;
  pressure: number[];             // Static pressure at cell centers (Pa)
  turbulence?: TurbulenceField3D;
  faceFluxes?: number[];
  iterationHistory: CfdIterationLog3D[];
  totalIterations: number;
  iterations?: number;
  converged: boolean;
  finalContinuityResidual: number;
  finalMomentumResidual: number;
  globalMassImbalanceNorm: number;
  monitors: AerodynamicMonitors3D;
  numericalStatus: 'STABLE' | 'SENSITIVE' | 'ILL_CONDITIONED' | 'UNSTABLE' | 'INVALID';
  continuityAudit?: ContinuityAudit3D;
  convergenceAudit?: ConvergenceAudit3D;
  solutionStateHash?: string;
  forceStateHash?: string;
}
