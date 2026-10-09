/**
 * SECP DRONE-001: End-to-End Industrial UAV Design & Engineering Proof Types
 * Classification: SECP Engineering Proof Case — Adversarial Integrated UAV Design
 */

export interface DroneVehicleRequirements {
  configuration: 'Quad-X';
  wheelbaseMm: number; // 650 mm
  maxTakeoffMassKg: number; // <= 2.50 kg
  nominalPayloadMassG: number; // 500 g
  adversarialPayloadMassG: number; // 700 g
  batteryMount: 'CENTRAL_REMOVABLE';
  armStructure: 'FOUR_IDENTICAL_REPLACEABLE';
  minPropClearanceMm: number; // 15 mm
  propulsion: {
    motorsCount: 4;
    minStaticThrustPerMotorKgf: number; // >= 1.60 kgf
    nominalContinuousThrustKgf: number; // >= 0.80 kgf
    minTotalMaxThrustKgf: number; // >= 6.40 kgf
    minThrustToWeightRatio: number; // >= 2.50
  };
}

export interface DroneMaterialDefinition {
  id: string;
  name: string;
  category: 'COMPOSITE' | 'ALUMINUM_ALLOY' | 'ALLOY_STEEL' | 'ENGINEERING_POLYMER';
  densityKgM3: number; // kg/m^3
  youngsModulusGpa: number; // GPa
  poissonsRatio: number;
  yieldStrengthMpa: number; // MPa
  ultimateStrengthMpa: number; // MPa
  allowableStressMpa: number; // MPa (with safety factor)
}

export interface DroneParametricParameters {
  wheelbase: number; // 650 mm
  armLength: number; // 265 mm
  upperPlateThickness: number; // 2.0 mm
  lowerPlateThickness: number; // 2.5 mm
  armThickness: number; // 4.0 mm
  armWidth: number; // 22.0 mm
  motorHolePatternPcd: number; // 19.0 mm (Pitch Circle Diameter)
  motorHoleCount: number; // 4 holes M3
  batteryPositionX: number; // 0.0 mm
  batteryPositionY: number; // 0.0 mm
  batteryPositionZ: number; // +12.0 mm
  payloadPositionX: number; // 0.0 mm
  payloadPositionY: number; // 0.0 mm
  payloadPositionZ: number; // -35.0 mm
  landingGearHeight: number; // 140.0 mm
  motorMountAngleDeg: number; // 0.0 deg (cant angle)
  payloadMountWidth: number; // 60.0 mm
  payloadMountLength: number; // 80.0 mm
  payloadMassG: number; // 500g default
}

export interface DroneComponentGeometry {
  componentId: string;
  name: string;
  material: DroneMaterialDefinition;
  volumeMm3: number;
  massG: number;
  cgMm: { x: number; y: number; z: number };
  boundingBoxMm: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
  topology: {
    vertices: number;
    edges: number;
    faces: number;
    eulerChi: number;
    isWatertight: boolean;
    isManifold: boolean;
  };
  persistentFaceIds: string[];
  persistentEdgeIds: string[];
}

export interface DroneAssemblyMate {
  mateId: string;
  type: 'COINCIDENT' | 'CONCENTRIC' | 'PARALLEL' | 'DISTANCE';
  partA: string;
  partB: string;
  targetFaceOrAxisA: string;
  targetFaceOrAxisB: string;
  residualErrorMm: number;
  status: 'SOLVED' | 'FAILED';
}

export interface DroneAssemblyState {
  components: DroneComponentGeometry[];
  mates: DroneAssemblyMate[];
  totalMassKg: number;
  centerOfGravityMm: { x: number; y: number; z: number };
  cgDistanceToGeometricCenterMm: number;
  inertiaTensorKgMm2: [
    [number, number, number],
    [number, number, number],
    [number, number, number]
  ];
  principalMomentsKgMm2: { Ixx: number; Iyy: number; Izz: number };
  principalAxes: { axisX: [number, number, number]; axisY: [number, number, number]; axisZ: [number, number, number] };
  propellerClearanceMm: {
    prop1MinClearance: number;
    prop2MinClearance: number;
    prop3MinClearance: number;
    prop4MinClearance: number;
    allClearancesMet: boolean;
  };
  interferenceCheck: {
    solidSolidCollisionsCount: number;
    collidingPairs: Array<{ part1: string; part2: string; overlapVolumeMm3: number }>;
    isInterferenceFree: boolean;
  };
  thrustToWeightRatio: number;
}

export interface PayloadShiftResult {
  payloadMassG: number;
  totalMassKg: number;
  cgLocationMm: { x: number; y: number; z: number };
  deltaZFrom0gMm: number;
  isStable: boolean;
}

export interface DroneFeaLoadCaseResult {
  loadCaseId: 'LC-01-HOVER' | 'LC-02-MAX-THRUST' | 'LC-03-VERTICAL-MANEUVER-3G' | 'LC-04-HARD-LANDING-8G' | 'LC-05-ASYMMETRIC-FAILURE' | 'LC-06-WORST-ARM-BENDING';
  name: string;
  appliedThrustN: number;
  appliedDecelG: number;
  appliedForcesBreakdown: Array<{ location: string; fx: number; fy: number; fz: number }>;
  staticEquilibriumResidualN: number;
  maxDisplacementMm: number;
  maxVonMisesStressMpa: number;
  criticalComponentId: string;
  allowableStressMpa: number;
  calculatedFoS: number;
  minRequiredFoS: number; // 1.50
  solverStatus: 'CONVERGED' | 'SINGULAR' | 'FAILED';
  stiffnessMatrixPositiveDefinite: boolean;
  hasNaNOrInf: boolean;
  pass: boolean;
}

export interface DroneCfdCaseResult {
  caseId: 'CFD-01-FORWARD-15MS' | 'CFD-02-FORWARD-25MS' | 'CFD-03-CROSSWIND-10MS' | 'CFD-04-HOVER-VERTICAL';
  name: string;
  freestreamVelocityMs: { u: number; v: number; w: number };
  totalDragForceN: number;
  totalLiftForceN: number;
  sideForceN: number;
  pitchingMomentNm: number;
  rollingMomentNm: number;
  yawingMomentNm: number;
  pressureCoeffRange: { minCp: number; maxCp: number };
  massConservationResidualKgS: number;
  momentumConservationResidualN: number;
  convergenceStatus: 'CONVERGED' | 'DIVERGED';
  pass: boolean;
}

export interface DroneCamToolpathResult {
  componentId: 'MOTOR_MOUNT_ALU6061';
  stockDimensionsMm: { x: number; y: number; z: number };
  operations: Array<{
    opNumber: number;
    type: 'FACING' | 'POCKETING' | 'DRILLING_M3' | 'CONTOURING' | 'FINISHING';
    toolDiameterMm: number;
    feedrateMmMin: number;
    spindleRpm: number;
    cuttingTimeSec: number;
    gougeClearanceMm: number;
  }>;
  totalCycleTimeSec: number;
  gcodeLineCount: number;
  gcodeSample: string[];
  gougesDetectedCount: number;
  toolHolderCollisionsCount: number;
  axisLimitsViolationsCount: number;
  isManufacturable: boolean;
  pass: boolean;
}

export interface DroneManufacturingExportResult {
  stepAp214: {
    entityCount: number;
    fileSizeBytes: number;
    schemaConformant: boolean;
    losslessRoundTrip: boolean;
  };
  vtkMesh: {
    unstructuredCellsCount: number;
    pointDataFields: string[];
    cellDataFields: string[];
    isConformant: boolean;
  };
  gcodeNc: {
    linesTotal: number;
    checksumSha256: string;
    isParsable: boolean;
  };
}

export interface DroneIndependentVerificationReport {
  geometryIntegrity: {
    watertightManifoldProven: boolean;
    eulerCharacteristicsVerified: boolean;
    analyticalVolumeMatchesBRep: boolean;
  };
  assemblyIntegrity: {
    zeroInterferenceProven: boolean;
    allMatesResidualBelowTolerance: boolean;
    propClearanceVerified: boolean;
  };
  massIntegrity: {
    divergenceSurfaceIntegralMatchesSum: boolean;
    cgIndependentDivergenceVerified: boolean;
  };
  feaIntegrity: {
    independentGlobalEquilibriumVerified: boolean;
    independentStrainEnergyBalanceVerified: boolean;
  };
  cfdIntegrity: {
    massFluxBalanceVerified: boolean;
    momentumResidualVerified: boolean;
  };
  camIntegrity: {
    clPointSweptVolumeGougeFree: boolean;
  };
  interopIntegrity: {
    stepAstGrammarCompliant: boolean;
  };
  allIndependentVerificationsPassed: boolean;
}

export interface DroneFailureInjectionScenario {
  scenarioId: 'FI-01' | 'FI-02' | 'FI-03' | 'FI-04' | 'FI-05' | 'FI-06' | 'FI-07' | 'FI-08';
  defectDescription: string;
  expectedVerdict: 'REJECTED' | 'UNPROVEN' | 'EVIDENCE_MISMATCH';
  injectedArtifactType: string;
  auditDetectionResult: {
    detected: boolean;
    rejectionReason: string;
    verdictFlippedToRejected: boolean;
  };
}

export interface DroneDeterminismProofRun {
  runIndex: 1 | 2 | 3;
  canonicalInputDigest: string;
  geometryResultDigest: string;
  massPropertiesDigest: string;
  assemblyStateDigest: string;
  feaResultDigest: string;
  cfdResultDigest: string;
  camResultDigest: string;
  evidencePackageDigest: string;
}

export interface Drone001EvidenceChainNode {
  nodeId: string;
  stage: 'REQUIREMENTS' | 'PARAMETERS' | 'CAD' | 'TOPOLOGY' | 'ASSEMBLY' | 'MATERIALS' | 'MASS_PROPERTIES' | 'LOADS' | 'FEA' | 'CFD' | 'DESIGN_ITERATION' | 'CAM' | 'EXPORT' | 'INDEPENDENT_VERIFICATION' | 'EVIDENCE' | 'CRYPTOGRAPHIC_INTEGRITY';
  source: string;
  operation: string;
  resultSummary: string;
  verifier: string;
  metric: string;
  timestamp: string;
  deterministicDigest: string;
  provenance: string;
}

export type Drone001FinalVerdict =
  | 'DRONE-001 — FULLY PROVEN (CANONICAL ENGINEERING CLOSURE)'
  | 'DRONE-001 — PARTIALLY PROVEN'
  | 'DRONE-001 — NOT PROVEN'
  | 'DRONE-001 — CRITICAL FAILURE';

export interface Drone001ComprehensiveProofPackage {
  requirements: DroneVehicleRequirements;
  parameters: DroneParametricParameters;
  materials: DroneMaterialDefinition[];
  nominalAssembly: DroneAssemblyState;
  parametricRegeneration700g: {
    previousMassKg: number;
    newMassKg: number;
    topologyValid: boolean;
    orphanedReferencesCount: number;
    brokenBindingsCount: number;
  };
  payloadShiftTable: PayloadShiftResult[];
  feaResults: DroneFeaLoadCaseResult[];
  cfdResults: DroneCfdCaseResult[];
  camResults: DroneCamToolpathResult;
  manufacturingExport: DroneManufacturingExportResult;
  adversarialIterations: {
    defectD01ArmThicknessReduction20Pct: {
      reducedThicknessMm: number;
      nominalMaxStressMpa: number;
      reducedMaxStressMpa: number;
      calculatedFoS: number;
      violatesSafetyFactor: boolean; // if FoS < 1.50 -> VIOLATION DETECTED
      detectionStatus: 'DETECTED_AND_EVALUATED_CORRECTLY';
    };
    adversarialBatteryShift40Mm: {
      nominalCgMm: { x: number; y: number; z: number };
      shiftedCgMm: { x: number; y: number; z: number };
      cgShiftDeltaXMm: number;
      motorLoadsDistributionN: [number, number, number, number];
      asymmetryDetected: boolean;
      violatesMaxCgEnvelope: boolean;
    };
    topologyMotorHolePatternChange: {
      oldPcdMm: number;
      newPcdMm: number;
      dependentFeaturesRegenerated: boolean;
      staleReferencesCount: number;
      assemblyMatesUpdated: boolean;
    };
  };
  independentVerification: DroneIndependentVerificationReport;
  failureInjectionResults: DroneFailureInjectionScenario[];
  determinismProof: {
    runs: [DroneDeterminismProofRun, DroneDeterminismProofRun, DroneDeterminismProofRun];
    bitForBitIdentical: boolean;
  };
  evidenceChain: Drone001EvidenceChainNode[];
  merkleRootHash: string;
  finalVerdict: Drone001FinalVerdict;
  certificationStatement: string;
}
