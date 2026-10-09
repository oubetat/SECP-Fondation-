import { CSRStorage } from './CSRStorage';

export class COOBuilder {
  readonly rows: number;
  readonly cols: number;
  private entries: Map<string, number> = new Map();

  constructor(rows: number, cols: number) {
    this.rows = rows;
    this.cols = cols;
  }

  public add(row: number, col: number, val: number): void {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return;
    const key = `${row},${col}`;
    const curr = this.entries.get(key) || 0;
    this.entries.set(key, curr + val);
  }

  public toCSR(policy: 'RETAIN' | 'PRUNE' = 'RETAIN', tol: number = 0.0): CSRStorage {
    // Sort keys by row then col for canonical CSR
    const sortedKeys = Array.from(this.entries.keys())
      .map(k => {
        const [r, c] = k.split(',').map(Number);
        return { r, c, val: this.entries.get(k)! };
      })
      .filter(item => {
        if (policy === 'PRUNE') {
          return Math.abs(item.val) > tol;
        }
        return true;
      })
      .sort((a, b) => a.r - b.r || a.c - b.c);

    const nnz = sortedKeys.length;
    const values = new Float64Array(nnz);
    const columnIndices = new Int32Array(nnz);
    const rowPointers = new Int32Array(this.rows + 1);

    let currentPtr = 0;
    let currentRow = 0;
    rowPointers[0] = 0;

    for (const item of sortedKeys) {
      while (currentRow < item.r) {
        currentRow++;
        rowPointers[currentRow] = currentPtr;
      }
      values[currentPtr] = item.val;
      columnIndices[currentPtr] = item.c;
      currentPtr++;
    }

    while (currentRow < this.rows) {
      currentRow++;
      rowPointers[currentRow] = currentPtr;
    }

    return new CSRStorage({
      rows: this.rows,
      cols: this.cols,
      nnz,
      values,
      columnIndices,
      rowPointers,
      isCanonical: true
    });
  }
}
