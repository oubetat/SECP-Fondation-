/**
 * SECP — ADSE-P7 Power Impact Analysis Test Suite
 * 
 * Formal Verification of:
 * - Downstream Blast Radius Calculation
 * - Tracing impact paths:
 *   Converter / Load / Source Mutation -> Conversion Loss -> Power Flow -> Budget -> Execution Invalidation -> Verification Impact -> Evidence Invalidation -> P6 Thermal Consequence
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP7PowerEngine } from '../../../src/engine/adse/p7/ADSEP7PowerEngine';

describe('ADSE-P7 Power Impact Analysis', () => {
  let p7: ADSEP7PowerEngine;

  beforeEach(() => {
    p7 = new ADSEP7PowerEngine();
    p7.clear();
  });

  it('Traces complete downstream impact path from Converter mutation to thermal and verification artifacts', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:impact_test',
      canonicalId: 'arch:subsys:IMPACT',
      p4NodeId: 'thread:impact_test',
      displayName: 'Impact Analysis System',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const dom = p7.registry.registerDomain({
      domainId: 'dom:impact',
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
      name: 'Input Bus',
      nominalVoltageV: 28.0,
      maxCurrentCapacityAmps: 50.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const busOut = p7.registry.registerBus({
      busId: 'bus:12v_out',
      systemId: sys.systemId,
      domainId: dom.domainId,
      name: 'Output Bus',
      nominalVoltageV: 12.0,
      maxCurrentCapacityAmps: 50.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const conv = p7.registry.registerConverter({
      converterId: 'conv:dcdc_12v',
      systemId: sys.systemId,
      canonicalComponentId: 'arch:comp:DCDC_12V',
      inputBusId: busIn.busId,
      outputBusId: busOut.busId,
      topology: 'DC_DC_BUCK',
      inputVoltageNominalV: 28.0,
      outputVoltageNominalV: 12.0,
      ratedPowerWatts: 300.0,
      efficiencyPercent: 92.0,
      fixedNoLoadLossWatts: 2.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const impact = p7.impact.analyzeConverterDriftImpact(conv.converterId);

    expect(impact.affectedSystemIds).toContain(sys.systemId);
    expect(impact.impactedThermalModelIds.length).toBeGreaterThan(0);
    expect(impact.impactedThermalModelIds[0]).toContain(conv.converterId);
    expect(impact.impactedDownstreamArtifacts).toContain(`CONVERTER:${conv.converterId}`);
    expect(impact.reason).toContain('efficiency modified');
  });

  it('Traces load mutation blast radius affecting power budget and digital thread', () => {
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:load_impact',
      canonicalId: 'arch:subsys:LOAD_IMP',
      p4NodeId: 'thread:load_impact',
      displayName: 'Load Impact System',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const dom = p7.registry.registerDomain({
      domainId: 'dom:load_imp',
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
      busId: 'bus:load_imp',
      systemId: sys.systemId,
      domainId: dom.domainId,
      name: 'Main Bus',
      nominalVoltageV: 28.0,
      maxCurrentCapacityAmps: 50.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const load = p7.registry.registerLoad({
      loadId: 'load:radar_tx_pod',
      systemId: sys.systemId,
      domainId: dom.domainId,
      canonicalComponentId: 'arch:comp:RADAR_TX',
      connectedBusId: bus.busId,
      criticality: 'PRIMARY_MISSION',
      nominalVoltageV: 28.0,
      voltageToleranceMinV: 24.0,
      voltageToleranceMaxV: 30.0,
      nominalDemandWatts: 500.0,
      peakDemandWatts: 600.0,
      dutyCycle: 1.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const impact = p7.impact.analyzeLoadMutationImpact(load.loadId, 800.0);

    expect(impact.affectedSystemIds).toContain(sys.systemId);
    expect(impact.impactedDownstreamArtifacts).toContain(`LOAD:${load.loadId}`);
    expect(impact.impactedDownstreamArtifacts).toContain(`BUS:${bus.busId}`);
    expect(impact.impactedDownstreamArtifacts).toContain('POWER_BUDGET_RECALCULATION_REQUIRED');
  });
});
