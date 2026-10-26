export class Matrix {
  public data: number[][];
  public rows: number;
  public cols: number;

  constructor(rows: number, cols: number, initData?: number[][]) {
    this.rows = rows;
    this.cols = cols;
    if (initData) {
      this.data = initData.map(row => [...row]);
    } else {
      this.data = Array.from({ length: rows }, () => new Array(cols).fill(0));
    }
  }

  public get(r: number, c: number): number {
    return this.data[r][c];
  }

  public set(r: number, c: number, v: number): void {
    this.data[r][c] = v;
  }

  public clone(): Matrix {
    return new Matrix(this.rows, this.cols, this.data);
  }

  public add(r: number, c: number, v: number): void {
    this.data[r][c] += v;
  }

  public static zeros(r: number, c: number): Matrix {
    return new Matrix(r, c);
  }

  public static identity(n: number): Matrix {
    const res = new Matrix(n, n);
    for (let i = 0; i < n; i++) {
      res.set(i, i, 1.0);
    }
    return res;
  }

  public addMatrix(other: Matrix): Matrix {
    const res = new Matrix(this.rows, this.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        res.set(i, j, this.get(i, j) + other.get(i, j));
      }
    }
    return res;
  }

  public subtractMatrix(other: Matrix): Matrix {
    const res = new Matrix(this.rows, this.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        res.set(i, j, this.get(i, j) - other.get(i, j));
      }
    }
    return res;
  }

  public transpose(): Matrix {
    const res = new Matrix(this.cols, this.rows);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        res.set(j, i, this.get(i, j));
      }
    }
    return res;
  }

  public multiply(other: Matrix): Matrix {
    const res = new Matrix(this.rows, other.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < other.cols; j++) {
        let sum = 0;
        for (let k = 0; k < this.cols; k++) {
          sum += this.get(i, k) * other.get(k, j);
        }
        res.set(i, j, sum);
      }
    }
    return res;
  }

  public multiplyVector(vec: number[]): number[] {
    if (vec.length !== this.cols) {
      throw new Error(`Matrix vector multiplication size mismatch: cols=${this.cols}, vec=${vec.length}`);
    }
    const res = new Array(this.rows).fill(0);
    for (let i = 0; i < this.rows; i++) {
      let sum = 0;
      for (let j = 0; j < this.cols; j++) {
        sum += this.data[i][j] * vec[j];
      }
      res[i] = sum;
    }
    return res;
  }

  public scale(s: number): Matrix {
    const res = new Matrix(this.rows, this.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        res.set(i, j, this.data[i][j] * s);
      }
    }
    return res;
  }

  public isSymmetric(tol = 1e-6): boolean {
    if (this.rows !== this.cols) return false;
    let maxVal = 0;
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        const absVal = Math.abs(this.data[i][j]);
        if (absVal > maxVal) maxVal = absVal;
      }
    }
    const absTol = maxVal > 1 ? tol * maxVal : tol;
    for (let i = 0; i < this.rows; i++) {
      for (let j = i + 1; j < this.cols; j++) {
        if (Math.abs(this.data[i][j] - this.data[j][i]) > absTol) {
          return false;
        }
      }
    }
    return true;
  }

  public determinant(): number {
    if (this.rows !== this.cols) throw new Error("Determinant only for square matrices");
    const n = this.rows;
    if (n === 1) return this.data[0][0];
    if (n === 2) {
      return this.data[0][0] * this.data[1][1] - this.data[0][1] * this.data[1][0];
    }
    if (n === 3) {
      const a = this.data[0][0], b = this.data[0][1], c = this.data[0][2];
      const d = this.data[1][0], e = this.data[1][1], f = this.data[1][2];
      const g = this.data[2][0], h = this.data[2][1], i = this.data[2][2];
      return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    }
    let det = 1;
    const a = this.data.map(row => [...row]);
    for (let i = 0; i < n; i++) {
      let pivot = i;
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(a[j][i]) > Math.abs(a[pivot][i])) pivot = j;
      }
      if (Math.abs(a[pivot][i]) < 1e-15) return 0;
      if (pivot !== i) {
        [a[i], a[pivot]] = [a[pivot], a[i]];
        det = -det;
      }
      det *= a[i][i];
      for (let j = i + 1; j < n; j++) {
        const factor = a[j][i] / a[i][i];
        for (let k = i + 1; k < n; k++) {
          a[j][k] -= factor * a[i][k];
        }
      }
    }
    return det;
  }

  public inverse(): Matrix {
    if (this.rows !== this.cols) throw new Error("Inverse only for square matrices");
    const n = this.rows;
    const det = this.determinant();
    if (Math.abs(det) < 1e-15) throw new Error("Matrix is singular");

    if (n === 1) {
      return new Matrix(1, 1, [[1 / this.data[0][0]]]);
    }

    if (n === 2) {
      const invDet = 1 / det;
      return new Matrix(2, 2, [
        [this.data[1][1] * invDet, -this.data[0][1] * invDet],
        [-this.data[1][0] * invDet, this.data[0][0] * invDet]
      ]);
    }

    if (n === 3) {
      const a = this.data[0][0], b = this.data[0][1], c = this.data[0][2];
      const d = this.data[1][0], e = this.data[1][1], f = this.data[1][2];
      const g = this.data[2][0], h = this.data[2][1], i = this.data[2][2];

      const invDet = 1 / det;
      return new Matrix(3, 3, [
        [(e * i - f * h) * invDet, (c * h - b * i) * invDet, (b * f - c * e) * invDet],
        [(f * g - d * i) * invDet, (a * i - c * g) * invDet, (c * d - a * f) * invDet],
        [(d * h - e * g) * invDet, (g * b - a * h) * invDet, (a * e - b * d) * invDet]
      ]);
    }

    const aug = this.data.map((row, i) => {
      const eye = new Array(n).fill(0);
      eye[i] = 1;
      return [...row, ...eye];
    });

    for (let i = 0; i < n; i++) {
      let pivot = i;
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(aug[j][i]) > Math.abs(aug[pivot][i])) pivot = j;
      }
      if (Math.abs(aug[pivot][i]) < 1e-15) throw new Error("Matrix is singular");
      if (pivot !== i) [aug[i], aug[pivot]] = [aug[pivot], aug[i]];

      const pVal = aug[i][i];
      for (let j = 0; j < 2 * n; j++) aug[i][j] /= pVal;

      for (let j = 0; j < n; j++) {
        if (j !== i) {
          const factor = aug[j][i];
          for (let k = 0; k < 2 * n; k++) aug[j][k] -= factor * aug[i][k];
        }
      }
    }

    const invData = aug.map(row => row.slice(n));
    return new Matrix(n, n, invData);
  }

  /**
   * Solves Ax = b using LU Decomposition with Partial Pivoting.
   * Mandated by SECP-082 for numerical stability.
   */
  public solve(b: number[]): number[] {
    if (this.rows !== this.cols) throw new Error("Solve only for square matrices");
    const n = this.rows;
    if (b.length !== n) throw new Error("Vector size mismatch");

    const LU = this.data.map(row => [...row]);
    const p = Array.from({ length: n }, (_, i) => i);

    for (let i = 0; i < n; i++) {
      let maxIdx = i;
      let maxVal = Math.abs(LU[i][i]);
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(LU[k][i]) > maxVal) {
          maxVal = Math.abs(LU[k][i]);
          maxIdx = k;
        }
      }

      if (maxVal < 1e-18) {
        throw new Error(`[NUMERICAL_SINGULARITY] Matrix is singular or ill-conditioned at index ${i}`);
      }

      [LU[i], LU[maxIdx]] = [LU[maxIdx], LU[i]];
      [p[i], p[maxIdx]] = [p[maxIdx], p[i]];

      for (let j = i + 1; j < n; j++) {
        LU[j][i] /= LU[i][i];
        for (let k = i + 1; k < n; k++) {
          LU[j][k] -= LU[j][i] * LU[i][k];
        }
      }
    }

    const y = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      y[i] = b[p[i]];
      for (let j = 0; j < i; j++) {
        y[i] -= LU[i][j] * y[j];
      }
    }

    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = y[i];
      for (let j = i + 1; j < n; j++) {
        x[i] -= LU[i][j] * x[j];
      }
      x[i] /= LU[i][i];
    }

    return x;
  }
}

export function solveLinearSystem(A: Matrix, b: number[]): number[] {
  return A.solve(b);
}
