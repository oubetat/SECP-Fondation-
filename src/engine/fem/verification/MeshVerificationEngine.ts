import { VerificationCheckResult, VerificationStatus } from "./types";

export class MeshVerificationEngine {
  /**
   * Evaluates mesh quality metrics (aspect ratios, minimum Jacobians, inverted elements).
   */
  public static verifyMeshQuality(
    elementCoordinates: number[][][], // [elementIndex][nodeIndex][x, y, z]
    maxAspectRatioTol: number = 20.0
  ): VerificationCheckResult {
    let maxAspectRatio = 0;
    let minJacobian = Infinity;
    let invertedElementsCount = 0;

    for (let elemIdx = 0; elemIdx < elementCoordinates.length; elemIdx++) {
      const nodes = elementCoordinates[elemIdx];
      if (nodes.length < 2) continue;

      // 1D or 2D bar/beam aspect ratio
      let minLen = Infinity;
      let maxLen = 0;

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j][0] - nodes[i][0];
          const dy = (nodes[j][1] || 0) - (nodes[i][1] || 0);
          const dz = (nodes[j][2] || 0) - (nodes[i][2] || 0);
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < minLen) minLen = dist;
          if (dist > maxLen) maxLen = dist;
        }
      }

      const aspectRatio = minLen > 0 ? maxLen / minLen : 1.0;
      if (aspectRatio > maxAspectRatio) maxAspectRatio = aspectRatio;

      // Simple 2D Jacobian surrogate check
      if (nodes.length >= 3) {
        const ax = nodes[1][0] - nodes[0][0];
        const ay = nodes[1][1] - nodes[0][1];
        const bx = nodes[2][0] - nodes[0][0];
        const by = nodes[2][1] - nodes[0][1];
        const detJ = ax * by - ay * bx;

        if (detJ < minJacobian) minJacobian = detJ;
        if (detJ <= 0) invertedElementsCount++;
      }
    }

    const passed = invertedElementsCount === 0 && maxAspectRatio <= maxAspectRatioTol;

    return {
      checkId: "MESH_QUALITY_CHECK",
      metric: "Max Aspect Ratio & Inverted Element Count",
      measuredValue: maxAspectRatio,
      expectedValue: 1.0,
      tolerance: maxAspectRatioTol,
      error: invertedElementsCount,
      status: passed ? VerificationStatus.PASS : VerificationStatus.FAIL,
      details: `Max Aspect Ratio: ${maxAspectRatio.toFixed(2)}, Inverted Elements: ${invertedElementsCount}`
    };
  }

  /**
   * Performs Richardson extrapolation and computes observed order of accuracy p_obs.
   */
  public static calculateRichardsonExtrapolation(
    qCoarse: number,  // Q3 (h3)
    qMedium: number,  // Q2 (h2)
    qFine: number,    // Q1 (h1)
    gridRatio: number = 2.0 // h3/h2 = h2/h1 = r
  ): {
    extrapolatedValue: number;
    observedOrder: number;
    gridConvergenceIndex: number;
    converged: boolean;
  } {
    const e21 = qFine - qMedium;
    const e32 = qMedium - qCoarse;

    if (Math.abs(e21) < 1e-12 && Math.abs(e32) < 1e-12) {
      return {
        extrapolatedValue: qFine,
        observedOrder: 2.0,
        gridConvergenceIndex: 0.0,
        converged: true
      };
    }

    const ratio = Math.abs(e32 / Math.max(e21, 1e-12));
    const observedOrder = Math.max(0.1, Math.log(ratio) / Math.log(gridRatio));

    const denom = Math.pow(gridRatio, observedOrder) - 1.0;
    const extrapolatedValue = qFine + (qFine - qMedium) / Math.max(denom, 1e-6);

    const relDiff = Math.abs(qFine - qMedium) / Math.max(Math.abs(qFine), 1e-12);
    const gci = (1.25 * relDiff) / Math.max(denom, 1e-6);

    return {
      extrapolatedValue,
      observedOrder,
      gridConvergenceIndex: gci,
      converged: gci < 0.05
    };
  }
}
