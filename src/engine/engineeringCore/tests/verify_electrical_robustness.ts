/**
 * Hard Acceptance Tests for Electrical Foundation Phase 1-002
 */
import { CircuitModel } from '../ReferenceCircuitModel';
import { CircuitTopologySolver } from '../CircuitTopologySolver';
import { ElectricalCoreEngine } from '../electrical';

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
    console.log("=== SECP ELECTRICAL FOUNDATION PHASE 1-002 ===");
    
    // EEC-002: Series
    const seriesModel: CircuitModel = {
        id: "EEC-002",
        components: [
            { id: "V1", type: 'VOLTAGE_SOURCE', value: 10, nodes: ['N1', 'GND'] },
            { id: "R1", type: 'RESISTOR', value: 1000, nodes: ['N1', 'Nx'] },
            { id: "R2", type: 'RESISTOR', value: 2000, nodes: ['Nx', 'GND'] }
        ]
    };
    
    const reqSeries = CircuitTopologySolver.getEquivalentResistance(seriesModel, 'N1', 'GND');
    const iSeries = ElectricalCoreEngine.calculateCurrent(10, reqSeries);
    assert("EEC-002 Series Resistance", Math.abs(reqSeries - 3000) < 1e-9, `Expected 3000, got ${reqSeries}`);
    assert("EEC-002 Series Current", Math.abs(iSeries - 0.003333333) < 1e-7, `Expected 0.00333, got ${iSeries}`);

    // EEC-003: Parallel
    const parallelModel: CircuitModel = {
        id: "EEC-003",
        components: [
            { id: "V1", type: 'VOLTAGE_SOURCE', value: 10, nodes: ['N1', 'GND'] },
            { id: "R1", type: 'RESISTOR', value: 1000, nodes: ['N1', 'GND'] },
            { id: "R2", type: 'RESISTOR', value: 2000, nodes: ['N1', 'GND'] }
        ]
    };
    
    const reqParallel = CircuitTopologySolver.getEquivalentResistance(parallelModel, 'N1', 'GND');
    const iTotalParallel = ElectricalCoreEngine.calculateCurrent(10, reqParallel);
    assert("EEC-003 Parallel Resistance", Math.abs(reqParallel - 666.6666667) < 1e-7, `Expected 666.67, got ${reqParallel}`);
    assert("EEC-003 Parallel Current", Math.abs(iTotalParallel - 0.015) < 1e-9, `Expected 0.015, got ${iTotalParallel}`);

    console.table(results);
    const allPassed = results.every(r => r.status === "PASS");
    process.exit(allPassed ? 0 : 1);
}

runTests();
