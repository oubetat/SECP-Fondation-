/**
 * PATCH-SECP-077: 3D Solid Multiphysics Types & Mathematical Formulations
 * Defines data structures for 3D solid continuum elements (TET4, TET10, HEX8),
 * 3D isotropic material properties, modal eigenpairs, steady-state thermal fields,
 * and thermo-mechanical coupled states.
 */

export type Solid3DElementType = 'TET4' | 'TET10' | 'HEX8';

export interface Solid3DNode {
  id: number;
  x: number;
  y: number;
  z: number;
}

export interface Solid3DElement {
  id: number;
  type: Solid3DElementType;
  nodeIds: number[];
  materialId: string;
}

export interface Solid3DMaterial {
  id: string;
  name: string;
  E: number;        // Young's Modulus (Pa)
  nu: number;       // Poisson's Ratio (dimensionless)
  rho: number;      // Density (kg/m^3)
  alpha: number;    // Coefficient of Thermal Expansion (1/K)
  k: number;        // Thermal Conductivity (W/(m*K))
}

export interface Solid3DBC {
  nodeId: number;
  fixX?: boolean;
  fixY?: boolean;
  fixZ?: boolean;
  prescribedUx?: number;
  prescribedUy?: number;
  prescribedUz?: number;
}

export interface Solid3DLoad {
  nodeId: number;
  fx: number;
  fy: number;
  fz: number;
}

export interface Solid3DThermalBC {
  nodeId: number;
  prescribedT: number; // Kelvin or Celsius
}

export interface Solid3DHeatFluxLoad {
  nodeId: number;
  heatFlux: number; // Watts
}

export interface Solid3DStaticResult {
  displacements: { nodeId: number; ux: number; uy: number; uz: number }[];
  strains: { elementId: number; exx: number; eyy: number; ezz: number; exy: number; eyz: number; exz: number }[];
  stresses: { elementId: number; sxx: number; syy: number; szz: number; sxy: number; syz: number; sxz: number; vonMises: number }[];
  strainEnergy: number;
  residualNorm: number;
  relativeResidual: number;
  uGlobal: number[];
  isValid: boolean;
}

export interface Solid3DModalEigenpair {
  modeIndex: number;
  eigenvalue: number;        // lambda = omega^2
  angularFrequency: number;  // omega (rad/s)
  naturalFrequency: number;  // f (Hz)
  modeShape: number[];       // Eigenvector phi
  eigenpairResidual: number; // ||K phi - lambda M phi|| / (||K phi|| + lambda ||M phi||)
  modalMass: number;         // phi^T M phi (should be ~1.0 if normalized)
  isOrthogonal: boolean;
}

export interface Solid3DModalResult {
  modes: Solid3DModalEigenpair[];
  totalModesFound: number;
  isDeterministic: boolean;
  maxEigenResidual: number;
}

export interface Solid3DThermalResult {
  temperatures: { nodeId: number; temperature: number }[];
  tVector: number[];
  thermalResidualNorm: number;
  relativeThermalResidual: number;
  minTemperature: number;
  maxTemperature: number;
  totalHeatInput: number;
  heatBalanceResidual: number;
}

export interface Solid3DThermoMechanicalResult {
  thermalField: Solid3DThermalResult;
  staticResult: Solid3DStaticResult;
  thermalForces: number[];
  thermalStrains: { elementId: number; eth_xx: number; eth_yy: number; eth_zz: number }[];
  mechanicalStresses: { elementId: number; vonMises: number }[];
  coupledEnergy: number;
  energyConsistent: boolean;
}
