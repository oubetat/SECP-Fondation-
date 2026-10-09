import { COOBuilder } from "./COOBuilder";
import { CSRStorage } from "./CSRStorage";
import { SparseMatrixAnalyzer } from "./SparsityStatistics";
import { SparseMemoryProfiler } from "./SparseMemoryProfiler";
import { SparseMatrixOperations } from "./SparseMatrixOperations";
import { SparseMatrixValidator } from "./SparseMatrixValidator";
import { SparseMatrixHasher } from "./SparseMatrixHasher";
import { MatrixState, SparsityStatisticsData, SparseMemoryBreakdown, ZeroPolicy } from "./types";

export class SparseMatrix {
  private _storage: CSRStorage;
  private _state: MatrixState;
  private _matrixHash: string | null = null;
  private _patternHash: string | null = null;

  constructor(storage: CSRStorage, state: MatrixState = 'FINALIZED') {
    this._storage = storage;
    this._state = state;
  }

  get storage(): CSRStorage {
    return this._storage;
  }

  get state(): MatrixState {
    return this._state;
  }

  get rows(): number {
    return this._storage.rows;
  }

  get cols(): number {
    return this._storage.cols;
  }

  get nnz(): number {
    return this._storage.nnz;
  }

  get density(): number {
    return this.statistics.density;
  }

  get sparsity(): number {
    return this.statistics.sparsity;
  }

  get matrixHash(): string {
    if (!this._matrixHash) {
      this._matrixHash = SparseMatrixHasher.hash(this._storage);
    }
    return this._matrixHash;
  }

  get patternHash(): string {
    if (!this._patternHash) {
      this._patternHash = SparseMatrixHasher.hashPattern(this._storage);
    }
    return this._patternHash;
  }

  get statistics(): SparsityStatisticsData {
    return SparseMatrixAnalyzer.getStatistics(this._storage);
  }

  get memoryProfile(): SparseMemoryBreakdown {
    return SparseMemoryProfiler.profile(this._storage);
  }

  get(row: number, col: number): number {
    return this._storage.get(row, col);
  }

  spmv(x: ArrayLike<number>, yOut?: Float64Array): Float64Array {
    return SparseMatrixOperations.spmv(this._storage, x, yOut);
  }

  multiplyVector(x: ArrayLike<number>, yOut?: Float64Array): Float64Array {
    return this.spmv(x, yOut);
  }

  transpose(): SparseMatrix {
    const tStorage = SparseMatrixOperations.transpose(this._storage);
    return new SparseMatrix(tStorage, this._state);
  }

  get sparsityRatio(): number {
    const total = this.rows * this.cols;
    if (total === 0) return 1.0;
    return 1.0 - (this.nnz / total);
  }

  static create(rows: number, cols: number, estimatedNNZ: number = 0): SparseMatrixBuilder {
    return new SparseMatrixBuilder(rows, cols, estimatedNNZ);
  }

  add(other: SparseMatrix): SparseMatrix {
    const cStorage = SparseMatrixOperations.add(this._storage, other._storage);
    return new SparseMatrix(cStorage, 'FINALIZED');
  }

  sub(other: SparseMatrix): SparseMatrix {
    const cStorage = SparseMatrixOperations.subtract(this._storage, other._storage);
    return new SparseMatrix(cStorage, 'FINALIZED');
  }

  multiplyMatrix(other: SparseMatrix): SparseMatrix {
    const cStorage = SparseMatrixOperations.multiplyMatrix(this._storage, other._storage);
    return new SparseMatrix(cStorage, 'FINALIZED');
  }

  diagonal(): Float64Array {
    return SparseMatrixOperations.extractDiagonal(this._storage);
  }

  positiveDefinitenessCheck(): { isPositiveDefinite: boolean; reason?: string; minDiagonal: number } {
    const diag = this.diagonal();
    let minDiag = Infinity;
    for (let i = 0; i < diag.length; i++) {
      if (diag[i] < minDiag) minDiag = diag[i];
      if (diag[i] <= 0) {
        return { isPositiveDefinite: false, reason: `Diagonal entry at index ${i} is non-positive: ${diag[i]}`, minDiagonal: minDiag };
      }
    }
    const sym = this.isSymmetric();
    if (!sym.isSymmetric) {
      return { isPositiveDefinite: false, reason: `Matrix is asymmetric (max diff: ${sym.maxDiff})`, minDiagonal: minDiag };
    }
    return { isPositiveDefinite: true, minDiagonal: minDiag };
  }

  scale(alpha: number): SparseMatrix {
    const sStorage = SparseMatrixOperations.scale(this._storage, alpha);
    return new SparseMatrix(sStorage, this._state);
  }

  isSymmetric(tolerance: number = 1e-8): { isSymmetric: boolean; maxDiff: number } {
    return SparseMatrixOperations.isSymmetric(this._storage, tolerance);
  }

  frobeniusNorm(): number {
    return SparseMatrixOperations.frobeniusNorm(this._storage);
  }

  infNorm(): number {
    return SparseMatrixOperations.infNorm(this._storage);
  }

  oneNorm(): number {
    return SparseMatrixOperations.oneNorm(this._storage);
  }

  validate(): boolean {
    const report = SparseMatrixValidator.validate(this._storage);
    if (report.isValid) {
      if (this._state === 'FINALIZED' || this._state === 'BUILDING') {
        this._state = 'VALIDATED';
      }
      return true;
    } else {
      this._state = 'INVALID';
      return false;
    }
  }

  markSolverReady() {
    if (this._state === 'INVALID') {
      throw new Error("Cannot transition an INVALID matrix to SOLVER_READY without rebuilding/validation");
    }
    const isValid = this.validate();
    if (isValid) {
      this._state = 'SOLVER_READY';
    }
  }

  extractSubmatrix(rowIndices: number[], colIndices: number[]): SparseMatrix {
    const numRows = rowIndices.length;
    const numCols = colIndices.length;
    const builder = new SparseMatrixBuilder(numRows, numCols);

    // Map global column index to local column index in colIndices
    const colMap = new Map<number, number>();
    for (let c = 0; c < numCols; c++) {
      colMap.set(colIndices[c], c);
    }

    const csr = this._storage;
    for (let r = 0; r < numRows; r++) {
      const gRow = rowIndices[r];
      if (gRow < 0 || gRow >= csr.rows) continue;

      const start = csr.rowPointers[gRow];
      const end = csr.rowPointers[gRow + 1];

      for (let p = start; p < end; p++) {
        const gCol = csr.columnIndices[p];
        const val = csr.values[p];

        const localCol = colMap.get(gCol);
        if (localCol !== undefined) {
          builder.add(r, localCol, val);
        }
      }
    }

    return builder.build();
  }

  toDense(): number[][] {
    const dense: number[][] = [];
    for (let r = 0; r < this._storage.rows; r++) {
      const row: number[] = new Array(this._storage.cols).fill(0);
      for (let c = 0; c < this._storage.cols; c++) {
        row[c] = this._storage.get(r, c);
      }
      dense.push(row);
    }
    return dense;
  }

  clone(): SparseMatrix {
    const copyStorage = new CSRStorage({
      rows: this._storage.rows,
      cols: this._storage.cols,
      nnz: this._storage.nnz,
      values: new Float64Array(this._storage.values),
      columnIndices: new Int32Array(this._storage.columnIndices),
      rowPointers: new Int32Array(this._storage.rowPointers),
      isCanonical: this._storage.isCanonical
    });
    return new SparseMatrix(copyStorage, this._state);
  }
}

export class SparseMatrixBuilder {
  private coo: COOBuilder;
  private state: MatrixState = 'BUILDING';
  private zeroPolicy: ZeroPolicy = 'RETAIN';
  private tolerance: number = 0.0;

  constructor(rows: number, cols: number, estimatedNNZ: number = 0, zeroPolicy: ZeroPolicy = 'RETAIN', tolerance: number = 0.0) {
    this.coo = new COOBuilder(rows, cols, estimatedNNZ);
    this.zeroPolicy = zeroPolicy;
    this.tolerance = tolerance;
  }

  reserve(capacity: number) {
    if (this.state !== 'BUILDING') {
      throw new Error(`Cannot reserve capacity on matrix builder in state: ${this.state}`);
    }
    this.coo.reserve(capacity);
  }

  add(row: number, col: number, val: number) {
    if (this.state !== 'BUILDING') {
      throw new Error(`Cannot add entries to matrix builder in state: ${this.state}`);
    }
    this.coo.add(row, col, val);
  }

  addBlock(rowIndices: number[], colIndices: number[], blockData: number[][] | Float64Array | number[]) {
    if (this.state !== 'BUILDING') {
      throw new Error(`Cannot add block to matrix builder in state: ${this.state}`);
    }
    this.coo.addBlock(rowIndices, colIndices, blockData);
  }

  build(): SparseMatrix {
    const csr = this.coo.toCSR(this.zeroPolicy, this.tolerance);
    this.state = 'FINALIZED';
    const mat = new SparseMatrix(csr, 'FINALIZED');
    mat.validate();
    return mat;
  }
}
