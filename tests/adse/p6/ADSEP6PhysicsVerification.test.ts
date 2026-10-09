/**
 * SECP — ADSE-P6 Real Physics Verification Battery
 * 
 * Formal Numerical Verification of:
 * - Case A: 1D Steady Conduction (Fourier's Law, exact heat flow & temperature field)
 * - Case B: Thermal Resistance Network (Series drops, deltaT = Q * R_eq, energy conservation)
 * - Case C: Transient Thermal Response (Lumped capacitance analytical solution)
 * - Case D: Boundary Sensitivity (Controlled perturbation propagates to results)
 * - Case E: Material Sensitivity (Conductivity change scales heat flux & invalidates prior result)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP6ThermalEngine } from '../../../src/engine/adse/p6/ADSEP6ThermalEngine';

describe('ADSE-P6 Real Physics Verification Battery', () => {
  let p6: ADSEP6ThermalEngine;

  beforeEach(() => {
    p6 = new ADSEP6ThermalEngine();
    p6.clear();
  });

  // --- Case A: 1D Steady Conduction ---
  it('Case A: 1D Steady Conduction — Verifies Fourier law, linear profile, and exact energy balance', () => {
    p6.materials.registerMaterialBinding({
      bindingId: 'mat:copper:c101',
      materialId: 'mat:copper:c101',
      materialRevision: 1,
      canonicalName: 'Oxygen-Free Copper C10100',
      conductivityW_mK: 390.0, // W/(m·K)
      densityKg_m3: 8960.0,
      specificHeatJ_kgK: 385.0,
      emissivity: 0.05,
      authority: 'MATERIALS_AUTHORITY'
    });

    const model = p6.registry.registerModel({
      thermalId: 'therm:copper:rod',
      canonicalId: 'arch:comp:HEAT_SINK_SLUG',
      p4NodeId: 'thread:node:SLUG',
      displayName: '1D Conduction Test Slug',
      domain: 'STEADY_STATE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const region = p6.registry.registerRegion({
      regionId: 'reg:copper:slug',
      thermalId: model.thermalId,
      canonicalGeometryId: 'geom:copper_cylinder',
      materialId: 'mat:copper:c101',
      materialRevision: 1,
      configurationId: 'CONF-01',
      initialTemperatureK: 300.0
    });

    const exec = p6.solver.prepareExecution(model, [region], p6.materials.getAllBindings(), []);

    // Parameters:
    // L = 0.2 m, A = 0.005 m^2, k = 390 W/(m·K)
    // T_hot = 373.15 K, T_cold = 273.15 K => Delta T = 100 K
    // R_th = L / (k * A) = 0.2 / (390 * 0.005) = 0.2 / 1.95 = 0.102564 K/W
    // Q = Delta T / R_th = 100 / 0.102564 = 975.0 W
    const L = 0.2;
    const A = 0.005;
    const k = 390.0;
    const Thot = 373.15;
    const Tcold = 273.15;

    const result = p6.solver.execute1DSteadyConduction(exec.executionId, {
      hotBoundaryK: Thot,
      coldBoundaryK: Tcold,
      lengthM: L,
      areaM2: A,
      conductivityW_mK: k,
      evaluationPointsM: [0, L / 4, L / 2, (3 * L) / 4, L]
    });

    const expectedQ = (k * A * (Thot - Tcold)) / L; // 975 W
    expect(result.totalHeatInputWatts).toBeCloseTo(expectedQ, 2);
    expect(result.totalHeatDissipatedWatts).toBeCloseTo(expectedQ, 2);
    expect(result.energyBalanceDiscrepancyPercent).toBe(0.0);

    // Verify linear temperature profile at mid-point x = 0.1 m: T = Thot - (Q/(kA))*0.1 = 373.15 - 50 = 323.15 K
    const midPointRes = result.regionResults['pt_2_x_0.100m'];
    expect(midPointRes.temperatureK).toBeCloseTo(323.15, 2);
  });

  // --- Case B: Thermal Resistance Network ---
  it('Case B: Thermal Resistance Network — Verifies series equivalent resistance and node temperature drops', () => {
    const model = p6.registry.registerModel({
      thermalId: 'therm:stack:ic',
      canonicalId: 'arch:comp:IC_STACK',
      p4NodeId: 'thread:node:IC_STACK',
      displayName: 'Multi-layer IC Thermal Stack',
      domain: 'STEADY_STATE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const exec = p6.solver.prepareExecution(model, [], [], []);

    // Network: Die Junction -> TIM -> Heat Spreader -> Interface -> Heat Sink
    // R1 = 0.2 K/W, R2 = 0.5 K/W, R3 = 0.3 K/W => R_total = 1.0 K/W
    // T_source = 360 K, T_sink = 300 K => Delta T = 60 K
    // Q = 60 / 1.0 = 60 W
    const resistances = [
      { name: 'TIM_layer', resistanceK_W: 0.2 },
      { name: 'Heat_Spreader', resistanceK_W: 0.5 },
      { name: 'Sink_Interface', resistanceK_W: 0.3 }
    ];

    const result = p6.solver.executeThermalResistanceNetwork(exec.executionId, {
      tSourceK: 360.0,
      tSinkK: 300.0,
      resistancesK_W: resistances
    });

    expect(result.totalHeatInputWatts).toBeCloseTo(60.0, 3);
    expect(result.totalHeatDissipatedWatts).toBeCloseTo(60.0, 3);

    // Node 0 after TIM: T = 360 - (60 * 0.2) = 348 K
    expect(result.regionResults['node_0_TIM_layer'].temperatureK).toBeCloseTo(348.0, 2);

    // Node 1 after Spreader: T = 348 - (60 * 0.5) = 318 K
    expect(result.regionResults['node_1_Heat_Spreader'].temperatureK).toBeCloseTo(318.0, 2);

    // Node 2 after Sink: T = 318 - (60 * 0.3) = 300 K
    expect(result.regionResults['node_2_Sink_Interface'].temperatureK).toBeCloseTo(300.0, 2);
  });

  // --- Case C: Transient Thermal Response ---
  it('Case C: Transient Thermal Response — Verifies analytical lumped capacitance cooling curve and time constant', () => {
    const model = p6.registry.registerModel({
      thermalId: 'therm:transient:billet',
      canonicalId: 'arch:comp:AL_BILLET',
      p4NodeId: 'thread:node:BILLET',
      displayName: 'Aluminum Billet Quenching Model',
      domain: 'TRANSIENT',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const exec = p6.solver.prepareExecution(model, [], [], []);

    // Mass = 2 kg, Cp = 900 J/(kg*K) => C_th = 1800 J/K
    // h = 100 W/(m^2*K), A = 0.18 m^2 => R_th = 1 / (100 * 0.18) = 1 / 18 = 0.0555 K/W
    // tau = C_th * R_th = 1800 / 18 = 100.0 seconds
    // T_0 = 500 K, T_inf = 300 K
    // At t = 100 s (1 tau): T(100) = 300 + (500 - 300) * exp(-1) = 300 + 200 * 0.367879 = 373.58 K
    const result = p6.solver.executeTransientLumpedCapacitance(exec.executionId, {
      initialTempK: 500.0,
      ambientTempK: 300.0,
      massKg: 2.0,
      specificHeatJ_kgK: 900.0,
      htcW_m2K: 100.0,
      surfaceAreaM2: 0.18,
      timeStepsSeconds: [0, 50, 100, 200, 500]
    });

    expect(result.regionResults['t_0s'].temperatureK).toBeCloseTo(500.0, 2);
    expect(result.regionResults['t_100s'].temperatureK).toBeCloseTo(373.58, 1);
    expect(result.regionResults['t_500s'].temperatureK).toBeCloseTo(301.35, 1);
  });

  // --- Case D: Boundary Sensitivity ---
  it('Case D: Boundary Sensitivity — Controlled boundary perturbation directly shifts temperature profile', () => {
    const model = p6.registry.registerModel({
      thermalId: 'therm:boundary:sens',
      canonicalId: 'arch:comp:TEST_SLAB',
      p4NodeId: 'thread:node:SLAB',
      displayName: 'Sensitivity Test Slab',
      domain: 'STEADY_STATE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const exec1 = p6.solver.prepareExecution(model, [], [], []);
    const res1 = p6.solver.execute1DSteadyConduction(exec1.executionId, {
      hotBoundaryK: 350.0,
      coldBoundaryK: 300.0,
      lengthM: 0.1,
      areaM2: 0.01,
      conductivityW_mK: 100.0
    });

    const exec2 = p6.solver.prepareExecution(model, [], [], []);
    const res2 = p6.solver.execute1DSteadyConduction(exec2.executionId, {
      hotBoundaryK: 400.0, // Perturbed by +50 K
      coldBoundaryK: 300.0,
      lengthM: 0.1,
      areaM2: 0.01,
      conductivityW_mK: 100.0
    });

    // In res1: Q1 = 100 * 0.01 * 50 / 0.1 = 500 W
    // In res2: Q2 = 100 * 0.01 * 100 / 0.1 = 1000 W (Exactly doubles)
    expect(res1.totalHeatInputWatts).toBeCloseTo(500.0, 2);
    expect(res2.totalHeatInputWatts).toBeCloseTo(1000.0, 2);
  });

  // --- Case E: Material Sensitivity ---
  it('Case E: Material Sensitivity — Conductivity modification in revision scales heat transfer and invalidates prior result', () => {
    const matBinding = p6.materials.registerMaterialBinding({
      bindingId: 'mat:ti:alloy',
      materialId: 'mat:titanium:ti6al4v',
      materialRevision: 1,
      canonicalName: 'Titanium Ti-6Al-4V',
      conductivityW_mK: 6.7, // Low thermal conductivity
      densityKg_m3: 4430.0,
      specificHeatJ_kgK: 526.0,
      emissivity: 0.35,
      authority: 'MATERIALS_AUTHORITY'
    });

    const model = p6.registry.registerModel({
      thermalId: 'therm:insulation:shield',
      canonicalId: 'arch:comp:HEAT_SHIELD',
      p4NodeId: 'thread:node:SHIELD',
      displayName: 'Heat Shield Thermal Barrier',
      domain: 'STEADY_STATE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const region = p6.registry.registerRegion({
      regionId: 'reg:shield:barrier',
      thermalId: model.thermalId,
      canonicalGeometryId: 'geom:shield_panel',
      materialId: matBinding.materialId,
      materialRevision: matBinding.materialRevision,
      configurationId: 'CONF-01',
      initialTemperatureK: 300.0
    });

    const exec1 = p6.solver.prepareExecution(model, [region], [matBinding], []);
    const res1 = p6.solver.execute1DSteadyConduction(exec1.executionId, {
      hotBoundaryK: 600.0,
      coldBoundaryK: 300.0,
      lengthM: 0.02,
      areaM2: 0.01,
      conductivityW_mK: matBinding.conductivityW_mK
    });

    // Heat flow with Ti-6Al-4V (k = 6.7 W/m·K): Q1 = 6.7 * 0.01 * 300 / 0.02 = 1005 W
    expect(res1.totalHeatInputWatts).toBeCloseTo(1005.0, 2);

    // Now analyze impact of changing material conductivity to an advanced composite (k = 1.34 W/m·K)
    const impact = p6.impact.analyzeMaterialMutationImpact(matBinding.materialId, 'conductivityW_mK');
    expect(impact.invalidatedExecutionIds).toContain(exec1.executionId);

    // Invalidate prior execution
    p6.invalidations.invalidateForModel(model.thermalId, 'Material conductivity updated to composite replacement');

    const updatedExec = p6.solver.getExecution(exec1.executionId);
    expect(updatedExec?.status).toBe('INVALIDATED');

    // Executing on invalidated execution is rejected
    expect(() => {
      p6.solver.execute1DSteadyConduction(exec1.executionId, {
        hotBoundaryK: 600.0,
        coldBoundaryK: 300.0,
        lengthM: 0.02,
        areaM2: 0.01,
        conductivityW_mK: 1.34
      });
    }).toThrow(/EXECUTION_INVALIDATED/);
  });
});
