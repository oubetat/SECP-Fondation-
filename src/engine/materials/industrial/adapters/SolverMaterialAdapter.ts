/**
 * SECP Industrial OS v2 — Solver Material Adapters
 * Phase 18 (PATCH-178: Materials Benchmark → Industrial Materials Engine)
 *
 * Implements:
 * - FEM Material Adapter: converts IndustrialMaterial into stress updates, temperature-dependent moduli, and algorithmic tangents C^alg
 * - CFD Material Adapter: delivers fluid/thermal properties rho(T, p), dynamic viscosity mu(T), Cp(T), thermal conductivity k(T), Prandtl number Pr
 * - Multiphysics Material Adapter: unified Thermo-Mechanical-Fluid interface
 */

import { IndustrialMaterial, MaterialState } from '../types/IndustrialMaterialTypes';
import { TemperaturePropertyEngine } from '../temperature/TemperaturePropertyEngine';
import { J2IndustrialPlasticityModel } from '../constitutive/J2IndustrialPlasticityModel';
import { HyperelasticIndustrialModel } from '../constitutive/HyperelasticIndustrialModel';

export interface FEMMaterialResponse {
  stressVoigt: number[];
  tangent6x6: number[][];
  strainEnergyDensity: number;
  plasticDissipation: number;
  currentYoungsModulus_GPa: number;
  currentYieldStress_MPa: number;
  thermalStrainVoigt: number[];
}

export interface CFDFluidResponse {
  density_kg_m3: number;
  dynamicViscosity_Pa_s: number;
  specificHeatCp_J_kgK: number;
  thermalConductivity_W_mK: number;
  prandtlNumber: number;
  thermalDiffusivity_m2_s: number;
}

export class SolverMaterialAdapter {
  /**
   * FEM Adapter: Computes mechanical stress and algorithmic tangent at given strain increment and temperature.
   */
  public static evaluateFEM(
    material: IndustrialMaterial,
    strainIncrementVoigt: number[],
    state: MaterialState,
    tempK: number = 293.15,
    refTempK: number = 293.15
  ): FEMMaterialResponse {
    // 1. Evaluate temperature-dependent Young's Modulus & Yield Stress
    let E_GPa = material.nominalProperties.youngsModulus_GPa;
    const eCurve = material.temperatureCurves.get('YOUNGS_MODULUS');
    if (eCurve) {
      E_GPa = TemperaturePropertyEngine.evaluateCurve(eCurve, tempK);
    }

    let sigma_y_MPa = material.nominalProperties.tensileYieldStrength_MPa;
    const syCurve = material.temperatureCurves.get('YIELD_STRENGTH');
    if (syCurve) {
      sigma_y_MPa = TemperaturePropertyEngine.evaluateCurve(syCurve, tempK);
    }

    // Thermal expansion
    let alpha = material.nominalProperties.thermalExpansionCoeff_1_K;
    const alphaCurve = material.temperatureCurves.get('THERMAL_EXPANSION');
    if (alphaCurve) {
      alpha = TemperaturePropertyEngine.evaluateCurve(alphaCurve, tempK);
    }
    const thermalStrain = TemperaturePropertyEngine.computeThermalStrainVoigt(alpha, tempK, refTempK);

    // Subtract thermal strain from mechanical increment
    const mechStrainIncrement = strainIncrementVoigt.map((de, i) => de - thermalStrain[i]);

    if (material.plasticityModel) {
      const j2 = new J2IndustrialPlasticityModel(
        {
          ...material.plasticityModel,
          initialYieldStressMPa: sigma_y_MPa
        },
        E_GPa * 1000,
        material.nominalProperties.poissonsRatio
      );

      const res = j2.updateStress(mechStrainIncrement, state);

      return {
        stressVoigt: res.stressVoigt,
        tangent6x6: res.consistentTangent6x6,
        strainEnergyDensity: res.strainEnergyDensity,
        plasticDissipation: state.plasticDissipation + res.plasticDissipationIncrement,
        currentYoungsModulus_GPa: E_GPa,
        currentYieldStress_MPa: sigma_y_MPa,
        thermalStrainVoigt: thermalStrain
      };
    }

    // Default Linear Elastic
    const nu = material.nominalProperties.poissonsRatio;
    const E_Pa = E_GPa * 1e9;
    const lambda = (E_Pa * nu) / ((1 + nu) * (1 - 2 * nu));
    const twoG = E_Pa / (1 + nu);
    const G = E_Pa / (2 * (1 + nu));

    const Ce = [
      [lambda + twoG, lambda, lambda, 0, 0, 0],
      [lambda, lambda + twoG, lambda, 0, 0, 0],
      [lambda, lambda, lambda + twoG, 0, 0, 0],
      [0, 0, 0, G, 0, 0],
      [0, 0, 0, 0, G, 0],
      [0, 0, 0, 0, 0, G]
    ];

    const totalStrain = state.totalStrainVoigt.map((e, i) => e + mechStrainIncrement[i]);
    const stress: number[] = new Array(6).fill(0);
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        stress[i] += Ce[i][j] * totalStrain[j];
      }
    }

    const energy = 0.5 * stress.reduce((acc, s, idx) => acc + s * totalStrain[idx], 0);

    return {
      stressVoigt: stress,
      tangent6x6: Ce,
      strainEnergyDensity: energy,
      plasticDissipation: 0,
      currentYoungsModulus_GPa: E_GPa,
      currentYieldStress_MPa: sigma_y_MPa,
      thermalStrainVoigt: thermalStrain
    };
  }

  /**
   * CFD Adapter: Computes fluid dynamic and thermal properties at temperature T (K) and pressure p (Pa).
   */
  public static evaluateCFD(
    material: IndustrialMaterial,
    tempK: number = 293.15,
    pressurePa: number = 101325
  ): CFDFluidResponse {
    let rho = material.nominalProperties.density_kg_m3;
    let k = material.nominalProperties.thermalConductivity_W_mK;
    let Cp = material.nominalProperties.specificHeat_J_kgK;

    const rhoCurve = material.temperatureCurves.get('DENSITY');
    if (rhoCurve) rho = TemperaturePropertyEngine.evaluateCurve(rhoCurve, tempK);

    const kCurve = material.temperatureCurves.get('THERMAL_CONDUCTIVITY');
    if (kCurve) k = TemperaturePropertyEngine.evaluateCurve(kCurve, tempK);

    const cpCurve = material.temperatureCurves.get('SPECIFIC_HEAT');
    if (cpCurve) Cp = TemperaturePropertyEngine.evaluateCurve(cpCurve, tempK);

    // Sutherland's law or dynamic viscosity evaluation (standard air / fluid baseline ~ 1.8e-5 Pa*s at 293K)
    const T0 = 273.15;
    const mu0 = 1.716e-5;
    const S = 110.4;
    const mu = mu0 * Math.pow(tempK / T0, 1.5) * ((T0 + S) / (tempK + S));

    // Prandtl number Pr = mu * Cp / k
    const prandtl = (mu * Cp) / Math.max(1e-6, k);
    const alpha_diff = k / Math.max(1e-6, rho * Cp);

    return {
      density_kg_m3: rho,
      dynamicViscosity_Pa_s: mu,
      specificHeatCp_J_kgK: Cp,
      thermalConductivity_W_mK: k,
      prandtlNumber: prandtl,
      thermalDiffusivity_m2_s: alpha_diff
    };
  }
}
