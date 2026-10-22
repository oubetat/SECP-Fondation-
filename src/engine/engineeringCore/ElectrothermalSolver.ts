/**
 * SECP Industrial OS — Engineering Truth OS
 * SECP-ENGINE-STRENGTHENING-001C
 * Electrothermal Coupling Solver — Iterative Electrical/Thermal Co-Simulation
 *
 * Implements bi-directional, relaxed fixed-point Picard iteration between:
 * 1. NodalCircuitSolver (MNA / Nonlinear Newton-Raphson electrical engine)
 * 2. SpatialThermalSolver (2D finite volume multilayer PCB thermal engine)
 *
 * Governing Relations:
 * - Electrical: [G(T)] {V} = {I_s(T)} -> P_i = I_i * V_i
 * - Thermal: [K_th] {T} = {Q_eff(P)} -> T_surf(x, y), T_case, T_junction
 * - Feedback: R_i(T) = R_{0,i} * [1 + \alpha_i * (T_i - T_{ref})]
 * - Diode Thermal: V_t = k_B * T / q, I_s(T)
 * - Energy Conservation: \sum P_elec = \sum Q_out (within <= 0.1%)
 */

import { createHash } from 'crypto';
import { CircuitModel, CircuitComponent, computeCircuitCanonicalHash } from './ReferenceCircuitModel';
import { NodalCircuitSolver, NodalSolveResult } from './NodalCircuitSolver';
import { PcbThermalBoardConfig, ComponentThermalSpec } from './PcbThermalModel';
import { SpatialThermalSolver, SpatialThermalFieldResult } from './SpatialThermalSolver';
import {
  ElectrothermalCouplingContract,
  ComponentElectrothermalProperty,
  DEFAULT_ELECTROTHERMAL_OPTIONS,
  ElectrothermalConvergenceOptions
} from './ElectrothermalCouplingContract';

export interface ElectrothermalIterationRecord {
  iteration: number;
  maxTemperatureDeltaK: number;
  maxResistanceDeltaRel: number;
  totalElectricalPowerWatts: number;
  totalThermalHeatWatts: number;
  energyImbalanceRatio: number;
  componentStates: {
    refDes: string;
    resistanceOhms: number;
    voltageVolts: number;
    currentAmps: number;
    powerWatts: number;
    temperatureC: number;
  }[];
}

export interface ElectrothermalSolveResult {
  status:
    | 'CONVERGED'
    | 'NON_CONVERGED'
    | 'ELECTRICAL_DIVERGENCE'
    | 'THERMAL_DIVERGENCE'
    | 'THERMAL_RUNAWAY'
    | 'SINGULAR_MATRIX'
    | 'INVALID_INPUT';
  success: boolean;
  totalIterations: number;
  finalTemperatureResidualK: number;
  finalResistanceResidualRel: number;
  energyImbalanceRatio: number;
  energyConserved: boolean;
  circuitResult: NodalSolveResult;
  thermalFieldResult: SpatialThermalFieldResult;
  iterationHistory: ElectrothermalIterationRecord[];
  componentCouplingResults: {
    refDes: string;
    nominalResistanceOhms: number;
    convergedResistanceOhms: number;
    resistanceShiftPercent: number;
    convergedPowerWatts: number;
    convergedTemperatureC: number;
    temperatureRiseK: number;
    marginC: number;
    isOverstressed: boolean;
  }[];
  canonicalHash: string;
  diagnostics: string[];
}

export interface AnalyticalSelfHeatingBenchmarkResult {
  nominalResistanceOhms: number;
  ambientTempC: number;
  referenceTempC: number;
  appliedVoltageVolts: number;
  thermalResistanceCW: number;
  tempCoefficientAlpha: number;
  analyticalDeltaTC: number;
  analyticalTempC: number;
  analyticalResistanceOhms: number;
  analyticalPowerWatts: number;
  analyticalCurrentAmps: number;
}

export class ElectrothermalSolver {
  /**
   * Performs rigorous iterative electrothermal co-simulation with under-relaxation.
   */
  public static solve(
    baseCircuit: CircuitModel,
    baseThermalBoard: PcbThermalBoardConfig,
    contract: ElectrothermalCouplingContract
  ): ElectrothermalSolveResult {
    const diagnostics: string[] = [];
    const options: ElectrothermalConvergenceOptions = {
      ...DEFAULT_ELECTROTHERMAL_OPTIONS,
      ...(contract.options || {})
    };

    // 1. Validate inputs and contracts
    if (!baseCircuit || !Array.isArray(baseCircuit.components) || baseCircuit.components.length === 0) {
      return this.buildFailureResult('INVALID_INPUT', ['Invalid circuit: no components found.'], diagnostics);
    }
    if (!baseThermalBoard || !Array.isArray(baseThermalBoard.components)) {
      return this.buildFailureResult('INVALID_INPUT', ['Invalid thermal board: no thermal components found.'], diagnostics);
    }
    if (!contract || !Array.isArray(contract.components) || contract.components.length === 0) {
      return this.buildFailureResult('INVALID_INPUT', ['Invalid contract: no coupled component mappings defined.'], diagnostics);
    }

    // Build fast lookup maps
    const coupledPropsMap = new Map<string, ComponentElectrothermalProperty>();
    for (const c of contract.components) {
      if (coupledPropsMap.has(c.refDes)) {
        return this.buildFailureResult('INVALID_INPUT', [`Duplicate component mapping for ${c.refDes}`], diagnostics);
      }
      coupledPropsMap.set(c.refDes, c);
    }

    // Ensure mapped components exist in both models
    for (const [refDes] of coupledPropsMap.entries()) {
      const circComp = baseCircuit.components.find(c => c.id === refDes);
      if (!circComp) {
        return this.buildFailureResult('INVALID_INPUT', [`Coupled component ${refDes} not found in circuit model.`], diagnostics);
      }
      const thermComp = baseThermalBoard.components.find(c => c.refDes === refDes);
      if (!thermComp) {
        return this.buildFailureResult('INVALID_INPUT', [`Coupled component ${refDes} not found in thermal board model.`], diagnostics);
      }
    }

    // Clone working copies of models to guarantee non-mutation of originals
    const currentCircuit: CircuitModel = {
      ...baseCircuit,
      components: baseCircuit.components.map(c => ({ ...c, nodes: [c.nodes[0], c.nodes[1]] }))
    };

    const currentThermalBoard: PcbThermalBoardConfig = {
      ...baseThermalBoard,
      layers: baseThermalBoard.layers.map(l => ({ ...l })),
      components: baseThermalBoard.components.map(c => ({ ...c })),
      prescribedTemperatures: baseThermalBoard.prescribedTemperatures
        ? baseThermalBoard.prescribedTemperatures.map(p => ({ ...p }))
        : undefined
    };

    // State tracking across iterations
    const currentTempsC = new Map<string, number>();
    const currentResistances = new Map<string, number>();
    const currentPowers = new Map<string, number>();

    // Initialize with ambient temperature
    const ambientT = baseThermalBoard.ambientTemperatureC ?? 25.0;
    for (const [refDes, prop] of coupledPropsMap.entries()) {
      currentTempsC.set(refDes, ambientT);
      currentResistances.set(refDes, prop.nominalResistanceOhms);
      currentPowers.set(refDes, 0.0);
    }

    const iterationHistory: ElectrothermalIterationRecord[] = [];
    let lastCircuitResult: NodalSolveResult | null = null;
    let lastThermalResult: SpatialThermalFieldResult | null = null;
    let converged = false;
    let finalTempDeltaK = Infinity;
    let finalResDeltaRel = Infinity;
    let finalEnergyImbalanceRatio = 1.0;

    // Iterative Co-simulation Loop
    for (let iter = 1; iter <= options.maxIterations; iter++) {
      // Step A: Update circuit components with current temperatures
      for (const comp of currentCircuit.components) {
        const prop = coupledPropsMap.get(comp.id);
        if (!prop) continue;

        const tempC = currentTempsC.get(comp.id) ?? ambientT;

        if (comp.type === 'RESISTOR') {
          const deltaT = tempC - prop.referenceTempC;
          const newR = prop.nominalResistanceOhms * (1.0 + prop.tempCoefficientAlpha * deltaT);

          // Physical validity check (e.g. resistance must be positive)
          if (newR <= 1e-6 || !Number.isFinite(newR)) {
            diagnostics.push(`Unphysical resistance computed for ${comp.id}: ${newR} Ohms at ${tempC.toFixed(2)} C`);
            return this.buildFailureResult('THERMAL_RUNAWAY', diagnostics, diagnostics);
          }
          comp.value = newR;
          currentResistances.set(comp.id, newR);
        } else if (comp.type === 'DIODE') {
          const tempK = tempC + 273.15;
          comp.temperatureKelvin = tempK;

          if (prop.diodeSaturationIs0 && prop.diodeEmissionFactor) {
            const T0_K = prop.referenceTempC + 273.15;
            const Eg = prop.bandgapEnergyEV ?? 1.11; // eV
            const q_over_kB = 11604.5; // K/eV
            const isT =
              prop.diodeSaturationIs0 *
              Math.pow(tempK / T0_K, 3.0 / prop.diodeEmissionFactor) *
              Math.exp(-q_over_kB * (Eg / prop.diodeEmissionFactor) * (1.0 / tempK - 1.0 / T0_K));
            comp.saturationCurrent = isT;
          }
        }
      }

      // Step B: Solve electrical domain
      // Use nonlinear solver if diodes are present, otherwise detailed MNA
      const hasDiodes = currentCircuit.components.some(c => c.type === 'DIODE');
      const circuitResult = hasDiodes
        ? NodalCircuitSolver.solveNonlinearCircuit(currentCircuit)
        : NodalCircuitSolver.solveDetailed(currentCircuit);

      lastCircuitResult = circuitResult;

      if (!circuitResult.success) {
        if (circuitResult.status === 'SINGULAR_MATRIX') {
          diagnostics.push(`Electrical solver encountered singular matrix at iteration ${iter}: ${circuitResult.errorMessage}`);
          return this.buildFailureResult('SINGULAR_MATRIX', diagnostics, diagnostics);
        }
        diagnostics.push(`Electrical solver failed at iteration ${iter}: ${circuitResult.errorMessage}`);
        return this.buildFailureResult('ELECTRICAL_DIVERGENCE', diagnostics, diagnostics);
      }

      // Step C: Compute electrical dissipated power per component with under-relaxation
      const theta = Math.max(0.01, Math.min(1.0, options.relaxationTheta));
      let totalElecPower = 0.0;

      for (const [refDes] of coupledPropsMap.entries()) {
        const branch = circuitResult.branchCurrents.find(b => b.componentId === refDes);
        const rawPower = branch ? Math.abs(branch.powerWatts) : 0.0;
        const prevPower = currentPowers.get(refDes) ?? 0.0;

        // Damped Picard power update
        const relaxedPower = iter === 1 ? rawPower : theta * rawPower + (1.0 - theta) * prevPower;
        currentPowers.set(refDes, relaxedPower);
        totalElecPower += relaxedPower;

        // Check for runaway power explosion
        if (relaxedPower > 1e6 || !Number.isFinite(relaxedPower)) {
          diagnostics.push(`Thermal runaway detected on ${refDes}: power reached ${relaxedPower.toExponential(3)} W`);
          return this.buildFailureResult('THERMAL_RUNAWAY', diagnostics, diagnostics);
        }

        // Map to thermal board component
        const thermalComp = currentThermalBoard.components.find(c => c.refDes === refDes);
        if (thermalComp) {
          thermalComp.powerDissipationWatts = relaxedPower;
        }
      }

      // Step D: Solve spatial thermal domain
      const thermalResult = SpatialThermalSolver.solve(currentThermalBoard);
      lastThermalResult = thermalResult;

      if (thermalResult.verdict !== 'VERIFIED_WITHIN_DECLARED_SCOPE') {
        diagnostics.push(`Spatial thermal solver failed at iteration ${iter}: verdict=${thermalResult.verdict}`);
        return this.buildFailureResult('THERMAL_DIVERGENCE', diagnostics, diagnostics);
      }

      // Step E: Extract new component temperatures and evaluate residuals
      let maxDeltaT = 0.0;
      let maxDeltaRRel = 0.0;
      const componentStatesRecord: ElectrothermalIterationRecord['componentStates'] = [];

      for (const [refDes, prop] of coupledPropsMap.entries()) {
        const compStat = thermalResult.componentResults.find(r => r.refDes === refDes);
        let newTempC = ambientT;

        if (compStat) {
          switch (prop.feedbackTarget) {
            case 'BOARD':
              newTempC = compStat.boardTempC;
              break;
            case 'CASE':
              newTempC = compStat.caseTempC;
              break;
            case 'JUNCTION':
            default:
              newTempC = compStat.junctionTempC;
              break;
          }
        }

        const oldTempC = currentTempsC.get(refDes) ?? ambientT;
        const deltaT = Math.abs(newTempC - oldTempC);
        if (deltaT > maxDeltaT) {
          maxDeltaT = deltaT;
        }

        // Apply under-relaxation to temperature update to stabilize stiff regimes
        const relaxedTempC = iter === 1 ? newTempC : theta * newTempC + (1.0 - theta) * oldTempC;
        currentTempsC.set(refDes, relaxedTempC);

        // Evaluate resistance delta relative to previous
        const currentR = currentResistances.get(refDes) ?? prop.nominalResistanceOhms;
        const circComp = currentCircuit.components.find(c => c.id === refDes);
        const branch = circuitResult.branchCurrents.find(b => b.componentId === refDes);
        const vDrop = branch ? Math.abs(branch.voltageDropVolts) : 0.0;
        const iBranch = branch ? Math.abs(branch.currentAmps) : 0.0;

        if (circComp && circComp.type === 'RESISTOR') {
          const predictedR = prop.nominalResistanceOhms * (1.0 + prop.tempCoefficientAlpha * (relaxedTempC - prop.referenceTempC));
          const deltaRRel = Math.abs(predictedR - currentR) / Math.max(currentR, 1e-6);
          if (deltaRRel > maxDeltaRRel) {
            maxDeltaRRel = deltaRRel;
          }
        }

        componentStatesRecord.push({
          refDes,
          resistanceOhms: Number(currentR.toFixed(5)),
          voltageVolts: Number(vDrop.toFixed(5)),
          currentAmps: Number(iBranch.toFixed(5)),
          powerWatts: Number((currentPowers.get(refDes) ?? 0.0).toFixed(5)),
          temperatureC: Number(relaxedTempC.toFixed(3))
        });
      }

      // Energy balance verification
      const energyBal = thermalResult.energyBalance;
      const energyImbalanceRatio = energyBal.relativeImbalanceRatio;

      iterationHistory.push({
        iteration: iter,
        maxTemperatureDeltaK: Number(maxDeltaT.toFixed(5)),
        maxResistanceDeltaRel: Number(maxDeltaRRel.toFixed(6)),
        totalElectricalPowerWatts: Number(totalElecPower.toFixed(5)),
        totalThermalHeatWatts: Number((energyBal.totalConvectionHeatWatts + energyBal.totalPrescribedSinkWatts).toFixed(5)),
        energyImbalanceRatio: Number(energyImbalanceRatio.toFixed(6)),
        componentStates: componentStatesRecord
      });

      finalTempDeltaK = maxDeltaT;
      finalResDeltaRel = maxDeltaRRel;
      finalEnergyImbalanceRatio = energyImbalanceRatio;

      // Convergence criteria check
      if (
        iter > 1 &&
        maxDeltaT <= options.temperatureToleranceK &&
        maxDeltaRRel <= options.resistanceToleranceRatio &&
        energyImbalanceRatio <= options.energyConservationToleranceRatio
      ) {
        converged = true;
        break;
      }
    }

    if (!converged) {
      diagnostics.push(
        `Failed to reach convergence within ${options.maxIterations} iterations. Last deltaT=${finalTempDeltaK.toExponential(3)} K, deltaR=${finalResDeltaRel.toExponential(3)}, energyImbalance=${(finalEnergyImbalanceRatio * 100).toFixed(4)}%`
      );
      return {
        status: 'NON_CONVERGED',
        success: false,
        totalIterations: options.maxIterations,
        finalTemperatureResidualK: finalTempDeltaK,
        finalResistanceResidualRel: finalResDeltaRel,
        energyImbalanceRatio: finalEnergyImbalanceRatio,
        energyConserved: finalEnergyImbalanceRatio <= options.energyConservationToleranceRatio,
        circuitResult: lastCircuitResult!,
        thermalFieldResult: lastThermalResult!,
        iterationHistory,
        componentCouplingResults: [],
        canonicalHash: '',
        diagnostics
      };
    }

    // Build converged component coupling summary
    const componentCouplingResults = contract.components.map(prop => {
      const circComp = currentCircuit.components.find(c => c.id === prop.refDes);
      const convergedR = circComp && circComp.type === 'RESISTOR' ? circComp.value : prop.nominalResistanceOhms;
      const rShiftPct = ((convergedR - prop.nominalResistanceOhms) / prop.nominalResistanceOhms) * 100.0;
      const convergedP = currentPowers.get(prop.refDes) ?? 0.0;
      const convergedT = currentTempsC.get(prop.refDes) ?? ambientT;
      const tRise = convergedT - ambientT;
      const maxRated = prop.maxRatedTemperatureC ?? 125.0;
      const margin = maxRated - convergedT;
      const isOverstressed = convergedT > maxRated;

      return {
        refDes: prop.refDes,
        nominalResistanceOhms: Number(prop.nominalResistanceOhms.toFixed(5)),
        convergedResistanceOhms: Number(convergedR.toFixed(5)),
        resistanceShiftPercent: Number(rShiftPct.toFixed(3)),
        convergedPowerWatts: Number(convergedP.toFixed(5)),
        convergedTemperatureC: Number(convergedT.toFixed(3)),
        temperatureRiseK: Number(tRise.toFixed(3)),
        marginC: Number(margin.toFixed(3)),
        isOverstressed
      };
    });

    const canonicalHash = this.computeCanonicalHash({
      circuitHash: lastCircuitResult!.modelHash,
      thermalHash: lastThermalResult!.canonicalHash,
      totalIterations: iterationHistory.length,
      finalTempDeltaK,
      finalResDeltaRel,
      energyImbalanceRatio: finalEnergyImbalanceRatio,
      componentCouplingResults
    });

    return {
      status: 'CONVERGED',
      success: true,
      totalIterations: iterationHistory.length,
      finalTemperatureResidualK: Number(finalTempDeltaK.toFixed(6)),
      finalResistanceResidualRel: Number(finalResDeltaRel.toFixed(7)),
      energyImbalanceRatio: Number(finalEnergyImbalanceRatio.toFixed(6)),
      energyConserved: finalEnergyImbalanceRatio <= options.energyConservationToleranceRatio,
      circuitResult: lastCircuitResult!,
      thermalFieldResult: lastThermalResult!,
      iterationHistory,
      componentCouplingResults,
      canonicalHash,
      diagnostics
    };
  }

  /**
   * Independent Analytical Reference Benchmark (Single Resistor Self-Heating)
   *
   * Solves closed-form quadratic equation without numerical iteration:
   * (R_0 * \alpha) * (\Delta T)^2 + R_amb * \Delta T - V^2 * R_\theta = 0
   */
  public static solveAnalyticalSelfHeatingBenchmark(params: {
    appliedVoltageVolts: number;
    nominalResistanceOhms: number;
    ambientTempC: number;
    referenceTempC: number;
    thermalResistanceCW: number;
    tempCoefficientAlpha: number;
  }): AnalyticalSelfHeatingBenchmarkResult {
    const {
      appliedVoltageVolts: V,
      nominalResistanceOhms: R0,
      ambientTempC: Tamb,
      referenceTempC: Tref,
      thermalResistanceCW: Rth,
      tempCoefficientAlpha: alpha
    } = params;

    const Ramb = R0 * (1.0 + alpha * (Tamb - Tref));

    // Quadratic coefficients for Delta T = T - Tamb:
    // a * (Delta T)^2 + b * (Delta T) + c = 0
    const a = R0 * alpha;
    const b = Ramb;
    const c = -(V * V) * Rth;

    let deltaT: number;
    if (Math.abs(a) < 1e-12) {
      // Linear regime (alpha = 0)
      deltaT = -c / b;
    } else {
      const disc = b * b - 4.0 * a * c;
      if (disc < 0) {
        throw new Error('UNPHYSICAL_ROOT: Negative discriminant in analytical self-heating solution.');
      }
      deltaT = (-b + Math.sqrt(disc)) / (2.0 * a);
    }

    const Tstar = Tamb + deltaT;
    const Rstar = R0 * (1.0 + alpha * (Tstar - Tref));
    const Pstar = (V * V) / Rstar;
    const Istar = V / Rstar;

    return {
      nominalResistanceOhms: R0,
      ambientTempC: Tamb,
      referenceTempC: Tref,
      appliedVoltageVolts: V,
      thermalResistanceCW: Rth,
      tempCoefficientAlpha: alpha,
      analyticalDeltaTC: Number(deltaT.toFixed(4)),
      analyticalTempC: Number(Tstar.toFixed(4)),
      analyticalResistanceOhms: Number(Rstar.toFixed(5)),
      analyticalPowerWatts: Number(Pstar.toFixed(5)),
      analyticalCurrentAmps: Number(Istar.toFixed(5))
    };
  }

  private static computeCanonicalHash(payload: any): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
  }

  private static buildFailureResult(
    status: ElectrothermalSolveResult['status'],
    reasons: string[],
    diagnostics: string[]
  ): ElectrothermalSolveResult {
    return {
      status,
      success: false,
      totalIterations: 0,
      finalTemperatureResidualK: Infinity,
      finalResistanceResidualRel: Infinity,
      energyImbalanceRatio: 1.0,
      energyConserved: false,
      circuitResult: null as any,
      thermalFieldResult: null as any,
      iterationHistory: [],
      componentCouplingResults: [],
      canonicalHash: '',
      diagnostics: [...diagnostics, ...reasons]
    };
  }
}
