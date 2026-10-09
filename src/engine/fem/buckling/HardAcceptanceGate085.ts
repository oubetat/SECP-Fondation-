import { Matrix } from "../core/MathUtils";
import { GeometricStiffnessModel } from "./GeometricStiffnessModel";
import { BucklingAnalysisEngine } from "./BucklingAnalysisEngine";
import { BucklingVerdict, ModeClassification } from "./types";

export interface BucklingCheck {
  id: string;
  description: string;
  passed: boolean;
  details: string;
}

export class HardAcceptanceGate085 {
  static evaluateGate(): { verdict: BucklingVerdict, checks: BucklingCheck[] } {
    const checks: BucklingCheck[] = [];

    checks.push(this.testEulerPinnedPinned());
    checks.push(this.testEulerCantilever());
    checks.push(this.testEulerFixedFixed());
    checks.push(this.testEulerFixedPinned());
    checks.push(this.testLoadScalingInvariance());
    checks.push(this.testBucklingResidual());

    const allPassed = checks.every(c => c.passed);
    return {
      verdict: allPassed ? BucklingVerdict.VERIFIED : BucklingVerdict.NOT_CONVERGED,
      checks
    };
  }

  private static assembleColumn(
    E: number, A: number, I: number, L: number, numElements: number, P_comp: number
  ): { K: Matrix, KG: Matrix, nodeCount: number } {
    const Le = L / numElements;
    const nodeCount = numElements + 1;
    const totalDofs = nodeCount * 3; // u, v, theta per node

    const Ke = GeometricStiffnessModel.computeBeamElasticStiffness(E, A, I, Le);
    const KGe = GeometricStiffnessModel.computeBeamGeometricStiffness(P_comp, Le);

    const K = Matrix.zeros(totalDofs, totalDofs);
    const KG = Matrix.zeros(totalDofs, totalDofs);

    for (let e = 0; e < numElements; e++) {
      const dofs = [
        e * 3, e * 3 + 1, e * 3 + 2,
        (e + 1) * 3, (e + 1) * 3 + 1, (e + 1) * 3 + 2
      ];

      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
          K.add(dofs[i], dofs[j], Ke.get(i, j));
          KG.add(dofs[i], dofs[j], KGe.get(i, j));
        }
      }
    }

    return { K, KG, nodeCount };
  }

  private static testEulerPinnedPinned(): BucklingCheck {
    const E = 200e9, I = 1e-6, A = 0.01, L = 2.0;
    const P_ref = 1.0;
    const { K, KG, nodeCount } = this.assembleColumn(E, A, I, L, 8, P_ref);

    const bcs = new Map([
      [0, 0], [1, 0], // Node 0: u=0, v=0
      [(nodeCount - 1) * 3 + 1, 0] // Node N: v=0
    ]);

    const res = BucklingAnalysisEngine.analyze(K, KG, P_ref, 1, bcs);
    const P_cr_num = res.eigenPairs[0]?.criticalLoad || 0;
    const P_cr_analytical = (Math.PI * Math.PI * E * I) / (L * L);
    const relError = Math.abs(P_cr_num - P_cr_analytical) / P_cr_analytical;

    const passed = relError < 0.01 && res.eigenPairs.length >= 1;

    return {
      id: "EULER_PINNED_PINNED",
      description: "Euler buckling load for Pinned-Pinned column vs analytical",
      passed,
      details: `Num: ${P_cr_num.toFixed(2)} N, Exact: ${P_cr_analytical.toFixed(2)} N (Err: ${(relError * 100).toFixed(3)}%)`
    };
  }

  private static testEulerCantilever(): BucklingCheck {
    const E = 200e9, I = 1e-6, A = 0.01, L = 2.0;
    const P_ref = 1.0;
    const { K, KG } = this.assembleColumn(E, A, I, L, 8, P_ref);

    const bcs = new Map([
      [0, 0], [1, 0], [2, 0] // Node 0: u=0, v=0, theta=0
    ]);

    const res = BucklingAnalysisEngine.analyze(K, KG, P_ref, 1, bcs);
    const P_cr_num = res.eigenPairs[0]?.criticalLoad || 0;
    const P_cr_analytical = (Math.PI * Math.PI * E * I) / (4 * L * L);
    const relError = Math.abs(P_cr_num - P_cr_analytical) / P_cr_analytical;

    const passed = relError < 0.01;

    return {
      id: "EULER_CANTILEVER",
      description: "Euler buckling load for Cantilever (Fixed-Free) column vs analytical",
      passed,
      details: `Num: ${P_cr_num.toFixed(2)} N, Exact: ${P_cr_analytical.toFixed(2)} N (Err: ${(relError * 100).toFixed(3)}%)`
    };
  }

  private static testEulerFixedFixed(): BucklingCheck {
    const E = 200e9, I = 1e-6, A = 0.01, L = 2.0;
    const P_ref = 1.0;
    const { K, KG, nodeCount } = this.assembleColumn(E, A, I, L, 8, P_ref);

    const lastNode = nodeCount - 1;
    const bcs = new Map([
      [0, 0], [1, 0], [2, 0], // Node 0
      [lastNode * 3 + 1, 0], [lastNode * 3 + 2, 0] // Node N
    ]);

    const res = BucklingAnalysisEngine.analyze(K, KG, P_ref, 1, bcs);
    const P_cr_num = res.eigenPairs[0]?.criticalLoad || 0;
    const P_cr_analytical = (4 * Math.PI * Math.PI * E * I) / (L * L);
    const relError = Math.abs(P_cr_num - P_cr_analytical) / P_cr_analytical;

    const passed = relError < 0.01;

    return {
      id: "EULER_FIXED_FIXED",
      description: "Euler buckling load for Fixed-Fixed column vs analytical",
      passed,
      details: `Num: ${P_cr_num.toFixed(2)} N, Exact: ${P_cr_analytical.toFixed(2)} N (Err: ${(relError * 100).toFixed(3)}%)`
    };
  }

  private static testEulerFixedPinned(): BucklingCheck {
    const E = 200e9, I = 1e-6, A = 0.01, L = 2.0;
    const P_ref = 1.0;
    const { K, KG, nodeCount } = this.assembleColumn(E, A, I, L, 10, P_ref);

    const lastNode = nodeCount - 1;
    const bcs = new Map([
      [0, 0], [1, 0], [2, 0], // Node 0
      [lastNode * 3 + 1, 0]  // Node N
    ]);

    const res = BucklingAnalysisEngine.analyze(K, KG, P_ref, 1, bcs);
    const P_cr_num = res.eigenPairs[0]?.criticalLoad || 0;
    const P_cr_analytical = (20.1907286 * E * I) / (L * L);
    const relError = Math.abs(P_cr_num - P_cr_analytical) / P_cr_analytical;

    const passed = relError < 0.01;

    return {
      id: "EULER_FIXED_PINNED",
      description: "Euler buckling load for Fixed-Pinned column vs analytical",
      passed,
      details: `Num: ${P_cr_num.toFixed(2)} N, Exact: ${P_cr_analytical.toFixed(2)} N (Err: ${(relError * 100).toFixed(3)}%)`
    };
  }

  private static testLoadScalingInvariance(): BucklingCheck {
    // Scaling reference load P_ref from 1 N to 100 N
    // Should scale lambda_cr by 1/100, keeping P_cr = lambda_cr * P_ref invariant.
    const E = 200e9, I = 1e-6, A = 0.01, L = 2.0;
    const { K: K1, KG: KG1, nodeCount } = this.assembleColumn(E, A, I, L, 4, 1.0);
    const { K: K2, KG: KG2 } = this.assembleColumn(E, A, I, L, 4, 100.0);

    const bcs = new Map([[0, 0], [1, 0], [(nodeCount - 1) * 3 + 1, 0]]);

    const res1 = BucklingAnalysisEngine.analyze(K1, KG1, 1.0, 1, bcs);
    const res2 = BucklingAnalysisEngine.analyze(K2, KG2, 100.0, 1, bcs);

    const P_cr1 = res1.eigenPairs[0]?.criticalLoad || 0;
    const P_cr2 = res2.eigenPairs[0]?.criticalLoad || 0;

    const diff = Math.abs(P_cr1 - P_cr2) / P_cr1;
    const passed = diff < 1e-6;

    return {
      id: "LOAD_SCALING_INVARIANCE",
      description: "Physical critical load invariance under reference load scaling",
      passed,
      details: `P_cr(1N): ${P_cr1.toFixed(2)} N, P_cr(100N): ${P_cr2.toFixed(2)} N (Diff: ${diff.toExponential(4)})`
    };
  }

  private static testBucklingResidual(): BucklingCheck {
    const E = 200e9, I = 1e-6, A = 0.01, L = 2.0;
    const { K, KG, nodeCount } = this.assembleColumn(E, A, I, L, 4, 1.0);
    const bcs = new Map([[0, 0], [1, 0], [(nodeCount - 1) * 3 + 1, 0]]);

    const res = BucklingAnalysisEngine.analyze(K, KG, 1.0, 1, bcs);
    const pair = res.eigenPairs[0];
    const residual = pair?.residual || 1.0;

    const passed = residual < 1e-2;

    return {
      id: "BUCKLING_RESIDUAL",
      description: "Eigenpair residual check ||(K - lambda*KG)*phi|| = 0",
      passed,
      details: `Residual norm: ${residual.toExponential(4)}`
    };
  }
}
