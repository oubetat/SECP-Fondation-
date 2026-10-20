/**
 * SECP-WH-ADVERSARIAL-QUALIFICATION-003
 * Mutation-test closure.
 */

import { WiringHarnessCanonicalModel } from '../WiringHarnessCanonicalModel';
import { WiringHarnessElectricalVerifier, WiringHarnessElectricalResult } from '../WiringHarnessElectricalVerifier';

// Define the verifier contract
type VerifierFunc = (model: WiringHarnessCanonicalModel) => WiringHarnessElectricalResult;

// A test runner that accepts a verifier implementation
function testHarness(model: WiringHarnessCanonicalModel, verifier: VerifierFunc): boolean {
    const result = verifier(model);
    // Harness expects short-circuit detection
    return result.shorts > 0;
}

// Model setup
function createShortCircuitModel(): WiringHarnessCanonicalModel {
    return {
        version: "1.0.0",
        harnessId: "QUAL-003",
        name: "Mutation Model",
        connectors: [{ id: "C1", name: "C1", pinCount: 1, pins: [{ pinNumber: 1, pinName: "A", isAssigned: true }], position3d: { x: 0, y: 0, z: 0 } }],
        terminals: [
            { id: "T1", name: "T1", connectorId: "C1", pinNumber: 1, compatibleWireGauge: "AWG 20", status: "CONNECTED" },
            { id: "T2", name: "T2", connectorId: "C1", pinNumber: 1, compatibleWireGauge: "AWG 20", status: "CONNECTED" }
        ],
        wires: [
            { id: "W1", name: "W1", sourceTerminalId: "T1", targetTerminalId: "T2", gaugeAwg: "AWG 20", color: "RED", lengthMm: 100 },
            { id: "W2", name: "W2", sourceTerminalId: "T1", targetTerminalId: "T2", gaugeAwg: "AWG 20", color: "BLUE", lengthMm: 100 }
        ],
        cables: [],
        connectionPoints: [],
        branches: [],
        junctions: [],
        sleeves: [],
        clamps: [],
        mountingPoints: [],
        routes: []
    };
}

// 1. Diagnosis
console.log("--- Diagnosis ---");
const model = createShortCircuitModel();
const result = WiringHarnessElectricalVerifier.verify(model);
console.log(`Production Verifier Detects Short: ${result.shorts > 0}`);

// 2. Mutation Test
console.log("\n--- Mutation Test ---");

// Normal path
const passResult = testHarness(model, WiringHarnessElectricalVerifier.verify);
console.log(`Normal Verifier Passed Mutation Test: ${passResult}`);

// Mutated path (simulated regression)
const mutatedVerifier: VerifierFunc = (m) => {
    const res = WiringHarnessElectricalVerifier.verify(m);
    res.shorts = 0; // Regression
    return res;
};

const failResult = testHarness(model, mutatedVerifier);
console.log(`Mutated Verifier Passed Mutation Test: ${failResult} (Expected: false)`);

// The harness identifies the regression
const mutationHarnessSuccess = (passResult === true && failResult === false);
console.log(`\nMutation Test Harness Success: ${mutationHarnessSuccess}`);

process.exit(mutationHarnessSuccess ? 0 : 1);
