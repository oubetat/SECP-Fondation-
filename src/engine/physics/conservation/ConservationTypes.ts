/**
 * SECP Industrial OS v2 — Conservation Types
 * PATCH-050: Conservation Framework
 */

export type SystemType = "CLOSED_SYSTEM" | "OPEN_SYSTEM" | "CONTROL_VOLUME" | "DOMAIN_BALANCE";
export type AnalysisType = "STEADY" | "TRANSIENT";

export type ConservationVerdict = "PASS" | "FAIL" | "UNPROVEN" | "INCONCLUSIVE" | "INVALID";

export type MassDomainVerdict = 
  | "MASS_CONVERGED" 
  | "MASS_NOT_CONVERGED" 
  | "MASS_CONSERVATION_FAILURE" 
  | "MASS_INVALID" 
  | "MASS_UNPROVEN";

export type MomentumDomainVerdict = 
  | "MOMENTUM_CONVERGED" 
  | "MOMENTUM_NOT_CONVERGED" 
  | "MOMENTUM_CONSERVATION_FAILURE" 
  | "MOMENTUM_INVALID" 
  | "MOMENTUM_UNPROVEN";

export type EnergyDomainVerdict = 
  | "ENERGY_CONVERGED" 
  | "ENERGY_NOT_CONVERGED" 
  | "ENERGY_CONSERVATION_FAILURE" 
  | "ENERGY_INVALID" 
  | "ENERGY_UNPROVEN";

export type NormalizationMethod = "INLET_FLUX" | "TOTAL_CAPACITY" | "REFERENCE_VALUE" | "NONE";

export interface ToleranceConfig {
  absoluteTolerance: number;
  relativeTolerance: number;
  normalizationMethod: NormalizationMethod;
  referenceValue?: number;
}

export interface BoundaryFluxValue {
  boundaryId: string;
  value: number;
  unit: string;
}

export interface BoundaryVectorFluxValue {
  boundaryId: string;
  x: number;
  y: number;
  z: number;
  unit: string;
}

export interface SourceTermValue {
  sourceId: string;
  value: number;
  unit: string;
}

export interface SourceVectorTermValue {
  sourceId: string;
  x: number;
  y: number;
  z: number;
  unit: string;
}

export interface MassFluxData {
  inletMassFlows?: BoundaryFluxValue[];
  outletMassFlows?: BoundaryFluxValue[];
  massSources?: SourceTermValue[];
  transientStorageRate?: { value: number; unit: string }; // d/dt ∫ρ dV
}

export interface MomentumFluxData {
  convectiveFluxesIn?: BoundaryVectorFluxValue[];
  convectiveFluxesOut?: BoundaryVectorFluxValue[];
  surfaceForces?: BoundaryVectorFluxValue[]; // Pressure and shear forces
  bodyForces?: SourceVectorTermValue[]; // Gravity, Centrifugal
  momentumSources?: SourceVectorTermValue[];
  transientStorageRate?: { x: number; y: number; z: number; unit: string }; // d/dt ∫ρu dV
}

export interface EnergyFluxData {
  convectiveEnergyIn?: BoundaryFluxValue[];
  convectiveEnergyOut?: BoundaryFluxValue[];
  conductiveHeatFluxIn?: BoundaryFluxValue[];
  conductiveHeatFluxOut?: BoundaryFluxValue[];
  workOrPressurePower?: BoundaryFluxValue[];
  volumetricSources?: SourceTermValue[];
  transientStorageRate?: { value: number; unit: string }; // d/dt ∫ρ e dV
  declaredZeroTerms?: string[]; // Terms explicitly declared as physically zero
}

export interface ConservationContract {
  caseId: string;
  solverId: string;
  solverVersion: string;
  meshId: string;
  meshVersion: string;
  physicsModel: string;
  systemType: SystemType;
  analysisType: AnalysisType;
  massData?: MassFluxData;
  momentumData?: MomentumFluxData;
  energyData?: EnergyFluxData;
  toleranceConfig: ToleranceConfig;
}

export interface DomainBalanceTerms {
  totalIn: number;
  totalOut: number;
  totalStorage: number;
  totalSource: number;
  absoluteImbalance: number;
  relativeImbalance: number;
  unit: string;
}

export interface MomentumComponentTerms {
  x: DomainBalanceTerms;
  y: DomainBalanceTerms;
  z: DomainBalanceTerms;
  vectorNormImbalance: number;
}

export interface MassConservationResult {
  verdict: MassDomainVerdict;
  balanceTerms?: DomainBalanceTerms;
  diagnostics: string[];
}

export interface MomentumConservationResult {
  verdict: MomentumDomainVerdict;
  componentTerms?: MomentumComponentTerms;
  diagnostics: string[];
}

export interface EnergyConservationResult {
  verdict: EnergyDomainVerdict;
  balanceTerms?: DomainBalanceTerms;
  availableTerms: string[];
  missingTerms: string[];
  diagnostics: string[];
}

export interface ConservationResult {
  caseId: string;
  solverId: string;
  solverVersion: string;
  meshId: string;
  systemType: SystemType;
  analysisType: AnalysisType;
  massResult: MassConservationResult;
  momentumResult: MomentumConservationResult;
  energyResult: EnergyConservationResult;
  overallVerdict: ConservationVerdict;
  diagnostics: string[];
  inputHash: string;
  resultHash: string;
  timestamp: string;
}
