import { Matrix } from "../core/MathUtils";
import { DeformationGradient } from "./DeformationGradient";
import { PolarDecomposition } from "./PolarDecomposition";
import { StrainMeasures } from "./StrainMeasures";
import { LargeDeformationVerdict, LargeDeformationFailureType } from "./types";

export interface GateReport082 {
  verdict: LargeDeformationVerdict;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  checks: { id: string; description: string; passed: boolean; details: string }[];
}

export class HardAcceptanceGate082 {
  static evaluateGate(): GateReport082 {
    const checks: { id: string; description: string; passed: boolean; details: string }[] = [];

    // 1. Rigid Body Rotation Test (Objectivity)
    checks.push(this.testRigidRotation(90));
    checks.push(this.testRigidRotation(180));

    // 2. Pure Stretch Test
    checks.push(this.testPureStretch(1.5));

    // 3. Simple Shear Test
    checks.push(this.testSimpleShear(0.5));

    // 4. Inversion Detection
    checks.push(this.testInversionDetection());

    // 5. Polar Decomposition Consistency
    checks.push(this.testPolarDecompositionConsistency());

    const passedChecks = checks.filter(c => c.passed).length;
    const verdict = passedChecks === checks.length ? LargeDeformationVerdict.VERIFIED : LargeDeformationVerdict.NOT_CONVERGED;

    return {
      verdict,
      totalChecks: checks.length,
      passedChecks,
      failedChecks: checks.length - passedChecks,
      checks
    };
  }

  private static testRigidRotation(angleDegrees: number) {
    const angle = angleDegrees * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Rotation Matrix Q
    const Q = [[cos, -sin], [sin, cos]];
    
    // Identity F initially
    const X = [[0, 0], [1, 0], [0, 1]];
    const x = X.map(p => [
      p[0] * cos - p[1] * sin,
      p[0] * sin + p[1] * cos
    ]);

    // F should equal Q
    // We need dNdX to compute F
    // For a triangle with nodes (0,0), (1,0), (0,1):
    // N1 = 1-X-Y, N2 = X, N3 = Y
    // dN/dX = [[-1, -1], [1, 0], [0, 1]]
    const dNdX = [[-1, -1], [1, 0], [0, 1]];
    const res = DeformationGradient.compute(X, x, dNdX);
    
    const F = new Matrix(2, 2, res.F);
    const C = StrainMeasures.computeRightCauchyGreen(res.F);
    
    // For rigid rotation, C should be Identity, E should be Zero
    const E = StrainMeasures.computeGreenLagrange(C);
    const strainNorm = Math.sqrt(E.data.flat().reduce((sum, v) => sum + v * v, 0));

    const passed = strainNorm < 1e-10;
    return {
      id: `RIGID_ROTATION_${angleDegrees}`,
      description: `Objectivity check for ${angleDegrees}° rigid rotation`,
      passed,
      details: passed ? "Strain is exactly zero" : `Artificial strain detected: ${strainNorm.toExponential(4)}`
    };
  }

  private static testPureStretch(lambda: number) {
    const X = [[0, 0], [1, 0], [0, 1]];
    const x = X.map(p => [p[0] * lambda, p[1]]); // Stretch in X

    const dNdX = [[-1, -1], [1, 0], [0, 1]];
    const res = DeformationGradient.compute(X, x, dNdX);
    
    const J_expected = lambda;
    const passed = Math.abs(res.J - J_expected) < 1e-10;

    return {
      id: "PURE_STRETCH",
      description: `Jacobian check for pure stretch (lambda=${lambda})`,
      passed,
      details: passed ? `Jacobian = ${res.J}` : `Wrong Jacobian: expected ${J_expected}, got ${res.J}`
    };
  }

  private static testSimpleShear(gamma: number) {
    const X = [[0, 0], [1, 0], [0, 1]];
    const x = X.map(p => [p[0] + gamma * p[1], p[1]]);

    const dNdX = [[-1, -1], [1, 0], [0, 1]];
    const res = DeformationGradient.compute(X, x, dNdX);
    
    const J_expected = 1.0;
    const passed = Math.abs(res.J - J_expected) < 1e-10;

    return {
      id: "SIMPLE_SHEAR",
      description: `Jacobian check for simple shear (gamma=${gamma})`,
      passed,
      details: passed ? `Jacobian is exactly 1.0` : `Shear should be isochoric, but J=${res.J}`
    };
  }

  private static testInversionDetection() {
    const X = [[0, 0], [1, 0], [0, 1]];
    const x = [[0, 0], [-1, 0], [0, 1]]; // Inverted node 2

    const dNdX = [[-1, -1], [1, 0], [0, 1]];
    const res = DeformationGradient.compute(X, x, dNdX);
    
    const passed = res.J < 0;

    return {
      id: "INVERSION_DETECTION",
      description: "Detection of element inversion (Negative Jacobian)",
      passed,
      details: passed ? `Negative J detected: ${res.J}` : "Failed to detect inversion"
    };
  }

  private static testPolarDecompositionConsistency() {
    // F = [2, 1; 0.5, 1.5]
    const F_data = [[2, 1], [0.5, 1.5]];
    const F = new Matrix(2, 2, F_data);
    const decomp = PolarDecomposition.decompose(F_data);
    
    const R = new Matrix(2, 2, decomp.R);
    const U = new Matrix(2, 2, decomp.U);
    const RU = R.multiply(U);

    let error = 0;
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        error += Math.abs(RU.get(i, j) - F.get(i, j));
      }
    }

    const passed = error < 1e-10;

    return {
      id: "POLAR_CONSISTENCY",
      description: "Consistency check for polar decomposition F = RU",
      passed,
      details: passed ? "F = RU exactly" : `Decomposition error: ${error.toExponential(4)}`
    };
  }
}
