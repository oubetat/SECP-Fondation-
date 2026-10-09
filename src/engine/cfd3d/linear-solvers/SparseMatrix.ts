/**
 * SECP Industrial OS v2 — Linear Solvers Architecture
 * PATCH-055: SparseMatrix Abstraction
 */

import { SparseVector } from './SparseVector';

export class SparseMatrix {
  public readonly rows: number;
  public readonly cols: number;
  private readonly rowMap: Map<number, number>[];

  constructor(rows: number, cols: number) {
    if (rows <= 0 || cols <= 0 || !Number.isInteger(rows) || !Number.isInteger(cols)) {
      throw new Error(`Invalid SparseMatrix dimensions: ${rows}x${cols}`);
    }
    this.rows = rows;
    this.cols = cols;
    this.rowMap = Array.from({ length: rows }, () => new Map<number, number>());
  }

  public set(row: number, col: number, value: number): void {
    this.assertBounds(row, col);
    if (!Number.isFinite(value)) {
      throw new Error(`Non-finite value at (${row}, ${col}): ${value}`);
    }
    if (Math.abs(value) === 0) {
      this.rowMap[row].delete(col);
    } else {
      this.rowMap[row].set(col, value);
    }
  }

  public insert(row: number, col: number, value: number): void {
    this.set(row, col, value);
  }

  public add(row: number, col: number, value: number): void {
    this.assertBounds(row, col);
    if (!Number.isFinite(value)) {
      throw new Error(`Non-finite value provided to add at (${row}, ${col}): ${value}`);
    }
    const current = this.get(row, col);
    this.set(row, col, current + value);
  }

  public get(row: number, col: number): number {
    this.assertBounds(row, col);
    return this.rowMap[row].get(col) ?? 0.0;
  }

  public multVector(x: SparseVector): SparseVector {
    if (x.length !== this.cols) {
      throw new Error(`Matrix-Vector dimension mismatch: matrix has ${this.cols} cols, vector has length ${x.length}`);
    }
    const y = new SparseVector(this.rows);
    for (let i = 0; i < this.rows; i++) {
      let sum = 0.0;
      this.rowMap[i].forEach((val, col) => {
        sum += val * x.get(col);
      });
      y.set(i, sum);
    }
    return y;
  }

  public rowAccess(row: number): ReadonlyMap<number, number> {
    if (row < 0 || row >= this.rows || !Number.isInteger(row)) {
      throw new Error(`Invalid row index: ${row}`);
    }
    return this.rowMap[row];
  }

  public nonZeroCount(): number {
    let count = 0;
    for (let i = 0; i < this.rows; i++) {
      count += this.rowMap[i].size;
    }
    return count;
  }

  public getDiagonal(): SparseVector {
    const minDim = Math.min(this.rows, this.cols);
    const diag = new SparseVector(minDim);
    for (let i = 0; i < minDim; i++) {
      diag.set(i, this.get(i, i));
    }
    return diag;
  }

  public hasZeroDiagonal(tolerance: number = 1e-14): boolean {
    const minDim = Math.min(this.rows, this.cols);
    for (let i = 0; i < minDim; i++) {
      if (Math.abs(this.get(i, i)) <= tolerance) {
        return true;
      }
    }
    return false;
  }

  public isFinite(): boolean {
    for (let i = 0; i < this.rows; i++) {
      let finite = true;
      this.rowMap[i].forEach((val) => {
        if (!Number.isFinite(val)) finite = false;
      });
      if (!finite) return false;
    }
    return true;
  }

  public isSquare(): boolean {
    return this.rows === this.cols;
  }

  public isSymmetric(tolerance: number = 1e-10): boolean {
    if (!this.isSquare()) return false;
    for (let i = 0; i < this.rows; i++) {
      let symmetric = true;
      this.rowMap[i].forEach((valI, j) => {
        const valJ = this.get(j, i);
        if (Math.abs(valI - valJ) > tolerance) {
          symmetric = false;
        }
      });
      if (!symmetric) return false;
    }
    return true;
  }

  public isDiagonallyDominant(): boolean {
    if (!this.isSquare()) return false;
    for (let i = 0; i < this.rows; i++) {
      let offDiagSum = 0.0;
      let diagVal = 0.0;
      this.rowMap[i].forEach((val, col) => {
        if (col === i) {
          diagVal = Math.abs(val);
        } else {
          offDiagSum += Math.abs(val);
        }
      });
      if (diagVal < offDiagSum) return false;
    }
    return true;
  }

  public copy(): SparseMatrix {
    const clone = new SparseMatrix(this.rows, this.cols);
    for (let i = 0; i < this.rows; i++) {
      this.rowMap[i].forEach((val, col) => {
        clone.set(i, col, val);
      });
    }
    return clone;
  }

  private assertBounds(row: number, col: number): void {
    if (row < 0 || row >= this.rows || !Number.isInteger(row)) {
      throw new Error(`Row out of bounds: ${row} (matrix has ${this.rows} rows)`);
    }
    if (col < 0 || col >= this.cols || !Number.isInteger(col)) {
      throw new Error(`Col out of bounds: ${col} (matrix has ${this.cols} cols)`);
    }
  }
}
