import { Matrix } from "../core/MathUtils";
import { ContactStateMode, ContactStatus } from "./types";

export interface TangentialTractionResult {
  tangentialTraction: number[];
  frictionStatus: 'FRICTIONLESS' | 'STICKING' | 'SLIDING' | 'UNSUPPORTED';
  stateMode: ContactStateMode;
  tangentialTangent: Matrix;
  dissipationIncrement: number;
  trialForceNorm: number;
  frictionLimit: number;
}

export interface FrictionModel {
  computeTangentialTraction(
    normalPressure: number,
    relativeTangentialSlip: number[],
    previousTraction?: number[],
    tangentialStiffness?: number
  ): TangentialTractionResult;

  getFrictionCoefficient(): number;
  setFrictionCoefficient(mu: number): void;
}

export class CoulombFrictionModel implements FrictionModel {
  private mu: number;
  private defaultTangentialStiffness: number;

  constructor(mu: number = 0.0, defaultTangentialStiffness: number = 1e8) {
    this.mu = mu;
    this.defaultTangentialStiffness = defaultTangentialStiffness;
  }

  getFrictionCoefficient(): number {
    return this.mu;
  }

  setFrictionCoefficient(mu: number): void {
    if (mu < 0) throw new Error(`Friction coefficient mu must be >= 0. Got ${mu}`);
    this.mu = mu;
  }

  /**
   * Evaluates Coulomb return mapping for 2D/3D relative tangential slip.
   */
  computeTangentialTraction(
    normalPressure: number,
    relativeTangentialSlip: number[],
    previousTraction: number[] = [0, 0],
    tangentialStiffness: number = this.defaultTangentialStiffness
  ): TangentialTractionResult {
    const dim = relativeTangentialSlip.length || 2;
    const zeroTangent = Matrix.zeros(dim, dim);
    const zeroTraction = new Array(dim).fill(0.0);

    if (this.mu <= 0.0 || normalPressure <= 0.0) {
      return {
        tangentialTraction: zeroTraction,
        frictionStatus: 'FRICTIONLESS',
        stateMode: 'CONTACT',
        tangentialTangent: zeroTangent,
        dissipationIncrement: 0.0,
        trialForceNorm: 0.0,
        frictionLimit: 0.0
      };
    }

    const kt = tangentialStiffness;
    const frictionLimit = this.mu * normalPressure;

    // Trial tangential force: F_trial = F_prev + k_t * delta_u_tangential
    const trialTraction = new Array(dim).fill(0.0);
    let trialNormSq = 0.0;
    for (let d = 0; d < dim; d++) {
      trialTraction[d] = previousTraction[d] + kt * relativeTangentialSlip[d];
      trialNormSq += trialTraction[d] * trialTraction[d];
    }
    const trialNorm = Math.sqrt(trialNormSq);

    if (trialNorm <= 1e-12) {
      // Zero slip state -> STICK
      const kStick = Matrix.zeros(dim, dim);
      for (let d = 0; d < dim; d++) kStick.set(d, d, kt);
      return {
        tangentialTraction: zeroTraction,
        frictionStatus: 'STICKING',
        stateMode: 'STICK',
        tangentialTangent: kStick,
        dissipationIncrement: 0.0,
        trialForceNorm: 0.0,
        frictionLimit
      };
    }

    // Return Mapping Check: ||F_trial|| <= mu * F_n
    if (trialNorm <= frictionLimit) {
      // STICK
      const kStick = Matrix.zeros(dim, dim);
      for (let d = 0; d < dim; d++) kStick.set(d, d, kt);

      return {
        tangentialTraction: trialTraction,
        frictionStatus: 'STICKING',
        stateMode: 'STICK',
        tangentialTangent: kStick,
        dissipationIncrement: 0.0,
        trialForceNorm: trialNorm,
        frictionLimit
      };
    } else {
      // SLIP (Radial return to friction limit)
      const slipDirection = trialTraction.map(t => t / trialNorm);
      const actualTraction = slipDirection.map(dir => frictionLimit * dir);

      // Algorithmic consistent tangential tangent matrix for SLIP
      // K_tangent = kt * (frictionLimit / trialNorm) * [ I - dir (x) dir ]
      const kSlip = Matrix.zeros(dim, dim);
      const ratio = (frictionLimit / trialNorm) * kt;
      for (let i = 0; i < dim; i++) {
        for (let j = 0; j < dim; j++) {
          const delta = i === j ? 1.0 : 0.0;
          kSlip.set(i, j, ratio * (delta - slipDirection[i] * slipDirection[j]));
        }
      }

      // Dissipation increment = ||F_t|| * ||delta_u_slip||
      const slipMag = Math.max(0, (trialNorm - frictionLimit) / kt);
      const dissipationIncrement = frictionLimit * slipMag;

      return {
        tangentialTraction: actualTraction,
        frictionStatus: 'SLIDING',
        stateMode: 'SLIP',
        tangentialTangent: kSlip,
        dissipationIncrement,
        trialForceNorm: trialNorm,
        frictionLimit
      };
    }
  }
}
