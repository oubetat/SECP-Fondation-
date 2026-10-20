/**
 * Adversarial Tests for Electrical Foundation Phase 1-002
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

function runAdversarialTests() {
    console.log("=== SECP ELECTRICAL ADVERSARIAL TESTS ===");
    
    // EEC-006: Open circuit
    const openCircuitModel: CircuitModel = {
        id: "EEC-006",
        components: [
            { id: "V1", type: 'VOLTAGE_SOURCE', value: 10, nodes: ['N1', 'GND'] },
            { id: "R1", type: 'RESISTOR', value: 1000, nodes: ['N1', 'Nx'] }
            // No path to GND for R1
        ]
    };
    
    const reqOpen = CircuitTopologySolver.getEquivalentResistance(openCircuitModel, 'N1', 'GND');
    assert("EEC-006 Open Circuit", !isFinite(reqOpen), "Should return Infinity/NotFinite for open circuit");

    // EEC-007: Missing value
    const missingValueModel: CircuitModel = {
        id: "EEC-007",
        components: [
            { id: "V1", type: 'VOLTAGE_SOURCE', value: 10, nodes: ['N1', 'GND'] },
            { id: "R1", type: 'RESISTOR', value: NaN, nodes: ['N1', 'GND'] }
        ]
    };
    const reqMissing = CircuitTopologySolver.getEquivalentResistance(missingValueModel, 'N1', 'GND');
    assert("EEC-007 Missing value", isNaN(reqMissing), "Should return NaN or handle missing value");

    console.table(results);
}

runAdversarialTests();
