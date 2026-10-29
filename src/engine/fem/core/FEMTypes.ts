import { Matrix } from "./MathUtils";
import { SpatialMaterialField } from "./SpatialMaterialField";
import { CoordinateFrameContract, GeometryMaterialAssignment } from "./GeometryMaterialAssignment";
import { ManufacturingConstraintProfile } from "./ManufacturingConstraintEngine";

export enum DOFComponent {
  UX = "UX",
  UY = "UY",
  UZ = "UZ",
  RX = "RX",
  RY = "RY",
  RZ = "RZ",
}

export interface FEMNode {
  nodeId: string;
  x: number;
  y: number;
  z: number;
}

export interface FEMMaterial {
  materialId: string;
  E: number; // Young's modulus [MPa]
  nu: number; // Poisson's ratio
  density?: number;
  yieldStress?: number; // [MPa]
  tangentModulus?: number; // [MPa] (Hardening H)
  alphaE?: number; // Temperature coeff for E [1/K]
  alphaY?: number; // Temperature coeff for yield [1/K]
  thermalExpansionCoeff?: number; // [1/K]
  refTempC?: number; // [C]
  // Fatigue & Damage Parameters (EXPANSION-007)
  fatigueParams?: {
    uts: number; // Ultimate Tensile Strength [MPa]
    sf_prime?: number; // Fatigue strength coefficient [MPa]
    b?: number; // Fatigue strength exponent
    enduranceLimit?: number; // [MPa]
    ductilityExponent?: number; // c
    ductilityCoeff?: number; // eps_f_prime
  };
}

export interface FEMSection {
  sectionId: string;
  area?: number;
  thickness?: number;
  I?: number; // Moment of inertia Izz
  iy?: number; // Distance from neutral axis to extreme fiber y_max
  depth?: number; // Section depth
}

export interface FEMElement {
  elementId: string;
  nodeIds: string[];
  materialId: string;
  sectionId: string;
  formulationId: string;
  distributedLoad?: number; // Transverse uniform distributed load w (N/mm or N/m)
  spatialFieldId?: string;
  assignmentId?: string;
}

export interface Load {
  nodeId: string;
  dof: DOFComponent;
  value: number;
}

export interface BoundaryCondition {
  nodeId: string;
  dof: DOFComponent;
  value: number;
}

import { AsBuiltMaterialState } from "./AsBuiltMaterialStateEngine";
import { SpatialMaterialDeviationResult } from "./SpatialMaterialDeviationEngine";
import { MaterialTruthThread } from "./MaterialTruthThreadEngine";

export interface FEMModel {
  nodes: Map<string, FEMNode>;
  elements: Map<string, FEMElement>;
  materials: Map<string, FEMMaterial>;
  sections: Map<string, FEMSection>;
  loads: Load[];
  boundaryConditions: BoundaryCondition[];
  spatialMaterialFields?: Map<string, SpatialMaterialField>;
  materialAssignments?: Map<string, GeometryMaterialAssignment>;
  manufacturingProfile?: ManufacturingConstraintProfile;
  asBuiltState?: AsBuiltMaterialState;
  deviationResult?: SpatialMaterialDeviationResult;
  truthThread?: MaterialTruthThread;
  geometryMetadata?: {
    geometryId: string;
    geometryRevision: string;
    coordinateFrame?: CoordinateFrameContract;
  };
  nodalTemperatures?: Map<string, number>; // [C]
}

export interface DOF {
  globalId: number;
  nodeId: string;
  component: DOFComponent;
}

export interface ElementMatrixResult {
  Ke: Matrix;
  Fe: number[];
  globalDOFs: number[];
}

export interface ShapeFunctionResult {
  N: number[];
  dN_dxi: Matrix; // derivatives w.r.t local coordinates
}

export interface IntegrationPointResult {
  pointIndex: number;
  xi: number;
  eta: number;
  weight: number;
  physicalLocation: { x: number; y: number; z?: number };
  strain: {
    epsilon_x: number;
    epsilon_y: number;
    gamma_xy: number;
    epsilon_z?: number;
    gamma_yz?: number;
    gamma_xz?: number;
  };
  stress: {
    sigma_x: number;
    sigma_y: number;
    tau_xy: number;
    sigma_z?: number;
    tau_yz?: number;
    tau_xz?: number;
  };
  vonMisesStress: number;
}

export interface ElementStressStrainResult {
  elementId: string;
  formulationId: string;
  strain: {
    epsilon_x: number;
    epsilon_y?: number;
    gamma_xy?: number;
    epsilon_z?: number;
    gamma_yz?: number;
    gamma_xz?: number;
  };
  stress: {
    sigma_x: number;
    sigma_y?: number;
    tau_xy?: number;
    sigma_z?: number;
    tau_yz?: number;
    tau_xz?: number;
    sigma_axial?: number;
    sigma_bending?: number;
  };
  internalForces?: {
    N?: number; // Axial force
    V1?: number; // Shear force at node 1
    V2?: number; // Shear force at node 2
    M1?: number; // Bending moment at node 1
    M2?: number; // Bending moment at node 2
    M_mid?: number; // Bending moment at midspan
  };
  nodalDisplacementsLocal?: {
    u1_local: number;
    v1_local: number;
    theta1_local: number;
    u2_local: number;
    v2_local: number;
    theta2_local: number;
  };
  integrationPoints?: IntegrationPointResult[];
  vonMisesStress: number;
  principalStresses?: {
    sigma_1: number;
    sigma_2: number;
    sigma_3?: number;
  };
  strainEnergy: number;
  location: 'CENTROID' | 'ELEMENT_ENDS' | 'INTEGRATION_POINTS';
  units: {
    strain: 'dimensionless';
    stress: 'MPa' | 'Pa';
    strainEnergy: 'J' | 'N*mm';
  };
}

export interface NodalStressResult {
  nodeId: string;
  connectedElementsCount: number;
  stress: {
    sigma_x: number;
    sigma_y?: number;
    tau_xy?: number;
    sigma_z?: number;
    tau_yz?: number;
    tau_xz?: number;
  };
  vonMisesStress: number;
  stressDiscontinuity: number; // Inter-element stress standard deviation / jump
  location: 'NODAL';
  units: {
    stress: 'MPa' | 'Pa';
  };
}

export interface IntegrationPointState {
  stress: number[]; // Voigt notation
  plasticStrain: number[]; // Voigt notation
  equivalentPlasticStrain: number;
  yieldStress: number;
  totalStrain?: number[]; // To support incremental updates
  // Damage & Fatigue State (EXPANSION-007)
  damage?: number; // D in [0, 1]
  accumulatedCycles?: number;
}

export interface MaterialState {
  elementStates: Map<string, IntegrationPointState[]>;
}

export interface StructuralFieldRecovery {
  elementFields: Map<string, ElementStressStrainResult>;
  nodalFields: Map<string, NodalStressResult>;
  maxVonMisesStress: number;
  maxVonMisesElementId: string;
  maxVonMisesNodeId: string;
  totalStrainEnergy: number;
  recoveryStatus: 'CONVERGED_AND_VERIFIED' | 'FAILED';
}

