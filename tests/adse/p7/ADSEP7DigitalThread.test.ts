/**
 * SECP — ADSE-P7 Digital Thread Binding Test Suite
 * 
 * Formal Verification of:
 * - Lineage from Requirement (P1) -> MBSE (P2) -> Architecture (P3) -> Structural (P5) -> Power (P7) -> Execution -> Verification -> Evidence
 * - Strict binding to P4 Digital Thread authority (no parallel P7 digital thread)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP7PowerEngine } from '../../../src/engine/adse/p7/ADSEP7PowerEngine';
import { ADSEP4DigitalThreadEngine } from '../../../src/engine/adse/p4/ADSEP4DigitalThreadEngine';

describe('ADSE-P7 Digital Thread (P4 Authority Binding)', () => {
  let p7: ADSEP7PowerEngine;
  let p4: ADSEP4DigitalThreadEngine;

  beforeEach(() => {
    p4 = ADSEP4DigitalThreadEngine.getInstance();
    p7 = new ADSEP7PowerEngine();
    p7.clear();
  });

  it('Binds Power System to P4 Digital Thread node and verifies continuous lineage', () => {
    // 1. Register P4 lineage nodes
    const reqNode = p4.registry.registerNode({
      nodeId: 'thread:node:req:power_avail',
      canonicalId: 'req:EPS_001_AVAILABILITY',
      nodeType: 'REQUIREMENT_NODE',
      authoritySource: 'P1_REQUIREMENTS',
      displayName: 'EPS Availability Requirement',
      configurationId: 'CONF-01'
    });

    const mbseNode = p4.registry.registerNode({
      nodeId: 'thread:node:mbse:eps_block',
      canonicalId: 'mbse:block:EPS_SUBSYSTEM',
      nodeType: 'MBSE_NODE',
      authoritySource: 'P2_MBSE',
      displayName: 'EPS Block Element',
      configurationId: 'CONF-01'
    });

    const archNode = p4.registry.registerNode({
      nodeId: 'thread:node:arch:eps_arch',
      canonicalId: 'arch:subsys:EPS',
      nodeType: 'ARCHITECTURE_NODE',
      authoritySource: 'P3_ARCHITECTURE',
      displayName: 'EPS Architecture Subsystem',
      configurationId: 'CONF-01'
    });

    const structNode = p4.registry.registerNode({
      nodeId: 'thread:node:struct:eps_chassis',
      canonicalId: 'struct:part:EPS_CHASSIS',
      nodeType: 'PHYSICAL_NODE',
      authoritySource: 'P5_PHYSICAL_INTEGRATION',
      displayName: 'EPS Chassis Structure',
      configurationId: 'CONF-01'
    });

    const powerNode = p4.registry.registerNode({
      nodeId: 'thread:node:power:main_eps',
      canonicalId: 'pwr:sys:main_eps',
      nodeType: 'DOMAIN_EXTENSION_NODE',
      authoritySource: 'P0_CORE_ENGINEERING',
      displayName: 'Main EPS Power System',
      configurationId: 'CONF-01'
    });

    // 2. Connect Digital Thread Edges
    p4.registry.registerEdge({
      edgeId: 'edge:req_to_mbse',
      edgeType: 'SATISFIES',
      sourceNodeId: reqNode.nodeId,
      targetNodeId: mbseNode.nodeId,
      authoritySource: 'P2_MBSE',
      configurationId: 'CONF-01'
    });

    p4.registry.registerEdge({
      edgeId: 'edge:mbse_to_arch',
      edgeType: 'ALLOCATED_TO',
      sourceNodeId: mbseNode.nodeId,
      targetNodeId: archNode.nodeId,
      authoritySource: 'P3_ARCHITECTURE',
      configurationId: 'CONF-01'
    });

    p4.registry.registerEdge({
      edgeId: 'edge:arch_to_struct',
      edgeType: 'DERIVED_FROM',
      sourceNodeId: archNode.nodeId,
      targetNodeId: structNode.nodeId,
      authoritySource: 'P5_PHYSICAL_INTEGRATION',
      configurationId: 'CONF-01'
    });

    p4.registry.registerEdge({
      edgeId: 'edge:struct_to_power',
      edgeType: 'DERIVED_FROM',
      sourceNodeId: structNode.nodeId,
      targetNodeId: powerNode.nodeId,
      authoritySource: 'P0_CORE_ENGINEERING',
      configurationId: 'CONF-01'
    });

    // 3. Register P7 Power System with P4 Node ID
    const sys = p7.registry.registerSystem({
      systemId: 'pwr:sys:main_eps',
      canonicalId: archNode.canonicalId,
      p5StructuralId: structNode.canonicalId,
      p4NodeId: powerNode.nodeId,
      displayName: 'Main EPS System with Full Lineage',
      nominalVoltageV: 28.0,
      domainType: 'DC_LOW_VOLTAGE',
      configurationId: 'CONF-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    expect(sys.p4NodeId).toBe('thread:node:power:main_eps');
    expect(sys.p5StructuralId).toBe('struct:part:EPS_CHASSIS');
    expect(sys.canonicalId).toBe('arch:subsys:EPS');

    // 4. Trace Full Thread in P4
    const trace = p4.traceability.forwardTrace(reqNode.nodeId);
    expect(trace.visitedIds).toContain(powerNode.nodeId);
  });
});
