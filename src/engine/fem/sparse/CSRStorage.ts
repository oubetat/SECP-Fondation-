export class CSRStorage {
  public rows: number;
  public cols: number;
  public nnz: number;
  public values: Float64Array;
  public columnIndices: Int32Array;
  public rowPointers: Int32Array;
  public isCanonical: boolean;

  constructor(opts: any) {
    this.rows = opts.rows;
    this.cols = opts.cols;
    this.nnz = opts.nnz;
    this.values = opts.values;
    this.columnIndices = opts.columnIndices;
    this.rowPointers = opts.rowPointers;
    this.isCanonical = opts.isCanonical;
  }
  
  public canonicalize(): CSRStorage {
    if (this.isCanonical) return this;
    const newValues = new Float64Array(this.nnz);
    const newColIndices = new Int32Array(this.nnz);

    for (let r = 0; r < this.rows; r++) {
      const start = this.rowPointers[r];
      const end = this.rowPointers[r + 1];
      const rowItems: { col: number; val: number }[] = [];
      for (let i = start; i < end; i++) {
        rowItems.push({ col: this.columnIndices[i], val: this.values[i] });
      }
      rowItems.sort((a, b) => a.col - b.col);
      for (let i = 0; i < rowItems.length; i++) {
        newColIndices[start + i] = rowItems[i].col;
        newValues[start + i] = rowItems[i].val;
      }
    }

    return new CSRStorage({
      rows: this.rows,
      cols: this.cols,
      nnz: this.nnz,
      values: newValues,
      columnIndices: newColIndices,
      rowPointers: new Int32Array(this.rowPointers),
      isCanonical: true
    });
  }

  public get(row: number, col: number): number {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return 0;
    const start = this.rowPointers[row];
    const end = this.rowPointers[row + 1];
    for (let i = start; i < end; i++) {
      if (this.columnIndices[i] === col) {
        return this.values[i];
      }
    }
    return 0;
  }
}
