import { Matrix } from "../core/MathUtils";
import { MassMatrixModel } from "./MassMatrixModel";
import { ModalAnalysisEngine } from "./ModalAnalysisEngine";
import { ModalVerdict, EigenPair, ModeClassification } from "./types";

export interface ModalCheck {
  id: string;
  description: string;
  passed: boolean;
  details: string;
}

export class HardAcceptanceGate084 {
  static evaluateGate(): { verdict: ModalVerdict, checks: ModalCheck[] } {
    const checks: ModalCheck[] = [];

    checks.push(this.test1DBarCantilever());
    checks.push(this.testRigidBodyModes());
    checks.push(this.testOrthogonality());
    checks.push(this.testRayleighQuotient());

    const allPassed = checks.every(c => c.passed);
    return {
      verdict: allPassed ? ModalVerdict.VERIFIED : ModalVerdict.NOT_CONVERGED,
      checks
    };
  }

  private static test1DBarCantilever(): ModalCheck {
    // 4 elements, 5 nodes
    // L_total = 1.0, E = 100, rho = 1.0, A = 1.0
    // L_e = 0.25
    // Ke = (E*A/L_e) * [1, -1; -1, 1] = 400 * [1, -1; -1, 1]
    // Me = (rho*A*L_e/6) * [2, 1; 1, 2] = (0.25/6) * [2, 1; 1, 2]
    const E = 100.0;
    const rho = 1.0;
    const A = 1.0;
    const L = 1.0;
    const numElements = 4;
    const Le = L / numElements;
    const nodeCount = numElements + 1;

    const Ke = new Matrix(2, 2, [[(E * A) / Le, -(E * A) / Le], [-(E * A) / Le, (E * A) / Le]]);
    const Me = MassMatrixModel.computeBarConsistentMass(rho, A, Le);

    const K = Matrix.zeros(nodeCount, nodeCount);
    const M = Matrix.zeros(nodeCount, nodeCount);

    for (let e = 0; e < numElements; e++) {
      const nodes = [e, e + 1];
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          K.add(nodes[i], nodes[j], Ke.get(i, j));
          M.add(nodes[i], nodes[j], Me.get(i, j));
        }
      }
    }

    // Node 0 fixed
    const bcs = new Map([[0, 0]]);
    const res = ModalAnalysisEngine.analyze(K, M, 2, bcs);

    // Analytical: f1 = 2.5, f2 = 7.5
    // Finite element with consistent mass usually overestimates slightly
    const f1 = res.eigenPairs[0]?.frequencyHz || 0;
    const error1 = Math.abs(f1 - 2.5) / 2.5;

    const passed = error1 < 0.05 && res.eigenPairs.length >= 2;

    return {
      id: "1D_BAR_CANTILEVER",
      description: "Cantilever bar natural frequencies vs analytical",
      passed,
      details: `f1: ${f1.toFixed(4)} Hz (Err: ${(error1 * 100).toFixed(2)}%)`
    };
  }

  private static testRigidBodyModes(): ModalCheck {
    // 2 elements unconstrained 1D bar
    // Should have 1 rigid body mode (f = 0)
    const E = 100.0, rho = 1.0, A = 1.0, L = 1.0;
    const Le = L / 2;
    const nodeCount = 3;

    const Ke = new Matrix(2, 2, [[(E * A) / Le, -(E * A) / Le], [-(E * A) / Le, (E * A) / Le]]);
    const Me = MassMatrixModel.computeBarConsistentMass(rho, A, Le);

    const K = Matrix.zeros(nodeCount, nodeCount);
    const M = Matrix.zeros(nodeCount, nodeCount);

    for (let e = 0; e < 2; e++) {
      const nodes = [e, e + 1];
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          K.add(nodes[i], nodes[j], Ke.get(i, j));
          M.add(nodes[i], nodes[j], Me.get(i, j));
        }
      }
    }

    const res = ModalAnalysisEngine.analyze(K, M, 2, new Map());
    const hasRigid = res.eigenPairs.some(p => p.classification === ModeClassification.RIGID_BODY);
    
    return {
      id: "RIGID_BODY_MODES",
      description: "Detection of unconstrained rigid body modes",
      passed: hasRigid,
      details: hasRigid ? "Rigid body mode detected at ~0 Hz" : "No rigid body mode found"
    };
  }

  private static testOrthogonality(): ModalCheck {
    // Check phi1^T * M * phi2 approx 0
    const E = 100.0, rho = 1.0, A = 1.0, L = 1.0;
    const Le = L / 4;
    const nodeCount = 5;
    const K = Matrix.zeros(nodeCount, nodeCount);
    const M = Matrix.zeros(nodeCount, nodeCount);
    const Ke = new Matrix(2, 2, [[(E * A) / Le, -(E * A) / Le], [-(E * A) / Le, (E * A) / Le]]);
    const Me = MassMatrixModel.computeBarConsistentMass(rho, A, Le);

    for (let e = 0; e < 4; e++) {
      const nodes = [e, e + 1];
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          K.add(nodes[i], nodes[j], Ke.get(i, j));
          M.add(nodes[i], nodes[j], Me.get(i, j));
        }
      }
    }

    const res = ModalAnalysisEngine.analyze(K, M, 3, new Map([[0, 0]]));
    if (res.eigenPairs.length < 2) return { id: "ORTHOGONALITY", description: "Mass orthogonality", passed: false, details: "Insufficient modes" };

    const phi1 = res.eigenPairs[0].eigenvector;
    const phi2 = res.eigenPairs[1].eigenvector;
    const Mphi2 = M.multiplyVector(phi2);
    let orthogonality = 0;
    for (let i = 0; i < nodeCount; i++) orthogonality += phi1[i] * Mphi2[i];

    const passed = Math.abs(orthogonality) < 1e-8;

    return {
      id: "ORTHOGONALITY",
      description: "Mass orthogonality phi1^T * M * phi2 = 0",
      passed,
      details: `Inner product: ${orthogonality.toExponential(4)}`
    };
  }

  private static testRayleighQuotient(): ModalCheck {
    // Check lambda = (phi^T * K * phi) / (phi^T * M * phi)
    const E = 100.0, rho = 1.0, A = 1.0, L = 1.0;
    const Le = L / 4;
    const nodeCount = 5;
    const K = Matrix.zeros(nodeCount, nodeCount);
    const M = Matrix.zeros(nodeCount, nodeCount);
    const Ke = new Matrix(2, 2, [[(E * A) / Le, -(E * A) / Le], [-(E * A) / Le, (E * A) / Le]]);
    const Me = MassMatrixModel.computeBarConsistentMass(rho, A, Le);

    for (let e = 0; e < 4; e++) {
      const nodes = [e, e + 1];
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          K.add(nodes[i], nodes[j], Ke.get(i, j));
          M.add(nodes[i], nodes[j], Me.get(i, j));
        }
      }
    }

    const res = ModalAnalysisEngine.analyze(K, M, 1, new Map([[0, 0]]));
    const pair = res.eigenPairs[0];
    const phi = pair.eigenvector;
    const Kphi = K.multiplyVector(phi);
    const Mphi = M.multiplyVector(phi);
    let phiKphi = 0, phiMphi = 0;
    for (let i = 0; i < nodeCount; i++) {
      phiKphi += phi[i] * Kphi[i];
      phiMphi += phi[i] * Mphi[i];
    }
    const rayleigh = phiKphi / (phiMphi || 1);
    const error = Math.abs(rayleigh - pair.eigenvalue) / (pair.eigenvalue || 1);

    return {
      id: "RAYLEIGH_QUOTIENT",
      description: "Rayleigh quotient verification",
      passed: error < 1e-10,
      details: `Relative error: ${error.toExponential(4)}`
    };
  }
}
