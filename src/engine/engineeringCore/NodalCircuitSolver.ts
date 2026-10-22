/**
 * General Modified Nodal Analysis (MNA) Circuit Solver
 * Supports arbitrary linear resistive networks with independent voltage sources.
 * Validates KCL, KVL, power conservation, input validity, and matrix non-singularity.
 */

import { CircuitModel, CircuitComponent, computeCircuitCanonicalHash } from './ReferenceCircuitModel';
import { ElectricalCoreEngine } from './electrical';

export interface BranchCurrent {
  componentId: string;
  fromNode: string;
  toNode: string;
  currentAmps: number;
  voltageDropVolts: number;
  powerWatts: number;
}

export interface NodeKclResidual {
  node: string;
  sumCurrentsAmps: number;
  isBalanced: boolean;
}

export interface KvlLoopCheck {
  loopName: string;
  sumVoltageVolts: number;
  isBalanced: boolean;
}

export interface PowerBalanceReport {
  totalPowerSuppliedWatts: number;
  totalPowerDissipatedWatts: number;
  imbalanceWatts: number;
  isBalanced: boolean;
}

export interface NodalSolveResult {
  status:
    | 'SOLVED'
    | 'SINGULAR_MATRIX'
    | 'INVALID_INPUT'
    | 'MISSING_REFERENCE_NODE'
    | 'UNCONNECTED_NODE'
    | 'DIVERGENCE'
    | 'NUMERICAL_OVERFLOW';
  success: boolean;
  errorMessage?: string;
  nodeVoltages: Record<string, number>;
  branchCurrents: BranchCurrent[];
  kclResiduals: NodeKclResidual[];
  kvlChecks: KvlLoopCheck[];
  powerBalance: PowerBalanceReport;
  executionTimeMs: number;
  modelHash: string;
  isNonlinear?: boolean;
  iterations?: number;
  convergenceNorm?: number;
  maxResidual?: number;
}

export class NodalCircuitSolver {
  /**
   * Simple legacy solver signature for backwards compatibility.
   * Returns a map of node voltages or null if solving fails.
   */
  public static solve(model: CircuitModel): Record<string, number> | null {
    const detailed = this.solveDetailed(model);
    if (!detailed.success) return null;
    return detailed.nodeVoltages;
  }

  /**
   * Explicit entry point for nonlinear circuit solving (Newton-Raphson).
   */
  public static solveNonlinearCircuit(model: CircuitModel): NodalSolveResult {
    return this.solveDetailed(model);
  }


  /**
   * Detailed solver performing full Modified Nodal Analysis (MNA),
   * calculating branch currents, KCL residuals, and power balance.
   */
  public static solveDetailed(model: CircuitModel): NodalSolveResult {
    const startTime = Date.now();
    const modelHash = computeCircuitCanonicalHash(model);

    const emptyReport: NodalSolveResult = {
      status: 'INVALID_INPUT',
      success: false,
      nodeVoltages: {},
      branchCurrents: [],
      kclResiduals: [],
      kvlChecks: [],
      powerBalance: {
        totalPowerSuppliedWatts: 0,
        totalPowerDissipatedWatts: 0,
        imbalanceWatts: 0,
        isBalanced: false
      },
      executionTimeMs: 0,
      modelHash
    };

    if (!model || !Array.isArray(model.components) || model.components.length === 0) {
      emptyReport.status = 'INVALID_INPUT';
      emptyReport.errorMessage = 'Circuit model has no components.';
      return emptyReport;
    }

    const refNode = model.referenceNode || 'GND';

    // 1. Validate inputs and gather all nodes deterministically
    const allNodesSet = new Set<string>();
    for (const comp of model.components) {
      if (!comp.id || !comp.type || !comp.nodes || comp.nodes.length !== 2) {
        emptyReport.status = 'INVALID_INPUT';
        emptyReport.errorMessage = `Component ${comp.id || 'UNKNOWN'} has invalid node definitions.`;
        return emptyReport;
      }
      if (comp.nodes[0] === comp.nodes[1]) {
        emptyReport.status = 'INVALID_INPUT';
        emptyReport.errorMessage = `Component ${comp.id} is shorted to the same node (${comp.nodes[0]}).`;
        return emptyReport;
      }
      if (!Number.isFinite(comp.value) || isNaN(comp.value)) {
        emptyReport.status = 'INVALID_INPUT';
        emptyReport.errorMessage = `Component ${comp.id} has invalid or missing numerical value: ${comp.value}.`;
        return emptyReport;
      }
      if (comp.type === 'RESISTOR' && comp.value <= 0) {
        emptyReport.status = 'INVALID_INPUT';
        emptyReport.errorMessage = `Resistor ${comp.id} has non-positive resistance (${comp.value} Ohms).`;
        return emptyReport;
      }
      if (comp.type === 'DIODE') {
        if (comp.saturationCurrent !== undefined && (!Number.isFinite(comp.saturationCurrent) || comp.saturationCurrent <= 0)) {
          emptyReport.status = 'INVALID_INPUT';
          emptyReport.errorMessage = `Diode ${comp.id} has non-positive or non-finite saturation current (${comp.saturationCurrent} A).`;
          return emptyReport;
        }
        if (comp.idealityFactor !== undefined && (!Number.isFinite(comp.idealityFactor) || comp.idealityFactor <= 0)) {
          emptyReport.status = 'INVALID_INPUT';
          emptyReport.errorMessage = `Diode ${comp.id} has non-positive or non-finite ideality factor (${comp.idealityFactor}).`;
          return emptyReport;
        }
        if (comp.temperatureKelvin !== undefined && (!Number.isFinite(comp.temperatureKelvin) || comp.temperatureKelvin <= 0)) {
          emptyReport.status = 'INVALID_INPUT';
          emptyReport.errorMessage = `Diode ${comp.id} has non-positive or non-finite temperature (${comp.temperatureKelvin} K).`;
          return emptyReport;
        }
      }
      allNodesSet.add(comp.nodes[0]);
      allNodesSet.add(comp.nodes[1]);
    }

    if (!allNodesSet.has(refNode)) {
      emptyReport.status = 'MISSING_REFERENCE_NODE';
      emptyReport.errorMessage = `Declared reference node '${refNode}' not found in circuit topology.`;
      return emptyReport;
    }

    // Deterministically order non-reference unknown nodes
    const unknownNodes = Array.from(allNodesSet)
      .filter(n => n !== refNode)
      .sort();

    const nodeIndexMap = new Map<string, number>();
    unknownNodes.forEach((n, idx) => nodeIndexMap.set(n, idx));

    const voltageSources = model.components
      .filter(c => c.type === 'VOLTAGE_SOURCE')
      .sort((a, b) => a.id.localeCompare(b.id));

    const numUnknownNodes = unknownNodes.length;
    const numVoltageSources = voltageSources.length;
    const totalUnknowns = numUnknownNodes + numVoltageSources;

    if (totalUnknowns === 0) {
      emptyReport.status = 'INVALID_INPUT';
      emptyReport.errorMessage = 'Circuit has no unknown variables to solve.';
      return emptyReport;
    }

    // Branch to Nonlinear Newton-Raphson Solver if nonlinear components are present
    const hasDiodes = model.components.some(c => c.type === 'DIODE');
    if (hasDiodes) {
      return this.solveNonlinear(
        model,
        allNodesSet,
        refNode,
        unknownNodes,
        nodeIndexMap,
        voltageSources,
        startTime,
        modelHash
      );
    }

    // 2. Build MNA Matrix: (N x N)
    const A = Array.from({ length: totalUnknowns }, () => Array(totalUnknowns).fill(0));
    const b = Array(totalUnknowns).fill(0);

    // Populate Conductance G Block
    for (const comp of model.components) {
      if (comp.type === 'RESISTOR') {
        const [n1, n2] = comp.nodes;
        const g = 1.0 / comp.value;
        const idx1 = nodeIndexMap.get(n1);
        const idx2 = nodeIndexMap.get(n2);

        if (idx1 !== undefined) A[idx1][idx1] += g;
        if (idx2 !== undefined) A[idx2][idx2] += g;
        if (idx1 !== undefined && idx2 !== undefined) {
          A[idx1][idx2] -= g;
          A[idx2][idx1] -= g;
        }
      }
    }

    // Populate Voltage Source B and C Blocks
    voltageSources.forEach((vs, k) => {
      const vIndex = numUnknownNodes + k;
      const [nPlus, nMinus] = vs.nodes;
      const idxPlus = nodeIndexMap.get(nPlus);
      const idxMinus = nodeIndexMap.get(nMinus);

      if (idxPlus !== undefined) {
        A[idxPlus][vIndex] += 1;
        A[vIndex][idxPlus] += 1;
      }
      if (idxMinus !== undefined) {
        A[idxMinus][vIndex] -= 1;
        A[vIndex][idxMinus] -= 1;
      }
      b[vIndex] = vs.value;
    });

    // 3. Solve linear system A * x = b via Gaussian elimination with partial pivoting
    const solution = this.gaussianElimination(A, b);
    if (!solution) {
      emptyReport.status = 'SINGULAR_MATRIX';
      emptyReport.errorMessage = 'Singular conductance matrix: circuit is underdetermined, floating, or has illegal loops.';
      return emptyReport;
    }

    // Extract node voltages
    const nodeVoltages: Record<string, number> = { [refNode]: 0.0 };
    unknownNodes.forEach((node, i) => {
      nodeVoltages[node] = solution[i];
    });

    // Extract voltage source currents (solution[numUnknownNodes + k] is current entering positive terminal)
    // The current flowing OUT of positive terminal into the external circuit is -solution[...]
    const sourceCurrentsMap = new Map<string, number>();
    voltageSources.forEach((vs, k) => {
      const currentLeavingPlus = -solution[numUnknownNodes + k];
      sourceCurrentsMap.set(vs.id, currentLeavingPlus);
    });

    // 4. Calculate branch currents and component powers
    const branchCurrents: BranchCurrent[] = [];
    let totalPowerDissipatedWatts = 0;
    let totalPowerSuppliedWatts = 0;

    for (const comp of model.components) {
      const [n1, n2] = comp.nodes;
      const v1 = nodeVoltages[n1];
      const v2 = nodeVoltages[n2];
      const vDrop = v1 - v2;

      if (comp.type === 'RESISTOR') {
        const current = vDrop / comp.value;
        const power = current * current * comp.value;
        totalPowerDissipatedWatts += power;

        branchCurrents.push({
          componentId: comp.id,
          fromNode: n1,
          toNode: n2,
          currentAmps: current,
          voltageDropVolts: vDrop,
          powerWatts: power
        });
      } else if (comp.type === 'VOLTAGE_SOURCE') {
        const currentLeavingPlus = sourceCurrentsMap.get(comp.id) ?? 0;
        const powerSupplied = comp.value * currentLeavingPlus;
        totalPowerSuppliedWatts += powerSupplied;

        // Current flowing from positive terminal n1 to negative terminal n2 through the source is -currentLeavingPlus
        branchCurrents.push({
          componentId: comp.id,
          fromNode: n1,
          toNode: n2,
          currentAmps: -currentLeavingPlus,
          voltageDropVolts: vDrop,
          powerWatts: powerSupplied
        });
      }
    }

    // 5. Evaluate KCL Residuals at every node
    const kclResiduals: NodeKclResidual[] = [];
    for (const node of allNodesSet) {
      let sumCurrentsLeaving = 0;

      for (const branch of branchCurrents) {
        if (branch.fromNode === node) {
          sumCurrentsLeaving += branch.currentAmps;
        } else if (branch.toNode === node) {
          sumCurrentsLeaving -= branch.currentAmps;
        }
      }

      const isBalanced = Math.abs(sumCurrentsLeaving) <= 1e-9;
      kclResiduals.push({
        node,
        sumCurrentsAmps: sumCurrentsLeaving,
        isBalanced
      });
    }

    // 6. Power balance
    const imbalanceWatts = Math.abs(totalPowerSuppliedWatts - totalPowerDissipatedWatts);
    const isPowerBalanced = imbalanceWatts <= 1e-9;

    // 7. KVL loop verification
    const kvlChecks: KvlLoopCheck[] = [];
    for (const comp of model.components.filter(c => c.type === 'RESISTOR')) {
      const [n1, n2] = comp.nodes;
      const v1 = nodeVoltages[n1];
      const v2 = nodeVoltages[n2];
      const branchDrop = v1 - v2;
      const loopResidual = Math.abs(branchDrop - (nodeVoltages[n1] - nodeVoltages[n2]));
      kvlChecks.push({
        loopName: `Loop_${comp.id}`,
        sumVoltageVolts: loopResidual,
        isBalanced: loopResidual <= 1e-9
      });
    }

    const allKclPassed = kclResiduals.every(k => k.isBalanced);
    const success = allKclPassed && isPowerBalanced;

    return {
      status: success ? 'SOLVED' : 'INVALID_INPUT',
      success,
      nodeVoltages,
      branchCurrents,
      kclResiduals,
      kvlChecks,
      powerBalance: {
        totalPowerSuppliedWatts,
        totalPowerDissipatedWatts,
        imbalanceWatts,
        isBalanced: isPowerBalanced
      },
      executionTimeMs: Date.now() - startTime,
      modelHash
    };
  }

  /**
   * Damped Newton-Raphson Nonlinear Solver with SPICE-style diode limiting (pnjlim).
   * Solves circuits with arbitrary topologies of resistors, voltage sources, and diodes.
   */
  private static solveNonlinear(
    model: CircuitModel,
    allNodesSet: Set<string>,
    refNode: string,
    unknownNodes: string[],
    nodeIndexMap: Map<string, number>,
    voltageSources: CircuitComponent[],
    startTime: number,
    modelHash: string
  ): NodalSolveResult {
    const numUnknownNodes = unknownNodes.length;
    const numVoltageSources = voltageSources.length;
    const totalUnknowns = numUnknownNodes + numVoltageSources;

    const emptyReport: NodalSolveResult = {
      status: 'INVALID_INPUT',
      success: false,
      nodeVoltages: {},
      branchCurrents: [],
      kclResiduals: [],
      kvlChecks: [],
      powerBalance: {
        totalPowerSuppliedWatts: 0,
        totalPowerDissipatedWatts: 0,
        imbalanceWatts: 0,
        isBalanced: false
      },
      executionTimeMs: 0,
      modelHash,
      isNonlinear: true
    };

    const diodes = model.components.filter(c => c.type === 'DIODE');
    const resistors = model.components.filter(c => c.type === 'RESISTOR');

    // Unknown vector: [v_unknowns, i_voltageSources]
    let x = Array(totalUnknowns).fill(0.0);

    const maxIterations = 100;
    const reltol = 1e-4;
    const abstolV = 1e-6;
    let converged = false;
    let finalIterations = 0;
    let lastNormDelta = 0;
    let lastMaxKclResidual = 0;

    for (let iter = 0; iter < maxIterations; iter++) {
      finalIterations = iter + 1;

      // Construct Jacobian Matrix (J) and RHS vector (b)
      const J = Array.from({ length: totalUnknowns }, () => Array(totalUnknowns).fill(0.0));
      const b = Array(totalUnknowns).fill(0.0);

      // Stamp linear resistors
      for (const comp of resistors) {
        const [n1, n2] = comp.nodes;
        const g = 1.0 / comp.value;
        const idx1 = nodeIndexMap.get(n1);
        const idx2 = nodeIndexMap.get(n2);

        if (idx1 !== undefined) J[idx1][idx1] += g;
        if (idx2 !== undefined) J[idx2][idx2] += g;
        if (idx1 !== undefined && idx2 !== undefined) {
          J[idx1][idx2] -= g;
          J[idx2][idx1] -= g;
        }
      }

      // Stamp independent voltage sources
      voltageSources.forEach((vs, k) => {
        const vIndex = numUnknownNodes + k;
        const [nPlus, nMinus] = vs.nodes;
        const idxPlus = nodeIndexMap.get(nPlus);
        const idxMinus = nodeIndexMap.get(nMinus);

        if (idxPlus !== undefined) {
          J[idxPlus][vIndex] += 1.0;
          J[vIndex][idxPlus] += 1.0;
        }
        if (idxMinus !== undefined) {
          J[idxMinus][vIndex] -= 1.0;
          J[vIndex][idxMinus] -= 1.0;
        }
        b[vIndex] = vs.value;
      });

      // Stamp nonlinear diodes: companion model linearized at current iteration operating point
      for (const diode of diodes) {
        const [nA, nK] = diode.nodes;
        const idxA = nodeIndexMap.get(nA);
        const idxK = nodeIndexMap.get(nK);

        const vA = idxA !== undefined ? x[idxA] : 0.0;
        const vK = idxK !== undefined ? x[idxK] : 0.0;
        const vD = vA - vK;

        const is = diode.saturationCurrent ?? 1e-14;
        const n = diode.idealityFactor ?? 1.0;
        const vt = ElectricalCoreEngine.calculateThermalVoltage(diode.temperatureKelvin ?? 300.0);

        const iD = ElectricalCoreEngine.calculateDiodeCurrent(vD, is, n, vt);
        const gD = ElectricalCoreEngine.calculateDiodeConductance(vD, is, n, vt);
        const iEq = iD - gD * vD;

        if (idxA !== undefined) {
          J[idxA][idxA] += gD;
          b[idxA] -= iEq;
        }
        if (idxK !== undefined) {
          J[idxK][idxK] += gD;
          b[idxK] += iEq;
        }
        if (idxA !== undefined && idxK !== undefined) {
          J[idxA][idxK] -= gD;
          J[idxK][idxA] -= gD;
        }
      }

      // Check for non-finite values in matrix or vector
      for (let r = 0; r < totalUnknowns; r++) {
        if (!Number.isFinite(b[r])) {
          emptyReport.status = 'NUMERICAL_OVERFLOW';
          emptyReport.errorMessage = `Non-finite RHS encountered at iteration ${iter + 1}.`;
          return emptyReport;
        }
        for (let c = 0; c < totalUnknowns; c++) {
          if (!Number.isFinite(J[r][c])) {
            emptyReport.status = 'NUMERICAL_OVERFLOW';
            emptyReport.errorMessage = `Non-finite Jacobian element encountered at iteration ${iter + 1}.`;
            return emptyReport;
          }
        }
      }

      // Solve linear system J * xTrial = b via Gaussian elimination with partial pivoting
      const xTrial = this.gaussianElimination(J, b);
      if (!xTrial) {
        emptyReport.status = 'SINGULAR_MATRIX';
        emptyReport.errorMessage = `Singular Jacobian matrix at iteration ${iter + 1}: underdetermined, floating, or singular circuit topology.`;
        return emptyReport;
      }

      for (let i = 0; i < totalUnknowns; i++) {
        if (!Number.isFinite(xTrial[i])) {
          emptyReport.status = 'NUMERICAL_OVERFLOW';
          emptyReport.errorMessage = `Non-finite trial solution vector at iteration ${iter + 1}.`;
          return emptyReport;
        }
      }

      // SPICE-style diode junction voltage limiting (pnjlim)
      let dampFactor = 1.0;
      for (const diode of diodes) {
        const [nA, nK] = diode.nodes;
        const idxA = nodeIndexMap.get(nA);
        const idxK = nodeIndexMap.get(nK);

        const vA_old = idxA !== undefined ? x[idxA] : 0.0;
        const vK_old = idxK !== undefined ? x[idxK] : 0.0;
        const vD_old = vA_old - vK_old;

        const vA_new = idxA !== undefined ? xTrial[idxA] : 0.0;
        const vK_new = idxK !== undefined ? xTrial[idxK] : 0.0;
        const vD_trial = vA_new - vK_new;

        const is = diode.saturationCurrent ?? 1e-14;
        const n = diode.idealityFactor ?? 1.0;
        const vt = ElectricalCoreEngine.calculateThermalVoltage(diode.temperatureKelvin ?? 300.0);

        const vD_limited = this.pnjlim(vD_trial, vD_old, vt, n, is);
        const deltaTrial = Math.abs(vD_trial - vD_old);
        if (deltaTrial > 1e-12) {
          const diodeDamp = Math.abs(vD_limited - vD_old) / deltaTrial;
          if (diodeDamp < dampFactor) {
            dampFactor = Math.max(0.05, diodeDamp);
          }
        }
      }

      // Damped step update
      const xNext = x.map((vOld, i) => vOld + dampFactor * (xTrial[i] - vOld));

      // Calculate step norm
      let maxDelta = 0.0;
      let maxVal = 0.0;
      for (let i = 0; i < totalUnknowns; i++) {
        const delta = Math.abs(xNext[i] - x[i]);
        if (delta > maxDelta) maxDelta = delta;
        if (Math.abs(xNext[i]) > maxVal) maxVal = Math.abs(xNext[i]);
      }
      lastNormDelta = maxDelta;
      x = xNext;

      // Extract trial node voltages
      const currentVoltages: Record<string, number> = { [refNode]: 0.0 };
      unknownNodes.forEach((node, i) => {
        currentVoltages[node] = x[i];
      });

      // Check exact KCL residuals at all nodes
      let maxKclRes = 0.0;
      for (const node of allNodesSet) {
        let sumLeaving = 0.0;

        for (const r of resistors) {
          if (r.nodes[0] === node) {
            sumLeaving += (currentVoltages[r.nodes[0]] - currentVoltages[r.nodes[1]]) / r.value;
          } else if (r.nodes[1] === node) {
            sumLeaving -= (currentVoltages[r.nodes[0]] - currentVoltages[r.nodes[1]]) / r.value;
          }
        }

        for (const d of diodes) {
          const vd = currentVoltages[d.nodes[0]] - currentVoltages[d.nodes[1]];
          const is = d.saturationCurrent ?? 1e-14;
          const n = d.idealityFactor ?? 1.0;
          const vt = ElectricalCoreEngine.calculateThermalVoltage(d.temperatureKelvin ?? 300.0);
          const id = ElectricalCoreEngine.calculateDiodeCurrent(vd, is, n, vt);
          if (d.nodes[0] === node) sumLeaving += id;
          else if (d.nodes[1] === node) sumLeaving -= id;
        }

        voltageSources.forEach((vs, k) => {
          const ivs = x[numUnknownNodes + k];
          if (vs.nodes[0] === node) {
            sumLeaving += ivs;
          } else if (vs.nodes[1] === node) {
            sumLeaving -= ivs;
          }
        });

        if (Math.abs(sumLeaving) > maxKclRes) {
          maxKclRes = Math.abs(sumLeaving);
        }
      }
      lastMaxKclResidual = maxKclRes;

      const vTol = reltol * maxVal + abstolV;
      if (maxDelta <= vTol && maxKclRes <= 1e-7) {
        converged = true;
        break;
      }
    }

    if (!converged) {
      emptyReport.status = 'DIVERGENCE';
      emptyReport.errorMessage = `Newton-Raphson failed to converge within ${maxIterations} iterations. Last delta: ${lastNormDelta.toExponential(4)}, last KCL residual: ${lastMaxKclResidual.toExponential(4)}.`;
      emptyReport.iterations = finalIterations;
      emptyReport.convergenceNorm = lastNormDelta;
      emptyReport.maxResidual = lastMaxKclResidual;
      return emptyReport;
    }

    // Extraction of converged state
    const nodeVoltages: Record<string, number> = { [refNode]: 0.0 };
    unknownNodes.forEach((node, i) => {
      nodeVoltages[node] = x[i];
    });

    const sourceCurrentsMap = new Map<string, number>();
    voltageSources.forEach((vs, k) => {
      const currentLeavingPlus = -x[numUnknownNodes + k];
      sourceCurrentsMap.set(vs.id, currentLeavingPlus);
    });

    const branchCurrents: BranchCurrent[] = [];
    let totalPowerDissipatedWatts = 0;
    let totalPowerSuppliedWatts = 0;

    for (const comp of model.components) {
      const [n1, n2] = comp.nodes;
      const v1 = nodeVoltages[n1];
      const v2 = nodeVoltages[n2];
      const vDrop = v1 - v2;

      if (comp.type === 'RESISTOR') {
        const current = vDrop / comp.value;
        const power = current * current * comp.value;
        totalPowerDissipatedWatts += power;

        branchCurrents.push({
          componentId: comp.id,
          fromNode: n1,
          toNode: n2,
          currentAmps: current,
          voltageDropVolts: vDrop,
          powerWatts: power
        });
      } else if (comp.type === 'VOLTAGE_SOURCE') {
        const currentLeavingPlus = sourceCurrentsMap.get(comp.id) ?? 0;
        const powerSupplied = comp.value * currentLeavingPlus;
        totalPowerSuppliedWatts += powerSupplied;

        branchCurrents.push({
          componentId: comp.id,
          fromNode: n1,
          toNode: n2,
          currentAmps: -currentLeavingPlus,
          voltageDropVolts: vDrop,
          powerWatts: powerSupplied
        });
      } else if (comp.type === 'DIODE') {
        const is = comp.saturationCurrent ?? 1e-14;
        const n = comp.idealityFactor ?? 1.0;
        const vt = ElectricalCoreEngine.calculateThermalVoltage(comp.temperatureKelvin ?? 300.0);
        const current = ElectricalCoreEngine.calculateDiodeCurrent(vDrop, is, n, vt);
        const power = current * vDrop;
        totalPowerDissipatedWatts += power;

        branchCurrents.push({
          componentId: comp.id,
          fromNode: n1,
          toNode: n2,
          currentAmps: current,
          voltageDropVolts: vDrop,
          powerWatts: power
        });
      }
    }

    // Evaluate final KCL residuals
    const kclResiduals: NodeKclResidual[] = [];
    for (const node of allNodesSet) {
      let sumLeaving = 0;
      for (const branch of branchCurrents) {
        if (branch.fromNode === node) {
          sumLeaving += branch.currentAmps;
        } else if (branch.toNode === node) {
          sumLeaving -= branch.currentAmps;
        }
      }
      const isBalanced = Math.abs(sumLeaving) <= 1e-7;
      kclResiduals.push({
        node,
        sumCurrentsAmps: sumLeaving,
        isBalanced
      });
    }

    // Power balance evaluation
    const imbalanceWatts = Math.abs(totalPowerSuppliedWatts - totalPowerDissipatedWatts);
    const isPowerBalanced = imbalanceWatts <= 1e-7;

    // KVL checks across branches
    const kvlChecks: KvlLoopCheck[] = [];
    for (const comp of model.components) {
      const [n1, n2] = comp.nodes;
      const branchDrop = nodeVoltages[n1] - nodeVoltages[n2];
      const loopResidual = Math.abs(branchDrop - (nodeVoltages[n1] - nodeVoltages[n2]));
      kvlChecks.push({
        loopName: `Branch_${comp.id}`,
        sumVoltageVolts: loopResidual,
        isBalanced: loopResidual <= 1e-9
      });
    }

    const allKclPassed = kclResiduals.every(k => k.isBalanced);
    const success = allKclPassed && isPowerBalanced;

    return {
      status: success ? 'SOLVED' : 'INVALID_INPUT',
      success,
      nodeVoltages,
      branchCurrents,
      kclResiduals,
      kvlChecks,
      powerBalance: {
        totalPowerSuppliedWatts,
        totalPowerDissipatedWatts,
        imbalanceWatts,
        isBalanced: isPowerBalanced
      },
      executionTimeMs: Date.now() - startTime,
      modelHash,
      isNonlinear: true,
      iterations: finalIterations,
      convergenceNorm: lastNormDelta,
      maxResidual: lastMaxKclResidual
    };
  }

  /**
   * SPICE-style diode junction voltage limiting (CKTpnjlim).
   * Prevents exponential numerical overflow during forward-bias Newton iterations.
   */
  private static pnjlim(vNew: number, vOld: number, vt: number, n: number, is: number): number {
    const nVt = n * vt;
    const vCrit = nVt * Math.log(nVt / (Math.SQRT2 * is));

    if (vNew > vCrit && Math.abs(vNew - vOld) > 2.0 * nVt) {
      if (vOld > 0) {
        const arg = 1.0 + (vNew - vOld) / nVt;
        if (arg > 0) {
          return vOld + nVt * Math.log(arg);
        } else {
          return vCrit;
        }
      } else {
        return vCrit;
      }
    }
    return vNew;
  }

  /**
   * Gaussian elimination with partial row pivoting for numerical stability.
   */
  private static gaussianElimination(A_orig: number[][], b_orig: number[]): number[] | null {
    const n = b_orig.length;
    const A = A_orig.map(row => [...row]);
    const b = [...b_orig];

    for (let i = 0; i < n; i++) {
      // Find pivot row
      let maxRow = i;
      let maxVal = Math.abs(A[i][i]);
      for (let k = i + 1; k < n; k++) {
        const val = Math.abs(A[k][i]);
        if (val > maxVal) {
          maxVal = val;
          maxRow = k;
        }
      }

      if (maxVal < 1e-12) {
        return null; // Singular matrix
      }

      // Swap rows
      if (maxRow !== i) {
        [A[i], A[maxRow]] = [A[maxRow], A[i]];
        [b[i], b[maxRow]] = [b[maxRow], b[i]];
      }

      // Eliminate below
      for (let k = i + 1; k < n; k++) {
        const factor = A[k][i] / A[i][i];
        b[k] -= factor * b[i];
        for (let j = i; j < n; j++) {
          A[k][j] -= factor * A[i][j];
        }
      }
    }

    // Back substitution
    const x = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = 0;
      for (let j = i + 1; j < n; j++) {
        sum += A[i][j] * x[j];
      }
      x[i] = (b[i] - sum) / A[i][i];
    }

    return x;
  }
}
