/**
 * SECP — ADSE-P7 Power to P6 Thermal Coupling Test Suite
 * 
 * Formal Verification of:
 * - Electrical losses (conduction, conversion, component dissipation) coupling into P6 Thermal Truth
 * - P7 electrical dissipation -> P6 Heat Source registration
 * - Non-parallel thermal authority: P6 owns Thermal Truth, P7 owns Power Truth
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP7PowerEngine } from '../../../src/engine/adse/p7/ADSEP7PowerEngine';
import { ADSEP6ThermalEngine } from '../../../src/engine/adse/p6/ADSEP6ThermalEngine';

describe('ADSE-P7 to P6 Thermal Coupling', () => {
  let p7: ADSEP7PowerEngine;
  let p6: ADSEP6ThermalEngine;

  beforeEach(() => {
    p6 = new ADSEP6ThermalEngine();
    p6.clear();
    p7 = new ADSEP7PowerEngine(p6);
    p7.clear();
  });

  it('Binds electrical losses to P6 Thermal Model and produces verified coupling records', () => {
    // 1. Setup Material Binding in P6
    p6.materials.registerMaterialBinding({
      bindingId: 'bind:al6061',
      materialId: 'mat:AL6061_T6',
      materialRevision: 1,
      canonicalName: 'Aluminum 6061-T6',
      conductivityW_mK: 167.0,
      densityKg_m3: 2700.0,
      specificHeatJ_kgK: 896.0,
      emissivity: 0.8,
      authority: 'MATERIAL_AUTHORITY'
    });

    // 2. Setup P6 Canonical Thermal Model & Region
    const thermalModel = p6.registry.registerModel({
      thermalId: 'therm:avionics_bay',
      canonicalId: 'geom:avionics_chassis',
      p5StructuralId: 'struct:chassis:main',
      p4NodeId: 'thread:thermal_bay',
      displayName: 'Avionics Thermal Model',
      configurationId: 'CONF-01',
      revisionId: 'REV-01',
      authority: 'THERMAL_ENGINEER'
    });

    const region = p6.registry.registerRegion({
      regionId: 'reg:coldplate:avionics',
      thermalId: thermalModel.thermalId,
      canonicalGeometryId: 'geom:coldplate_solid',
      materialId: 'mat:AL6061_T6',
      materialRevision: 1,
      volumeM3: 0.002,
      characteristicLengthM: 0.25,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    // 3. Setup P7 Electrical System
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:avionics_power',
      canonicalId: 'arch:subsys:AVIONICS_EPS',
      p4NodeId: 'thread:avionics_power',
      displayName: 'Avionics Power Subsystem',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const dom = p7.registry.registerDomain({
      domainId: 'dom:avionics',
      systemId: sys.systemId,
      name: '28V Avionics Domain',
      domainType: 'DC_LOW_VOLTAGE',
      nominalVoltageV: 28.0,
      voltageRangeMinV: 24.0,
      voltageRangeMaxV: 32.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const bus = p7.registry.registerBus({
      busId: 'bus:avionics_main',
      systemId: sys.systemId,
      domainId: dom.domainId,
      name: 'Avionics Bus',
      nominalVoltageV: 28.0,
      maxCurrentCapacityAmps: 50.0,
      connectedSourceIds: ['src:gen_avionics'],
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const src = p7.registry.registerSource({
      sourceId: 'src:gen_avionics',
      systemId: sys.systemId,
      domainId: dom.domainId,
      canonicalComponentId: 'arch:comp:GEN_AV',
      sourceType: 'MAIN_GENERATOR',
      nominalVoltageV: 28.0,
      ratedContinuousPowerWatts: 1500.0,
      peakPowerWatts: 2000.0,
      internalResistanceOhms: 0.01,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    // Load: 280W demand, 90% dissipated as heat = 252W
    const load = p7.registry.registerLoad({
      loadId: 'load:flight_computer',
      systemId: sys.systemId,
      domainId: dom.domainId,
      canonicalComponentId: 'arch:comp:FCC',
      connectedBusId: bus.busId,
      criticality: 'FLIGHT_CRITICAL_ESSENTIAL',
      nominalVoltageV: 28.0,
      voltageToleranceMinV: 24.0,
      voltageToleranceMaxV: 30.0,
      nominalDemandWatts: 280.0,
      peakDemandWatts: 300.0,
      dutyCycle: 1.0,
      thermalLossFraction: 0.90,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const branch = p7.topology.registerBranch({
      branchId: 'br:fcc',
      systemId: sys.systemId,
      fromBusId: bus.busId,
      toTargetId: load.loadId,
      lineResistanceOhms: 0.05, // I = 10A, Line Loss = 10^2 * 0.05 = 5.0W
      maxCurrentAmps: 20.0,
      protectionRatingAmps: 15.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const state = p7.registry.registerOperatingState({
      stateId: 'state:avionics_active',
      systemId: sys.systemId,
      mode: 'CRUISE_NOMINAL',
      name: 'Active Flight Computer',
      activeSourceIds: [src.sourceId],
      activeLoadIds: [load.loadId],
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    // 4. Solve Power Flow
    const exec = p7.solver.prepareExecution(sys, [src], [load], [bus], [branch], state);
    const pwrResult = p7.solver.solvePowerFlow(exec.executionId, {
      sources: [src],
      loads: [load],
      buses: [bus],
      branches: [branch],
      operatingState: state
    });

    expect(pwrResult.thermalLossSummaryWatts.loadThermalLossWatts).toBeCloseTo(252.0, 1);
    expect(pwrResult.thermalLossSummaryWatts.distributionThermalLossWatts).toBeCloseTo(5.0, 1);
    expect(pwrResult.thermalLossSummaryWatts.totalElectricalHeatDissipatedWatts).toBeCloseTo(257.0, 1);

    // 5. Couple to P6 Thermal Model
    const coupling = p7.thermalCoupling.couplePowerLossesToThermal(
      pwrResult,
      thermalModel.thermalId,
      region.regionId
    );

    expect(coupling.totalHeatGeneratedWatts).toBeCloseTo(257.0, 1);
    expect(coupling.p6ThermalModelId).toBe(thermalModel.thermalId);
    expect(coupling.mappedHeatSourceIds.length).toBeGreaterThan(0);

    // Verify P6 Heat Source was registered
    const p6Sources = p6.boundaries.getAllHeatSources();
    expect(p6Sources.some(s => s.thermalId === thermalModel.thermalId && Math.abs(s.heatPowerWatts - 257.0) < 0.1)).toBe(true);
  });
});
