/**
 * SECP — ADSE-P5 Structural Interfaces Test Suite
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP5StructuralEngine } from '../../../src/engine/adse/p5/ADSEP5StructuralEngine';

describe('ADSE-P5 Structural Interfaces Suite', () => {
  let p5: ADSEP5StructuralEngine;

  beforeEach(() => {
    p5 = ADSEP5StructuralEngine.getInstance();
    p5.clear();
  });

  it('P5.INTERFACES: should map architectural interfaces to physical structural connections', () => {
    const compA = p5.registry.registerElement({
      elementId: 'comp:def:PUMP_MODULE',
      elementType: 'ComponentDefinition',
      displayName: 'Hydraulic Pump Module Def',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    const compB = p5.registry.registerElement({
      elementId: 'comp:def:MANIFOLD_BLOCK',
      elementType: 'ComponentDefinition',
      displayName: 'Distribution Manifold Block Def',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    const iface = p5.interfaces.defineStructuralInterface({
      interfaceId: 'IF-STRUCT-HYD-FLANGE',
      displayName: 'Hydraulic High-Pressure Flange Interface',
      p3InterfaceId: 'IF-P3-HYD-LINE-01',
      providerElementId: compA.elementId,
      consumerElementId: compB.elementId,
      requiredInterfaceType: 'SAE-J518-FLANGE',
      providedInterfaceType: 'SAE-J518-FLANGE',
      configurationId: 'CONF-BASE'
    });

    expect(iface.isCompatible).toBe(true);
    expect(iface.isConnected).toBe(false);

    // Create Physical Connection
    const partA = p5.registry.registerElement({
      elementId: 'part:def:PUMP_OUTLET_PORT',
      elementType: 'PartDefinition',
      displayName: 'Pump Outlet Port Flange',
      layer: 'PART',
      configurationId: 'CONF-BASE'
    });

    const partB = p5.registry.registerElement({
      elementId: 'part:def:MANIFOLD_INLET_PORT',
      elementType: 'PartDefinition',
      displayName: 'Manifold Inlet Port Flange',
      layer: 'PART',
      configurationId: 'CONF-BASE'
    });

    const conn = p5.interfaces.createPhysicalConnection({
      connectionId: 'CONN-HYD-BOLTED-01',
      displayName: 'SAE-J518 4-Bolt Flange Joint',
      structuralInterfaceId: iface.interfaceId,
      sourcePartId: partA.elementId,
      targetPartId: partB.elementId,
      connectionMethod: 'BOLTED_JOINT',
      configurationId: 'CONF-BASE',
      verifiedByIntentId: 'VERIF-INTENT-HYD-PRESSURE-TEST',
      evidenceId: 'EVID-PRESSURE-TEST-MERKLE-LEAF'
    });

    expect(conn.connectionMethod).toBe('BOLTED_JOINT');

    const updatedIface = p5.interfaces.getInterface(iface.interfaceId);
    expect(updatedIface?.isConnected).toBe(true);
    expect(updatedIface?.connectionId).toBe(conn.connectionId);
  });
});
