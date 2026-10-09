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
}

export interface FEMElement {
  elementId: string;
  nodeIds: string[];
  materialId: string;
  sectionId: string;
  formulationId: string;
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
