/**
 * Integration test for Electrical-to-Wiring Harness connectivity
 */
import { ElectricalHarnessIntegrator } from '../ElectricalHarnessIntegrator';
import { PcbCanonicalModel } from '../../pcb/PcbCanonicalModel';
import { WiringHarnessCanonicalModel } from '../../wiring-harness/WiringHarnessCanonicalModel';

function testIntegration() {
  const pcbModel: PcbCanonicalModel = {
    designId: "D1",
    revisionId: "R1",
    components: [{ refDes: "C1", name: "Conn", footprintId: "F1" }],
    placements: [],
    schematicNets: [{ name: "NET1", pins: [{ refDes: "C1", pinNumber: 1 }] }, { name: "NET2", pins: [{ refDes: "C1", pinNumber: 2 }] }]
  } as any;

  const harnessModel: WiringHarnessCanonicalModel = {
    harnessId: "H1",
    name: "Harness",
    terminals: [
      { id: "T1", name: "T1", connectorId: "C1", pinNumber: 1, status: "CONNECTED" } as any,
      { id: "T2", name: "T2", connectorId: "C1", pinNumber: 2, status: "CONNECTED" } as any
    ],
    wires: [
      { id: "W1", sourceTerminalId: "T1", targetTerminalId: "T2" } as any
    ]
  } as any;

  // Test Case: Miswiring (NET1 to NET2)
  const result1 = ElectricalHarnessIntegrator.verify(pcbModel, harnessModel);
  console.log(`Miswiring Test (Expected FAIL): ${!result1.passed ? 'PASS' : 'FAIL'}`);

  // Test Case: Valid Connection (NET1 to NET1 - wait, they are same pin?)
  // Let's create a model with NET1 connected to NET1 (not possible)
  // Let's connect two pins on NET1.
  const pcbModel2 = {
    ...pcbModel,
    schematicNets: [{ name: "NET1", pins: [{ refDes: "C1", pinNumber: 1 }, { refDes: "C1", pinNumber: 2 }] }]
  } as any;
  const result2 = ElectricalHarnessIntegrator.verify(pcbModel2, harnessModel);
  console.log(`Valid Connection Test (Expected PASS): ${result2.passed ? 'PASS' : 'FAIL'}`);
}

testIntegration();
