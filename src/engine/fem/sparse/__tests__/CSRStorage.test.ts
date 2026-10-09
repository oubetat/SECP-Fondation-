import { describe, it, expect } from 'vitest';
import { CSRStorage } from '../CSRStorage';
import { CSCStorage } from '../CSCStorage';
import { SparseMemoryProfiler } from '../SparseMemoryProfiler';
import { SparsityStatistics } from '../SparsityStatistics';

describe('CSRStorage & CSCStorage', () => {
  it('correctly accesses entries via binary search and returns 0 for zero entries', () => {
    const csr = new CSRStorage({
      rows: 3,
      cols: 3,
      nnz: 4,
      values: new Float64Array([10, 20, 30, 40]),
      columnIndices: new Int32Array([0, 2, 1, 2]),
      rowPointers: new Int32Array([0, 2, 3, 4]),
      isCanonical: true
    });

    expect(csr.get(0, 0)).toBe(10);
    expect(csr.get(0, 1)).toBe(0);
    expect(csr.get(0, 2)).toBe(20);
    expect(csr.get(1, 1)).toBe(30);
    expect(csr.get(2, 2)).toBe(40);
  });

  it('performs exact bidirectional conversion between CSR and CSC', () => {
    const csr = new CSRStorage({
      rows: 3,
      cols: 3,
      nnz: 4,
      values: new Float64Array([10, 20, 30, 40]),
      columnIndices: new Int32Array([0, 2, 1, 2]),
      rowPointers: new Int32Array([0, 2, 3, 4]),
      isCanonical: true
    });

    const csc = CSCStorage.fromCSR(csr);
    expect(csc.rows).toBe(3);
    expect(csc.cols).toBe(3);
    expect(csc.nnz).toBe(4);

    const convertedCSR = csc.toCSR();
    expect(convertedCSR.get(0, 0)).toBe(10);
    expect(convertedCSR.get(0, 2)).toBe(20);
    expect(convertedCSR.get(1, 1)).toBe(30);
    expect(convertedCSR.get(2, 2)).toBe(40);
  });

  it('computes exact memory bytes in SparseMemoryProfiler', () => {
    const csr = new CSRStorage({
      rows: 3,
      cols: 3,
      nnz: 4,
      values: new Float64Array([10, 20, 30, 40]),
      columnIndices: new Int32Array([0, 2, 1, 2]),
      rowPointers: new Int32Array([0, 2, 3, 4]),
      isCanonical: true
    });

    const mem = SparseMemoryProfiler.profile(csr);
    expect(mem.valuesBytes).toBe(4 * 8); // 32
    expect(mem.indicesBytes).toBe(4 * 4); // 16
    expect(mem.pointersBytes).toBe(4 * 4); // 16
    expect(mem.totalSparseBytes).toBe(64);
  });

  it('computes exact sparsity metrics in SparsityStatistics', () => {
    const csr = new CSRStorage({
      rows: 3,
      cols: 3,
      nnz: 4,
      values: new Float64Array([10, 20, 30, 40]),
      columnIndices: new Int32Array([0, 2, 1, 2]),
      rowPointers: new Int32Array([0, 2, 3, 4]),
      isCanonical: true
    });

    const stats = SparsityStatistics.analyze(csr);
    expect(stats.density).toBeCloseTo(4 / 9);
    expect(stats.sparsity).toBeCloseTo(5 / 9);
    expect(stats.lowerBandwidth).toBe(0);
    expect(stats.upperBandwidth).toBe(2);
  });
});
