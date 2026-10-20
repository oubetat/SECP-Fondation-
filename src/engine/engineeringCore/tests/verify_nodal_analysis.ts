/**
 * General Nodal Analysis Tests for EEC-014, EEC-015, EEC-016
 */
import { NodalCircuitSolver } from '../NodalCircuitSolver';
import { CircuitModel } from '../ReferenceCircuitModel';

const results: { test: string, status: string, details: string }[] = [];

function assert(name: string, condition: boolean, details: string) {
    if (condition) {
        results.push({ test: name, status: "PASS", details });
    } else {
        results.push({ test: name, status: "FAIL", details });
        console.error(`[FAIL] ${name}: ${details}`);
    }
}

function runTests() {
    console.log("=== SECP ELECTRICAL GENERAL NODAL ANALYSIS TESTS ===");

    // EEC-014: Series (10V, 1k, 2k)
    // Nodes: N1, Nx, GND
    // V1(10V): N1-GND, R1(1k): N1-Nx, R2(2k): Nx-GND
    const series: CircuitModel = {
        id: "EEC-014",
        components: [
            { id: "V1", type: 'VOLTAGE_SOURCE', value: 10, nodes: ['N1', 'GND'] },
            { id: "R1", type: 'RESISTOR', value: 1000, nodes: ['N1', 'Nx'] },
            { id: "R2", type: 'RESISTOR', value: 2000, nodes: ['Nx', 'GND'] }
        ]
    };
    const resSeries = NodalCircuitSolver.solve(series);
    if (resSeries) {
        const vNx = resSeries['Nx'];
        assert("EEC-014 Series (Nx Voltage)", Math.abs(vNx - 6.666666667) < 1e-7, `Expected 6.6667V, got ${vNx}`);
    } else {
        assert("EEC-014 Series", false, "Failed to solve");
    }

    // EEC-015: Parallel (10V, 1k, 2k)
    // Nodes: N1, GND
    const parallel: CircuitModel = {
        id: "EEC-015",
        components: [
            { id: "V1", type: 'VOLTAGE_SOURCE', value: 10, nodes: ['N1', 'GND'] },
            { id: "R1", type: 'RESISTOR', value: 1000, nodes: ['N1', 'GND'] },
            { id: "R2", type: 'RESISTOR', value: 2000, nodes: ['N1', 'GND'] }
        ]
    };
    const resParallel = NodalCircuitSolver.solve(parallel);
    if (resParallel) {
        // I1 = 10/1000 = 10mA, I2 = 10/2000 = 5mA, Itot = 15mA
        assert("EEC-015 Parallel (N1 Voltage)", Math.abs(resParallel['N1'] - 10) < 1e-9, `Expected 10V, got ${resParallel['N1']}`);
    } else {
        assert("EEC-015 Parallel", false, "Failed to solve");
    }

    // EEC-016: Wheatstone Bridge (Simple unbalanced: 1k, 2k, 3k, 4k)
    // Source 10V: N1-GND. R1: N1-Nx(1k), R2: N1-Ny(2k), R3: Nx-GND(3k), R4: Ny-GND(4k).
    // Bridge R5: Nx-Ny (optional) - leave open for now
    const bridge: CircuitModel = {
        id: "EEC-016",
        components: [
            { id: "V1", type: 'VOLTAGE_SOURCE', value: 10, nodes: ['N1', 'GND'] },
            { id: "R1", type: 'RESISTOR', value: 1000, nodes: ['N1', 'Nx'] },
            { id: "R2", type: 'RESISTOR', value: 2000, nodes: ['N1', 'Ny'] },
            { id: "R3", type: 'RESISTOR', value: 3000, nodes: ['Nx', 'GND'] },
            { id: "R4", type: 'RESISTOR', value: 4000, nodes: ['Ny', 'GND'] }
        ]
    };
    const resBridge = NodalCircuitSolver.solve(bridge);
    if (resBridge) {
        const vNx = resBridge['Nx']; // VNx = 10 * (3000 / (1000+3000)) = 7.5V
        const vNy = resBridge['Ny']; // VNy = 10 * (4000 / (2000+4000)) = 6.6667V
        assert("EEC-016 Bridge (Nx Voltage)", Math.abs(vNx - 7.5) < 1e-9, `Expected 7.5V, got ${vNx}`);
        assert("EEC-016 Bridge (Ny Voltage)", Math.abs(vNy - 6.666666667) < 1e-7, `Expected 6.6667V, got ${vNy}`);
    } else {
        assert("EEC-016 Bridge", false, "Failed to solve");
    }

    console.table(results);
    const allPassed = results.every(r => r.status === "PASS");
    process.exit(allPassed ? 0 : 1);
}

runTests();
