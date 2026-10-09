import { SparsityPatternData } from "./types";

export class SparsityPattern {
  readonly rows: number;
  readonly cols: number;
  readonly nnz: number;
  readonly rowPointers: Int32Array;
  readonly columnIndices: Int32Array;
  readonly patternHash: string;
  readonly constructionSource: string;
  readonly generationVersion: string;
  private isLocked: boolean = true;

  constructor(data: SparsityPatternData) {
    this.rows = data.rows;
    this.cols = data.cols;
    this.nnz = data.nnz;
    this.rowPointers = data.rowPointers;
    this.columnIndices = data.columnIndices;
    this.patternHash = data.patternHash;
    this.constructionSource = data.constructionSource;
    this.generationVersion = data.generationVersion;
  }

  /**
   * Check if a specific (row, col) position is a structural nonzero
   */
  hasNonzero(row: number, col: number): boolean {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      return false;
    }
    const start = this.rowPointers[row];
    const end = this.rowPointers[row + 1];

    // Binary search over sorted columnIndices
    let low = start;
    let high = end - 1;
    while (low <= high) {
      const mid = (low + high) >>> 1;
      const midCol = this.columnIndices[mid];
      if (midCol === col) return true;
      if (midCol < col) low = mid + 1;
      else high = mid - 1;
    }
    return false;
  }

  /**
   * Verifies if two patterns are strictly identical
   */
  matches(other: SparsityPattern): boolean {
    if (this.rows !== other.rows || this.cols !== other.cols || this.nnz !== other.nnz) {
      return false;
    }
    for (let r = 0; r <= this.rows; r++) {
      if (this.rowPointers[r] !== other.rowPointers[r]) return false;
    }
    for (let i = 0; i < this.nnz; i++) {
      if (this.columnIndices[i] !== other.columnIndices[i]) return false;
    }
    return true;
  }
}

export class SparsityPatternBuilder {
  private rows: number;
  private cols: number;
  private adjacency: Set<number>[] = [];

  constructor(rows: number, cols: number) {
    this.rows = rows;
    this.cols = cols;
    this.adjacency = Array.from({ length: rows }, () => new Set<number>());
  }

  /**
   * Adds an edge / structural nonzero at (r, c)
   */
  addEdge(row: number, col: number) {
    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
      this.adjacency[row].add(col);
    }
  }

  /**
   * Predicts pattern directly from FEM element connectivity
   * For each element, all associated global DOFs are fully interconnected (clique)
   */
  addElementConnectivity(globalDOFs: number[]) {
    for (let i = 0; i < globalDOFs.length; i++) {
      const r = globalDOFs[i];
      if (r < 0 || r >= this.rows) continue;
      for (let j = 0; j < globalDOFs.length; j++) {
        const c = globalDOFs[j];
        if (c < 0 || c >= this.cols) continue;
        this.adjacency[r].add(c);
      }
    }
  }

  /**
   * Builds immutable SparsityPattern with canonical sorted column indices
   */
  build(constructionSource: string = 'FEM_CONNECTIVITY_PREDICTION'): SparsityPattern {
    let totalNNZ = 0;
    for (let r = 0; r < this.rows; r++) {
      totalNNZ += this.adjacency[r].size;
    }

    const rowPointers = new Int32Array(this.rows + 1);
    const columnIndices = new Int32Array(totalNNZ);

    let idx = 0;
    rowPointers[0] = 0;

    for (let r = 0; r < this.rows; r++) {
      const cols = Array.from(this.adjacency[r]).sort((a, b) => a - b);
      for (const c of cols) {
        columnIndices[idx++] = c;
      }
      rowPointers[r + 1] = idx;
    }

    const patternHash = SparsityPatternBuilder.computeHash(this.rows, this.cols, totalNNZ, rowPointers, columnIndices);

    return new SparsityPattern({
      rows: this.rows,
      cols: this.cols,
      nnz: totalNNZ,
      rowPointers,
      columnIndices,
      patternHash,
      constructionSource,
      generationVersion: 'v1.0.0-PATCH-078'
    });
  }

  static computeHash(rows: number, cols: number, nnz: number, rowPointers: Int32Array, columnIndices: Int32Array): string {
    let hash = 2166136261;
    hash = (hash ^ rows) * 16777619;
    hash = (hash ^ cols) * 16777619;
    hash = (hash ^ nnz) * 16777619;

    // Sample row pointers & column indices for fast deterministic hash
    const step = Math.max(1, Math.floor(nnz / 100));
    for (let i = 0; i < rowPointers.length; i += Math.max(1, Math.floor(rowPointers.length / 50))) {
      hash = (hash ^ rowPointers[i]) * 16777619;
    }
    for (let i = 0; i < nnz; i += step) {
      hash = (hash ^ columnIndices[i]) * 16777619;
    }
    return `PAT_HASH_${(hash >>> 0).toString(16).toUpperCase()}_NNZ_${nnz}`;
  }
}
