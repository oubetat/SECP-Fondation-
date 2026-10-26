import { Matrix } from "./MathUtils";

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
  E: number; // Young's modulus
  nu: number; // Poisson's ratio
  density?: number;
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

export interface FEMModel {
  nodes: Map<string, FEMNode>;
  elements: Map<string, FEMElement>;
  materials: Map<string, FEMMaterial>;
  sections: Map<string, FEMSection>;
  loads: Load[];
  boundaryConditions: BoundaryCondition[];
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

