/**
 * SECP Industrial OS v2 — Residual Framework
 * PATCH-056: Residual Vector Abstraction
 */

import { ResidualNorms } from './ResidualTypes';

export class ResidualVector {
  private readonly data: Float64Array;

  constructor(sizeOrData: number | Float64Array | number[]) {
    if (typeof sizeOrData === 'number') {
      if (sizeOrData < 0 || !Number.isInteger(sizeOrData)) {
        throw new Error(`Invalid ResidualVector size: ${sizeOrData}`);
      }
      this.data = new Float64Array(sizeOrData);
    } else if (sizeOrData instanceof Float64Array) {
      this.data = new Float64Array(sizeOrData);
    } else if (Array.isArray(sizeOrData)) {
      this.data = new Float64Array(sizeOrData.length);
      for (let i = 0; i < sizeOrData.length; i++) {
        if (!Number.isFinite(sizeOrData[i])) {
          throw new Error(`Non-finite residual value at index ${i}: ${sizeOrData[i]}`);
        }
        this.data[i] = sizeOrData[i];
      }
    } else {
      throw new Error('Invalid input to ResidualVector constructor');
    }
  }

  public get length(): number {
    return this.data.length;
  }

  public get(index: number): number {
    this.assertBounds(index);
    return this.data[index];
  }

  public set(index: number, value: number): void {
    this.assertBounds(index);
    if (!Number.isFinite(value)) {
      throw new Error(`Non-finite residual value at index ${index}: ${value}`);
    }
    this.data[index] = value;
  }

  public l1(): number {
    let sum = 0;
    for (let i = 0; i < this.data.length; i++) {
      sum += Math.abs(this.data[i]);
    }
    return sum;
  }

  public l2(): number {
    let sumSq = 0;
    for (let i = 0; i < this.data.length; i++) {
      sumSq += this.data[i] * this.data[i];
    }
    return Math.sqrt(sumSq);
  }

  public lInf(): number {
    let max = 0;
    for (let i = 0; i < this.data.length; i++) {
      const abs = Math.abs(this.data[i]);
      if (abs > max) max = abs;
    }
    return max;
  }

  public norms(): ResidualNorms {
    return {
      l1: this.l1(),
      l2: this.l2(),
      lInf: this.lInf()
    };
  }

  public isFinite(): boolean {
    for (let i = 0; i < this.data.length; i++) {
      if (!Number.isFinite(this.data[i])) return false;
    }
    return true;
  }

  public hash(): string {
    let h = 0;
    for (let i = 0; i < this.data.length; i++) {
      const val = this.data[i];
      // Basic numeric hash
      const view = new DataView(new ArrayBuffer(8));
      view.setFloat64(0, val);
      h = (h << 5) - h + view.getUint32(0);
      h = (h << 5) - h + view.getUint32(4);
      h |= 0;
    }
    return `rv-hash-${Math.abs(h).toString(16)}`;
  }

  private assertBounds(index: number): void {
    if (index < 0 || index >= this.data.length || !Number.isInteger(index)) {
      throw new Error(`ResidualVector index out of bounds: ${index} (length ${this.data.length})`);
    }
  }
}
