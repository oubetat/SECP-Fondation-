import { VerificationCheckResult, VerificationStatus } from "./types";

export class AnalyticalVerificationSuite {
  /**
   * Benchmark 1: 1D Axial Bar u = F*L / (A*E), sigma = F / A.
   */
  public static verifyAxialBar(
    F: number,
    L: number,
    A: number,
    E: number,
    numericDisplacement: number,
    numericStress: number,
    tolRel: number = 1e-4
  ): VerificationCheckResult {
    const exactDisplacement = (F * L) / (A * E);
    const exactStress = F / A;

    const dispErr = Math.abs(numericDisplacement - exactDisplacement) / Math.abs(exactDisplacement);
    const stressErr = Math.abs(numericStress - exactStress) / Math.abs(exactStress);

    const maxErr = Math.max(dispErr, stressErr);
    const passed = maxErr <= tolRel;

    return {
      checkId: "BENCHMARK_AXIAL_BAR",
      metric: "Axial Bar Exact Analytical Match Error",
      measuredValue: numericDisplacement,
      expectedValue: exactDisplacement,
      tolerance: tolRel,
      error: maxErr,
      status: passed ? VerificationStatus.PASS : VerificationStatus.FAIL,
      details: `Exact disp = ${exactDisplacement.toExponential(6)} m, Numeric disp = ${numericDisplacement.toExponential(6)} m (Err: ${(dispErr * 100).toFixed(4)}%)`
    };
  }

  /**
   * Benchmark 2: Cantilever Beam Tip Deflection delta = P*L^3 / (3*E*I).
   */
  public static verifyCantileverBeam(
    P: number,
    L: number,
    E: number,
    I: number,
    numericTipDeflection: number,
    tolRel: number = 1e-3
  ): VerificationCheckResult {
    const exactDeflection = (P * Math.pow(L, 3)) / (3.0 * E * I);
    const err = Math.abs(numericTipDeflection - exactDeflection) / Math.abs(exactDeflection);

    const passed = err <= tolRel;

    return {
      checkId: "BENCHMARK_CANTILEVER_BEAM",
      metric: "Cantilever Beam Tip Deflection Error",
      measuredValue: numericTipDeflection,
      expectedValue: exactDeflection,
      tolerance: tolRel,
      error: err,
      status: passed ? VerificationStatus.PASS : VerificationStatus.FAIL,
      details: `Exact tip deflection = ${exactDeflection.toExponential(6)} m, Numeric = ${numericTipDeflection.toExponential(6)} m (Err: ${(err * 100).toFixed(4)}%)`
    };
  }

  /**
   * Benchmark 3: Simply Supported Beam Midspan Deflection delta = P*L^3 / (48*E*I).
   */
  public static verifySimplySupportedBeam(
    P: number,
    L: number,
    E: number,
    I: number,
    numericMidDeflection: number,
    tolRel: number = 1e-3
  ): VerificationCheckResult {
    const exactDeflection = (P * Math.pow(L, 3)) / (48.0 * E * I);
    const err = Math.abs(numericMidDeflection - exactDeflection) / Math.abs(exactDeflection);

    const passed = err <= tolRel;

    return {
      checkId: "BENCHMARK_SIMPLY_SUPPORTED_BEAM",
      metric: "Simply Supported Beam Midspan Deflection Error",
      measuredValue: numericMidDeflection,
      expectedValue: exactDeflection,
      tolerance: tolRel,
      error: err,
      status: passed ? VerificationStatus.PASS : VerificationStatus.FAIL,
      details: `Exact midspan deflection = ${exactDeflection.toExponential(6)} m, Numeric = ${numericMidDeflection.toExponential(6)} m (Err: ${(err * 100).toFixed(4)}%)`
    };
  }

  /**
   * Benchmark 4: Thermal Expansion Delta_L = alpha * Delta_T * L.
   */
  public static verifyThermalExpansion(
    alpha: number,
    deltaT: number,
    L: number,
    numericExpansion: number,
    tolRel: number = 1e-4
  ): VerificationCheckResult {
    const exactExpansion = alpha * deltaT * L;
    const err = Math.abs(numericExpansion - exactExpansion) / Math.abs(exactExpansion);

    const passed = err <= tolRel;

    return {
      checkId: "BENCHMARK_THERMAL_EXPANSION",
      metric: "Free Thermal Expansion Error",
      measuredValue: numericExpansion,
      expectedValue: exactExpansion,
      tolerance: tolRel,
      error: err,
      status: passed ? VerificationStatus.PASS : VerificationStatus.FAIL,
      details: `Exact thermal expansion = ${exactExpansion.toExponential(6)} m, Numeric = ${numericExpansion.toExponential(6)} m (Err: ${(err * 100).toFixed(4)}%)`
    };
  }

  /**
   * Manufactured Solution Framework:
   * Exact field u_exact(x) = sin(pi * x / L).
   * Calculates L2 error norm ||u_numeric - u_exact||_L2.
   */
  public static verifyManufacturedSolution(
    nodesX: number[],
    numericU: number[],
    L: number,
    tolL2: number = 1e-3
  ): { checkResult: VerificationCheckResult; l2Norm: number; maxNorm: number } {
    let sumSq = 0;
    let maxDiff = 0;

    for (let i = 0; i < nodesX.length; i++) {
      const x = nodesX[i];
      const exactVal = Math.sin((Math.PI * x) / L);
      const diff = Math.abs(numericU[i] - exactVal);

      sumSq += diff * diff;
      if (diff > maxDiff) maxDiff = diff;
    }

    const l2Norm = Math.sqrt(sumSq / nodesX.length);
    const passed = l2Norm <= tolL2;

    const checkResult: VerificationCheckResult = {
      checkId: "MANUFACTURED_SOLUTION_CHECK",
      metric: "Manufactured Solution L2 Discretization Error Norm",
      measuredValue: l2Norm,
      expectedValue: 0,
      tolerance: tolL2,
      error: l2Norm,
      status: passed ? VerificationStatus.PASS : VerificationStatus.FAIL,
      details: `Manufactured Solution L2 Error Norm: ${l2Norm.toExponential(6)}, Max Point Error: ${maxDiff.toExponential(6)}`
    };

    return { checkResult, l2Norm, maxNorm: maxDiff };
  }
}
