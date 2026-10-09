/**
 * SECP — ADSE-P7 Power Integration Forensic & Verification Suite
 * 
 * Formal Verification of the 32 Forensic Gates (P7-V1 through P7-V32)
 * and 35/35 Capability Registry Reconciliation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP7PowerEngine } from '../../../src/engine/adse/p7/ADSEP7PowerEngine';
import { ADSEP7ForensicAuditEngine } from '../../../src/engine/adse/p7/ADSEP7ForensicAuditEngine';
import { ADSEEngine } from '../../../src/engine/adse/p0/ADSEEngine';

describe('ADSE-P7 Power Integration Forensics & 32 Gates', () => {
  let p7: ADSEP7PowerEngine;
  let auditor: ADSEP7ForensicAuditEngine;

  beforeEach(() => {
    p7 = new ADSEP7PowerEngine();
    p7.clear();
    auditor = new ADSEP7ForensicAuditEngine(p7);
  });

  it('P7-CAP-001 through P7-CAP-035: Reconciles all 35 Capabilities in ADSEEngine', () => {
    const adse = ADSEEngine.getInstance();
    const allCaps = adse.getAllCapabilities().filter(c => c.stage === 'P7_POWER_INTEGRATION');
    expect(allCaps.length).toBe(35);

    const requiredCaps = [
      'ADSE_POWER_INTEGRATION',
      'ADSE_POWER_TRUTH',
      'ADSE_POWER_SYSTEM_MODEL',
      'ADSE_POWER_DOMAINS',
      'ADSE_POWER_SOURCES',
      'ADSE_POWER_LOADS',
      'ADSE_POWER_BUSES',
      'ADSE_POWER_DISTRIBUTION_TOPOLOGY',
      'ADSE_POWER_BRANCHES',
      'ADSE_POWER_CONVERSION',
      'ADSE_POWER_STORAGE',
      'ADSE_POWER_PROTECTION',
      'ADSE_POWER_OPERATING_STATES',
      'ADSE_POWER_BUDGET_BALANCE',
      'ADSE_POWER_LOAD_FLOW_ANALYSIS',
      'ADSE_POWER_CONVERTER_LOSSES',
      'ADSE_POWER_STORAGE_DYNAMICS',
      'ADSE_POWER_VOLTAGE_COMPLIANCE',
      'ADSE_POWER_PEAK_TRANSIENT_ANALYSIS',
      'ADSE_POWER_THERMAL_COUPLING',
      'ADSE_POWER_RESULT_INVALIDATION',
      'ADSE_POWER_SAFETY_MARGINS',
      'ADSE_POWER_IMPACT_ANALYSIS',
      'ADSE_POWER_STRUCTURAL_COUPLING',
      'ADSE_POWER_DIGITAL_THREAD',
      'ADSE_POWER_VERIFICATION',
      'ADSE_POWER_EVIDENCE',
      'ADSE_POWER_PROVENANCE',
      'ADSE_POWER_PERSISTENCE',
      'ADSE_POWER_RECONSTRUCTION',
      'ADSE_POWER_AI_GOVERNANCE',
      'ADSE_POWER_FORENSIC_AUDIT',
      'ADSE_POWER_CONFIGURATION_ISOLATION',
      'ADSE_POWER_PUBLICATION',
      'ADSE_POWER_TRUTH_CLOSURE'
    ];

    for (const cap of requiredCaps) {
      expect(adse.getCapability(cap)).toBeDefined();
    }
  });

  it('P7-V1 to P7-V32: Audits all 32 Forensic Gates successfully on a complete canonical model', () => {
    // 1. Register Power System
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:main_28v',
      canonicalId: 'arch:subsys:EPS',
      p5StructuralId: 'struct:assembly:eps_bay',
      p4NodeId: 'thread:node:EPS_SUBSYSTEM',
      displayName: 'Main 28V Electrical Power System',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-BLOCK-1',
      revisionId: 'REV-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    // 2. Register Voltage Domain
    const dom = p7.registry.registerDomain({
      domainId: 'dom:28vdc',
      systemId: sys.systemId,
      name: '28V Regulated DC Bus Domain',
      domainType: 'DC_LOW_VOLTAGE',
      nominalVoltageV: 28.0,
      voltageRangeMinV: 24.0,
      voltageRangeMaxV: 32.0,
      frequencyHz: 0,
      configurationId: 'CONF-BLOCK-1',
      revisionId: 'REV-01'
    });

    // 3. Register Bus
    const mainBus = p7.registry.registerBus({
      busId: 'bus:main_28v_dc',
      systemId: sys.systemId,
      domainId: dom.domainId,
      name: 'Main 28V DC Power Bus',
      nominalVoltageV: 28.0,
      maxCurrentCapacityAmps: 150.0,
      connectedSourceIds: ['src:gen_primary', 'src:battery_main'],
      configurationId: 'CONF-BLOCK-1',
      revisionId: 'REV-01'
    });

    // 4. Register Source (Main Generator)
    const gen = p7.registry.registerSource({
      sourceId: 'src:gen_primary',
      systemId: sys.systemId,
      domainId: dom.domainId,
      canonicalComponentId: 'arch:comp:GEN_V3',
      sourceType: 'MAIN_GENERATOR',
      nominalVoltageV: 28.0,
      ratedContinuousPowerWatts: 3000.0,
      peakPowerWatts: 4500.0,
      internalResistanceOhms: 0.015,
      efficiencyPercent: 94.0,
      configurationId: 'CONF-BLOCK-1',
      revisionId: 'REV-01',
      derivedFromArchitectureId: 'arch:comp:GEN_V3'
    });

    // 5. Register Storage (Main Li-Ion Battery)
    const battery = p7.registry.registerStorage({
      storageId: 'src:battery_main',
      systemId: sys.systemId,
      canonicalComponentId: 'arch:comp:BAT_28V',
      connectedBusId: mainBus.busId,
      chemistry: 'LI_ION_NMC',
      nameplateCapacityWh: 1200.0,
      nominalVoltageV: 28.0,
      maxDischargeRateC: 3.0,
      maxChargeRateC: 1.0,
      roundTripEfficiencyPercent: 95.0,
      stateOfChargePercent: 90.0,
      usableSocMinPercent: 20.0,
      usableSocMaxPercent: 95.0,
      internalResistanceOhms: 0.02,
      configurationId: 'CONF-BLOCK-1',
      revisionId: 'REV-01'
    });

    // 6. Register Loads (Avionics & Mission Payload)
    const loadAvionics = p7.registry.registerLoad({
      loadId: 'load:avionics_flight_ctrl',
      systemId: sys.systemId,
      domainId: dom.domainId,
      canonicalComponentId: 'arch:comp:FLIGHT_COMPUTER',
      connectedBusId: mainBus.busId,
      criticality: 'FLIGHT_CRITICAL_ESSENTIAL',
      nominalVoltageV: 28.0,
      voltageToleranceMinV: 22.0,
      voltageToleranceMaxV: 32.0,
      nominalDemandWatts: 350.0,
      peakDemandWatts: 500.0,
      dutyCycle: 1.0,
      thermalLossFraction: 0.95,
      configurationId: 'CONF-BLOCK-1',
      revisionId: 'REV-01'
    });

    const loadPayload = p7.registry.registerLoad({
      loadId: 'load:radar_tx',
      systemId: sys.systemId,
      domainId: dom.domainId,
      canonicalComponentId: 'arch:comp:RADAR_TRANSMITTER',
      connectedBusId: mainBus.busId,
      criticality: 'PRIMARY_MISSION',
      nominalVoltageV: 28.0,
      voltageToleranceMinV: 24.0,
      voltageToleranceMaxV: 30.0,
      nominalDemandWatts: 1200.0,
      peakDemandWatts: 1800.0,
      dutyCycle: 0.8,
      thermalLossFraction: 0.85,
      configurationId: 'CONF-BLOCK-1',
      revisionId: 'REV-01'
    });

    // 7. Register Branches
    p7.topology.registerBranch({
      branchId: 'br:bus_to_avionics',
      systemId: sys.systemId,
      fromBusId: mainBus.busId,
      toTargetId: loadAvionics.loadId,
      lineResistanceOhms: 0.02,
      maxCurrentAmps: 30.0,
      protectionRatingAmps: 25.0,
      configurationId: 'CONF-BLOCK-1',
      revisionId: 'REV-01'
    });

    p7.topology.registerBranch({
      branchId: 'br:bus_to_radar',
      systemId: sys.systemId,
      fromBusId: mainBus.busId,
      toTargetId: loadPayload.loadId,
      lineResistanceOhms: 0.015,
      maxCurrentAmps: 80.0,
      protectionRatingAmps: 65.0,
      configurationId: 'CONF-BLOCK-1',
      revisionId: 'REV-01'
    });

    // 8. Register Protection
    p7.registry.registerProtection({
      protectionId: 'prot:sspc_radar',
      systemId: sys.systemId,
      branchId: 'br:bus_to_radar',
      deviceType: 'SOLID_STATE_POWER_CONTROLLER',
      tripCurrentAmps: 70.0,
      tripTimeMs: 15.0,
      configurationId: 'CONF-BLOCK-1',
      revisionId: 'REV-01'
    });

    // 9. Register Operating State
    const opState = p7.registry.registerOperatingState({
      stateId: 'state:cruise_nominal',
      systemId: sys.systemId,
      mode: 'CRUISE_NOMINAL',
      name: 'Cruise Nominal Operating State',
      activeSourceIds: [gen.sourceId],
      activeLoadIds: [loadAvionics.loadId, loadPayload.loadId],
      loadScalingFactors: {
        [loadAvionics.loadId]: 1.0,
        [loadPayload.loadId]: 1.0
      },
      storageDischargeEnabled: true,
      configurationId: 'CONF-BLOCK-1',
      revisionId: 'REV-01'
    });

    // 10. Execute Power Flow
    const exec = p7.solver.prepareExecution(
      sys,
      [gen],
      [loadAvionics, loadPayload],
      [mainBus],
      p7.topology.getAllBranches(),
      opState
    );

    const solverResult = p7.solver.solvePowerFlow(exec.executionId, {
      sources: [gen],
      loads: [loadAvionics, loadPayload],
      buses: [mainBus],
      branches: p7.topology.getAllBranches(),
      storages: [battery],
      operatingState: opState
    });

    // 11. Register Verification Intent & Prove Evidence
    const intent = p7.verifications.registerVerificationIntent({
      intentId: 'intent:verify:nominal_loadflow',
      systemId: sys.systemId,
      executionId: exec.executionId,
      operatingStateId: opState.stateId,
      minAllowableVoltageV: 24.0,
      maxAllowableVoltageV: 30.0,
      minRequiredMarginWatts: 500.0,
      minRequiredMarginPercent: 15.0,
      maxAllowablePowerBalanceErrorPercent: 0.001,
      verificationMethod: 'KIRCHHOFF_LOAD_FLOW_AUDIT'
    });

    p7.verifications.verifyExecution(intent.intentId, solverResult, 'SYSTEM_ARCHITECT');

    // 12. Couple to Thermal
    p7.thermalCoupling.couplePowerLossesToThermal(
      solverResult,
      'therm:avionics:chassis',
      'reg:chassis:base'
    );

    // 13. Audit all 32 Forensic Gates
    const audit = auditor.auditAllGates();

    expect(audit.totalGates).toBe(32);
    expect(audit.passedCount).toBe(32);
    expect(audit.isForensicallyClosed).toBe(true);

    for (let i = 1; i <= 32; i++) {
      expect(audit.gates[`P7-V${i}`]).toBe(true);
    }
  });
});
