/**
 * SECP Electrical-to-Wiring Harness Integration Verifier
 * Bridges Schematic (PCB) and Wiring Harness domains to ensure 
 * connectivity consistency and manufacturing traceability.
 */

import { WiringHarnessCanonicalModel } from '../wiring-harness/WiringHarnessCanonicalModel';
import { PcbCanonicalModel } from '../pcb/PcbCanonicalModel';

export interface IntegrationViolation {
  code: 'WH-INT-001' | 'WH-INT-002' | 'WH-INT-003' | 'WH-INT-004';
  message: string;
  affectedEntities: string[];
}

export interface IntegrationResult {
  passed: boolean;
  violations: IntegrationViolation[];
  timestamp: string;
}

export class ElectricalHarnessIntegrator {
  /**
   * Verifies that the Wiring Harness connections are consistent
   * with the Schematic Connectivity defined in the PCB Model.
   */
  public static verify(
    pcbModel: PcbCanonicalModel,
    harnessModel: WiringHarnessCanonicalModel
  ): IntegrationResult {
    const violations: IntegrationViolation[] = [];

    // 1. Validate Binding: All Harness Connectors must map to PCB components
    for (const conn of harnessModel.connectors) {
      const pcbComp = pcbModel.components.find(c => c.refDes === conn.id);
      if (!pcbComp) {
        violations.push({
          code: 'WH-INT-002',
          message: `Connector ${conn.id} not found in PCB components`,
          affectedEntities: [conn.id]
        });
      }
    }

    // 2. Build schematic net map (NetName -> [pinKey])
    const schematicNetMap = new Map<string, string[]>();
    for (const net of pcbModel.schematicNets) {
      const pins = net.pins.map(p => `${p.refDes}:${p.pinNumber}`);
      schematicNetMap.set(net.name, pins);
    }

    // 3. Cross-reference harness wires
    for (const wire of harnessModel.wires) {
      const srcTerm = harnessModel.terminals.find(t => t.id === wire.sourceTerminalId);
      const tgtTerm = harnessModel.terminals.find(t => t.id === wire.targetTerminalId);
      
      if (!srcTerm || !tgtTerm) {
        violations.push({
          code: 'WH-INT-003',
          message: `Wire ${wire.id} references missing terminal`,
          affectedEntities: [wire.id]
        });
        continue;
      }

      const srcPinKey = `${srcTerm.connectorId}:${srcTerm.pinNumber}`;
      const tgtPinKey = `${tgtTerm.connectorId}:${tgtTerm.pinNumber}`;
      
      let srcNet: string | null = null;
      let tgtNet: string | null = null;
      
      for (const [netName, pinKeys] of schematicNetMap.entries()) {
        if (pinKeys.includes(srcPinKey)) srcNet = netName;
        if (pinKeys.includes(tgtPinKey)) tgtNet = netName;
      }
      
      if (!srcNet) {
        violations.push({
          code: 'WH-INT-004',
          message: `Terminal ${srcTerm.id} (pin ${srcPinKey}) has no schematic net`,
          affectedEntities: [srcTerm.id]
        });
      }
      if (!tgtNet) {
        violations.push({
          code: 'WH-INT-004',
          message: `Terminal ${tgtTerm.id} (pin ${tgtPinKey}) has no schematic net`,
          affectedEntities: [tgtTerm.id]
        });
      }
      
      if (srcNet && tgtNet && srcNet !== tgtNet) {
        violations.push({
          code: 'WH-INT-001',
          message: `Miswiring detected: Wire ${wire.id} connects Net '${srcNet}' to Net '${tgtNet}'`,
          affectedEntities: [wire.id, srcNet, tgtNet]
        });
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      timestamp: new Date().toISOString()
    };
  }
}
