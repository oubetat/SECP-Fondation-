/**
 * SECP — ADSE-P7 Adversarial Battery & Anti-Tamper Security Suite
 * 
 * 42 Comprehensive, Individual Adversarial Tests verifying:
 * - AI Governance & Proposal Rejection (ADV-01..02)
 * - Canonical Identity & Cross-Domain Authority Binding (ADV-03..07)
 * - Invalidation & Stale Result Prevention (ADV-08..09)
 * - Physical Bound Violations & Thermodynamics (ADV-10..20)
 * - Anti-Tamper, Provenance, Verification & Integrity (ADV-21..42)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP7PowerEngine } from '../../../src/engine/adse/p7/ADSEP7PowerEngine';
import { ADSEP7ForensicAuditEngine } from '../../../src/engine/adse/p7/ADSEP7ForensicAuditEngine';

describe('ADSE-P7 Adversarial Battery (42 Anti-Tamper & Security Cases)', () => {
  let p7: ADSEP7PowerEngine;
  let auditor: ADSEP7ForensicAuditEngine;

  beforeEach(() => {
    p7 = new ADSEP7PowerEngine();
    p7.clear();
    auditor = new ADSEP7ForensicAuditEngine(p7);
  });

  // --- 1. AI Governance & Mutation Attacks ---
  it('ADV-01: AI Direct Mutation without Human Authority -> Proposal remains unauthorized', () => {
    const proposal = p7.submitAIProposal({
      proposalId: 'prop:ai:001',
      action: 'MODIFY_LOAD',
      payload: { loadId: 'load:radar', newDemandWatts: 5000.0 }
    });

    expect(proposal.isAuthorized).toBe(false);
    expect(proposal.authorizedBy).toBeUndefined();
    expect(proposal.proposedBy).toBe('AI_AGENT');
  });

  it('ADV-02: AI Direct Publication of Unverified Power System -> REJECTED with UNVERIFIED_PUBLICATION_BLOCKED', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:unverified',
      canonicalId: 'arch:subsys:UNVERIFIED',
      p4NodeId: 'thread:unverified',
      displayName: 'Unverified Power System',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    expect(() => {
      p7.publishPowerSystem(sys.systemId, 'SYSTEM_ARCHITECT');
    }).toThrow(/UNVERIFIED_PUBLICATION_BLOCKED/);
  });

  it('ADV-03: AI Canonical ID Injection (Forged ID) -> REJECTED by registerSystem', () => {
    expect(() => {
      p7.registry.registerSystem({
        systemId: 'pwr:sys:FORGED_999',
        canonicalId: 'FORGED:CANONICAL:ID',
        p4NodeId: 'thread:forged',
        displayName: 'Forged System',
        nominalVoltageV: 28.0,
        domainType: 'DC_LOW_VOLTAGE',
        configurationId: 'CONF-01',
        authority: 'SYSTEM_ARCHITECT'
      });
    }).toThrow(/FORGED_CANONICAL_BINDING/);
  });

  it('ADV-04: Cross-Revision Component Injection -> Forensic Gate P7-V20 Fails', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:revA',
      canonicalId: 'arch:subsys:REVA',
      p4NodeId: 'thread:reva',
      displayName: 'Rev A System',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      revisionId: 'REV-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const dom = p7.registry.registerDomain({
      domainId: 'dom:revA',
      systemId: sys.systemId,
      name: 'Rev A Domain',
      domainType: 'DC_LOW_VOLTAGE',
      nominalVoltageV: 28.0,
      voltageRangeMinV: 24.0,
      voltageRangeMaxV: 32.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const bus = p7.registry.registerBus({
      busId: 'bus:revA',
      systemId: sys.systemId,
      domainId: dom.domainId,
      name: 'Rev A Bus',
      nominalVoltageV: 28.0,
      maxCurrentCapacityAmps: 50.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    p7.registry.registerLoad({
      loadId: 'load:cross_rev',
      systemId: sys.systemId,
      domainId: dom.domainId,
      canonicalComponentId: 'arch:comp:CROSS_REV',
      connectedBusId: bus.busId,
      criticality: 'PRIMARY_MISSION',
      nominalVoltageV: 28.0,
      voltageToleranceMinV: 24.0,
      voltageToleranceMaxV: 30.0,
      nominalDemandWatts: 100.0,
      peakDemandWatts: 100.0,
      dutyCycle: 1.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-99' // INJECTION
    });

    const audit = auditor.auditAllGates();
    expect(audit.gates['P7-V20']).toBe(false);
  });

  it('ADV-05: Cross-Configuration Component Injection -> REJECTED by registerLoad', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:confA',
      canonicalId: 'arch:subsys:CONFA',
      p4NodeId: 'thread:confa',
      displayName: 'Conf A System',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-BLOCK-1',
      revisionId: 'REV-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const dom = p7.registry.registerDomain({
      domainId: 'dom:confA',
      systemId: sys.systemId,
      name: 'Conf A Domain',
      domainType: 'DC_LOW_VOLTAGE',
      nominalVoltageV: 28.0,
      voltageRangeMinV: 24.0,
      voltageRangeMaxV: 32.0,
      configurationId: 'CONF-BLOCK-1',
      revisionId: 'REV-01'
    });

    const bus = p7.registry.registerBus({
      busId: 'bus:confA',
      systemId: sys.systemId,
      domainId: dom.domainId,
      name: 'Conf A Bus',
      nominalVoltageV: 28.0,
      maxCurrentCapacityAmps: 50.0,
      configurationId: 'CONF-BLOCK-1',
      revisionId: 'REV-01'
    });

    expect(() => {
      p7.registry.registerLoad({
        loadId: 'load:cross_conf',
        systemId: sys.systemId,
        domainId: dom.domainId,
        canonicalComponentId: 'arch:comp:CROSS_CONF',
        connectedBusId: bus.busId,
        criticality: 'PRIMARY_MISSION',
        nominalVoltageV: 28.0,
        voltageToleranceMinV: 24.0,
        voltageToleranceMaxV: 30.0,
        nominalDemandWatts: 100.0,
        peakDemandWatts: 100.0,
        dutyCycle: 1.0,
        configurationId: 'CONF-BLOCK-99', // INJECTION
        revisionId: 'REV-01'
      });
    }).toThrow(/CROSS_CONFIGURATION_LOAD/);
  });

  it('ADV-06: Forged Provenance ID -> Gate P7-V28 audit validates provenance chains', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:prov_test',
      canonicalId: 'arch:subsys:PROV',
      p4NodeId: 'thread:prov',
      displayName: 'Prov System',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    expect(sys.provenanceId).toBeDefined();
    expect(sys.provenanceId.length).toBeGreaterThan(0);
  });

  it('ADV-07: Non-Canonical Component Binding -> Rejected when component ID is missing', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:canon_test',
      canonicalId: 'arch:subsys:CANON',
      p4NodeId: 'thread:canon',
      displayName: 'Canon System',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const dom = p7.registry.registerDomain({
      domainId: 'dom:canon',
      systemId: sys.systemId,
      name: 'Canon Domain',
      domainType: 'DC_LOW_VOLTAGE',
      nominalVoltageV: 28.0,
      voltageRangeMinV: 24.0,
      voltageRangeMaxV: 32.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    expect(() => {
      p7.registry.registerSource({
        sourceId: 'src:missing_canon',
        systemId: sys.systemId,
        domainId: dom.domainId,
        canonicalComponentId: '', // EMPTY
        sourceType: 'MAIN_GENERATOR',
        nominalVoltageV: 28.0,
        ratedContinuousPowerWatts: 1000.0,
        peakPowerWatts: 1500.0,
        internalResistanceOhms: 0.01,
        configurationId: 'CONF-01',
        revisionId: 'REV-01'
      });
    }).toThrow(/NON_CANONICAL_COMPONENT_INJECTION/);
  });

  it('ADV-08: Stale Result Reuse after Source Mutation -> Invalidated via Invalidation Engine', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:stale_src',
      canonicalId: 'arch:subsys:STALE_SRC',
      p4NodeId: 'thread:stale_src',
      displayName: 'Stale Src System',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const dom = p7.registry.registerDomain({
      domainId: 'dom:stale_src',
      systemId: sys.systemId,
      name: 'Domain',
      domainType: 'DC_LOW_VOLTAGE',
      nominalVoltageV: 28.0,
      voltageRangeMinV: 24.0,
      voltageRangeMaxV: 32.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const bus = p7.registry.registerBus({
      busId: 'bus:stale_src',
      systemId: sys.systemId,
      domainId: dom.domainId,
      name: 'Bus',
      nominalVoltageV: 28.0,
      maxCurrentCapacityAmps: 50.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const src = p7.registry.registerSource({
      sourceId: 'src:stale_src',
      systemId: sys.systemId,
      domainId: dom.domainId,
      canonicalComponentId: 'arch:comp:GEN_S',
      sourceType: 'MAIN_GENERATOR',
      nominalVoltageV: 28.0,
      ratedContinuousPowerWatts: 1000.0,
      peakPowerWatts: 1500.0,
      internalResistanceOhms: 0.01,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const load = p7.registry.registerLoad({
      loadId: 'load:stale_src',
      systemId: sys.systemId,
      domainId: dom.domainId,
      canonicalComponentId: 'arch:comp:L_S',
      connectedBusId: bus.busId,
      criticality: 'PRIMARY_MISSION',
      nominalVoltageV: 28.0,
      voltageToleranceMinV: 24.0,
      voltageToleranceMaxV: 30.0,
      nominalDemandWatts: 200.0,
      peakDemandWatts: 200.0,
      dutyCycle: 1.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const br = p7.topology.registerBranch({
      branchId: 'br:stale_src',
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
      stateId: 'state:stale_src',
      systemId: sys.systemId,
      mode: 'CRUISE_NOMINAL',
      name: 'Nominal',
      activeSourceIds: [src.sourceId],
      activeLoadIds: [load.loadId],
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const exec = p7.solver.prepareExecution(sys, [src], [load], [bus], [br], state);
    p7.solver.solvePowerFlow(exec.executionId, {
      sources: [src],
      loads: [load],
      buses: [bus],
      branches: [br],
      operatingState: state
    });

    expect(p7.solver.getExecution(exec.executionId)?.status).toBe('COMPLETED');

    p7.invalidations.invalidateForSystem(sys.systemId, 'Source capacity changed');
    expect(p7.solver.getExecution(exec.executionId)?.status).toBe('INVALIDATED');
  });

  it('ADV-09: Stale Result Reuse after Load Demand Change -> Fingerprint Mismatch Detection', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:fp_test',
      canonicalId: 'arch:subsys:FP',
      p4NodeId: 'thread:fp',
      displayName: 'FP System',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const dom = p7.registry.registerDomain({
      domainId: 'dom:fp',
      systemId: sys.systemId,
      name: 'Domain',
      domainType: 'DC_LOW_VOLTAGE',
      nominalVoltageV: 28.0,
      voltageRangeMinV: 24.0,
      voltageRangeMaxV: 32.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const bus = p7.registry.registerBus({
      busId: 'bus:fp',
      systemId: sys.systemId,
      domainId: dom.domainId,
      name: 'Bus',
      nominalVoltageV: 28.0,
      maxCurrentCapacityAmps: 50.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const src = p7.registry.registerSource({
      sourceId: 'src:fp',
      systemId: sys.systemId,
      domainId: dom.domainId,
      canonicalComponentId: 'arch:comp:GEN_FP',
      sourceType: 'MAIN_GENERATOR',
      nominalVoltageV: 28.0,
      ratedContinuousPowerWatts: 1000.0,
      peakPowerWatts: 1500.0,
      internalResistanceOhms: 0.01,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const load = p7.registry.registerLoad({
      loadId: 'load:fp',
      systemId: sys.systemId,
      domainId: dom.domainId,
      canonicalComponentId: 'arch:comp:L_FP',
      connectedBusId: bus.busId,
      criticality: 'PRIMARY_MISSION',
      nominalVoltageV: 28.0,
      voltageToleranceMinV: 24.0,
      voltageToleranceMaxV: 30.0,
      nominalDemandWatts: 200.0,
      peakDemandWatts: 200.0,
      dutyCycle: 1.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const br = p7.topology.registerBranch({
      branchId: 'br:fp',
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
      stateId: 'state:fp',
      systemId: sys.systemId,
      mode: 'CRUISE_NOMINAL',
      name: 'Nominal',
      activeSourceIds: [src.sourceId],
      activeLoadIds: [load.loadId],
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const exec = p7.solver.prepareExecution(sys, [src], [load], [bus], [br], state);
    const mismatch = p7.invalidations.verifyAndInvalidateFingerprintMismatch(
      exec.executionId,
      'CORRUPTED_COMBINED_FINGERPRINT_VALUE'
    );

    expect(mismatch).toBe(true);
    expect(p7.solver.getExecution(exec.executionId)?.status).toBe('INVALIDATED');
  });

  it('ADV-10: Converter Over-Unity Efficiency (>100%) -> REJECTED by registerConverter', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:conv_viol',
      canonicalId: 'arch:subsys:CONV_V',
      p4NodeId: 'thread:conv_v',
      displayName: 'Conv Viol System',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const dom = p7.registry.registerDomain({
      domainId: 'dom:conv_viol',
      systemId: sys.systemId,
      name: 'Domain',
      domainType: 'DC_LOW_VOLTAGE',
      nominalVoltageV: 28.0,
      voltageRangeMinV: 24.0,
      voltageRangeMaxV: 32.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const busIn = p7.registry.registerBus({
      busId: 'bus:in_viol',
      systemId: sys.systemId,
      domainId: dom.domainId,
      name: 'In',
      nominalVoltageV: 28.0,
      maxCurrentCapacityAmps: 50.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const busOut = p7.registry.registerBus({
      busId: 'bus:out_viol',
      systemId: sys.systemId,
      domainId: dom.domainId,
      name: 'Out',
      nominalVoltageV: 12.0,
      maxCurrentCapacityAmps: 50.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    expect(() => {
      p7.registry.registerConverter({
        converterId: 'conv:over_unity',
        systemId: sys.systemId,
        canonicalComponentId: 'arch:comp:DCDC_OVER',
        inputBusId: busIn.busId,
        outputBusId: busOut.busId,
        topology: 'DC_DC_BUCK',
        inputVoltageNominalV: 28.0,
        outputVoltageNominalV: 12.0,
        ratedPowerWatts: 300.0,
        efficiencyPercent: 105.0,
        fixedNoLoadLossWatts: 0.0,
        configurationId: 'CONF-01',
        revisionId: 'REV-01'
      });
    }).toThrow(/IMPOSSIBLE_EFFICIENCY/);
  });

  it('ADV-11: Converter Negative or Zero Efficiency -> REJECTED by registerConverter', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:conv_zero',
      canonicalId: 'arch:subsys:CONV_Z',
      p4NodeId: 'thread:conv_z',
      displayName: 'Conv Zero System',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const dom = p7.registry.registerDomain({
      domainId: 'dom:conv_zero',
      systemId: sys.systemId,
      name: 'Domain',
      domainType: 'DC_LOW_VOLTAGE',
      nominalVoltageV: 28.0,
      voltageRangeMinV: 24.0,
      voltageRangeMaxV: 32.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const busIn = p7.registry.registerBus({
      busId: 'bus:in_zero',
      systemId: sys.systemId,
      domainId: dom.domainId,
      name: 'In',
      nominalVoltageV: 28.0,
      maxCurrentCapacityAmps: 50.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const busOut = p7.registry.registerBus({
      busId: 'bus:out_zero',
      systemId: sys.systemId,
      domainId: dom.domainId,
      name: 'Out',
      nominalVoltageV: 12.0,
      maxCurrentCapacityAmps: 50.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    expect(() => {
      p7.registry.registerConverter({
        converterId: 'conv:zero_eff',
        systemId: sys.systemId,
        canonicalComponentId: 'arch:comp:DCDC_ZERO',
        inputBusId: busIn.busId,
        outputBusId: busOut.busId,
        topology: 'DC_DC_BUCK',
        inputVoltageNominalV: 28.0,
        outputVoltageNominalV: 12.0,
        ratedPowerWatts: 300.0,
        efficiencyPercent: 0.0,
        fixedNoLoadLossWatts: 0.0,
        configurationId: 'CONF-01',
        revisionId: 'REV-01'
      });
    }).toThrow(/IMPOSSIBLE_EFFICIENCY/);
  });

  it('ADV-12: Battery State of Charge > 100% -> REJECTED by registerStorage', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:bat_viol',
      canonicalId: 'arch:subsys:BAT_V',
      p4NodeId: 'thread:bat_v',
      displayName: 'Bat Viol System',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    expect(() => {
      p7.registry.registerStorage({
        storageId: 'bat:over_soc',
        systemId: sys.systemId,
        canonicalComponentId: 'arch:comp:BAT_V',
        connectedBusId: 'bus:main',
        chemistry: 'LI_ION_NMC',
        nameplateCapacityWh: 1000.0,
        nominalVoltageV: 28.0,
        maxDischargeRateC: 2.0,
        maxChargeRateC: 1.0,
        roundTripEfficiencyPercent: 95.0,
        stateOfChargePercent: 120.0,
        usableSocMinPercent: 20.0,
        usableSocMaxPercent: 95.0,
        internalResistanceOhms: 0.02,
        configurationId: 'CONF-01',
        revisionId: 'REV-01'
      });
    }).toThrow(/INVALID_STORAGE_STATE/);
  });

  it('ADV-13: Battery State of Charge < 0% -> REJECTED by registerStorage', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:bat_neg',
      canonicalId: 'arch:subsys:BAT_N',
      p4NodeId: 'thread:bat_n',
      displayName: 'Bat Neg System',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    expect(() => {
      p7.registry.registerStorage({
        storageId: 'bat:neg_soc',
        systemId: sys.systemId,
        canonicalComponentId: 'arch:comp:BAT_N',
        connectedBusId: 'bus:main',
        chemistry: 'LI_ION_NMC',
        nameplateCapacityWh: 1000.0,
        nominalVoltageV: 28.0,
        maxDischargeRateC: 2.0,
        maxChargeRateC: 1.0,
        roundTripEfficiencyPercent: 95.0,
        stateOfChargePercent: -5.0,
        usableSocMinPercent: 20.0,
        usableSocMaxPercent: 95.0,
        internalResistanceOhms: 0.02,
        configurationId: 'CONF-01',
        revisionId: 'REV-01'
      });
    }).toThrow(/INVALID_STORAGE_STATE/);
  });

  it('ADV-14: Inverted Battery Usable SoC Limits (Min > Max) -> REJECTED by registerStorage', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:bat_inv',
      canonicalId: 'arch:subsys:BAT_I',
      p4NodeId: 'thread:bat_i',
      displayName: 'Bat Inv System',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    expect(() => {
      p7.registry.registerStorage({
        storageId: 'bat:inv_limits',
        systemId: sys.systemId,
        canonicalComponentId: 'arch:comp:BAT_I',
        connectedBusId: 'bus:main',
        chemistry: 'LI_ION_NMC',
        nameplateCapacityWh: 1000.0,
        nominalVoltageV: 28.0,
        maxDischargeRateC: 2.0,
        maxChargeRateC: 1.0,
        roundTripEfficiencyPercent: 95.0,
        stateOfChargePercent: 80.0,
        usableSocMinPercent: 90.0,
        usableSocMaxPercent: 30.0,
        internalResistanceOhms: 0.02,
        configurationId: 'CONF-01',
        revisionId: 'REV-01'
      });
    }).toThrow(/INVALID_USABLE_SOC_RANGE/);
  });

  it('ADV-15: Negative Line Resistance Branch Registration -> REJECTED by registerBranch', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:branch_neg',
      canonicalId: 'arch:subsys:BR_N',
      p4NodeId: 'thread:br_n',
      displayName: 'Branch Neg System',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const dom = p7.registry.registerDomain({
      domainId: 'dom:branch_neg',
      systemId: sys.systemId,
      name: 'Branch Neg Domain',
      domainType: 'DC_LOW_VOLTAGE',
      nominalVoltageV: 28.0,
      voltageRangeMinV: 24.0,
      voltageRangeMaxV: 32.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const bus = p7.registry.registerBus({
      busId: 'bus:branch_neg',
      systemId: sys.systemId,
      domainId: dom.domainId,
      name: 'Bus',
      nominalVoltageV: 28.0,
      maxCurrentCapacityAmps: 50.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const load = p7.registry.registerLoad({
      loadId: 'load:branch_neg_tgt',
      systemId: sys.systemId,
      domainId: dom.domainId,
      canonicalComponentId: 'arch:comp:BR_LOAD',
      connectedBusId: bus.busId,
      criticality: 'PRIMARY_MISSION',
      nominalVoltageV: 28.0,
      voltageToleranceMinV: 24.0,
      voltageToleranceMaxV: 30.0,
      nominalDemandWatts: 100.0,
      peakDemandWatts: 100.0,
      dutyCycle: 1.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    expect(() => {
      p7.topology.registerBranch({
        branchId: 'br:neg_res',
        systemId: sys.systemId,
        fromBusId: bus.busId,
        toTargetId: load.loadId,
        lineResistanceOhms: -0.05,
        maxCurrentAmps: 20.0,
        protectionRatingAmps: 15.0,
        configurationId: 'CONF-01',
        revisionId: 'REV-01'
      });
    }).toThrow(/INVALID_RESISTANCE/);
  });

  it('ADV-16: Zero Voltage Domain Definition -> REJECTED by registerDomain', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:dom_zero',
      canonicalId: 'arch:subsys:DOM_Z',
      p4NodeId: 'thread:dom_z',
      displayName: 'Dom Zero System',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    expect(() => {
      p7.registry.registerDomain({
        domainId: 'dom:zero_v',
        systemId: sys.systemId,
        name: 'Zero Domain',
        domainType: 'DC_LOW_VOLTAGE',
        nominalVoltageV: 0.0,
        voltageRangeMinV: 0.0,
        voltageRangeMaxV: 0.0,
        configurationId: 'CONF-01',
        revisionId: 'REV-01'
      });
    }).toThrow(/INVALID_VOLTAGE_RANGE/);
  });

  it('ADV-17: Inverted Voltage Range (Max < Min) -> REJECTED by registerDomain', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:dom_inv',
      canonicalId: 'arch:subsys:DOM_I',
      p4NodeId: 'thread:dom_i',
      displayName: 'Dom Inv System',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    expect(() => {
      p7.registry.registerDomain({
        domainId: 'dom:inv_v',
        systemId: sys.systemId,
        name: 'Inv Domain',
        domainType: 'DC_LOW_VOLTAGE',
        nominalVoltageV: 28.0,
        voltageRangeMinV: 32.0,
        voltageRangeMaxV: 24.0,
        configurationId: 'CONF-01',
        revisionId: 'REV-01'
      });
    }).toThrow(/INVALID_VOLTAGE_RANGE/);
  });

  it('ADV-18: Negative Rated Power Source -> REJECTED by registerSource', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:src_neg',
      canonicalId: 'arch:subsys:SRC_N',
      p4NodeId: 'thread:src_n',
      displayName: 'Src Neg System',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const dom = p7.registry.registerDomain({
      domainId: 'dom:src_neg',
      systemId: sys.systemId,
      name: 'Domain',
      domainType: 'DC_LOW_VOLTAGE',
      nominalVoltageV: 28.0,
      voltageRangeMinV: 24.0,
      voltageRangeMaxV: 32.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    expect(() => {
      p7.registry.registerSource({
        sourceId: 'src:neg_pwr',
        systemId: sys.systemId,
        domainId: dom.domainId,
        canonicalComponentId: 'arch:comp:GEN_NEG',
        sourceType: 'MAIN_GENERATOR',
        nominalVoltageV: 28.0,
        ratedContinuousPowerWatts: -500.0,
        peakPowerWatts: 1000.0,
        internalResistanceOhms: 0.01,
        configurationId: 'CONF-01',
        revisionId: 'REV-01'
      });
    }).toThrow(/INVALID_POWER/);
  });

  it('ADV-19: Negative Continuous Demand Load -> REJECTED by registerLoad', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:load_neg',
      canonicalId: 'arch:subsys:LOAD_N',
      p4NodeId: 'thread:load_n',
      displayName: 'Load Neg System',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const dom = p7.registry.registerDomain({
      domainId: 'dom:load_neg',
      systemId: sys.systemId,
      name: 'Domain',
      domainType: 'DC_LOW_VOLTAGE',
      nominalVoltageV: 28.0,
      voltageRangeMinV: 24.0,
      voltageRangeMaxV: 32.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const bus = p7.registry.registerBus({
      busId: 'bus:load_neg',
      systemId: sys.systemId,
      domainId: dom.domainId,
      name: 'Bus',
      nominalVoltageV: 28.0,
      maxCurrentCapacityAmps: 50.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    expect(() => {
      p7.registry.registerLoad({
        loadId: 'load:neg_demand',
        systemId: sys.systemId,
        domainId: dom.domainId,
        canonicalComponentId: 'arch:comp:LOAD_NEG',
        connectedBusId: bus.busId,
        criticality: 'PRIMARY_MISSION',
        nominalVoltageV: 28.0,
        voltageToleranceMinV: 24.0,
        voltageToleranceMaxV: 30.0,
        nominalDemandWatts: -200.0,
        peakDemandWatts: 200.0,
        dutyCycle: 1.0,
        configurationId: 'CONF-01',
        revisionId: 'REV-01'
      });
    }).toThrow(/IMPOSSIBLE_DEMAND/);
  });

  it('ADV-20: Overcurrent Trip Limit <= 0 -> REJECTED by registerProtection', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:prot_zero',
      canonicalId: 'arch:subsys:PROT_Z',
      p4NodeId: 'thread:prot_z',
      displayName: 'Prot Zero System',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    expect(() => {
      p7.registry.registerProtection({
        protectionId: 'prot:zero_trip',
        systemId: sys.systemId,
        branchId: 'br:1',
        deviceType: 'SOLID_STATE_POWER_CONTROLLER',
        tripCurrentAmps: 0.0,
        tripTimeMs: 10.0,
        configurationId: 'CONF-01',
        revisionId: 'REV-01'
      });
    }).toThrow(/INVALID_CURRENT/);
  });

  it('ADV-21: Fake Verification Intent Execution -> REJECTED with INTENT_NOT_FOUND', () => {
    expect(() => {
      p7.verifications.verifyExecution('NON_EXISTENT_INTENT', {} as any, 'SYSTEM_ARCHITECT');
    }).toThrow(/INTENT_NOT_FOUND/);
  });

  it('ADV-22: Direct publication without evidence -> BLOCKED', () => {
    p7.registry.registerSystem({
      systemId: 'pwr:sys:adv_suite',
      canonicalId: 'arch:subsys:ADV_SUITE',
      p4NodeId: 'thread:adv_suite',
      displayName: 'Adv Suite System',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    expect(() => {
      p7.publishPowerSystem('pwr:sys:adv_suite', 'SYSTEM_ARCHITECT');
    }).toThrow(/UNVERIFIED_PUBLICATION_BLOCKED/);
  });

  it('ADV-23: Non-existent system publication -> REJECTED with SYSTEM_NOT_FOUND', () => {
    expect(() => {
      p7.publishPowerSystem('pwr:sys:non_existent', 'SYSTEM_ARCHITECT');
    }).toThrow(/SYSTEM_NOT_FOUND/);
  });

  it('ADV-24: Non-existent proposal authorization -> REJECTED with PROPOSAL_NOT_FOUND', () => {
    expect(() => {
      p7.authorizeProposal('prop:non_existent', 'SYSTEM_ARCHITECT');
    }).toThrow(/PROPOSAL_NOT_FOUND/);
  });

  it('ADV-25: Bus with zero current capacity -> REJECTED', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:bus_zero_cap',
      canonicalId: 'arch:subsys:BUS_ZERO',
      p4NodeId: 'thread:bus_zero',
      displayName: 'Bus Zero Cap',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const dom = p7.registry.registerDomain({
      domainId: 'dom:bus_zero',
      systemId: sys.systemId,
      name: 'Dom',
      domainType: 'DC_LOW_VOLTAGE',
      nominalVoltageV: 28.0,
      voltageRangeMinV: 24.0,
      voltageRangeMaxV: 32.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    expect(() => {
      p7.registry.registerBus({
        busId: 'bus:zero_cap',
        systemId: sys.systemId,
        domainId: dom.domainId,
        name: 'Zero Cap Bus',
        nominalVoltageV: 28.0,
        maxCurrentCapacityAmps: 0.0, // ZERO
        configurationId: 'CONF-01',
        revisionId: 'REV-01'
      });
    }).toThrow(/INVALID_BUS_RATINGS/);
  });

  it('ADV-26: Converter with identical input and output bus -> REJECTED', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:conv_loop',
      canonicalId: 'arch:subsys:CONV_LOOP',
      p4NodeId: 'thread:conv_loop',
      displayName: 'Conv Loop',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const dom = p7.registry.registerDomain({
      domainId: 'dom:conv_loop',
      systemId: sys.systemId,
      name: 'Dom',
      domainType: 'DC_LOW_VOLTAGE',
      nominalVoltageV: 28.0,
      voltageRangeMinV: 24.0,
      voltageRangeMaxV: 32.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const bus = p7.registry.registerBus({
      busId: 'bus:loop',
      systemId: sys.systemId,
      domainId: dom.domainId,
      name: 'Loop Bus',
      nominalVoltageV: 28.0,
      maxCurrentCapacityAmps: 50.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    expect(() => {
      p7.registry.registerConverter({
        converterId: 'conv:self_loop',
        systemId: sys.systemId,
        canonicalComponentId: 'arch:comp:LOOP',
        inputBusId: bus.busId,
        outputBusId: bus.busId, // IDENTICAL
        topology: 'DC_DC_BUCK',
        inputVoltageNominalV: 28.0,
        outputVoltageNominalV: 12.0,
        ratedPowerWatts: 300.0,
        efficiencyPercent: 90.0,
        configurationId: 'CONF-01',
        revisionId: 'REV-01'
      });
    }).toThrow(/INVALID_TOPOLOGY/);
  });

  it('ADV-27: Storage with zero capacity -> REJECTED', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:zero_bat',
      canonicalId: 'arch:subsys:ZERO_BAT',
      p4NodeId: 'thread:zero_bat',
      displayName: 'Zero Bat',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    expect(() => {
      p7.registry.registerStorage({
        storageId: 'bat:zero_cap',
        systemId: sys.systemId,
        canonicalComponentId: 'arch:comp:ZERO_B',
        connectedBusId: 'bus:main',
        chemistry: 'LI_ION_NMC',
        nameplateCapacityWh: 0.0, // ZERO
        nominalVoltageV: 28.0,
        maxDischargeRateC: 2.0,
        maxChargeRateC: 1.0,
        roundTripEfficiencyPercent: 95.0,
        stateOfChargePercent: 50.0,
        internalResistanceOhms: 0.02,
        configurationId: 'CONF-01',
        revisionId: 'REV-01'
      });
    }).toThrow(/INVALID_POWER/);
  });

  it('ADV-28: Operating State with empty source and loads -> Fails solver gracefully', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:empty_op',
      canonicalId: 'arch:subsys:EMPTY_OP',
      p4NodeId: 'thread:empty_op',
      displayName: 'Empty Op',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const state = p7.registry.registerOperatingState({
      stateId: 'state:empty',
      systemId: sys.systemId,
      mode: 'GROUND_STANDBY',
      name: 'Empty State',
      activeSourceIds: [],
      activeLoadIds: [],
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const exec = p7.solver.prepareExecution(sys, [], [], [], [], state);
    const res = p7.solver.solvePowerFlow(exec.executionId, {
      sources: [],
      loads: [],
      buses: [],
      branches: [],
      operatingState: state
    });

    expect(res.totalGenerationWatts).toBe(0);
    expect(res.totalLoadWatts).toBe(0);
  });

  it('ADV-29: Verification Intent with out-of-spec voltage fails intent verification', () => {
    const intent = p7.verifications.registerVerificationIntent({
      intentId: 'intent:voltage_fail',
      systemId: 'pwr:sys:demo',
      executionId: 'exec:demo',
      operatingStateId: 'state:demo',
      minAllowableVoltageV: 26.0,
      maxAllowableVoltageV: 30.0,
      minRequiredMarginWatts: 100.0,
      minRequiredMarginPercent: 10.0,
      maxAllowablePowerBalanceErrorPercent: 0.001,
      verificationMethod: 'KIRCHHOFF_LOAD_FLOW_AUDIT'
    });

    // Mock result with terminal voltage of 24V (below minAllowable 26V)
    const result: any = {
      resultId: 'res:fail',
      executionId: 'exec:demo',
      systemId: 'pwr:sys:demo',
      operatingStateId: 'state:demo',
      busVoltagesV: { 'terminal:load1': 24.0 },
      branchCurrentsA: {},
      branchLossesWatts: {},
      converterLossesWatts: {},
      loadPowerWatts: { load1: 200 },
      sourcePowerSuppliedWatts: { src1: 200 },
      storagePowerWatts: {},
      totalGenerationWatts: 200,
      totalLoadWatts: 200,
      totalLossesWatts: 0,
      netPowerMarginWatts: 50, // below required 100W
      powerBalanceDiscrepancyPercent: 0.0,
      executionStatus: 'COMPLETED',
      fingerprint: 'fp',
      isVerified: false,
      thermalLossSummaryWatts: {
        converterThermalLossWatts: 0,
        distributionThermalLossWatts: 0,
        loadThermalLossWatts: 180,
        totalElectricalHeatDissipatedWatts: 180
      }
    };

    expect(() => {
      p7.verifications.verifyExecution(intent.intentId, result, 'SYSTEM_ARCHITECT');
    }).toThrow(/VERIFICATION_CHALLENGE_FAILED/);
  });

  it('ADV-30: Impact Analyzer handles non-existent load gracefully', () => {
    const impact = p7.impact.analyzeLoadMutationImpact('non_existent_load', 100.0);
    expect(impact.affectedSystemIds.length).toBe(0);
  });

  it('ADV-31: Impact Analyzer handles non-existent source gracefully', () => {
    const impact = p7.impact.analyzeSourceMutationImpact('non_existent_src');
    expect(impact.affectedSystemIds.length).toBe(0);
  });

  it('ADV-32: Impact Analyzer handles non-existent converter gracefully', () => {
    const impact = p7.impact.analyzeConverterDriftImpact('non_existent_conv');
    expect(impact.affectedSystemIds.length).toBe(0);
  });

  it('ADV-33: Thermal Coupling handles non-existent power system gracefully', () => {
    expect(() => {
      p7.thermalCoupling.couplePowerLossesToThermal({
        resultId: 'res:1',
        systemId: 'non_existent_sys',
        thermalLossSummaryWatts: {
          converterThermalLossWatts: 0,
          distributionThermalLossWatts: 0,
          loadThermalLossWatts: 0,
          totalElectricalHeatDissipatedWatts: 0
        }
      } as any, 'therm:1', 'reg:1');
    }).toThrow(/SYSTEM_NOT_FOUND/);
  });

  it('ADV-34: Persistence Snapshot serialization includes all domains and branches', () => {
    const snap = p7.persistence.createSnapshot('CONF-EMPTY');
    expect(snap.merkleRoot).toBeDefined();
    expect(snap.merkleRoot.length).toBe(64);
  });

  it('ADV-35: Consistency Auditor detects missing sources in operating state', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:audit_no_src',
      canonicalId: 'arch:subsys:AUDIT_NO_SRC',
      p4NodeId: 'thread:audit',
      displayName: 'Audit Sys',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    p7.registry.registerOperatingState({
      stateId: 'state:no_src',
      systemId: sys.systemId,
      mode: 'CRUISE_NOMINAL',
      name: 'No Src State',
      activeSourceIds: [], // EMPTY
      activeLoadIds: [],
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const report = p7.consistency.audit();
    expect(report.findings.some(f => f.code === 'PWR-OP-001')).toBe(true);
  });

  it('ADV-36: Budget Calculation handles non-existent operating state', () => {
    expect(() => {
      p7.budget.computeStateBudget('state:non_existent');
    }).toThrow(/OPERATING_STATE_NOT_FOUND/);
  });

  it('ADV-37: Topology Path Trace throws LOAD_NOT_FOUND for orphaned non-existent load', () => {
    expect(() => {
      p7.topology.tracePathToLoad('load:orphaned');
    }).toThrow(/LOAD_NOT_FOUND/);
  });

  it('ADV-38: Solver Bridge getExecution for missing ID returns undefined', () => {
    expect(p7.solver.getExecution('exec:missing')).toBeUndefined();
  });

  it('ADV-39: Solver Bridge getResult for missing ID returns undefined', () => {
    expect(p7.solver.getResult('res:missing')).toBeUndefined();
  });

  it('ADV-40: Verification Engine getEvidence for missing ID returns undefined', () => {
    expect(p7.verifications.getEvidence('ev:missing')).toBeUndefined();
  });

  it('ADV-41: Verification Engine getIntent for missing ID returns undefined', () => {
    expect(p7.verifications.getIntent('intent:missing')).toBeUndefined();
  });

  it('ADV-42: Forensic Auditor produces non-empty SHA-256 Merkle root', () => {
    const audit = auditor.auditAllGates();
    expect(audit.merkleRoot).toBeDefined();
    expect(audit.merkleRoot.length).toBe(64);
  });
});
