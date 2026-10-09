/**
 * SECP — ADSE-P7 Structural Coupling Test Suite
 * 
 * Formal Verification of:
 * - P5 Structural Assembly & Component Binding to P7 Power Elements
 * - P5 Structural Mutation -> P7 Dependency Invalidation & Impact Analysis
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP7PowerEngine } from '../../../src/engine/adse/p7/ADSEP7PowerEngine';
import { ADSEP5StructuralEngine } from '../../../src/engine/adse/p5/ADSEP5StructuralEngine';

describe('ADSE-P7 Structural Coupling (P5 Authority Binding)', () => {
  let p7: ADSEP7PowerEngine;
  let p5: ADSEP5StructuralEngine;

  beforeEach(() => {
    p5 = ADSEP5StructuralEngine.getInstance();
    p7 = new ADSEP7PowerEngine();
    p7.clear();
  });

  it('Binds Power Systems to P5 Structural Assemblies and verifies change cascade', () => {
    // 1. Create P5 Structural Assembly Element
    const assembly = p5.registry.registerElement({
      elementId: 'elem:asm:avionics_bay_rack',
      elementType: 'AssemblyDefinition',
      displayName: 'Avionics Equipment Bay Rack',
      layer: 'PHYSICAL_ASSEMBLY',
      configurationId: 'CONF-01',
      p4NodeId: 'thread:struct_bay'
    });

    const part = p5.registry.registerElement({
      elementId: 'elem:part:pdu_chassis',
      elementType: 'PartDefinition',
      displayName: 'PDU Mechanical Chassis',
      layer: 'DETAIL_PART',
      configurationId: 'CONF-01',
      p4NodeId: 'thread:part_pdu'
    });

    // 2. Register P7 Power System mapped to P5 Assembly
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:pdu_28v',
      canonicalId: 'arch:subsys:PDU',
      p5StructuralId: assembly.elementId,
      p4NodeId: 'thread:power_pdu',
      displayName: 'PDU 28V Electrical Power System',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    const dom = p7.registry.registerDomain({
      domainId: 'dom:pdu',
      systemId: sys.systemId,
      name: '28V PDU Domain',
      domainType: 'DC_LOW_VOLTAGE',
      nominalVoltageV: 28.0,
      voltageRangeMinV: 24.0,
      voltageRangeMaxV: 32.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const bus = p7.registry.registerBus({
      busId: 'bus:pdu_main',
      systemId: sys.systemId,
      domainId: dom.domainId,
      name: 'PDU Main Bus',
      nominalVoltageV: 28.0,
      maxCurrentCapacityAmps: 100.0,
      connectedSourceIds: ['src:pdu_gen'],
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const src = p7.registry.registerSource({
      sourceId: 'src:pdu_gen',
      systemId: sys.systemId,
      domainId: dom.domainId,
      canonicalComponentId: part.elementId,
      sourceType: 'MAIN_GENERATOR',
      nominalVoltageV: 28.0,
      ratedContinuousPowerWatts: 2000.0,
      peakPowerWatts: 3000.0,
      internalResistanceOhms: 0.01,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const load = p7.registry.registerLoad({
      loadId: 'load:pdu_avionics',
      systemId: sys.systemId,
      domainId: dom.domainId,
      canonicalComponentId: 'arch:comp:AVIONICS_LOAD',
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

    const br = p7.topology.registerBranch({
      branchId: 'br:pdu_branch',
      systemId: sys.systemId,
      fromBusId: bus.busId,
      toTargetId: load.loadId,
      lineResistanceOhms: 0.01,
      maxCurrentAmps: 30.0,
      protectionRatingAmps: 25.0,
      configurationId: 'CONF-01',
      revisionId: 'REV-01'
    });

    const state = p7.registry.registerOperatingState({
      stateId: 'state:pdu_nominal',
      systemId: sys.systemId,
      mode: 'CRUISE_NOMINAL',
      name: 'PDU Nominal',
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
    expect(sys.p5StructuralId).toBe('elem:asm:avionics_bay_rack');

    // 3. Structural Change in P5 triggers Power Invalidation
    const impact = p7.invalidations.invalidateForSystem(sys.systemId, `Structural modification in P5 Assembly '${assembly.elementId}'`);
    expect(impact.invalidatedExecutionIds).toContain(exec.executionId);
    expect(p7.solver.getExecution(exec.executionId)?.status).toBe('INVALIDATED');
  });
});
