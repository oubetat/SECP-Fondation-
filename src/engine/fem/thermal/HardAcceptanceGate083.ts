import { Matrix } from "../core/MathUtils";
import { ThermalMaterial } from "./ThermalMaterial";
import { ThermalElementIntegrator } from "./ThermalElementIntegrator";
import { ThermalAssembler } from "./ThermalAssembler";
import { ThermalSolver } from "./ThermalSolver";
import { ThermalVerdict } from "./types";

export interface ThermalCheck {
  id: string;
  description: string;
  passed: boolean;
  details: string;
}

export class HardAcceptanceGate083 {
  static evaluateGate(): { verdict: ThermalVerdict, checks: ThermalCheck[] } {
    const checks: ThermalCheck[] = [];

    checks.push(this.test1DSteadyConduction());
    checks.push(this.testThermalPatchTest());
    checks.push(this.testEnergyConservation());
    checks.push(this.testTransientDecay());

    const allPassed = checks.every(c => c.passed);
    return {
      verdict: allPassed ? ThermalVerdict.VERIFIED : ThermalVerdict.NOT_CONVERGED,
      checks
    };
  }

  private static test1DSteadyConduction(): ThermalCheck {
    // 2 elements, 3 nodes
    // Node 0: T=100, Node 2: T=200
    // L=2.0, k=10.0 -> q = -k * (T2-T0)/L = -10 * 100 / 2 = -500
    // Expected Node 1: T=150
    const k = 10.0;
    const L = 2.0;
    const dNdX = [[-1.0], [1.0]]; // 1D shape derivatives for elements of length 1.0
    const Ke = ThermalElementIntegrator.computeConductivityMatrix(dNdX, 1.0, k);

    const elements = [
      { nodes: [0, 1], matrix: Ke },
      { nodes: [1, 2], matrix: Ke }
    ];

    const K = ThermalAssembler.assembleGlobalMatrix(3, elements);
    const f = new Array(3).fill(0);
    const bcs = new Map([[0, 100], [2, 200]]);

    const res = ThermalSolver.solveSteady(K, f, bcs);
    const passed = Math.abs(res.temperatures[1] - 150) < 1e-10;

    return {
      id: "1D_STEADY_CONDUCTION",
      description: "Steady 1D conduction with Dirichlet boundaries",
      passed,
      details: passed ? "Linear temperature profile verified" : `Wrong mid-node temperature: ${res.temperatures[1]}`
    };
  }

  private static testThermalPatchTest(): ThermalCheck {
    // Constant heat flux q = 500
    // T(0) = 100, T(L) = 200, L=2, k=10
    // ∇T = 50
    // Energy balance should hold exactly.
    const k = 10.0;
    const dNdX = [[-1.0], [1.0]];
    const Ke = ThermalElementIntegrator.computeConductivityMatrix(dNdX, 1.0, k);
    const elements = [{ nodes: [0, 1], matrix: Ke }, { nodes: [1, 2], matrix: Ke }];
    const K = ThermalAssembler.assembleGlobalMatrix(3, elements);
    const T = [100, 150, 200];
    const f = [0, 0, 0];

    const balance = ThermalSolver.computeEnergyBalance(K, T, f);
    const passed = balance.relativeImbalance < 1e-12;

    return {
      id: "THERMAL_PATCH_TEST",
      description: "Constant gradient patch test and energy balance",
      passed,
      details: `Relative imbalance: ${balance.relativeImbalance.toExponential(4)}`
    };
  }

  private static testEnergyConservation(): ThermalCheck {
    // Heat source Q = 1000
    // System should balance Q_total = Q_out
    const k = 10.0;
    const Q = 1000.0;
    const dNdX = [[-1.0], [1.0]];
    const Ke = ThermalElementIntegrator.computeConductivityMatrix(dNdX, 1.0, k);
    const fe = ThermalElementIntegrator.computeHeatSourceVector(2, 1.0, Q);

    const elements = [
      { nodes: [0, 1], matrix: Ke, vector: fe },
      { nodes: [1, 2], matrix: Ke, vector: fe }
    ];

    const K = ThermalAssembler.assembleGlobalMatrix(3, elements as any);
    const f = ThermalAssembler.assembleGlobalVector(3, elements as any);
    const bcs = new Map([[0, 100], [2, 100]]);

    const res = ThermalSolver.solveSteady(K, f, bcs);
    const balance = ThermalSolver.computeEnergyBalance(K, res.temperatures, f);
    
    // Total generated = Q * L = 1000 * 2 = 2000
    const passed = Math.abs(balance.qGen - 2000) < 1e-10 && balance.relativeImbalance < 1e-10;

    return {
      id: "ENERGY_CONSERVATION",
      description: "Heat generation balances boundary flux",
      passed,
      details: `Generated: ${balance.qGen}, Imbalance: ${balance.imbalance.toExponential(4)}`
    };
  }

  private static testTransientDecay(): ThermalCheck {
    // 1 node system: C dT/dt + K T = 0
    // T(t) = T0 * exp(-K/C * t)
    const K = 10.0;
    const C = 100.0;
    const T0 = 100.0;
    const dt = 1.0;
    
    const K_mat = new Matrix(1, 1, [[K]]);
    const C_mat = new Matrix(1, 1, [[C]]);
    const f = [0];
    const bcs = new Map();

    const res = ThermalSolver.solveTransientStep(C_mat, K_mat, f, [T0], dt, bcs);
    
    // Backward Euler: (C/dt + K) T1 = C/dt * T0
    // T1 = (C/dt) / (C/dt + K) * T0 = C / (C + K*dt) * T0
    const T1_expected = (C / (C + K * dt)) * T0;
    const passed = Math.abs(res.temperatures[0] - T1_expected) < 1e-10;

    return {
      id: "TRANSIENT_DECAY",
      description: "Single-DOF thermal decay transient validation",
      passed,
      details: passed ? "Backward Euler step verified" : `Expected ${T1_expected}, got ${res.temperatures[0]}`
    };
  }
}
