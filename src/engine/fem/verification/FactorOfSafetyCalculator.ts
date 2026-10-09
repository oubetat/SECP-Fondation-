/**
 * SECP Industrial OS — Engineering Truth Platform
 * PATCH-240 — Factor of Safety Calculator
 */

export interface FoSReport {
  minFoS: number;
  maxStress: number;
  yieldStrength: number;
  criticalLocation: { x: number; y: number; z: number };
  verdict: 'PASS' | 'MARGINAL' | 'FAIL';
}

/**
 * FactorOfSafetyCalculator: Computes FoS from actual stress/material data.
 */
export class FactorOfSafetyCalculator {
  public static calculate(
    vonMisesStresses: Map<string, number>,
    nodes: { id: string, x: number, y: number, z: number }[],
    yieldStrength: number
  ): FoSReport {
    let maxStress = 0;
    let criticalNodeId = '';

    vonMisesStresses.forEach((stress, nodeId) => {
      if (stress > maxStress) {
        maxStress = stress;
        criticalNodeId = nodeId;
      }
    });

    const minFoS = maxStress > 1e-9 ? yieldStrength / maxStress : Infinity;
    const criticalNode = nodes.find(n => n.id === criticalNodeId) || { x: 0, y: 0, z: 0 };

    let verdict: 'PASS' | 'MARGINAL' | 'FAIL' = 'PASS';
    if (minFoS < 1.0) verdict = 'FAIL';
    else if (minFoS < 1.5) verdict = 'MARGINAL';

    return {
      minFoS,
      maxStress,
      yieldStrength,
      criticalLocation: { x: criticalNode.x, y: criticalNode.y, z: criticalNode.z },
      verdict
    };
  }
}
