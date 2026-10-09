import { describe, it, expect } from 'vitest';
import { CSRStorage } from '../CSRStorage';
import { COOBuilder } from '../COOBuilder';
import { SparseMatrixOperations } from '../SparseMatrixOperations';
import { SparseAssembler } from '../SparseAssembler';
import { SparseBenchmarkSuite } from '../SparseBenchmarkSuite';
import { DenseReferenceMatrix } from '../DenseReferenceMatrix';
import { HardAcceptanceGate078 } from '../HardAcceptanceGate078';
import { SparseMatrixSerializer } from '../SparseMatrixSerializer';

describe('Sparse Operations, Assembly & Gate 078', () => {
  it('correctly executes pure sparse SpMV, Transpose, Addition, and Scale', () => {
    const csr = new CSRStorage({
      rows: 3,
      cols: 3,
      nnz: 4,
      values: new Float64Array([10, 20, 30, 40]),
      columnIndices: new Int32Array([0, 2, 1, 2]),
      rowPointers: new Int32Array([0, 2, 3, 4]),
      isCanonical: true
    });

    const x = new Float64Array([1, 2, 3]);
    const y = SparseMatrixOperations.spmv(csr, x);
    expect(y[0]).toBe(70); // 10*1 + 20*3
    expect(y[1]).toBe(60); // 30*2
    expect(y[2]).toBe(120); // 40*3

    const t = SparseMatrixOperations.transpose(csr);
    expect(t.get(2, 0)).toBe(20);
    expect(t.get(1, 1)).toBe(30);

    const sum = SparseMatrixOperations.add(csr, csr);
    expect(sum.get(0, 0)).toBe(20);
    expect(sum.get(0, 2)).toBe(40);

    const scaled = SparseMatrixOperations.scale(csr, 3.0);
    expect(scaled.get(0, 0)).toBe(30);
    expect(scaled.get(2, 2)).toBe(120);
  });

  it('correctly accumulates duplicates in COOBuilder', () => {
    const coo = new COOBuilder(2, 2);
    coo.add(0, 0, 5.0);
    coo.add(0, 0, 15.0);
    coo.add(1, 1, 2.5);
    const csr = coo.toCSR();

    expect(csr.nnz).toBe(2);
    expect(csr.get(0, 0)).toBe(20.0);
    expect(csr.get(1, 1)).toBe(2.5);
  });

  it('assembles 1D Bar mesh directly in sparse format without dense matrix', () => {
    const mesh = SparseBenchmarkSuite.generate1DBar(5);
    const res = SparseAssembler.assembleGlobalStiffness(mesh.totalDOFs, 1, mesh.elements);

    expect(res.sparseMatrix.rows).toBe(6);
    expect(res.usedDenseFallback).toBe(false);
    expect(res.duplicateAccumulationCount).toBeGreaterThan(0);

    const sym = res.sparseMatrix.isSymmetric(1e-8);
    expect(sym.isSymmetric).toBe(true);
  });

  it('serializes and deserializes losslessly with hash integrity validation', () => {
    const csr = new CSRStorage({
      rows: 2,
      cols: 2,
      nnz: 2,
      values: new Float64Array([100, 200]),
      columnIndices: new Int32Array([0, 1]),
      rowPointers: new Int32Array([0, 1, 2]),
      isCanonical: true
    });

    const serialized = SparseMatrixSerializer.serialize(csr);
    const deserialized = SparseMatrixSerializer.deserialize(serialized);

    expect(deserialized.get(0, 0)).toBe(100);
    expect(deserialized.get(1, 1)).toBe(200);
  });

  it('passes all 45 criteria in HardAcceptanceGate078 with VERIFIED verdict', () => {
    const gate = HardAcceptanceGate078.evaluateAll();
    expect(gate.overallPassed).toBe(true);
    expect(gate.failedCriteria).toBe(0);
    expect(gate.verdict).toBe('VERIFIED');
    expect(gate.passedCriteria).toBe(45);
  });
});
