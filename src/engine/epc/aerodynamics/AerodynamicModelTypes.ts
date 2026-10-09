/**
 * SECP Industrial OS — EPC-024 Aerodynamic Model Data Types & Interfaces
 * Governs the aerodynamic representation of the Industrial Drone proof case.
 * Enforces unified schemas, atmospheric models, CFD solver integration,
 * aerodynamic polar outputs, physics validation checks, and evidence provenance.
 */

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export type FlightRegimeType = 
  | 'HOVER' 
  | 'LOW_SPEED_FLIGHT' 
  | 'FORWARD_FLIGHT' 
  | 'CLIMB' 
  | 'DESCENT' 
  | 'TURNING_MANEUVERING'
  | 'SUPERSONIC_HIGH_MACH';

export type SupportStatus = 'SUPPORTED' | 'NOT_SUPPORTED' | 'INCONCLUSIVE';

export interface FlightRegimeCapability {
  regime: FlightRegimeType;
  status: SupportStatus;
  description: string;
}

export interface AtmosphericCondition {
  altitudeM: number;
  densityKgM3: number;          // Air density rho (kg/m^3)
  viscosityPaS: number;         // Dynamic viscosity mu (Pa·s)
  temperatureK: number;         // Temperature T (K)
  pressurePa: number;           // Static pressure p (Pa)
  speedOfSoundMps: number;      // Speed of sound a (m/s)
}

export interface ComponentAerodynamicContribution {
  componentId: string;
  componentName: string;
  cadRevision: string;
  referenceAreaM2: number;
  frontalAreaM2: number;
  dragCoefficientCd: number;
  dragForceN: number;
  liftForceN: number;
  sideForceN: number;
  pitchMomentNm: number;
  yawMomentNm: number;
  rollMomentNm: number;
}

export interface PropellerRotorAerodynamicState {
  unitId: string;
  motorId: string;
  propellerId: string;
  rpm: number;
  thrustN: number;
  torqueNm: number;
  electricalPowerW: number;
  mechanicalPowerW: number;
  rotorRadiusM: number;
  rotorAreaM2: number;
  inducedVelocityMps: number;   // v_i = sqrt(T / (2 * rho * A_rotor))
  downwashDynamicPressurePa: number;
}

export interface CFDSolverSettings {
  solverName: string;
  solverVersion: string;
  upwindScheme: string;
  underRelaxationVelocity: number;
  underRelaxationPressure: number;
  convergenceTolerance: number;
  maxIterations: number;
  turbulenceModel: string;
}

export interface CFDMeshMetadata {
  meshId: string;
  meshRevision: string;
  totalCells: number;
  totalFaces: number;
  qualityStatus: 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'DEGENERATE';
  hasPositiveVolumes: boolean;
  boundingBoxMin: Vector3D;
  boundingBoxMax: Vector3D;
}

export interface CFDBoundaryConditions {
  inletVelocityVector: Vector3D;
  outletPressurePa: number;
  wallNoSlipSurfaceIds: string[];
}

export interface AerodynamicCoefficients {
  CL: number; // Lift coefficient
  CD: number; // Drag coefficient
  CY: number; // Side force coefficient
  Cl: number; // Roll moment coefficient
  Cm: number; // Pitch moment coefficient
  Cn: number; // Yaw moment coefficient
}

export interface AerodynamicForcesAndMoments {
  liftN: number;
  dragN: number;
  sideForceN: number;
  rollMomentNm: number;
  pitchMomentNm: number;
  yawMomentNm: number;
}

export interface AerodynamicModelSchema {
  aerodynamicModelId: string;
  caseId: string;
  geometryRevision: string;
  atmosphericCondition: AtmosphericCondition;
  referenceAreaM2: number;
  referenceLengthM: number;

  velocityMps: number;
  velocityVectorMS: Vector3D;
  machNumber: number;
  reynoldsNumber: number;

  angleOfAttackDeg: number;
  sideslipAngleDeg: number;
  rotationalRatesRadS: Vector3D; // (p, q, r)

  dynamicPressurePa: number;

  coefficients: AerodynamicCoefficients;
  forcesAndMoments: AerodynamicForcesAndMoments;

  propellerStates: PropellerRotorAerodynamicState[];
  components: ComponentAerodynamicContribution[];

  regime: FlightRegimeType;
  regimeStatus: SupportStatus;

  solver: CFDSolverSettings;
  mesh: CFDMeshMetadata;
  boundaryConditions: CFDBoundaryConditions;
  convergence: {
    converged: boolean;
    iterations: number;
    finalContinuityResidual: number;
    finalMomentumResidual: number;
  };

  modelVersion: string;
  configurationId: string;
  evidenceId: string;
}

export interface AerodynamicPolarPoint {
  alphaDeg: number;
  betaDeg: number;
  velocityMps: number;
  CL: number;
  CD: number;
  CY: number;
  Cl: number;
  Cm: number;
  Cn: number;
  liftN: number;
  dragN: number;
  thrustReqN: number;
  powerReqW: number;
  liftToDragRatio: number;
}

export interface AerodynamicOutputsPackage {
  alphaSweepCL: AerodynamicPolarPoint[];
  alphaSweepCD: AerodynamicPolarPoint[];
  betaSweepCY: AerodynamicPolarPoint[];
  alphaSweepCm: AerodynamicPolarPoint[];
  betaSweepCl: AerodynamicPolarPoint[];
  betaSweepCn: AerodynamicPolarPoint[];
  velocitySweepLift: AerodynamicPolarPoint[];
  velocitySweepDrag: AerodynamicPolarPoint[];
  velocitySweepThrustReq: AerodynamicPolarPoint[];
  powerRequiredCurve: AerodynamicPolarPoint[];
  liftToDragRatioCurve: AerodynamicPolarPoint[];
}

export interface PhysicsValidationReport {
  passed: boolean;
  checks: {
    liftDirectionValid: boolean;
    dragDirectionValid: boolean;       // Drag > 0 for V > 0
    dynamicPressurePositive: boolean;  // q >= 0
    densityPhysical: boolean;          // rho > 0
    velocityConsistent: boolean;       // V = |V_vec|
    dimensionalConsistency: boolean;  // Forces [N] = Pa * m^2, Moments [N*m] = N * m
    coefficientBoundsValid: boolean;   // 0 <= CD <= 3.0, -2.0 <= CL <= 2.5
    forceBalanceValid: boolean;        // Rotor thrust = m*g + D_downwash in hover
    momentConsistencyValid: boolean;   // Moments calculated around CG
    conservationCheckValid: boolean;   // Residuals < tol
  };
  messages: string[];
}

export interface RequirementTraceabilityItem {
  requirementId: string;
  parameterName: string;
  geometryRevision: string;
  simulationId: string;
  targetValue: number | string;
  simulatedValue: number | string;
  units: string;
  verified: boolean;
  evidenceId: string;
}

export interface ReproducibilityAuditRecord {
  testName: string;
  parameter: string;
  expected: number;
  actual: number;
  difference: number;
  tolerance: number;
  verdict: 'PASS' | 'FAIL';
}
