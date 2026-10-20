/**
 * Hard Acceptance Tests for Electrical Foundation
 */
import { referenceCircuit } from '../ReferenceCircuitModel';
import { SimpleCircuitSolver } from '../SimpleCircuitSolver';
import { ElectricalCoreEngine } from '../electrical';

function runTests() {
    console.log("=== SECP ELECTRICAL FOUNDATION TESTS ===");
    
    // EEC-001 Reference Case
    const circuit = referenceCircuit;
    const solverResult = SimpleCircuitSolver.solve(circuit);
    
    const engineResult = ElectricalCoreEngine.calculateCurrent(10, 1000);
    const powerResult = ElectricalCoreEngine.calculateDCPowerWatts(10, engineResult);
    
    const passed = Math.abs(engineResult - solverResult.currentAmps) < 1e-9 &&
                   Math.abs(powerResult - solverResult.powerWatts) < 1e-9;
    
    console.log(`EEC-001: ${passed ? 'PASS' : 'FAIL'}`);
    console.log(`Engine I: ${engineResult}A, Solver I: ${solverResult.currentAmps}A`);
    console.log(`Engine P: ${powerResult}W, Solver P: ${solverResult.powerWatts}W`);

    process.exit(passed ? 0 : 1);
}

runTests();
