/**
 * SECP-WH-ADVERSARIAL-INTEGRATION-TESTS-002
 * Comprehensive robustness audit of Electrical-Harness Integration.
 */

import { ElectricalHarnessIntegrator } from '../ElectricalHarnessIntegrator';
import { PcbCanonicalModel } from '../../pcb/PcbCanonicalModel';
import { WiringHarnessCanonicalModel } from '../../wiring-harness/WiringHarnessCanonicalModel';

const results: { test: string, status: string, details: string }[] = [];

function assert(name: string, condition: boolean, details: string) {
  if (condition) {
    results.push({ test: name, status: "PASS", details });
  } else {
    results.push({ test: name, status: "FAIL", details });
    console.error(`[FAIL] ${name}: ${details}`);
  }
}

function runIntegrationTests() {
  console.log("=== SECP ELECTRICAL-HARNESS INTEGRATION ADVERSARIAL TESTS ===");

  // Setup Base Models
  const basePcb: PcbCanonicalModel = {
    designId: "D1",
    revisionId: "R1",
    components: [{ refDes: "C1", name: "Conn", footprintId: "F1" }],
    placements: [],
    schematicNets: [{ name: "NET1", pins: [{ refDes: "C1", pinNumber: 1 }] }]
  } as any;

  const baseHarness: WiringHarnessCanonicalModel = {
    harnessId: "H1",
    name: "Harness",
    terminals: [{ id: "T1", connectorId: "C1", pinNumber: 1, status: "CONNECTED" } as any],
    wires: []
  } as any;

  // A. Correct wire-to-net mapping
  const harnessA = { ...baseHarness, wires: [{ id: "W1", sourceTerminalId: "T1", targetTerminalId: "T1" }] } as any;
  const resA = ElectricalHarnessIntegrator.verify(basePcb, harnessA);
  assert("Correct mapping", resA.passed, "Should pass correct mapping");

  // B. Wire connecting two incompatible nets
  const pcbB = { ...basePcb, schematicNets: [{ name: "NET1", pins: [{ refDes: "C1", pinNumber: 1 }] }, { name: "NET2", pins: [{ refDes: "C1", pinNumber: 2 }] }] } as any;
  const harnessB = { terminals: [{ id: "T1", connectorId: "C1", pinNumber: 1, status: "CONNECTED" }, { id: "T2", connectorId: "C1", pinNumber: 2, status: "CONNECTED" }], wires: [{ id: "W1", sourceTerminalId: "T1", targetTerminalId: "T2" }] } as any;
  const resB = ElectricalHarnessIntegrator.verify(pcbB, harnessB);
  assert("Miswiring (Net1 to Net2)", !resB.passed && resB.violations.some(v => v.code === 'WH-INT-001'), "Should detect miswiring");

  // C. Missing schematic net
  const harnessC = { ...baseHarness, wires: [{ id: "W1", sourceTerminalId: "T1", targetTerminalId: "T1" }] } as any;
  const resC = ElectricalHarnessIntegrator.verify({ ...basePcb, schematicNets: [] }, harnessC);
  // Current implementation just ignores missing nets, should be NOT_PROVEN? 
  // Let's assert it fails or marks as not proven.
  assert("Missing schematic net", !resC.passed, "Should fail on missing schematic net");

  console.table(results);
}

runIntegrationTests();
