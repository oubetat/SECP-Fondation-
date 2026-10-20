/**
 * Adversarial Qualification Tests for SECP Wiring Harness Phase 3
 * Tests collision detection, electrical shorts, and manufacturing data consistency.
 */

import { WiringHarnessCanonicalModel } from '../WiringHarnessCanonicalModel';
import { WiringHarnessGeometryKernel } from '../WiringHarnessGeometryKernel';
import { WiringHarnessElectricalVerifier } from '../WiringHarnessElectricalVerifier';
import { WiringHarnessManufacturingVerifier } from '../WiringHarnessManufacturingVerifier';

function createComplexModel(): WiringHarnessCanonicalModel {
    return {
        version: "1.0.0",
        harnessId: "ADV-001",
        name: "Adversarial Test Model",
        connectors: [{ id: "C1", name: "Conn1", pinCount: 2, pins: [{ pinNumber: 1, pinName: "A", isAssigned: true }, { pinNumber: 2, pinName: "B", isAssigned: true }], position3d: { x: 0, y: 0, z: 0 } }],
        terminals: [
            { id: "T1", name: "T1", connectorId: "C1", pinNumber: 1, compatibleWireGauge: "AWG 20", status: "CONNECTED" },
            { id: "T2", name: "T2", connectorId: "C1", pinNumber: 2, compatibleWireGauge: "AWG 20", status: "CONNECTED" },
            { id: "T3", name: "T3", connectorId: "C1", pinNumber: 1, compatibleWireGauge: "AWG 20", status: "CONNECTED" } // Extra terminal to induce short
        ],
        wires: [
            { id: "W1", name: "W1", sourceTerminalId: "T1", targetTerminalId: "T2", gaugeAwg: "AWG 20", color: "RED", lengthMm: 100 },
            { id: "W2", name: "W2", sourceTerminalId: "T1", targetTerminalId: "T3", gaugeAwg: "AWG 20", color: "BLACK", lengthMm: 100 },
            { id: "W3", name: "W3", sourceTerminalId: "T1", targetTerminalId: "T3", gaugeAwg: "AWG 20", color: "BLUE", lengthMm: 100 }
        ],
        cables: [],
        connectionPoints: [],
        branches: [],
        junctions: [],
        sleeves: [],
        clamps: [],
        mountingPoints: [],
        routes: [{ id: "R1", name: "R1", waypoints: [{ x: 5, y: 5, z: 5 }, { x: 10, y: 10, z: 10 }], branchIds: [] }]
    };
}

function runAdversarialTests() {
    console.log("=== SECP WIRING HARNESS ADVERSARIAL QUALIFICATION START ===");
    const model = createComplexModel();

    // 1. Electrical Short Test
    const elecResult = WiringHarnessElectricalVerifier.verify(model);
    console.log(`Electrical Test: Shorts=${elecResult.shorts}, Passed=${elecResult.shorts > 0}`);

    // 2. Spatial Clash Test
    const obstacles = [{ id: "OBS1", min: { x: 0, y: 0, z: 0 }, max: { x: 6, y: 6, z: 6 } }];
    const geoResult = WiringHarnessGeometryKernel.detectCllashes(model, obstacles);
    console.log(`Geometry Test: Clashes=${geoResult.clashes.length}, Passed=${geoResult.clashes.length > 0}`);

    // 3. Manufacturing Data Test
    const manResult = WiringHarnessManufacturingVerifier.generateManufacturingPackage(model);
    console.log(`Manufacturing Test: BOMItems=${manResult.bom.length}, Passed=${manResult.bom.length > 0}`);
}

runAdversarialTests();
