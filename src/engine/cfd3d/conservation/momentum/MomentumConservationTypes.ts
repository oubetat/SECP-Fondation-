/**
 * SECP Industrial OS v2 — Momentum Conservation Framework
 * PATCH-058: Core Types & Momentum Vector
 */

export enum MomentumConservationStatus {
  CONSERVATIVE = 'CONSERVATIVE',
  NOT_CONSERVATIVE = 'NOT_CONSERVATIVE',
  CONSERVATION_FAILURE = 'CONSERVATION_FAILURE',
  INVALID = 'INVALID',
  INCONCLUSIVE = 'INCONCLUSIVE',
  UNPROVEN = 'UNPROVEN'
}

export class MomentumVector {
  constructor(
    public readonly x: number,
    public readonly y: number,
    public readonly z: number
  ) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      throw new Error(`Non-finite values in MomentumVector: [${x}, ${y}, ${z}]`);
    }
  }

  public static zero(): MomentumVector {
    return new MomentumVector(0, 0, 0);
  }

  public add(other: MomentumVector): MomentumVector {
    return new MomentumVector(this.x + other.x, this.y + other.y, this.z + other.z);
  }

  public subtract(other: MomentumVector): MomentumVector {
    return new MomentumVector(this.x - other.x, this.y - other.y, this.z - other.z);
  }

  public multiply(scalar: number): MomentumVector {
    return new MomentumVector(this.x * scalar, this.y * scalar, this.z * scalar);
  }

  public dot(other: MomentumVector): number {
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }

  public magnitude(): number {
    return Math.sqrt(this.dot(this));
  }

  public l1(): number {
    return Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z);
  }

  public l2(): number {
    return this.magnitude();
  }

  public lInf(): number {
    return Math.max(Math.abs(this.x), Math.abs(this.y), Math.abs(this.z));
  }

  public isFinite(): boolean {
    return Number.isFinite(this.x) && Number.isFinite(this.y) && Number.isFinite(this.z);
  }

  public hash(): string {
    const data = `${this.x.toExponential(10)}|${this.y.toExponential(10)}|${this.z.toExponential(10)}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = (hash << 5) - hash + data.charCodeAt(i);
      hash |= 0;
    }
    return `mv-hash-${Math.abs(hash).toString(16)}`;
  }

  public toArray(): [number, number, number] {
    return [this.x, this.y, this.z];
  }
}

export interface ControlVolumeMomentumBalance {
  readonly cellId: number;
  readonly accumulation: MomentumVector;
  readonly convectiveFlux: MomentumVector;
  readonly pressureForce: MomentumVector;
  readonly viscousForce: MomentumVector;
  readonly bodyForce: MomentumVector;
  readonly sourceTerms: MomentumVector;
  readonly imbalance: MomentumVector;
  readonly normalizedImbalance: MomentumVector;
  readonly finite: boolean;
  readonly diagnostics: string[];
}

export interface GlobalMomentumBalanceResult {
  readonly totalConvectiveFlux: MomentumVector;
  readonly totalPressureForce: MomentumVector;
  readonly totalViscousForce: MomentumVector;
  readonly totalBodyForce: MomentumVector;
  readonly totalSourceTerms: MomentumVector;
  readonly totalAccumulation: MomentumVector;
  readonly globalImbalance: MomentumVector;
  readonly normalizedGlobalImbalance: number;
  readonly maxLocalImbalance: MomentumVector;
  readonly status: MomentumConservationStatus;
  readonly componentStatus: {
    readonly x: MomentumConservationStatus;
    readonly y: MomentumConservationStatus;
    readonly z: MomentumConservationStatus;
  };
}
