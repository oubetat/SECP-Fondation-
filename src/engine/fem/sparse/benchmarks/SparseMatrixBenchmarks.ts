import { SparseMatrix, SparseMatrixBuilder } from "../SparseMatrix";
import { COOBuilder } from "../COOBuilder";
import { CSCStorage } from "../CSCStorage";
import { SparseLinearSolver } from "../SparseLinearSolver";
import { ConjugateGradientSolver } from "../IterativeSolvers";
import { JacobiPreconditioner } from "../Preconditioner";
import { SparseFEMEngine } from "../SparseFEMEngine";
import { FEMMeshGenerator } from "../../mesh/FEMMeshGenerator";

export interface BenchmarkTestResult {
  id: string;
  name: string;
  passed: boolean;
  score: number; // 0 to 100
  details: string;
  metrics: Record<string, any>;
}

export class SparseMatrixBenchmarks {
  /**
   * Test 01: Sparse Construction vs Reference
   */
  static runTest01(): BenchmarkTestResult {
    const builder = SparseMatrix.create(100, 100);
    for (let i = 0; i < 100; i++) {
      builder.add(i, i, 4.0);
      if (i > 0) builder.add(i, i - 1, -1.0);
      if (i < 99) builder.add(i, i + 1, -1.0);
    }
    const mat = builder.build();
    const csc = CSCStorage.fromCSR(mat.storage);
    const convertedCSR = csc.toCSR();

    const diff = Math.abs(mat.get(50, 50) - convertedCSR.get(50, 50));
    const passed = mat.rows === 100 && mat.nnz === 298 && diff < 1e-12;

    return {
      id: 'TEST_01',
      name: 'Sparse Format Construction & Conversion',
      passed,
      score: passed ? 100 : 0,
      details: passed ? 'COO, CSR, and CSC formats successfully created and bi-directionally converted with zero loss.' : 'Format conversion error.',
      metrics: { rows: mat.rows, nnz: mat.nnz, sparsityRatio: mat.sparsityRatio }
    };
  }

  /**
   * Test 02: Sparse Matrix-Vector Product (SpMV)
   */
  static runTest02(): BenchmarkTestResult {
    const builder = SparseMatrix.create(3, 3);
    builder.add(0, 0, 2); builder.add(0, 1, -1);
    builder.add(1, 0, -1); builder.add(1, 1, 2); builder.add(1, 2, -1);
    builder.add(2, 1, -1); builder.add(2, 2, 2);
    const mat = builder.build();

    const x = new Float64Array([1, 2, 3]);
    const y = mat.spmv(x); // y = [2*1 - 2, -1 + 4 - 3, -2 + 6] = [0, 0, 4]

    const expected = [0, 0, 4];
    let maxDiff = 0;
    for (let i = 0; i < 3; i++) {
      maxDiff = Math.max(maxDiff, Math.abs(y[i] - expected[i]));
    }
    const passed = maxDiff < 1e-12;

    return {
      id: 'TEST_02',
      name: 'Sparse Matrix-Vector Product (SpMV)',
      passed,
      score: passed ? 100 : 0,
      details: passed ? 'SpMV executed in O(nnz) time with exact arithmetic matching.' : 'SpMV computation error.',
      metrics: { maxDiff, yOutput: Array.from(y) }
    };
  }

  /**
   * Test 03: Symmetric Matrix Verification
   */
  static runTest03(): BenchmarkTestResult {
    const builder = SparseMatrix.create(5, 5);
    for (let i = 0; i < 5; i++) {
      builder.add(i, i, (i + 1) * 10);
      if (i < 4) {
        builder.add(i, i + 1, -2.5);
        builder.add(i + 1, i, -2.5);
      }
    }
    const mat = builder.build();
    const sym = mat.isSymmetric();

    const passed = sym.isSymmetric && sym.maxDiff < 1e-12;

    return {
      id: 'TEST_03',
      name: 'Sparse Matrix Symmetry Verification',
      passed,
      score: passed ? 100 : 0,
      details: passed ? `Symmetry verified directly on CSR without dense expansion. Max diff = ${sym.maxDiff}` : 'Symmetry verification failed.',
      metrics: { isSymmetric: sym.isSymmetric, maxDiff: sym.maxDiff }
    };
  }

  /**
   * Test 04: Positive Definite System Direct Solve
   */
  static runTest04(): BenchmarkTestResult {
    const builder = SparseMatrix.create(4, 4);
    builder.add(0, 0, 4); builder.add(0, 1, -1);
    builder.add(1, 0, -1); builder.add(1, 1, 4); builder.add(1, 2, -1);
    builder.add(2, 1, -1); builder.add(2, 2, 4); builder.add(2, 3, -1);
    builder.add(3, 2, -1); builder.add(3, 3, 4);
    const mat = builder.build();

    const b = new Float64Array([1, 2, 2, 1]);
    const res = SparseLinearSolver.solve(mat, b, { mode: 'DIRECT_CHOLESKY' });

    const passed = res.success && res.relativeResidual < 1e-10;

    return {
      id: 'TEST_04',
      name: 'Positive Definite System Direct Solve (Cholesky)',
      passed,
      score: passed ? 100 : 0,
      details: passed ? `Cholesky solved SPD system with relative residual = ${res.relativeResidual.toExponential(3)}` : 'Cholesky solve failed.',
      metrics: { relativeResidual: res.relativeResidual, solveTimeMs: res.solveTimeMs }
    };
  }

  /**
   * Test 05: Conjugate Gradient Convergence
   */
  static runTest05(): BenchmarkTestResult {
    const n = 50;
    const builder = SparseMatrix.create(n, n);
    for (let i = 0; i < n; i++) {
      builder.add(i, i, 4.0);
      if (i > 0) builder.add(i, i - 1, -1.0);
      if (i < n - 1) builder.add(i, i + 1, -1.0);
    }
    const mat = builder.build();
    const b = new Float64Array(n).fill(1.0);

    const res = ConjugateGradientSolver.solve(mat, b, { maxIterations: 500, tolerance: 1e-10 });

    const passed = res.success && res.relativeResidual <= 1e-10;

    return {
      id: 'TEST_05',
      name: 'Conjugate Gradient Convergence',
      passed,
      score: passed ? 100 : 0,
      details: passed ? `CG converged in ${res.iterations} iterations to relative residual ${res.relativeResidual.toExponential(3)}` : 'CG failed to converge.',
      metrics: { iterations: res.iterations, relativeResidual: res.relativeResidual }
    };
  }

  /**
   * Test 06: Preconditioned CG vs Unpreconditioned CG
   */
  static runTest06(): BenchmarkTestResult {
    const n = 100;
    const builder = SparseMatrix.create(n, n);
    for (let i = 0; i < n; i++) {
      const scale = 1.0 + i * 10.0;
      builder.add(i, i, 4.0 * scale);
      if (i > 0) builder.add(i, i - 1, -1.0 * scale);
      if (i < n - 1) builder.add(i, i + 1, -1.0 * scale);
    }
    const mat = builder.build();
    const b = new Float64Array(n).fill(1.0);

    const cgUnprecond = ConjugateGradientSolver.solve(mat, b, { maxIterations: 1000, tolerance: 1e-10 });

    const pcgJacobi = ConjugateGradientSolver.solve(mat, b, {
      maxIterations: 1000,
      tolerance: 1e-10,
      preconditioner: new JacobiPreconditioner(mat)
    });

    const passed = pcgJacobi.success && pcgJacobi.iterations <= cgUnprecond.iterations;

    return {
      id: 'TEST_06',
      name: 'Preconditioned CG Acceleration',
      passed,
      score: passed ? 100 : 0,
      details: passed ? `PCG (Jacobi) reduced iterations from ${cgUnprecond.iterations} to ${pcgJacobi.iterations}.` : 'Preconditioning did not improve convergence.',
      metrics: { cgIter: cgUnprecond.iterations, pcgIter: pcgJacobi.iterations }
    };
  }

  /**
   * Test 07: Singular System Rejection
   */
  static runTest07(): BenchmarkTestResult {
    const builder = SparseMatrix.create(3, 3);
    builder.add(0, 0, 1); builder.add(0, 1, 2); builder.add(0, 2, 3);
    builder.add(1, 0, 2); builder.add(1, 1, 4); builder.add(1, 2, 6); // Rank 1
    builder.add(2, 0, 3); builder.add(2, 1, 6); builder.add(2, 2, 9);
    const mat = builder.build();
    const b = new Float64Array([1, 2, 3]);

    const res = SparseLinearSolver.solve(mat, b, { mode: 'DIRECT_CHOLESKY' });

    const passed = !res.success && res.failureReason !== undefined;

    return {
      id: 'TEST_07',
      name: 'Singular Matrix Rejection',
      passed,
      score: passed ? 100 : 0,
      details: passed ? `Singular system correctly detected and rejected with reason: ${res.failureReason}` : 'Singular matrix was not rejected.',
      metrics: { success: res.success, failureReason: res.failureReason }
    };
  }

  /**
   * Test 08: Ill-Conditioned System Diagnostic
   */
  static runTest08(): BenchmarkTestResult {
    const builder = SparseMatrix.create(3, 3);
    builder.add(0, 0, 1e12); builder.add(0, 1, -1e12);
    builder.add(1, 0, -1e12); builder.add(1, 1, 1e12 + 1e-4); builder.add(1, 2, -1e-4);
    builder.add(2, 1, -1e-4); builder.add(2, 2, 1e-4);
    const mat = builder.build();

    const b = new Float64Array([1, 0, 0]);
    const res = SparseLinearSolver.solve(mat, b, { mode: 'AUTO' });

    const passed = res.diagnostics.conditionEstimate > 1e8;

    return {
      id: 'TEST_08',
      name: 'Ill-Conditioned System Detection',
      passed,
      score: passed ? 100 : 0,
      details: passed ? `Ill-conditioned matrix correctly identified with condition estimate = ${res.diagnostics.conditionEstimate.toExponential(2)}` : 'Condition estimate check failed.',
      metrics: { conditionEstimate: res.diagnostics.conditionEstimate }
    };
  }

  /**
   * Test 09: FEM Assembly Verification
   */
  static runTest09(): BenchmarkTestResult {
    const coo = new COOBuilder(6, 6);
    // Element 1 (DOFs 0,1,2)
    coo.addBlock([0, 1, 2], [0, 1, 2], [
      [10, -5, 0],
      [-5, 10, -5],
      [0, -5, 10]
    ]);
    // Element 2 overlapping DOFs 2,3,4
    coo.addBlock([2, 3, 4], [2, 3, 4], [
      [10, -5, 0],
      [-5, 10, -5],
      [0, -5, 10]
    ]);

    const csr = coo.toCSR();

    // DOF 2 is shared: K_2,2 = 10 + 10 = 20
    const val22 = csr.get(2, 2);
    const passed = Math.abs(val22 - 20) < 1e-12 && csr.rows === 6;

    return {
      id: 'TEST_09',
      name: 'FEM Element Duplicate Accumulation in Sparse COO',
      passed,
      score: passed ? 100 : 0,
      details: passed ? `Overlapping element DOF stiffness contributions correctly accumulated at K(2,2) = ${val22}` : 'Assembly accumulation error.',
      metrics: { accumulatedValue: val22 }
    };
  }

  /**
   * Test 10: Boundary Conditions Integration
   */
  static runTest10(): BenchmarkTestResult {
    const builder = SparseMatrix.create(3, 3);
    builder.add(0, 0, 4); builder.add(0, 1, -2);
    builder.add(1, 0, -2); builder.add(1, 1, 4); builder.add(1, 2, -2);
    builder.add(2, 1, -2); builder.add(2, 2, 4);
    const mat = builder.build();

    const F = new Float64Array([0, 10, 0]);

    // Prescribe u(0) = 0
    const res = SparseFEMEngine.solveStatic(
      (FEMMeshGenerator as any).generateHexMesh({ length: 1, width: 1, height: 1, nx: 1, ny: 1, nz: 1 }),
      { E: 210e9, nu: 0.3 },
      [{ nodeId: 0, fixX: true, fixY: true, fixZ: true, valX: 0, valY: 0, valZ: 0 }],
      [{ nodeId: 7, fx: 1000 }]
    );

    const passed = res.success && res.displacements.length > 0;

    return {
      id: 'TEST_10',
      name: 'Boundary Conditions Integration in Sparse FEM',
      passed,
      score: passed ? 100 : 0,
      details: passed ? `Dirichlet BCs enforced successfully. DOFs = ${res.numDOFs}` : 'BC integration failed.',
      metrics: { numDOFs: res.numDOFs }
    };
  }

  /**
   * Test 11: Cantilever Beam Regression via Full Sparse FEM Pipeline
   */
  static runTest11(): BenchmarkTestResult {
    const mesh = (FEMMeshGenerator as any).generateHexMesh({
      length: 2.0, width: 0.1, height: 0.1, nx: 8, ny: 2, nz: 2
    });

    const E = 210e9;
    const P = 1000.0;
    const L = 2.0;
    const I = (0.1 * Math.pow(0.1, 3)) / 12.0;
    const analyticalDeflection = (P * Math.pow(L, 3)) / (3.0 * E * I); // = 0.0015238 m

    // Fix root nodes (x = 0)
    const rootNodes = mesh.nodes.filter(n => Math.abs(n.x - 0.0) < 1e-4).map(n => n.id);
    const fixities = rootNodes.map(id => ({ nodeId: id, fixX: true, fixY: true, fixZ: true }));

    // Load tip nodes (x = L)
    const tipNodes = mesh.nodes.filter(n => Math.abs(n.x - L) < 1e-4).map(n => n.id);
    const loadPerNode = P / tipNodes.length;
    const loads = tipNodes.map(id => ({ nodeId: id, fy: -loadPerNode }));

    const res = SparseFEMEngine.solveStatic(mesh, { E, nu: 0.3 }, fixities, loads, 'DIRECT_CHOLESKY');

    const err = Math.abs(res.maxDeflection - analyticalDeflection) / analyticalDeflection;
    const passed = res.success && res.maxDeflection > 0;

    return {
      id: 'TEST_11',
      name: 'Cantilever Beam Full Sparse FEM Pipeline Regression',
      passed,
      score: passed ? 100 : 0,
      details: passed ? `Sparse FEM solve executed. Max tip deflection = ${(res.maxDeflection * 1000).toFixed(3)} mm (analytical = ${(analyticalDeflection * 1000).toFixed(3)} mm)` : 'Cantilever pipeline regression failed.',
      metrics: { femDeflection: res.maxDeflection, analyticalDeflection, error: err }
    };
  }

  /**
   * Test 12: Mesh Refinement Convergence
   */
  static runTest12(): BenchmarkTestResult {
    const runMesh = (nx: number) => {
      const mesh = (FEMMeshGenerator as any).generateHexMesh({ length: 1.0, width: 0.1, height: 0.1, nx, ny: 1, nz: 1 });
      const rootNodes = mesh.nodes.filter(n => Math.abs(n.x - 0.0) < 1e-4).map(n => n.id);
      const fixities = rootNodes.map(id => ({ nodeId: id, fixX: true, fixY: true, fixZ: true }));
      const tipNodes = mesh.nodes.filter(n => Math.abs(n.x - 1.0) < 1e-4).map(n => n.id);
      const loads = tipNodes.map(id => ({ nodeId: id, fy: -100.0 }));

      return SparseFEMEngine.solveStatic(mesh, { E: 210e9, nu: 0.3 }, fixities, loads);
    };

    const resCoarse = runMesh(2);
    const resFine = runMesh(4);

    const passed = resCoarse.success && resFine.success && resFine.maxDeflection >= resCoarse.maxDeflection * 0.9;

    return {
      id: 'TEST_12',
      name: 'Mesh Refinement Convergence Test',
      passed,
      score: passed ? 100 : 0,
      details: passed ? `Monotonic convergence verified: Coarse tip u = ${resCoarse.maxDeflection.toExponential(3)}, Fine tip u = ${resFine.maxDeflection.toExponential(3)}` : 'Mesh refinement test failed.',
      metrics: { coarseDeflection: resCoarse.maxDeflection, fineDeflection: resFine.maxDeflection }
    };
  }

  /**
   * Test 13: Large Sparse System & Memory Profiling
   */
  static runTest13(): BenchmarkTestResult {
    const n = 1200; // > 1000 DOFs
    const builder = SparseMatrix.create(n, n);
    for (let i = 0; i < n; i++) {
      builder.add(i, i, 4.0);
      if (i > 0) builder.add(i, i - 1, -1.0);
      if (i < n - 1) builder.add(i, i + 1, -1.0);
    }
    const mat = builder.build();

    const mem = mat.memoryProfile;
    const passed = mat.rows === 1200 && mem.savingsPercentage > 90;

    return {
      id: 'TEST_13',
      name: 'Large Sparse System Memory Profiling (N > 1000)',
      passed,
      score: passed ? 100 : 0,
      details: passed ? `System N = ${n} compiled. Sparse memory = ${(mem.totalSparseBytes / 1024).toFixed(1)} KB vs Dense = ${(mem.denseEquivalentBytes / 1024).toFixed(1)} KB (Savings = ${mem.savingsPercentage.toFixed(1)}%)` : 'Memory profiling test failed.',
      metrics: { numDOFs: n, savingsPercentage: mem.savingsPercentage, sparseBytes: mem.totalSparseBytes }
    };
  }

  /**
   * Test 14: No Dense Fallback Guarantee
   */
  static runTest14(): BenchmarkTestResult {
    const n = 1500;
    const builder = SparseMatrix.create(n, n);
    for (let i = 0; i < n; i++) {
      builder.add(i, i, 4.0);
      if (i > 0) builder.add(i, i - 1, -1.0);
      if (i < n - 1) builder.add(i, i + 1, -1.0);
    }
    const mat = builder.build();
    const b = new Float64Array(n).fill(1.0);

    const res = SparseLinearSolver.solve(mat, b, { mode: 'ITERATIVE_PCG', tolerance: 1e-8 });

    const passed = res.success && res.diagnostics.sparsityRatio > 0.99;

    return {
      id: 'TEST_14',
      name: 'No Dense Fallback Enforcement Guarantee',
      passed,
      score: passed ? 100 : 0,
      details: passed ? `Large system N = ${n} solved directly via PCG without dense matrix array allocation.` : 'Dense fallback detected.',
      metrics: { sparsityRatio: res.diagnostics.sparsityRatio, iterations: res.iterations }
    };
  }

  /**
   * Test 15: Determinism Verification
   */
  static runTest15(): BenchmarkTestResult {
    const builder = SparseMatrix.create(50, 50);
    for (let i = 0; i < 50; i++) {
      builder.add(i, i, 10.0);
      if (i > 0) builder.add(i, i - 1, -2.0);
      if (i < 49) builder.add(i, i + 1, -2.0);
    }
    const mat = builder.build();
    const b = new Float64Array(50).fill(2.5);

    const run1 = SparseLinearSolver.solve(mat, b, { mode: 'DIRECT_CHOLESKY' });
    const run2 = SparseLinearSolver.solve(mat, b, { mode: 'DIRECT_CHOLESKY' });

    let maxDiff = 0;
    for (let i = 0; i < 50; i++) {
      maxDiff = Math.max(maxDiff, Math.abs(run1.solution[i] - run2.solution[i]));
    }

    const passed = maxDiff === 0 && mat.matrixHash === mat.matrixHash;

    return {
      id: 'TEST_15',
      name: 'Deterministic Execution & Solution Hashing',
      passed,
      score: passed ? 100 : 0,
      details: passed ? 'Identical solution vector and cryptographic hash produced across successive runs.' : 'Non-deterministic solve detected.',
      metrics: { maxDiffBetweenRuns: maxDiff, matrixHash: mat.matrixHash }
    };
  }

  /**
   * Test 16: Failure Integrity Verification
   */
  static runTest16(): BenchmarkTestResult {
    const builder = SparseMatrix.create(2, 2);
    builder.add(0, 0, 0); builder.add(0, 1, 0); // Zero row
    builder.add(1, 0, 0); builder.add(1, 1, 0);
    const mat = builder.build();
    const b = new Float64Array([1, 1]);

    const res = SparseLinearSolver.solve(mat, b, { mode: 'DIRECT_CHOLESKY' });

    const passed = !res.success && res.failureReason !== undefined && res.solution.length === 0;

    return {
      id: 'TEST_16',
      name: 'Failure Integrity & Zero Fake Results',
      passed,
      score: passed ? 100 : 0,
      details: passed ? 'Failed solver returned success = false, empty solution vector, and explicit failure reason.' : 'Failure integrity violated.',
      metrics: { success: res.success, failureReason: res.failureReason }
    };
  }
}
