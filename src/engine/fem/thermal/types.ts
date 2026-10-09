export enum TemperatureUnit {
  KELVIN = 'K',
  CELSIUS = '°C',
  FAHRENHEIT = '°F'
}

export interface ThermalMaterialProps {
  conductivity: number; // k [W/(m·K)]
  density: number;      // rho [kg/m³]
  specificHeat: number; // cp [J/(kg·K)]
}

export interface ThermalBoundaryCondition {
  type: 'DIRICHLET' | 'NEUMANN' | 'ROBIN';
  nodeIds?: string[];
  faceIds?: string[];
  value: number; // T_prescribed, q_flux, or h_convection
  ambientTemperature?: number; // For Robin/Convection
}

export interface ThermalField {
  id: string;
  temperatures: Map<string, number>; // nodeId -> temperature in Kelvin
  time: number;
}

export enum ThermalVerdict {
  CONVERGED = 'CONVERGED',
  NOT_CONVERGED = 'NOT_CONVERGED',
  ENERGY_BALANCE_FAILURE = 'ENERGY_BALANCE_FAILURE',
  INVALID_MATERIAL = 'INVALID_MATERIAL',
  INVALID_BOUNDARY_CONDITION = 'INVALID_BOUNDARY_CONDITION',
  NUMERICAL_FAILURE = 'NUMERICAL_FAILURE',
  VERIFIED = 'VERIFIED'
}

export interface ThermalEnergyBalance {
  qIn: number;
  qOut: number;
  qGen: number;
  internalEnergyChange: number;
  imbalance: number;
  relativeImbalance: number;
}
