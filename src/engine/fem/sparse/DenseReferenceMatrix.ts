export class DenseReferenceMatrix {
  readonly rows: number;
  readonly cols: number;
  readonly data: Float64Array;

  constructor(rows: number, cols: number, initialData?: number[][]) {
    this.rows = rows;
    this.cols = cols;
    this.data = new Float64Array(rows * cols);

    if (initialData) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          this.data[r * cols + c] = initialData[r][c] ?? 0;
        }
      }
    }
  }

  get(row: number, col: number): number {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      throw new Error(`Index out of bounds in DenseReferenceMatrix: (${row}, ${col})`);
    }
    return this.data[row * this.cols + col];
  }

  set(row: number, col: number, val: number) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      throw new Error(`Index out of bounds in DenseReferenceMatrix: (${row}, ${col})`);
    }
    this.data[row * this.cols + col] = val;
  }

  add(row: number, col: number, val: number) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      throw new Error(`Index out of bounds in DenseReferenceMatrix: (${row}, ${col})`);
    }
    this.data[row * this.cols + col] += val;
  }

  addBlock(rowIndices: number[], colIndices: number[], block: number[][]) {
    for (let i = 0; i < rowIndices.length; i++) {
      const r = rowIndices[i];
      for (let j = 0; j < colIndices.length; j++) {
        const c = colIndices[j];
        this.add(r, c, block[i][j]);
      }
    }
  }

  multiplyVector(x: ArrayLike<number>): Float64Array {
    if (x.length !== this.cols) {
      throw new Error(`Vector length mismatch: ${x.length} vs cols ${this.cols}`);
    }
    const y = new Float64Array(this.rows);
    for (let r = 0; r < this.rows; r++) {
      let sum = 0;
      const rowOffset = r * this.cols;
      for (let c = 0; c < this.cols; c++) {
        sum += this.data[rowOffset + c] * x[c];
      }
      y[r] = sum;
    }
    return y;
  }

  transpose(): DenseReferenceMatrix {
    const res = new DenseReferenceMatrix(this.cols, this.rows);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        res.set(c, r, this.get(r, c));
      }
    }
    return res;
  }

  addMatrix(other: DenseReferenceMatrix): DenseReferenceMatrix {
    if (this.rows !== other.rows || this.cols !== other.cols) {
      throw new Error("Dimension mismatch in DenseReferenceMatrix addition");
    }
    const res = new DenseReferenceMatrix(this.rows, this.cols);
    for (let i = 0; i < this.data.length; i++) {
      res.data[i] = this.data[i] + other.data[i];
    }
    return res;
  }

  isSymmetric(tolerance: number = 1e-8): { isSymmetric: boolean; maxDiff: number } {
    if (this.rows !== this.cols) return { isSymmetric: false, maxDiff: Infinity };
    let maxDiff = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = r + 1; c < this.cols; c++) {
        const d = Math.abs(this.get(r, c) - this.get(c, r));
        if (d > maxDiff) maxDiff = d;
        if (d > tolerance) return { isSymmetric: false, maxDiff };
      }
    }
    return { isSymmetric: true, maxDiff };
  }

  to2DArray(): number[][] {
    const arr: number[][] = [];
    for (let r = 0; r < this.rows; r++) {
      const row: number[] = [];
      const offset = r * this.cols;
      for (let c = 0; c < this.cols; c++) {
        row.push(this.data[offset + c]);
      }
      arr.push(row);
    }
    return arr;
  }
}
