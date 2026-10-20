/**
 * SECP Wiring Harness Electrical Verifier (Phase 3)
 * Verifies electrical continuity, open circuits, miswirings, shorts,
 * terminal compatibility, and unrouted required connections.
 */

import { WiringHarnessCanonicalModel, WireDefinition, TerminalDefinition } from './WiringHarnessCanonicalModel';

export interface ElectricalViolation {
  code: string;
  entityId: string;
  message: string;
}

export interface WiringHarnessElectricalResult {
  passed: boolean;
  totalWires: number;
  connectedWires: number;
  openCircuits: number;
  miswirings: number;
  shorts: number;
  violations: ElectricalViolation[];
}

export class WiringHarnessElectricalVerifier {
  public static verify(model: WiringHarnessCanonicalModel): WiringHarnessElectricalResult {
    const violations: ElectricalViolation[] = [];
    let openCircuits = 0;
    let miswirings = 0;
    let shorts = 0;
    let connectedWires = 0;

    // Check terminal connectivity and open circuits
    for (const term of model.terminals) {
      if (term.status === 'UNCONNECTED') {
        openCircuits++;
        violations.push({
          code: 'WH_OPEN_CIRCUIT',
          entityId: term.id,
          message: `Terminal ${term.id} on connector ${term.connectorId} pin ${term.pinNumber} is unconnected (Open Circuit)`
        });
      } else if (term.status === 'FAULT') {
        violations.push({
          code: 'WH_TERMINAL_FAULT',
          entityId: term.id,
          message: `Terminal ${term.id} is in FAULT state`
        });
      }
    }

    // Check wire routing and pin compatibility
    for (const wire of model.wires) {
      const srcTerm = model.terminals.find(t => t.id === wire.sourceTerminalId);
      const tgtTerm = model.terminals.find(t => t.id === wire.targetTerminalId);

      if (!srcTerm || !tgtTerm) {
        miswirings++;
        violations.push({
          code: 'WH_MISWIRING_INVALID_TERMINAL',
          entityId: wire.id,
          message: `Wire ${wire.id} references invalid terminals`
        });
        continue;
      }

      // Check gauge compatibility
      if (srcTerm.compatibleWireGauge && srcTerm.compatibleWireGauge !== wire.gaugeAwg) {
        miswirings++;
        violations.push({
          code: 'WH_GAUGE_INCOMPATIBLE',
          entityId: wire.id,
          message: `Wire ${wire.id} gauge ${wire.gaugeAwg} incompatible with terminal ${srcTerm.id} requirement ${srcTerm.compatibleWireGauge}`
        });
      } else {
        connectedWires++;
      }
    }

    // Check for short circuits (multiple wires connected to same terminal pin incorrectly)
    const pinMap = new Map<string, string[]>();
    for (const wire of model.wires) {
      const srcKey = wire.sourceTerminalId;
      if (!pinMap.has(srcKey)) pinMap.set(srcKey, []);
      pinMap.get(srcKey)!.push(wire.id);

      const tgtKey = wire.targetTerminalId;
      if (!pinMap.has(tgtKey)) pinMap.set(tgtKey, []);
      pinMap.get(tgtKey)!.push(wire.id);
    }

    for (const [termId, wireIds] of pinMap.entries()) {
      if (wireIds.length > 1) { // more than 1 wire per terminal endpoint without junction
        shorts++;
        violations.push({
          code: 'WH_POTENTIAL_SHORT',
          entityId: termId,
          message: `Terminal ${termId} has multiple connected wires (${wireIds.join(', ')}), potential short or unmanaged junction`
        });
      }
    }

    const passed = violations.length === 0;

    return {
      passed,
      totalWires: model.wires.length,
      connectedWires,
      openCircuits,
      miswirings,
      shorts,
      violations
    };
  }
}
