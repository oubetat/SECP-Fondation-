import { Matrix } from "../core/MathUtils";
import { ClosestPointResult, ContactElementEvaluation, ContactParameters, ContactPointState, ContactStatus, ContactTractionResult } from "./types";

export class ContactModel {
  readonly parameters: ContactParameters;
  readonly enforcement: 'PENALTY' | 'AUGMENTED_LAGRANGIAN' | 'LAGRANGE_MULTIPLIER';

  constructor(
    parameters: ContactParameters,
    enforcement: 'PENALTY' | 'AUGMENTED_LAGRANGIAN' | 'LAGRANGE_MULTIPLIER' = 'PENALTY'
  ) {
    this.parameters = { ...parameters };
    this.enforcement = enforcement;
  }

  /**
   * Evaluates normal contact traction and status based on signed gap g_n.
   */
  computeTraction(
    projection: ClosestPointResult,
    previousState?: ContactPointState
  ): ContactTractionResult {
    const gap = projection.gap;
    const kp = this.parameters.penaltyStiffness;

    if (gap >= 0.0) {
      // OPEN / SEPARATED
      return {
        normalPressure: 0.0,
        tangentialTraction: [0.0, 0.0],
        status: 'OPEN', stateMode: 'OPEN',
        penetration: 0.0,
        contactEnergyIncrement: 0.0
      };
    }

    // PENETRATION / OVERCLOSURE (g_n < 0)
    const penetration = -gap;
    let normalPressure = 0.0;

    if (this.enforcement === 'PENALTY') {
      normalPressure = kp * penetration;
    } else if (this.enforcement === 'AUGMENTED_LAGRANGIAN') {
      const prevLm = previousState?.lagrangeMultiplier || 0.0;
      normalPressure = Math.max(0.0, prevLm + kp * penetration);
    } else {
      normalPressure = kp * penetration;
    }

    const energy = 0.5 * kp * penetration * penetration;

    return {
      normalPressure,
      tangentialTraction: [0.0, 0.0],
      status: 'ACTIVE', stateMode: 'STICK',
      penetration,
      contactEnergyIncrement: energy
    };
  }

  /**
   * Evaluates Kuhn-Tucker complementarity error |g_n * lambda_n|.
   */
  evaluateComplementarity(gap: number, pressure: number): number {
    if (gap >= 0.0) {
      return gap * pressure; // Should be 0 since pressure = 0
    } else {
      return Math.abs(gap) * pressure; // Penalty error term
    }
  }

  /**
   * Assembles 2D Node-to-Segment elemental contact force vector and consistent contact tangent.
   * Node ordering in element vector u: [u_Sx, u_Sy, u_M1x, u_M1y, u_M2x, u_M2y]
   */
  computeNodeToSegmentForceAndTangent(
    projection: ClosestPointResult,
    previousState?: ContactPointState
  ): ContactElementEvaluation {
    const force = new Array(6).fill(0.0);
    const tangent = Matrix.zeros(6, 6);

    const tractionRes = this.computeTraction(projection, previousState);

    if (tractionRes.status === 'OPEN') {
      return {
        contactForce: force,
        contactTangent: tangent,
        status: 'OPEN',
        stateMode: 'OPEN',
        gap: projection.gap,
        normalPressure: 0.0,
        penetration: 0.0
      };
    }

    const lambda = tractionRes.normalPressure;
    const kp = this.parameters.penaltyStiffness;

    const [nx, ny] = projection.normal;
    const xi = projection.parametricCoords[0]; // xi in [0, 1]

    // Shape functions Nc = [1, -(1-xi), -xi]
    const N1 = -(1.0 - xi);
    const N2 = -xi;
    const Nc = [1.0, N1, N2];

    // Contact force on node triad (repulsive force): f_node = - Nc_i * lambda * n
    for (let i = 0; i < 3; i++) {
      force[2 * i]     = -Nc[i] * lambda * nx;
      force[2 * i + 1] = -Nc[i] * lambda * ny;
    }

    // Consistent tangent matrix: K_ij = kp * (Nc_a * Nc_b) * (n_d * n_e)
    for (let a = 0; a < 3; a++) {
      for (let b = 0; b < 3; b++) {
        const shapeFactor = Nc[a] * Nc[b] * kp;
        
        tangent.set(2 * a,     2 * b,     shapeFactor * nx * nx);
        tangent.set(2 * a,     2 * b + 1, shapeFactor * nx * ny);
        tangent.set(2 * a + 1, 2 * b,     shapeFactor * ny * nx);
        tangent.set(2 * a + 1, 2 * b + 1, shapeFactor * ny * ny);
      }
    }

    return {
      contactForce: force,
      contactTangent: tangent,
      status: tractionRes.status,
      stateMode: tractionRes.stateMode,
      gap: projection.gap,
      normalPressure: lambda,
      penetration: tractionRes.penetration
    };
  }
}
