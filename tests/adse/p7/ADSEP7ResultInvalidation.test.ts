/**
 * SECP — ADSE-P7 Power Result Invalidation Test Suite
 * 
 * Formal Verification of:
 * 1. AUTHORITATIVE CHANGE -> DEPENDENCY RESOLUTION -> AFFECTED EXECUTION INVALIDATION
 * 2. UNRELATED CHANGE -> UNRELATED EXECUTION REMAINS VALID
 * 
 * Invariant:
 * «No stale results reused; No global/excessive invalidation of decoupled systems.»
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP7PowerEngine } from '../../../src/engine/adse/p7/ADSEP7PowerEngine';

describe('ADSE-P7 Dependency-Aware Result Invalidation', () => {
  let p7: ADSEP7PowerEngine;

  beforeEach(() => {
    p7 = new ADSEP7PowerEngine();
    p7.clear();
  });

  it('Proves Authoritative Change triggers Selective Invalidation while Unrelated Execution Remains Valid', () => {
    // 1. Setup System A (Main EPS)
    const sysA = p7.registry.registerSystem({
      systemId: 'pwr:sys:A',
      canonicalId: 'arch:subsys:EPS_A',
      p4NodeId: 'thread:sysA',
      displayName: 'EPS Subsystem A',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const domA = p7.registry.registerDomain({
      domainId: 'dom:A',
      systemId: sysA.systemId,
      name: '28V Bus A',
      domainType: 'DC_LOW_VOLTAGE',
      nominalVoltageV: 28.0,
      voltageRangeMinV: 24.0,
      voltageRangeMaxV: 32.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const busA = p7.registry.registerBus({
      busId: 'bus:A',
      systemId: sysA.systemId,
      domainId: domA.domainId,
      name: 'Bus A',
      nominalVoltageV: 28.0,
      maxCurrentCapacityAmps: 50.0,
      connectedSourceIds: ['src:A'],
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const srcA = p7.registry.registerSource({
      sourceId: 'src:A',
      systemId: sysA.systemId,
      domainId: domA.domainId,
      canonicalComponentId: 'arch:comp:GEN_A',
      sourceType: 'MAIN_GENERATOR',
      nominalVoltageV: 28.0,
      ratedContinuousPowerWatts: 1000.0,
      peakPowerWatts: 1500.0,
      internalResistanceOhms: 0.01,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const loadA = p7.registry.registerLoad({
      loadId: 'load:A',
      systemId: sysA.systemId,
      domainId: domA.domainId,
      canonicalComponentId: 'arch:comp:LOAD_A',
      connectedBusId: busA.busId,
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

    const brA = p7.topology.registerBranch({
      branchId: 'br:A',
      systemId: sysA.systemId,
      fromBusId: busA.busId,
      toTargetId: loadA.loadId,
      lineResistanceOhms: 0.01,
      maxCurrentAmps: 20.0,
      protectionRatingAmps: 15.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const stateA = p7.registry.registerOperatingState({
      stateId: 'state:A',
      systemId: sysA.systemId,
      mode: 'CRUISE_NOMINAL',
      name: 'Nominal A',
      activeSourceIds: [srcA.sourceId],
      activeLoadIds: [loadA.loadId],
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    // 2. Setup System B (Decoupled Payload Auxiliary EPS)
    const sysB = p7.registry.registerSystem({
      systemId: 'pwr:sys:B',
      canonicalId: 'arch:subsys:EPS_B',
      p4NodeId: 'thread:sysB',
      displayName: 'Payload Auxiliary EPS B',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const domB = p7.registry.registerDomain({
      domainId: 'dom:B',
      systemId: sysB.systemId,
      name: '28V Bus B',
      domainType: 'DC_LOW_VOLTAGE',
      nominalVoltageV: 28.0,
      voltageRangeMinV: 24.0,
      voltageRangeMaxV: 32.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const busB = p7.registry.registerBus({
      busId: 'bus:B',
      systemId: sysB.systemId,
      domainId: domB.domainId,
      name: 'Bus B',
      nominalVoltageV: 28.0,
      maxCurrentCapacityAmps: 50.0,
      connectedSourceIds: ['src:B'],
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const srcB = p7.registry.registerSource({
      sourceId: 'src:B',
      systemId: sysB.systemId,
      domainId: domB.domainId,
      canonicalComponentId: 'arch:comp:GEN_B',
      sourceType: 'MAIN_GENERATOR',
      nominalVoltageV: 28.0,
      ratedContinuousPowerWatts: 800.0,
      peakPowerWatts: 1200.0,
      internalResistanceOhms: 0.01,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const loadB = p7.registry.registerLoad({
      loadId: 'load:B',
      systemId: sysB.systemId,
      domainId: domB.domainId,
      canonicalComponentId: 'arch:comp:LOAD_B',
      connectedBusId: busB.busId,
      criticality: 'PRIMARY_MISSION',
      nominalVoltageV: 28.0,
      voltageToleranceMinV: 24.0,
      voltageToleranceMaxV: 30.0,
      nominalDemandWatts: 150.0,
      peakDemandWatts: 150.0,
      dutyCycle: 1.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const brB = p7.topology.registerBranch({
      branchId: 'br:B',
      systemId: sysB.systemId,
      fromBusId: busB.busId,
      toTargetId: loadB.loadId,
      lineResistanceOhms: 0.01,
      maxCurrentAmps: 20.0,
      protectionRatingAmps: 15.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const stateB = p7.registry.registerOperatingState({
      stateId: 'state:B',
      systemId: sysB.systemId,
      mode: 'CRUISE_NOMINAL',
      name: 'Nominal B',
      activeSourceIds: [srcB.sourceId],
      activeLoadIds: [loadB.loadId],
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    // 3. Execute Power Flow on both systems
    const execA = p7.solver.prepareExecution(sysA, [srcA], [loadA], [busA], [brA], stateA);
    const resA = p7.solver.solvePowerFlow(execA.executionId, {
      sources: [srcA],
      loads: [loadA],
      buses: [busA],
      branches: [brA],
      operatingState: stateA
    });

    const execB = p7.solver.prepareExecution(sysB, [srcB], [loadB], [busB], [brB], stateB);
    const resB = p7.solver.solvePowerFlow(execB.executionId, {
      sources: [srcB],
      loads: [loadB],
      buses: [busB],
      branches: [brB],
      operatingState: stateB
    });

    expect(p7.solver.getExecution(execA.executionId)?.status).toBe('COMPLETED');
    expect(p7.solver.getExecution(execB.executionId)?.status).toBe('COMPLETED');

    // 4. Invalidate only System A
    const impact = p7.invalidations.invalidateForSystem(sysA.systemId, 'Upstream battery chemistry change in System A');

    // 5. Verify Selective Invalidation:
    // System A execution must be INVALIDATED
    expect(impact.invalidatedExecutionIds).toContain(execA.executionId);
    expect(p7.solver.getExecution(execA.executionId)?.status).toBe('INVALIDATED');

    // System B execution must REMAIN COMPLETED and valid!
    expect(impact.invalidatedExecutionIds).not.toContain(execB.executionId);
    expect(p7.solver.getExecution(execB.executionId)?.status).toBe('COMPLETED');
  });
});
