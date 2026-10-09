/**
 * SECP Industrial OS v3 — PATCH-182: Deterministic Reduction & Randomness Engine
 * Controls floating point parallel reduction trees, Kahan compensated summation,
 * and PRNG random sequence providers to guarantee 100% deterministic arithmetic.
 */

export class DeterministicRandomProvider {
  private state: number;

  constructor(seed: number = 421337) {
    this.state = seed >>> 0;
  }

  /**
   * Linear Congruential PRNG (Knuth MMIX constants) for deterministic sequence generation.
   */
  public nextFloat(): number {
    this.state = (Math.imul(1664525, this.state) + 1013904223) >>> 0;
    return this.state / 4294967296;
  }

  public nextRange(min: number, max: number): number {
    return min + this.nextFloat() * (max - min);
  }

  public nextInt(min: number, max: number): number {
    return Math.floor(this.nextRange(min, max + 1));
  }

  public reset(seed: number): void {
    this.state = seed >>> 0;
  }
}

export class DeterministicReductionEngine {
  /**
   * Kahan / Neumaier Compensated Summation.
   * Prevents catastrophic loss of precision during large floating point vector accumulations.
   */
  public static kahanSum(values: number[]): number {
    let sum = 0.0;
    let c = 0.0; // A running compensation for lost low-order bits.

    for (let i = 0; i < values.length; i++) {
      const y = values[i] - c;
      const t = sum + y;
      c = (t - sum) - y;
      sum = t;
    }

    return sum;
  }

  /**
   * Neumaier Summation (Enhanced Kahan algorithm handling large & small numbers seamlessly).
   */
  public static neumaierSum(values: number[]): number {
    let sum = 0.0;
    let c = 0.0;

    for (let i = 0; i < values.length; i++) {
      const x = values[i];
      const t = sum + x;
      if (Math.abs(sum) >= Math.abs(x)) {
        c += (sum - t) + x;
      } else {
        c += (x - t) + sum;
      }
      sum = t;
    }

    return sum + c;
  }

  /**
   * Pairwise Tree Summation (Deterministic divide-and-conquer reduction tree).
   */
  public static pairwiseSum(values: number[]): number {
    if (values.length === 0) return 0.0;
    if (values.length === 1) return values[0];
    if (values.length === 2) return values[0] + values[1];

    const mid = Math.floor(values.length / 2);
    const left = values.slice(0, mid);
    const right = values.slice(mid);

    return this.pairwiseSum(left) + this.pairwiseSum(right);
  }

  /**
   * Strict Ordered Linear Summation.
   */
  public static orderedSum(values: number[]): number {
    let sum = 0.0;
    for (let i = 0; i < values.length; i++) {
      sum += values[i];
    }
    return sum;
  }

  /**
   * Computes a vector dot product using Neumaier compensated summation.
   */
  public static dotProductCompensated(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
    }
    const products = new Array<number>(a.length);
    for (let i = 0; i < a.length; i++) {
      products[i] = a[i] * b[i];
    }
    return this.neumaierSum(products);
  }

  /**
   * Quantizes a floating point number to a fixed decimal precision string/number to enforce exact canonical representation.
   */
  public static quantizeFloat(val: number, digits: number = 12): number {
    if (!Number.isFinite(val)) return 0;
    const factor = Math.pow(10, digits);
    return Math.round(val * factor) / factor;
  }
}
