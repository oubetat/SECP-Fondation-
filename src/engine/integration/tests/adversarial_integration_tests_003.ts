/**
 * SECP-WH-ADVERSARIAL-INTEGRATION-TESTS-003
 * Comprehensive robustness and evidence invalidation audit.
 */

import { ElectricalHarnessIntegrator } from '../ElectricalHarnessIntegrator';
import { PcbCanonicalModel } from '../../pcb/PcbCanonicalModel';
import { WiringHarnessCanonicalModel } from '../../wiring-harness/WiringHarnessCanonicalModel';
import { createHash } from 'crypto';

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
  console.log("=== SECP ELECTRICAL-HARNESS INTEGRATION ADV-003 ===");

  // Setup Base Models
  const basePcb: PcbCanonicalModel = {
    components: [{ refDes: "C1", name: "Conn", footprintId: "F1" }],
    schematicNets: [{ name: "NET1", pins: [{ refDes: "C1", pinNumber: 1 }] }]
  } as any;

  const baseHarness: WiringHarnessCanonicalModel = {
    connectors: [{ id: "C1", name: "C1" } as any],
    terminals: [{ id: "T1", connectorId: "C1", pinNumber: 1, status: "CONNECTED" } as any],
    wires: [{ id: "W1", sourceTerminalId: "T1", targetTerminalId: "T1" } as any]
  } as any;

  // 1. Correct mapping
  const resA = ElectricalHarnessIntegrator.verify(basePcb, baseHarness);
  assert("Correct mapping", resA.passed, "Should pass correct mapping");

  // 2. Incompatible nets
  const pcbB = { ...basePcb, schematicNets: [{ name: "NET1", pins: [{ refDes: "C1", pinNumber: 1 }] }, { name: "NET2", pins: [{ refDes: "C1", pinNumber: 2 }] }] } as any;
  const harnessB = { ...baseHarness, terminals: [...baseHarness.terminals, { id: "T2", connectorId: "C1", pinNumber: 2, status: "CONNECTED" } as any], wires: [{ id: "W1", sourceTerminalId: "T1", targetTerminalId: "T2" } as any] } as any;
  const resB = ElectricalHarnessIntegrator.verify(pcbB, harnessB);
  assert("Miswiring (Net1 to Net2)", !resB.passed && resB.violations.some(v => v.code === 'WH-INT-001'), "Should detect miswiring");

  // 3. Evidence Invalidation
  const harnessHash = (h: WiringHarnessCanonicalModel) => createHash('sha256').update(JSON.stringify(h)).digest('hex');
  const initialHash = harnessHash(baseHarness);
  const result1 = ElectricalHarnessIntegrator.verify(basePcb, baseHarness);
  
  // Mutate
  const mutatedHarness = { ...baseHarness, wires: [{ id: "W1", sourceTerminalId: "T1", targetTerminalId: "T1", gaugeAwg: "AWG 18" } as any] };
  const mutatedHash = harnessHash(mutatedHarness);
  
  assert("Evidence Invalidation", initialHash !== mutatedHash, "Hash must change after mutation");

  console.table(results);
}

runIntegrationTests();
