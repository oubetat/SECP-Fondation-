export class SparseVector {
  readonly length: number;
  readonly indices: Int32Array;
  readonly values: Float64Array;

  constructor(length: number, indices: Int32Array, values: Float64Array) {
    if (indices.length !== values.length) {
      throw new Error(`Mismatched indices (${indices.length}) and values (${values.length}) length in SparseVector`);
    }
    this.length = length;
    this.indices = indices;
    this.values = values;
  }

  static fromDense(dense: ArrayLike<number>, tolerance: number = 0.0): SparseVector {
    let nnz = 0;
    for (let i = 0; i < dense.length; i++) {
      if (Math.abs(dense[i]) > tolerance) nnz++;
    }

    const indices = new Int32Array(nnz);
    const values = new Float64Array(nnz);
    let idx = 0;
    for (let i = 0; i < dense.length; i++) {
      if (Math.abs(dense[i]) > tolerance) {
        indices[idx] = i;
        values[idx] = dense[i];
        idx++;
      }
    }

    return new SparseVector(dense.length, indices, values);
  }

  toDense(): Float64Array {
    const dense = new Float64Array(this.length);
    for (let i = 0; i < this.indices.length; i++) {
      dense[this.indices[i]] = this.values[i];
    }
    return dense;
  }

  get nnz(): number {
    return this.indices.length;
  }

  get(index: number): number {
    if (index < 0 || index >= this.length) {
      throw new Error(`Index out of bounds in SparseVector: ${index}`);
    }
    // Binary search over sorted indices
    let low = 0;
    let high = this.indices.length - 1;
    while (low <= high) {
      const mid = (low + high) >>> 1;
      const midIdx = this.indices[mid];
      if (midIdx === index) return this.values[mid];
      if (midIdx < index) low = mid + 1;
      else high = mid - 1;
    }
    return 0.0;
  }

  dot(denseOrSparse: ArrayLike<number> | SparseVector): number {
    let sum = 0;
    if (denseOrSparse instanceof SparseVector) {
      // 2-pointer scan over two sorted sparse vectors
      let p1 = 0;
      let p2 = 0;
      while (p1 < this.indices.length && p2 < denseOrSparse.indices.length) {
        const i1 = this.indices[p1];
        const i2 = denseOrSparse.indices[p2];
        if (i1 === i2) {
          sum += this.values[p1] * denseOrSparse.values[p2];
          p1++;
          p2++;
        } else if (i1 < i2) {
          p1++;
        } else {
          p2++;
        }
      }
    } else {
      for (let i = 0; i < this.indices.length; i++) {
        sum += this.values[i] * denseOrSparse[this.indices[i]];
      }
    }
    return sum;
  }

  norm2(): number {
    let sum = 0;
    for (let i = 0; i < this.values.length; i++) {
      sum += this.values[i] * this.values[i];
    }
    return Math.sqrt(sum);
  }

  scale(alpha: number): SparseVector {
    const newVals = new Float64Array(this.values.length);
    for (let i = 0; i < this.values.length; i++) {
      newVals[i] = this.values[i] * alpha;
    }
    return new SparseVector(this.length, new Int32Array(this.indices), newVals);
  }
}
