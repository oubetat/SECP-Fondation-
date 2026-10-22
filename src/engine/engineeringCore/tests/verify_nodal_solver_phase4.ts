/**
 * SECP-ELECTRICAL-ENGINEERING-PHASE-1-004
 * Nodal Solver Adversarial Verification & Numerical Integrity Test Suite
 *
 * Verifies:
 * - EEC-017: Unbalanced Wheatstone Bridge with active non-zero bridge current
 * - EEC-018: Kirchhoff's Current Law (KCL) exact node residuals
 * - EEC-019: Kirchhoff's Voltage Law (KVL) loop balance
 * - EEC-020: Power conservation (P_source = Sum P_dissipated)
 * - EEC-021: Singular matrix handling (floating nodes / disconnected subgraphs)
 * - EEC-022: Missing reference node (GND absent)
 * - EEC-023: Invalid input handling (negative resistance rejection)
 * - EEC-024: Shorted component nodes (n1 === n2)
 * - EEC-025: Permutation invariance (component ordering does not change physics)
 * - EEC-026: Deterministic model hashing & evidence invalidation upon mutation
 */

import { NodalCircuitSolver, NodalSolveResult } from '../NodalCircuitSolver';
import { CircuitModel, computeCircuitCanonicalHash } from '../ReferenceCircuitModel';

interface AssertionLog {
  id: string;
  name: string;
  status: 'PASS' | 'FAIL';
  expected: string;
  actual: string;
  residual?: number;
  details: string;
}

const assertions: AssertionLog[] = [];

function assertTest(
  id: string,
  name: string,
  passed: boolean,
  expected: string,
  actual: string,
  details: string,
  residual?: number
) {
  assertions.push({
    id,
    name,
    status: passed ? 'PASS' : 'FAIL',
    expected,
    actual,
    residual,
    details
  });
  if (!passed) {
    console.error(`[FAIL] ${id} - ${name}: expected ${expected}, got ${actual} (${details})`);
  }
}

function runPhase4Battery() {
  console.log('=== SECP-ELECTRICAL-ENGINEERING-PHASE-1-004 VERIFICATION BATTERY ===\n');

  // -------------------------------------------------------------
  // Reference Model: Unbalanced Wheatstone Bridge with Bridge Resistor R5
  // V1: 10V (N1 -> GND)
  // R1: 1000 Ohm (N1 -> Nx)
  // R2: 2000 Ohm (N1 -> Ny)
  // R3: 3000 Ohm (Nx -> GND)
  // R4: 4000 Ohm (Ny -> GND)
  // R5: 500 Ohm  (Nx -> Ny) [Cross-arm bridge resistor carrying active current]
  // -------------------------------------------------------------
  const wheatstoneActiveModel: CircuitModel = {
    id: 'WHEATSTONE-ACTIVE-001',
    version: '1.0.0',
    referenceNode: 'GND',
    components: [
      { id: 'V1', type: 'VOLTAGE_SOURCE', value: 10.0, nodes: ['N1', 'GND'] },
      { id: 'R1', type: 'RESISTOR', value: 1000.0, nodes: ['N1', 'Nx'] },
      { id: 'R2', type: 'RESISTOR', value: 2000.0, nodes: ['N1', 'Ny'] },
      { id: 'R3', type: 'RESISTOR', value: 3000.0, nodes: ['Nx', 'GND'] },
      { id: 'R4', type: 'RESISTOR', value: 4000.0, nodes: ['Ny', 'GND'] },
      { id: 'R5', type: 'RESISTOR', value: 500.0, nodes: ['Nx', 'Ny'] }
    ]
  };

  const bridgeResult: NodalSolveResult = NodalCircuitSolver.solveDetailed(wheatstoneActiveModel);

  // Analytical reference values derived via closed-form Cramer's rule:
  // Vx = 225 / 31 = 7.258064516129 V
  // Vy = 220 / 31 = 7.096774193548 V
  // I(R5) = (Vx - Vy) / 500 = (5/31) / 500 = 1 / 3100 A = 0.0003225806 A
  const expectedVx = 225.0 / 31.0;
  const expectedVy = 220.0 / 31.0;
  const expectedIR5 = 1.0 / 3100.0;
  const expectedTotalPower = 13.0 / 310.0; // 0.04193548387 W

  // EEC-017: Unbalanced Wheatstone Bridge Node Voltages and Bridge Current
  const actualVx = bridgeResult.nodeVoltages['Nx'] ?? 0;
  const actualVy = bridgeResult.nodeVoltages['Ny'] ?? 0;
  const errVx = Math.abs(actualVx - expectedVx);
  const errVy = Math.abs(actualVy - expectedVy);

  const r5Branch = bridgeResult.branchCurrents.find(b => b.componentId === 'R5');
  const actualIR5 = r5Branch ? Math.abs(r5Branch.currentAmps) : 0;
  const errIR5 = Math.abs(actualIR5 - expectedIR5);

  assertTest(
    'EEC-017A',
    'Unbalanced Wheatstone Bridge: Nx Node Voltage Accuracy',
    errVx < 1e-7 && bridgeResult.success,
    `${expectedVx.toFixed(8)} V`,
    `${actualVx.toFixed(8)} V`,
    `Error: ${errVx.toExponential(4)} V`,
    errVx
  );

  assertTest(
    'EEC-017B',
    'Unbalanced Wheatstone Bridge: Ny Node Voltage Accuracy',
    errVy < 1e-7 && bridgeResult.success,
    `${expectedVy.toFixed(8)} V`,
    `${actualVy.toFixed(8)} V`,
    `Error: ${errVy.toExponential(4)} V`,
    errVy
  );

  assertTest(
    'EEC-017C',
    'Unbalanced Wheatstone Bridge: Active Non-Zero Bridge Current',
    errIR5 < 1e-8 && actualIR5 > 1e-5,
    `${expectedIR5.toExponential(6)} A`,
    `${actualIR5.toExponential(6)} A`,
    `Non-zero current verified: ${actualIR5.toFixed(6)} A`,
    errIR5
  );

  // EEC-018: Kirchhoff's Current Law (KCL) Compliance
  const maxKclResidual = Math.max(...bridgeResult.kclResiduals.map(k => Math.abs(k.sumCurrentsAmps)));
  const allKclBalanced = bridgeResult.kclResiduals.every(k => k.isBalanced);
  assertTest(
    'EEC-018',
    "Kirchhoff's Current Law (KCL) Node Residual Compliance",
    allKclBalanced && maxKclResidual < 1e-9,
    'Max residual <= 1e-9 A',
    `Max residual: ${maxKclResidual.toExponential(4)} A`,
    `Evaluated at all ${bridgeResult.kclResiduals.length} nodes (N1, Nx, Ny, GND)`,
    maxKclResidual
  );

  // EEC-019: Kirchhoff's Voltage Law (KVL) Compliance
  // Check loop: V1 -> R1 -> R5 -> R4 -> GND
  // Loop voltage sum = V1 - V_drop(R1) - V_drop(R5) - V_drop(R4)
  const v1Val = 10.0;
  const vDropR1 = (bridgeResult.nodeVoltages['N1'] ?? 0) - (bridgeResult.nodeVoltages['Nx'] ?? 0);
  const vDropR5 = (bridgeResult.nodeVoltages['Nx'] ?? 0) - (bridgeResult.nodeVoltages['Ny'] ?? 0);
  const vDropR4 = (bridgeResult.nodeVoltages['Ny'] ?? 0) - (bridgeResult.nodeVoltages['GND'] ?? 0);
  const kvlResidual = Math.abs(v1Val - vDropR1 - vDropR5 - vDropR4);

  assertTest(
    'EEC-019',
    "Kirchhoff's Voltage Law (KVL) Closed Loop Conservation",
    kvlResidual < 1e-9,
    'Loop residual <= 1e-9 V',
    `Loop residual: ${kvlResidual.toExponential(4)} V`,
    'Summed around Loop (V1 -> R1 -> R5 -> R4 -> GND)',
    kvlResidual
  );

  // EEC-020: Power Conservation & Balance
  const pSupplied = bridgeResult.powerBalance.totalPowerSuppliedWatts;
  const pDissipated = bridgeResult.powerBalance.totalPowerDissipatedWatts;
  const pImbalance = bridgeResult.powerBalance.imbalanceWatts;
  const errPower = Math.abs(pSupplied - expectedTotalPower);

  assertTest(
    'EEC-020',
    'Conservation of Energy: Exact Power Balance (P_source = Sum P_dissipated)',
    bridgeResult.powerBalance.isBalanced && pImbalance < 1e-9 && errPower < 1e-8,
    `${expectedTotalPower.toFixed(8)} W`,
    `Supplied: ${pSupplied.toFixed(8)} W, Dissipated: ${pDissipated.toFixed(8)} W`,
    `Imbalance: ${pImbalance.toExponential(4)} W`,
    pImbalance
  );

  // EEC-021: Singular System Detection (Floating Disconnected Subnetwork)
  const floatingCircuit: CircuitModel = {
    id: 'SINGULAR-FLOATING-001',
    referenceNode: 'GND',
    components: [
      { id: 'V1', type: 'VOLTAGE_SOURCE', value: 10.0, nodes: ['N1', 'GND'] },
      { id: 'R1', type: 'RESISTOR', value: 1000.0, nodes: ['N1', 'GND'] },
      // Resistor completely isolated from reference and source
      { id: 'R_float', type: 'RESISTOR', value: 500.0, nodes: ['N_iso1', 'N_iso2'] }
    ]
  };

  const singularResult = NodalCircuitSolver.solveDetailed(floatingCircuit);
  assertTest(
    'EEC-021',
    'Singular System Detection: Isolated Floating Subnetwork',
    singularResult.status === 'SINGULAR_MATRIX' && !singularResult.success,
    'Status: SINGULAR_MATRIX, success: false',
    `Status: ${singularResult.status}, success: ${singularResult.success}`,
    `Diagnostic message: ${singularResult.errorMessage}`
  );

  // EEC-022: Missing Reference Node (GND absent)
  const missingRefCircuit: CircuitModel = {
    id: 'NO-REF-001',
    referenceNode: 'GND',
    components: [
      { id: 'V1', type: 'VOLTAGE_SOURCE', value: 10.0, nodes: ['N1', 'N2'] },
      { id: 'R1', type: 'RESISTOR', value: 1000.0, nodes: ['N1', 'N2'] }
    ]
  };

  const missingRefResult = NodalCircuitSolver.solveDetailed(missingRefCircuit);
  assertTest(
    'EEC-022',
    'Missing Reference Node Rejection (No ground reference defined)',
    missingRefResult.status === 'MISSING_REFERENCE_NODE' && !missingRefResult.success,
    'Status: MISSING_REFERENCE_NODE, success: false',
    `Status: ${missingRefResult.status}, success: ${missingRefResult.success}`,
    `Diagnostic: ${missingRefResult.errorMessage}`
  );

  // EEC-023: Invalid Passive Component Parameters (Negative / Zero Resistance)
  const negativeRCircuit: CircuitModel = {
    id: 'NEG-RES-001',
    referenceNode: 'GND',
    components: [
      { id: 'V1', type: 'VOLTAGE_SOURCE', value: 10.0, nodes: ['N1', 'GND'] },
      { id: 'R_invalid', type: 'RESISTOR', value: -100.0, nodes: ['N1', 'GND'] }
    ]
  };

  const negResult = NodalCircuitSolver.solveDetailed(negativeRCircuit);
  assertTest(
    'EEC-023',
    'Invalid Parameter Rejection (Negative Resistance Value)',
    negResult.status === 'INVALID_INPUT' && !negResult.success,
    'Status: INVALID_INPUT, success: false',
    `Status: ${negResult.status}, success: ${negResult.success}`,
    `Diagnostic: ${negResult.errorMessage}`
  );

  // EEC-024: Component Shorted to Same Node
  const shortedComponentCircuit: CircuitModel = {
    id: 'SHORTED-NODES-001',
    referenceNode: 'GND',
    components: [
      { id: 'V1', type: 'VOLTAGE_SOURCE', value: 10.0, nodes: ['N1', 'GND'] },
      { id: 'R_short', type: 'RESISTOR', value: 1000.0, nodes: ['N1', 'N1'] }
    ]
  };

  const shortedResult = NodalCircuitSolver.solveDetailed(shortedComponentCircuit);
  assertTest(
    'EEC-024',
    'Component Shorted to Same Node Rejection (n1 === n2)',
    shortedResult.status === 'INVALID_INPUT' && !shortedResult.success,
    'Status: INVALID_INPUT, success: false',
    `Status: ${shortedResult.status}, success: ${shortedResult.success}`,
    `Diagnostic: ${shortedResult.errorMessage}`
  );

  // EEC-025: Permutation Invariance (Order of components does not alter numerical solution)
  const permutedModel: CircuitModel = {
    ...wheatstoneActiveModel,
    id: 'WHEATSTONE-PERMUTED-001',
    components: [...wheatstoneActiveModel.components].reverse() // Reversed array order
  };

  const permutedResult = NodalCircuitSolver.solveDetailed(permutedModel);
  const diffVx = Math.abs(permutedResult.nodeVoltages['Nx'] - actualVx);
  const diffVy = Math.abs(permutedResult.nodeVoltages['Ny'] - actualVy);
  const diffPower = Math.abs(permutedResult.powerBalance.totalPowerSuppliedWatts - pSupplied);

  assertTest(
    'EEC-025',
    'Permutation Invariance (Reversed component definition yields identical physics)',
    diffVx < 1e-12 && diffVy < 1e-12 && diffPower < 1e-12,
    'Max difference < 1e-12',
    `dVx: ${diffVx.toExponential(4)}, dVy: ${diffVy.toExponential(4)}, dP: ${diffPower.toExponential(4)}`,
    'Confirmed component array ordering independence'
  );

  // EEC-026: Deterministic Model Hashing & Evidence Invalidation upon Mutation
  const initialHash = computeCircuitCanonicalHash(wheatstoneActiveModel);

  const mutatedModel: CircuitModel = {
    ...wheatstoneActiveModel,
    components: wheatstoneActiveModel.components.map(c =>
      c.id === 'R5' ? { ...c, value: 1200.0 } : c // Mutated R5 from 500 to 1200 Ohm
    )
  };

  const mutatedHash = computeCircuitCanonicalHash(mutatedModel);
  const mutatedResult = NodalCircuitSolver.solveDetailed(mutatedModel);
  const mutatedVx = mutatedResult.nodeVoltages['Nx'];
  const voltageShift = Math.abs(mutatedVx - actualVx);

  assertTest(
    'EEC-026A',
    'Deterministic Hash Mutation Sensitivity',
    initialHash !== mutatedHash && initialHash.length === 16,
    `Distinct hashes: ${initialHash} -> ${mutatedHash}`,
    `Initial: ${initialHash}, Mutated: ${mutatedHash}`,
    'Confirmed model hash change upon parameter mutation'
  );

  assertTest(
    'EEC-026B',
    'Evidence Invalidation: Numerical Solution Divergence on Mutation',
    voltageShift > 0.05,
    'Voltage shift > 0.05 V',
    `Shift: ${voltageShift.toFixed(6)} V`,
    `Prior evidence for ${initialHash} cannot certify mutated model ${mutatedHash}`
  );

  // Print Summary Table
  console.log('---------------------------------------------------------------------------------------------------------');
  console.log('| ID       | Test Name                                            | Status | Residual      | Details');
  console.log('---------------------------------------------------------------------------------------------------------');
  assertions.forEach(a => {
    const resStr = a.residual !== undefined ? a.residual.toExponential(2) : 'N/A';
    console.log(
      `| ${a.id.padEnd(8)} | ${a.name.slice(0, 52).padEnd(52)} | ${a.status.padEnd(6)} | ${resStr.padEnd(13)} | ${a.details.slice(0, 30)}`
    );
  });
  console.log('---------------------------------------------------------------------------------------------------------\n');

  const passedCount = assertions.filter(a => a.status === 'PASS').length;
  const totalCount = assertions.length;
  const allPassed = passedCount === totalCount;

  console.log(`Results: ${passedCount}/${totalCount} assertions PASSED.`);
  if (!allPassed) {
    console.error('Some assertions failed!');
    process.exit(1);
  }
}

runPhase4Battery();
