/**
 * SECP — ADSE-P7 Real Physics & Electrical Engineering Verification Battery
 * 
 * Formal Numerical Verification of:
 * - Case A: Single Source / Single Load (Ohm's Law, Joule heating, exact balance)
 * - Case B: Branched Distribution (Kirchhoff Current Law, line losses, voltage drops)
 * - Case C: Converter Efficiency (Input/output power, fixed vs load losses)
 * - Case D: Storage Discharge (Energy depletion, C-rate, SoC decay)
 * - Case E: Peak / Transient Surge Demand
 * - Case F: Configuration Sensitivity & Result Invalidation
 * - Case G: Thermal Coupling (Electrical losses producing P6 thermal loads)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP7PowerEngine } from '../../../src/engine/adse/p7/ADSEP7PowerEngine';

describe('ADSE-P7 Real Physics & Engineering Verification Battery', () => {
  let p7: ADSEP7PowerEngine;

  beforeEach(() => {
    p7 = new ADSEP7PowerEngine();
    p7.clear();
  });

  // --- Case A: Single Source / Single Load ---
  it('Case A: Single Source / Single Load — Verifies V, I, P, line drop, and exact energy conservation', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:test_a',
      canonicalId: 'arch:subsys:TEST',
      p4NodeId: 'thread:test_a',
      displayName: 'Single Loop Test System',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const dom = p7.registry.registerDomain({
      domainId: 'dom:test_a',
      systemId: sys.systemId,
      name: '28V Domain',
      domainType: 'DC_LOW_VOLTAGE',
      nominalVoltageV: 28.0,
      voltageRangeMinV: 24.0,
      voltageRangeMaxV: 32.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const bus = p7.registry.registerBus({
      busId: 'bus:test_a',
      systemId: sys.systemId,
      domainId: dom.domainId,
      name: 'Test Bus',
      nominalVoltageV: 28.0,
      maxCurrentCapacityAmps: 50.0,
      connectedSourceIds: ['src:gen_a'],
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const src = p7.registry.registerSource({
      sourceId: 'src:gen_a',
      systemId: sys.systemId,
      domainId: dom.domainId,
      canonicalComponentId: 'arch:comp:GEN_A',
      sourceType: 'MAIN_GENERATOR',
      nominalVoltageV: 28.0,
      ratedContinuousPowerWatts: 1000.0,
      peakPowerWatts: 1500.0,
      internalResistanceOhms: 0.01,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    // 28V, 280W demand => Current = 10A
    // Branch R = 0.05 Ohms => Line loss = I^2 * R = 10^2 * 0.05 = 5.0W
    // Total power = 280 + 5 = 285.0W
    // Voltage drop = I * R = 10 * 0.05 = 0.5V => Terminal Voltage = 27.5V
    const load = p7.registry.registerLoad({
      loadId: 'load:test_a',
      systemId: sys.systemId,
      domainId: dom.domainId,
      canonicalComponentId: 'arch:comp:HEATER_A',
      connectedBusId: bus.busId,
      criticality: 'PRIMARY_MISSION',
      nominalVoltageV: 28.0,
      voltageToleranceMinV: 24.0,
      voltageToleranceMaxV: 30.0,
      nominalDemandWatts: 280.0,
      peakDemandWatts: 300.0,
      dutyCycle: 1.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const branch = p7.topology.registerBranch({
      branchId: 'br:test_a',
      systemId: sys.systemId,
      fromBusId: bus.busId,
      toTargetId: load.loadId,
      lineResistanceOhms: 0.05,
      maxCurrentAmps: 20.0,
      protectionRatingAmps: 15.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const state = p7.registry.registerOperatingState({
      stateId: 'state:test_a',
      systemId: sys.systemId,
      mode: 'CRUISE_NOMINAL',
      name: 'Single Load Nominal',
      activeSourceIds: [src.sourceId],
      activeLoadIds: [load.loadId],
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const exec = p7.solver.prepareExecution(sys, [src], [load], [bus], [branch], state);
    const result = p7.solver.solvePowerFlow(exec.executionId, {
      sources: [src],
      loads: [load],
      buses: [bus],
      branches: [branch],
      operatingState: state
    });

    expect(result.branchCurrentsA[branch.branchId]).toBeCloseTo(10.0, 2);
    expect(result.branchLossesWatts[branch.branchId]).toBeCloseTo(5.0, 2);
    expect(result.totalLoadWatts).toBeCloseTo(280.0, 2);
    expect(result.totalGenerationWatts).toBeCloseTo(285.0, 2);
    expect(result.busVoltagesV[`terminal:${load.loadId}`]).toBeCloseTo(27.5, 2);
    expect(result.powerBalanceDiscrepancyPercent).toBe(0.0);
  });

  // --- Case B: Branched Distribution ---
  it('Case B: Branched Distribution — Verifies Kirchhoff current division and bus node balance', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:test_b',
      canonicalId: 'arch:subsys:BUS_B',
      p4NodeId: 'thread:test_b',
      displayName: 'Branched Bus System',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const dom = p7.registry.registerDomain({
      domainId: 'dom:test_b',
      systemId: sys.systemId,
      name: '28V Domain',
      domainType: 'DC_LOW_VOLTAGE',
      nominalVoltageV: 28.0,
      voltageRangeMinV: 24.0,
      voltageRangeMaxV: 32.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const bus = p7.registry.registerBus({
      busId: 'bus:dist_b',
      systemId: sys.systemId,
      domainId: dom.domainId,
      name: 'Distribution Bus',
      nominalVoltageV: 28.0,
      maxCurrentCapacityAmps: 100.0,
      connectedSourceIds: ['src:gen_b'],
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const src = p7.registry.registerSource({
      sourceId: 'src:gen_b',
      systemId: sys.systemId,
      domainId: dom.domainId,
      canonicalComponentId: 'arch:comp:GEN_B',
      sourceType: 'MAIN_GENERATOR',
      nominalVoltageV: 28.0,
      ratedContinuousPowerWatts: 2000.0,
      peakPowerWatts: 3000.0,
      internalResistanceOhms: 0.01,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    // 3 Branches: 140W (5A), 280W (10A), 560W (20A) => Total = 980W (35A)
    const load1 = p7.registry.registerLoad({
      loadId: 'load:branch_1',
      systemId: sys.systemId,
      domainId: dom.domainId,
      canonicalComponentId: 'arch:comp:L1',
      connectedBusId: bus.busId,
      criticality: 'PRIMARY_MISSION',
      nominalVoltageV: 28.0,
      voltageToleranceMinV: 24.0,
      voltageToleranceMaxV: 30.0,
      nominalDemandWatts: 140.0,
      peakDemandWatts: 150.0,
      dutyCycle: 1.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const load2 = p7.registry.registerLoad({
      loadId: 'load:branch_2',
      systemId: sys.systemId,
      domainId: dom.domainId,
      canonicalComponentId: 'arch:comp:L2',
      connectedBusId: bus.busId,
      criticality: 'PRIMARY_MISSION',
      nominalVoltageV: 28.0,
      voltageToleranceMinV: 24.0,
      voltageToleranceMaxV: 30.0,
      nominalDemandWatts: 280.0,
      peakDemandWatts: 300.0,
      dutyCycle: 1.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const load3 = p7.registry.registerLoad({
      loadId: 'load:branch_3',
      systemId: sys.systemId,
      domainId: dom.domainId,
      canonicalComponentId: 'arch:comp:L3',
      connectedBusId: bus.busId,
      criticality: 'PRIMARY_MISSION',
      nominalVoltageV: 28.0,
      voltageToleranceMinV: 24.0,
      voltageToleranceMaxV: 30.0,
      nominalDemandWatts: 560.0,
      peakDemandWatts: 600.0,
      dutyCycle: 1.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const br1 = p7.topology.registerBranch({
      branchId: 'br:1',
      systemId: sys.systemId,
      fromBusId: bus.busId,
      toTargetId: load1.loadId,
      lineResistanceOhms: 0.02,
      maxCurrentAmps: 10.0,
      protectionRatingAmps: 8.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const br2 = p7.topology.registerBranch({
      branchId: 'br:2',
      systemId: sys.systemId,
      fromBusId: bus.busId,
      toTargetId: load2.loadId,
      lineResistanceOhms: 0.02,
      maxCurrentAmps: 15.0,
      protectionRatingAmps: 12.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const br3 = p7.topology.registerBranch({
      branchId: 'br:3',
      systemId: sys.systemId,
      fromBusId: bus.busId,
      toTargetId: load3.loadId,
      lineResistanceOhms: 0.02,
      maxCurrentAmps: 25.0,
      protectionRatingAmps: 22.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const state = p7.registry.registerOperatingState({
      stateId: 'state:branched',
      systemId: sys.systemId,
      mode: 'CRUISE_NOMINAL',
      name: 'Branched Distribution Nominal',
      activeSourceIds: [src.sourceId],
      activeLoadIds: [load1.loadId, load2.loadId, load3.loadId],
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const exec = p7.solver.prepareExecution(sys, [src], [load1, load2, load3], [bus], [br1, br2, br3], state);
    const res = p7.solver.solvePowerFlow(exec.executionId, {
      sources: [src],
      loads: [load1, load2, load3],
      buses: [bus],
      branches: [br1, br2, br3],
      operatingState: state
    });

    expect(res.branchCurrentsA['br:1']).toBeCloseTo(5.0, 2);
    expect(res.branchCurrentsA['br:2']).toBeCloseTo(10.0, 2);
    expect(res.branchCurrentsA['br:3']).toBeCloseTo(20.0, 2);
    expect(res.totalLoadWatts).toBeCloseTo(980.0, 2);
  });

  // --- Case C: Converter Efficiency ---
  it('Case C: Converter Efficiency — Verifies input power, losses, and efficiency calculations', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:conv_test',
      canonicalId: 'arch:subsys:CONV',
      p4NodeId: 'thread:conv_test',
      displayName: 'Converter Test System',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const dom = p7.registry.registerDomain({
      domainId: 'dom:conv',
      systemId: sys.systemId,
      name: '28V Domain',
      domainType: 'DC_LOW_VOLTAGE',
      nominalVoltageV: 28.0,
      voltageRangeMinV: 24.0,
      voltageRangeMaxV: 32.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const busIn = p7.registry.registerBus({
      busId: 'bus:28v_in',
      systemId: sys.systemId,
      domainId: dom.domainId,
      name: '28V Input Bus',
      nominalVoltageV: 28.0,
      maxCurrentCapacityAmps: 50.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const busOut = p7.registry.registerBus({
      busId: 'bus:12v_out',
      systemId: sys.systemId,
      domainId: dom.domainId,
      name: '12V Output Bus',
      nominalVoltageV: 12.0,
      maxCurrentCapacityAmps: 50.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    // Converter: 28V -> 12V Buck, 90% efficiency, 2.0W fixed no-load loss
    const conv = p7.registry.registerConverter({
      converterId: 'conv:buck_28_12',
      systemId: sys.systemId,
      canonicalComponentId: 'arch:comp:DCDC_BUCK',
      inputBusId: busIn.busId,
      outputBusId: busOut.busId,
      topology: 'DC_DC_BUCK',
      inputVoltageNominalV: 28.0,
      outputVoltageNominalV: 12.0,
      ratedPowerWatts: 300.0,
      efficiencyPercent: 90.0,
      fixedNoLoadLossWatts: 2.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    // P_out = 180W => P_in = (180 / 0.90) + 2.0 = 200 + 2 = 202.0W => P_loss = 22.0W
    const convOp = p7.conversion.computeConverterOperatingPoint(conv.converterId, 180.0);

    expect(convOp.outputPowerWatts).toBeCloseTo(180.0, 2);
    expect(convOp.inputPowerWatts).toBeCloseTo(202.0, 2);
    expect(convOp.conversionLossWatts).toBeCloseTo(22.0, 2);
    expect(convOp.isOverloaded).toBe(false);
  });

  // --- Case D: Storage Discharge ---
  it('Case D: Storage Discharge — Verifies energy depletion, SoC decay, and C-rate limit checking', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:bat_test',
      canonicalId: 'arch:subsys:BAT',
      p4NodeId: 'thread:bat_test',
      displayName: 'Battery Test System',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const dom = p7.registry.registerDomain({
      domainId: 'dom:bat',
      systemId: sys.systemId,
      name: '28V Domain',
      domainType: 'DC_LOW_VOLTAGE',
      nominalVoltageV: 28.0,
      voltageRangeMinV: 24.0,
      voltageRangeMaxV: 32.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const bus = p7.registry.registerBus({
      busId: 'bus:bat_bus',
      systemId: sys.systemId,
      domainId: dom.domainId,
      name: 'Battery Bus',
      nominalVoltageV: 28.0,
      maxCurrentCapacityAmps: 100.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    // Battery: 1000 Wh, 28V, initial SoC = 100%, R_int = 0.02 Ohm, max C = 2.0
    const battery = p7.registry.registerStorage({
      storageId: 'bat:1000wh',
      systemId: sys.systemId,
      canonicalComponentId: 'arch:comp:BAT_PACK',
      connectedBusId: bus.busId,
      chemistry: 'LI_ION_NMC',
      nameplateCapacityWh: 1000.0,
      nominalVoltageV: 28.0,
      maxDischargeRateC: 2.0,
      maxChargeRateC: 1.0,
      roundTripEfficiencyPercent: 95.0,
      stateOfChargePercent: 100.0,
      usableSocMinPercent: 20.0,
      usableSocMaxPercent: 95.0,
      internalResistanceOhms: 0.02,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    // Discharge at 280 W for 2 hours => Current = 10A
    // I^2 * R = 100 * 0.02 = 2.0W loss => Total draw = 282W
    // Energy drawn = 282W * 2h = 564 Wh
    // Delta SoC = (564 / 1000) * 100% = 56.4% => Final SoC = 100 - 56.4 = 43.6%
    const discharge = p7.conversion.computeStorageDischarge(battery.storageId, 280.0, 2.0);

    expect(discharge.dischargeCurrentAmps).toBeCloseTo(10.0, 2);
    expect(discharge.internalResistanceLossWatts).toBeCloseTo(2.0, 2);
    expect(discharge.energyDrawnWh).toBeCloseTo(564.0, 1);
    expect(discharge.finalSocPercent).toBeCloseTo(43.6, 1);
    expect(discharge.isDepleted).toBe(false);
    expect(discharge.isMaxCRateExceeded).toBe(false);
  });

  // --- Case E: Peak / Transient Demand ---
  it('Case E: Peak / Transient Demand — Evaluates voltage drop under surge load', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:surge',
      canonicalId: 'arch:subsys:SURGE',
      p4NodeId: 'thread:surge',
      displayName: 'Surge Test System',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const dom = p7.registry.registerDomain({
      domainId: 'dom:surge',
      systemId: sys.systemId,
      name: '28V Domain',
      domainType: 'DC_LOW_VOLTAGE',
      nominalVoltageV: 28.0,
      voltageRangeMinV: 20.0,
      voltageRangeMaxV: 32.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const bus = p7.registry.registerBus({
      busId: 'bus:surge',
      systemId: sys.systemId,
      domainId: dom.domainId,
      name: 'Surge Bus',
      nominalVoltageV: 28.0,
      maxCurrentCapacityAmps: 200.0,
      connectedSourceIds: ['src:gen_surge'],
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const src = p7.registry.registerSource({
      sourceId: 'src:gen_surge',
      systemId: sys.systemId,
      domainId: dom.domainId,
      canonicalComponentId: 'arch:comp:GEN_SURGE',
      sourceType: 'MAIN_GENERATOR',
      nominalVoltageV: 28.0,
      ratedContinuousPowerWatts: 2000.0,
      peakPowerWatts: 4000.0,
      internalResistanceOhms: 0.01,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    // Surge Motor: Nominal 560W (20A), Peak 2240W (80A)
    const loadMotor = p7.registry.registerLoad({
      loadId: 'load:motor_actuator',
      systemId: sys.systemId,
      domainId: dom.domainId,
      canonicalComponentId: 'arch:comp:MOTOR',
      connectedBusId: bus.busId,
      criticality: 'PRIMARY_MISSION',
      nominalVoltageV: 28.0,
      voltageToleranceMinV: 20.0,
      voltageToleranceMaxV: 30.0,
      nominalDemandWatts: 560.0,
      peakDemandWatts: 2240.0,
      dutyCycle: 1.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const branch = p7.topology.registerBranch({
      branchId: 'br:motor',
      systemId: sys.systemId,
      fromBusId: bus.busId,
      toTargetId: loadMotor.loadId,
      lineResistanceOhms: 0.05,
      maxCurrentAmps: 100.0,
      protectionRatingAmps: 90.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const state = p7.registry.registerOperatingState({
      stateId: 'state:surge',
      systemId: sys.systemId,
      mode: 'ASCENT_MAX_PROPULSION',
      name: 'Peak Ascent Actuation',
      activeSourceIds: [src.sourceId],
      activeLoadIds: [loadMotor.loadId],
      loadScalingFactors: { [loadMotor.loadId]: 4.0 }, // 4x surge = 2240W
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const exec = p7.solver.prepareExecution(sys, [src], [loadMotor], [bus], [branch], state);
    const res = p7.solver.solvePowerFlow(exec.executionId, {
      sources: [src],
      loads: [loadMotor],
      buses: [bus],
      branches: [branch],
      operatingState: state
    });

    // Current = 2240 / 28 = 80 A
    // Line loss = 80^2 * 0.05 = 6400 * 0.05 = 320 W
    // Voltage drop = 80 * 0.05 = 4.0 V => Terminal = 24.0 V
    expect(res.branchCurrentsA[branch.branchId]).toBeCloseTo(80.0, 1);
    expect(res.branchLossesWatts[branch.branchId]).toBeCloseTo(320.0, 1);
    expect(res.busVoltagesV[`terminal:${loadMotor.loadId}`]).toBeCloseTo(24.0, 1);
  });

  // --- Case F: Configuration Sensitivity ---
  it('Case F: Configuration Sensitivity — Invalidation cascades upon architecture mutation', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:config_sens',
      canonicalId: 'arch:subsys:SENS',
      p4NodeId: 'thread:config_sens',
      displayName: 'Sensitivity System',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const dom = p7.registry.registerDomain({
      domainId: 'dom:sens',
      systemId: sys.systemId,
      name: '28V Domain',
      domainType: 'DC_LOW_VOLTAGE',
      nominalVoltageV: 28.0,
      voltageRangeMinV: 24.0,
      voltageRangeMaxV: 32.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const bus = p7.registry.registerBus({
      busId: 'bus:sens',
      systemId: sys.systemId,
      domainId: dom.domainId,
      name: 'Sens Bus',
      nominalVoltageV: 28.0,
      maxCurrentCapacityAmps: 50.0,
      connectedSourceIds: ['src:gen_sens'],
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const src = p7.registry.registerSource({
      sourceId: 'src:gen_sens',
      systemId: sys.systemId,
      domainId: dom.domainId,
      canonicalComponentId: 'arch:comp:GEN_SENS',
      sourceType: 'MAIN_GENERATOR',
      nominalVoltageV: 28.0,
      ratedContinuousPowerWatts: 1000.0,
      peakPowerWatts: 1500.0,
      internalResistanceOhms: 0.01,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const load = p7.registry.registerLoad({
      loadId: 'load:sens',
      systemId: sys.systemId,
      domainId: dom.domainId,
      canonicalComponentId: 'arch:comp:SENS',
      connectedBusId: bus.busId,
      criticality: 'PRIMARY_MISSION',
      nominalVoltageV: 28.0,
      voltageToleranceMinV: 24.0,
      voltageToleranceMaxV: 30.0,
      nominalDemandWatts: 300.0,
      peakDemandWatts: 300.0,
      dutyCycle: 1.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const branch = p7.topology.registerBranch({
      branchId: 'br:sens',
      systemId: sys.systemId,
      fromBusId: bus.busId,
      toTargetId: load.loadId,
      lineResistanceOhms: 0.01,
      maxCurrentAmps: 20.0,
      protectionRatingAmps: 15.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const state = p7.registry.registerOperatingState({
      stateId: 'state:sens',
      systemId: sys.systemId,
      mode: 'CRUISE_NOMINAL',
      name: 'Sens Nominal',
      activeSourceIds: [src.sourceId],
      activeLoadIds: [load.loadId],
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const exec = p7.solver.prepareExecution(sys, [src], [load], [bus], [branch], state);
    p7.solver.solvePowerFlow(exec.executionId, {
      sources: [src],
      loads: [load],
      buses: [bus],
      branches: [branch],
      operatingState: state
    });

    // Invalidate upon architecture change
    const impact = p7.invalidations.invalidateForSystem(sys.systemId, 'Upstream power source replaced');
    expect(impact.invalidatedExecutionIds).toContain(exec.executionId);

    const updatedExec = p7.solver.getExecution(exec.executionId);
    expect(updatedExec?.status).toBe('INVALIDATED');
  });

  // --- Case G: Thermal Coupling ---
  it('Case G: Thermal Coupling — Electrical losses generate P6 heat dissipation summary and coupling record', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:therm_couple',
      canonicalId: 'arch:subsys:THERMAL_COUPLE',
      p4NodeId: 'thread:therm_couple',
      displayName: 'Thermal Coupling System',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const dom = p7.registry.registerDomain({
      domainId: 'dom:therm_couple',
      systemId: sys.systemId,
      name: '28V Domain',
      domainType: 'DC_LOW_VOLTAGE',
      nominalVoltageV: 28.0,
      voltageRangeMinV: 24.0,
      voltageRangeMaxV: 32.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const bus = p7.registry.registerBus({
      busId: 'bus:therm_bus',
      systemId: sys.systemId,
      domainId: dom.domainId,
      name: 'Coupling Bus',
      nominalVoltageV: 28.0,
      maxCurrentCapacityAmps: 50.0,
      connectedSourceIds: ['src:gen_therm'],
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const src = p7.registry.registerSource({
      sourceId: 'src:gen_therm',
      systemId: sys.systemId,
      domainId: dom.domainId,
      canonicalComponentId: 'arch:comp:GEN_T',
      sourceType: 'MAIN_GENERATOR',
      nominalVoltageV: 28.0,
      ratedContinuousPowerWatts: 1500.0,
      peakPowerWatts: 2000.0,
      internalResistanceOhms: 0.01,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    // 500W load with 90% thermal dissipation = 450W heat
    const load = p7.registry.registerLoad({
      loadId: 'load:radar_power_amp',
      systemId: sys.systemId,
      domainId: dom.domainId,
      canonicalComponentId: 'arch:comp:RADAR_AMP',
      connectedBusId: bus.busId,
      criticality: 'PRIMARY_MISSION',
      nominalVoltageV: 28.0,
      voltageToleranceMinV: 24.0,
      voltageToleranceMaxV: 30.0,
      nominalDemandWatts: 500.0,
      peakDemandWatts: 600.0,
      dutyCycle: 1.0,
      thermalLossFraction: 0.90,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const branch = p7.topology.registerBranch({
      branchId: 'br:radar_branch',
      systemId: sys.systemId,
      fromBusId: bus.busId,
      toTargetId: load.loadId,
      lineResistanceOhms: 0.03, // Line loss = (500/28)^2 * 0.03 = 17.857^2 * 0.03 = 318.88 * 0.03 = 9.57 W
      maxCurrentAmps: 30.0,
      protectionRatingAmps: 25.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const state = p7.registry.registerOperatingState({
      stateId: 'state:radar_on',
      systemId: sys.systemId,
      mode: 'MISSION_PAYLOAD_ACTIVE',
      name: 'Radar Payload Active',
      activeSourceIds: [src.sourceId],
      activeLoadIds: [load.loadId],
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const exec = p7.solver.prepareExecution(sys, [src], [load], [bus], [branch], state);
    const res = p7.solver.solvePowerFlow(exec.executionId, {
      sources: [src],
      loads: [load],
      buses: [bus],
      branches: [branch],
      operatingState: state
    });

    expect(res.thermalLossSummaryWatts.loadThermalLossWatts).toBeCloseTo(450.0, 1);
    expect(res.thermalLossSummaryWatts.distributionThermalLossWatts).toBeCloseTo(9.57, 1);

    const coupling = p7.thermalCoupling.couplePowerLossesToThermal(
      res,
      'therm:radar:pod',
      'reg:radar:chassis'
    );

    expect(coupling.totalHeatGeneratedWatts).toBeCloseTo(459.57, 1);
    expect(coupling.powerSystemId).toBe(sys.systemId);
    expect(coupling.p6ThermalModelId).toBe('therm:radar:pod');
  });
});
