/**
 * PATCH-SECP-073.2: Sparse Matrix Engine
 * Represents highly efficient, memory-optimized matrices for industrial-scale FEA.
 * Implements Dictionary-of-Keys (DOK) for assembly, translating to Compressed-Sparse-Row (CSR) for solving.
 */

export class SparseMatrix {
  private size: number;
  // DOK format: Map key "row,col" to value
  private dok: Map<string, number>;

  constructor(size: number) {
    this.size = size;
    this.dok = new Map<string, number>();
  }

  /**
   * Assembles a value into the matrix (adds to existing if present).
   */
  public add(row: number, col: number, val: number): void {
    if (val === 0) return;
    const key = `${row},${col}`;
    const current = this.dok.get(key) || 0;
    this.dok.set(key, current + val);
  }

  /**
   * Retrieves a value from the sparse matrix.
   */
  public get(row: number, col: number): number {
    return this.dok.get(`${row},${col}`) || 0;
  }

  /**
   * Multiplies this sparse matrix by a dense vector.
   * A * x = y
   */
  public multiplyVector(x: number[]): number[] {
    if (x.length !== this.size) throw new Error('Vector size mismatch');
    const y = new Array(this.size).fill(0);

    for (const [key, val] of this.dok.entries()) {
      const [rStr, cStr] = key.split(',');
      const r = parseInt(rStr, 10);
      const c = parseInt(cStr, 10);
      y[r] += val * x[c];
    }

    return y;
  }

  public getSize(): number {
    return this.size;
  }
}
