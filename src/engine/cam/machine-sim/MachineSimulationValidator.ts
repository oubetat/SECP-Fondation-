/**
 * SECP Industrial OS - PATCH-264: Machine Simulation Engine
 * Machine Simulation Validator: Input Verification & Pre-flight Integrity Audits
 */

import { MachineSimulationInput, SimulationVerdict } from './MachineSimulationTypes';

export interface PreflightAuditResult {
  valid: boolean;
  verdict?: SimulationVerdict;
  message: string;
  errors: string[];
  warnings: string[];
}

export class MachineSimulationValidator {
  public static validateInput(input: MachineSimulationInput): PreflightAuditResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Check G-Code Verification Status from PATCH-263
    if (input.gcodeVerification) {
      if (input.gcodeVerification.verdict === 'FAILED') {
        if (!input.diagnosticMode) {
          return {
            valid: false,
            verdict: 'MACHINE_SIMULATION_BLOCKED',
            message: 'Machine Simulation Blocked: PATCH-263 G-Code Verification failed. Fix NC program errors or run in explicit Diagnostic Mode.',
            errors: ['G-Code Verification Gate reported FAILED status'],
            warnings,
          };
        } else {
          warnings.push('Operating in DIAGNOSTIC MODE following G-Code verification failure.');
        }
      }
    }

    // 2. Validate NC Program Content
    if (!input.ncProgram || input.ncProgram.trim().length === 0) {
      errors.push('NC Program is empty.');
    }

    // 3. Validate Machine Definition
    if (!input.machine || !input.machine.axes || input.machine.axes.length < 3) {
      errors.push('Invalid Machine Definition: Machine must define at least 3 kinematic axes (X, Y, Z).');
    }

    // 4. Validate Stock Definition
    if (!input.stock || !input.stock.dimensions || input.stock.dimensions.x <= 0) {
      errors.push('Invalid Stock Model: Stock dimensions must be strictly positive.');
    }

    // 5. Validate Fixture
    if (!input.fixture) {
      warnings.push('No fixture model specified: Running with virtual un-clamped workholding.');
    }

    // 6. Validate Simulation Resolution Safety
    const tol = input.tolerances;
    if (tol && tol.maxSamplingStepMm && tol.maxSamplingStepMm > 50.0) {
      return {
        valid: false,
        verdict: 'UNVERIFIED',
        message: 'Simulation resolution is too coarse (> 50mm) to guarantee collision-free execution.',
        errors: ['Insufficient simulation sampling resolution'],
        warnings,
      };
    }

    return {
      valid: errors.length === 0,
      verdict: errors.length === 0 ? undefined : 'SIMULATION_FAILED',
      message: errors.length === 0 ? 'Preflight checks passed successfully.' : 'Preflight validation failed.',
      errors,
      warnings,
    };
  }
}
