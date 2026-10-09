/**
 * PATCH-274: Topology Optimization Types
 * Defines data models for SIMP-based Real Topology Optimization, Non-Design Regions,
 * Density Fields, Iso-Surface Reconstruction, Independent Validation, and Evidence.
 */

export type NonDesignRegionType =
  | 'MOUNTING_FACE'
  | 'BOLT_HOLE'
  | 'BEARING_SEAT'
  | 'LOAD_SURFACE'
  | 'INTERFACE';

export interface NonDesignRegion {
  id: string;
  name: string;
  type: NonDesignRegionType;
  featureOrFaceId: string;
  volumeRatio: number; // Fraction of domain volume frozen at density = 1.0
  description: string;
}

export interface SIMPParameters {
  penalizationExponent: number; // p in E(ρ) = ρ^p * E0 (typically 3.0)
  minimumDensity: number; // ρ_min to avoid singular stiffness (typically 0.001)
  filterRadiusMm: number; // Minimum member size scale for density filtering
  targetVolumeFraction: number; // V_target / V_design (e.g. 0.35)
  maxIterations: number;
  convergenceTolerance: number; // Change in compliance or density norm
}

export interface TopologyElement {
  elementId: number;
  nodes: number[];
  centerCoordinates: [number, number, number]; // [x, y, z] in mm
  volumeM3: number;
  density: number; // Physical density ρ ∈ [ρ_min, 1.0]
  filteredDensity: number;
  isNonDesign: boolean;
  strainEnergy: number;
  sensitivity: number; // ∂C / ∂ρ_e
}

export interface TopologyMesh {
  nodes: Array<{ id: number; x: number; y: number; z: number }>;
  elements: TopologyElement[];
  totalDesignVolumeM3: number;
  elementCount: number;
}

export interface TopologyIterationSnapshot {
  iteration: number;
  complianceNm: number; // Strain energy C = u^T K u
  volumeFraction: number; // Current V(ρ) / V_design
  topologyChangeNorm: number; // ||ρ_new - ρ_old||_∞
  maxVonMisesStressPa: number;
  maxDisplacementMm: number;
  meanDensity: number;
  densityDistribution: {
    solidCount: number; // ρ > 0.9
    voidCount: number; // ρ < 0.1
    intermediateCount: number; // 0.1 <= ρ <= 0.9
  };
  isConverged: boolean;
}

export type ReconstructionStatus274 =
  | 'RAW_TOPOLOGY'
  | 'RECONSTRUCTED_SURFACE'
  | 'RECONSTRUCTED_SOLID'
  | 'B_REP_VALIDATED'
  | 'PARAMETRIC_RECONSTRUCTED'
  | 'RECONSTRUCTION_FAILED';

export interface ReconstructedCADResult274 {
  status: ReconstructionStatus274;
  isoDensityThreshold: number; // Density threshold for iso-surface extraction (e.g. 0.5)
  isWatertight: boolean;
  hasSelfIntersections: boolean;
  isNonManifold: boolean;
  volumeM3: number;
  reconstructedMassKg: number;
  interfaceDeviationMm: number;
  bRepEulerCharacteristic: number; // Topology invariant: V - E + F = 2 for solid sphere topology
  surfaceAreaM2: number;
}

export interface IndependentValidationResult274 {
  independentMeshElements: number;
  validatedComplianceNm: number;
  validatedMaxStressPa: number;
  validatedMaxDisplacementMm: number;
  validatedSafetyFactorFoS: number;
  validatedFailureIndex: number;
  complianceDegradationPct: number;
  stressDegradationPct: number;
  validationStatus: 'VALIDATED' | 'DEGRADED_PASS' | 'FAILED_VALIDATION';
}

export interface ManufacturabilityAssessment274 {
  minimumMemberSizeMm: number;
  manufacturabilityScore: number; // 0 to 10
  overhangAngleDeg: number;
  buildDirection: [number, number, number];
  additiveReady: boolean;
  machiningReady: boolean;
  recommendations: string[];
}

export interface TopologyOptimizationStudy {
  studyId: string;
  name: string;
  baselineModelId: string;
  designSpaceName: string;
  materialName: string;
  youngsModulusPa: number;
  poissonsRatio: number;
  densityKgM3: number;
  yieldStrengthPa: number;
  appliedForceN: number;
  nonDesignRegions: NonDesignRegion[];
  simp: SIMPParameters;
  mesh: TopologyMesh;
  baselineResults: {
    massKg: number;
    complianceNm: number;
    maxStressPa: number;
    maxDisplacementMm: number;
    safetyFactorFoS: number;
  };
  iterations: TopologyIterationSnapshot[];
  finalTopology: {
    finalComplianceNm: number;
    finalMassKg: number;
    massReductionPct: number;
    complianceChangePct: number;
    solidElementRatio: number;
    voidElementRatio: number;
    intermediateElementRatio: number;
  };
  reconstructedCAD: ReconstructedCADResult274;
  independentValidation: IndependentValidationResult274;
  manufacturability: ManufacturabilityAssessment274;
  evidence: {
    digitalCertificateSHA256: string;
    studyHash: string;
    reproducibleSeed: number;
    isDeterministic: boolean;
  };
  status:
    | 'COMPLETED'
    | 'MAX_ITERATIONS_REACHED'
    | 'NUMERICAL_FAILURE' | 'RECONSTRUCTION_FAILED'
    | 'INFEASIBLE';
}
