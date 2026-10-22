/**
 * SECP Industrial OS — Engineering Truth OS
 * SECP-ENGINE-STRENGTHENING-001C
 * Electrothermal Coupling Contract & Data Specifications
 *
 * Defines the bidirectional mapping between CircuitModel electrical elements
 * and PcbThermalBoardConfig spatial thermal elements.
 */

export type ThermalFeedbackTarget = 'JUNCTION' | 'CASE' | 'BOARD';

export interface ComponentElectrothermalProperty {
  refDes: string; // Must match CircuitComponent.id and ComponentThermalSpec.refDes
  nominalResistanceOhms: number; // R_0 measured at reference temperature T_ref
  tempCoefficientAlpha: number; // Linear temperature coefficient alpha (1/K or 1/°C), e.g. 0.00393 for Cu
  referenceTempC: number; // T_ref, typically 25.0 °C
  feedbackTarget: ThermalFeedbackTarget; // Which temperature drives electrical resistance change
  diodeSaturationIs0?: number; // Saturation current at T_ref
  diodeEmissionFactor?: number; // Diode ideality factor n
  bandgapEnergyEV?: number; // Energy bandgap, e.g. 1.11 eV for Silicon
  maxRatedTemperatureC?: number; // Thermal limit for de-rating checks
}

export interface ElectrothermalConvergenceOptions {
  maxIterations: number; // Maximum co-simulation iterations (default: 50)
  temperatureToleranceK: number; // Delta T convergence threshold in Kelvin (default: 1e-3)
  resistanceToleranceRatio: number; // Relative resistance change |delta R| / R (default: 1e-4)
  voltageToleranceV?: number; // Node voltage convergence threshold in Volts (default: 1e-4)
  relaxationTheta: number; // Under-relaxation parameter in (0.0, 1.0] (default: 0.7)
  energyConservationToleranceRatio: number; // Maximum allowable relative energy mismatch (default: 1e-3)
}

export interface ElectrothermalCouplingContract {
  contractId: string;
  version: string;
  components: ComponentElectrothermalProperty[];
  options: ElectrothermalConvergenceOptions;
}

export const DEFAULT_ELECTROTHERMAL_OPTIONS: ElectrothermalConvergenceOptions = {
  maxIterations: 50,
  temperatureToleranceK: 1e-3, // 0.001 K
  resistanceToleranceRatio: 1e-4, // 0.01%
  voltageToleranceV: 1e-4,
  relaxationTheta: 0.7, // Damped Picard iteration
  energyConservationToleranceRatio: 1e-3 // 0.1% energy conservation
};
