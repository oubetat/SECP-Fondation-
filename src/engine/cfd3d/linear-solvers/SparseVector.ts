/**
 * SECP Industrial OS v2 — Linear Solvers Architecture
 * PATCH-055: SparseVector Abstraction
 */

export class SparseVector {
  private readonly data: Float64Array;

  constructor(sizeOrData: number | Float64Array | number[]) {
    if (typeof sizeOrData === 'number') {
      if (sizeOrData < 0 || !Number.isInteger(sizeOrData)) {
        throw new Error(`Invalid SparseVector size: ${sizeOrData}`);
      }
      this.data = new Float64Array(sizeOrData);
    } else if (sizeOrData instanceof Float64Array) {
      this.data = new Float64Array(sizeOrData);
    } else if (Array.isArray(sizeOrData)) {
      this.data = Float64Array.from(sizeOrData);
    } else {
      throw new Error('Invalid input to SparseVector constructor');
    }
  }

  public get length(): number {
    return this.data.length;
  }

  public get(index: number): number {
    this.assertValidIndex(index);
    return this.data[index];
  }

  public set(index: number, value: number): void {
    this.assertValidIndex(index);
    if (!Number.isFinite(value)) {
      throw new Error(`Non-finite value provided to SparseVector.set at index ${index}: ${value}`);
    }
    this.data[index] = value;
  }

  public add(index: number, value: number): void {
    this.assertValidIndex(index);
    if (!Number.isFinite(value)) {
      throw new Error(`Non-finite value provided to SparseVector.add at index ${index}: ${value}`);
    }
    this.data[index] += value;
  }

  public dot(other: SparseVector): number {
    if (this.length !== other.length) {
      throw new Error(`Vector dimension mismatch in dot product: ${this.length} vs ${other.length}`);
    }
    let sum = 0;
    for (let i = 0; i < this.length; i++) {
      sum += this.data[i] * other.data[i];
    }
    return sum;
  }

  public norm2(): number {
    let sumSq = 0;
    for (let i = 0; i < this.length; i++) {
      sumSq += this.data[i] * this.data[i];
    }
    return Math.sqrt(sumSq);
  }

  public normInf(): number {
    let maxAbs = 0;
    for (let i = 0; i < this.length; i++) {
      const absVal = Math.abs(this.data[i]);
      if (absVal > maxAbs) {
        maxAbs = absVal;
      }
    }
    return maxAbs;
  }

  public scale(alpha: number): SparseVector {
    if (!Number.isFinite(alpha)) {
      throw new Error(`Non-finite scale factor: ${alpha}`);
    }
    const result = new SparseVector(this.length);
    for (let i = 0; i < this.length; i++) {
      result.data[i] = this.data[i] * alpha;
    }
    return result;
  }

  public addVector(other: SparseVector, alpha: number = 1.0): SparseVector {
    if (this.length !== other.length) {
      throw new Error(`Vector dimension mismatch in addVector: ${this.length} vs ${other.length}`);
    }
    const result = new SparseVector(this.length);
    for (let i = 0; i < this.length; i++) {
      result.data[i] = this.data[i] + alpha * other.data[i];
    }
    return result;
  }

  public subtractVector(other: SparseVector): SparseVector {
    return this.addVector(other, -1.0);
  }

  public copy(): SparseVector {
    return new SparseVector(new Float64Array(this.data));
  }

  public toArray(): Float64Array {
    return new Float64Array(this.data);
  }

  public isFinite(): boolean {
    for (let i = 0; i < this.length; i++) {
      if (!Number.isFinite(this.data[i])) return false;
    }
    return true;
  }

  private assertValidIndex(index: number): void {
    if (index < 0 || index >= this.length || !Number.isInteger(index)) {
      throw new Error(`Index out of bounds for SparseVector of length ${this.length}: ${index}`);
    }
  }
}
