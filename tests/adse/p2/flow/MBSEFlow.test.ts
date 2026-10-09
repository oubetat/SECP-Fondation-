import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP2Engine } from '../../../../src/engine/adse/p2/ADSEP2Engine';

describe('ADSE-P2 MBSE Flow Semantics', () => {
  let p2: ADSEP2Engine;

  beforeEach(() => {
    p2 = ADSEP2Engine.getInstance();
    p2.clear();
  });

  it('registers FlowPorts, Connectors, and ItemFlows', () => {
    const generator = p2.registry.registerElement({
      mbseId: 'mbse:comp:GEN_UNIT',
      elementType: 'Component',
      displayName: 'APU Power Generator',
      category: 'STRUCTURAL',
      configurationId: 'CFG-001'
    });

    const avionics = p2.registry.registerElement({
      mbseId: 'mbse:comp:AVIONICS_BAY',
      elementType: 'Component',
      displayName: 'Main Avionics Bay',
      category: 'STRUCTURAL',
      configurationId: 'CFG-001'
    });

    const outPort = p2.flow.registerFlowPort({
      mbseId: 'mbse:port:GEN_PWR_OUT',
      name: 'PowerOutPort',
      direction: 'OUT',
      ownerMbseId: generator.mbseId,
      dataType: 'POWER_28VDC',
      configurationId: 'CFG-001'
    });

    const inPort = p2.flow.registerFlowPort({
      mbseId: 'mbse:port:AVIONICS_PWR_IN',
      name: 'PowerInPort',
      direction: 'IN',
      ownerMbseId: avionics.mbseId,
      dataType: 'POWER_28VDC',
      configurationId: 'CFG-001'
    });

    const connector = p2.flow.registerConnector({
      mbseId: 'mbse:conn:PWR_BUS_A',
      name: 'Main 28VDC Power Bus A',
      sourcePortMbseId: outPort.mbseId,
      targetPortMbseId: inPort.mbseId,
      configurationId: 'CFG-001'
    });

    const itemFlow = p2.flow.registerItemFlow({
      mbseId: 'mbse:flow:ELEC_PWR_FLOW',
      name: '28VDC Electric Power Flow',
      itemType: 'ELECTRICAL_POWER',
      sourcePortMbseId: outPort.mbseId,
      targetPortMbseId: inPort.mbseId,
      flowDirection: 'OUT',
      rate: 15, // kW
      unit: 'kW',
      connectorMbseId: connector.mbseId,
      configurationId: 'CFG-001'
    });

    expect(connector.sourcePortMbseId).toBe('mbse:port:GEN_PWR_OUT');
    expect(itemFlow.rate).toBe(15);
  });
});
