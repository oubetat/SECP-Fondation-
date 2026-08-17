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

export type BoundaryType3D = 'INLET' | 'OUTLET' | 'WALL' | 'SYMMETRY' | 'INTERNAL';

export interface FvmFace3D {
  faceId: number;
  area: number;                   // Positive scalar area (m^2)
  normal: Vector3D;               // Unit normal vector pointing from owner to neighbor
  centroid: Vector3D;             // Centroid (x, y, z)
  ownerCellId: number;            // Index of owner cell
  neighborCellId: number;         // Index of neighbor cell (-1 if boundary face)
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
  neighborCellIds: number[];      // Neighboring cell indices
  boundaryFaceIds: number[];      // Boundary face indices
  skewness: number;               // Mesh skewness metric (0 = ideal, > 0.8 bad)
  aspectRatio: number;            // Cell aspect ratio (1 = isotropic cube)
  nonOrthogonalityDeg: number;    // Angle between face normal and cell-center vector (degrees)
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
  quality: MeshQualityReport3D;
  boundingBox: {
    min: Vector3D;
    max: Vector3D;
  };
}

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
  useTurbulenceModel: boolean;
  turbulenceScheme: 'LAMINAR' | 'K_EPSILON';
  upwindScheme: 'FIRST_ORDER_UPWIND' | 'CENTRAL_DIFFERENCE';
}

export interface VelocityField3D {
  u: number[];                    // u-velocity at cell centers (m/s)
  v: number[];                    // v-velocity at cell centers (m/s)
  w: number[];                    // w-velocity at cell centers (m/s)
}

export interface TurbulenceField3D {
  k: number[];                    // Turbulent kinetic energy (m^2/s^2)
  epsilon: number[];              // Dissipation rate (m^2/s^3)
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
}

export interface AerodynamicMonitors3D {
  pressureDropPa: number;        // Inlet avg pressure - Outlet avg pressure
  dragForceN: number;             // Total drag force on wall surfaces (N)
  liftForceN: number;             // Total lift force on wall surfaces (N)
  pressureDragForceN: number;     // Pressure contribution to drag
  viscousDragForceN: number;      // Viscous shear contribution to drag
  dragCoefficientCd: number;      // Drag coefficient Cd
  liftCoefficientCl: number;      // Lift coefficient Cl
  referenceAreaM2: number;        // Reference area for Cd, Cl
  referenceVelocityMS: number;    // Reference velocity U_infinity
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
  converged: boolean;
  finalContinuityResidual: number;
  finalMomentumResidual: number;
  globalMassImbalanceNorm: number;
  monitors: AerodynamicMonitors3D;
  numericalStatus: 'STABLE' | 'SENSITIVE' | 'ILL_CONDITIONED' | 'UNSTABLE' | 'INVALID';
}
