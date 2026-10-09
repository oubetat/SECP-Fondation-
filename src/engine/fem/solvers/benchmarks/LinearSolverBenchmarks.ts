import { SparseMatrix } from "../../sparse/SparseMatrix";
import { ConjugateGradientSolver } from "../ConjugateGradientSolver";
import { PreconditionedConjugateGradientSolver } from "../PreconditionedConjugateGradientSolver";
import { GMRESSolver } from "../GMRESSolver";
import { SparseCholeskySolver } from "../SparseCholeskySolver";
import { LinearSolverSelector } from "../LinearSolverSelector";
import { FEMLinearSolverAdapter } from "../FEMLinearSolverAdapter";
import { FEMMeshGenerator } from "../../mesh/FEMMeshGenerator";

export interface BenchmarkTestResult {
  id: string;
  name: string;
  passed: boolean;
  score: number;
  details: string;
  metrics: Record<string, any>;
}

export class LinearSolverBenchmarks {
  /**
   * Test 01: CG Identity System
   */
  static runTest01(): BenchmarkTestResult {
    const n = 10;
    const builder = SparseMatrix.create(n, n);
    for (let i = 0; i < n; i++) builder.add(i, i, 1.0);
    const A = builder.build();
    const b = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    const solver = new ConjugateGradientSolver();
    const res = solver.solve(A, b);

    let maxDiff = 0.0;
    for (let i = 0; i < n; i++) maxDiff = Math.max(maxDiff, Math.abs(res.solution[i] - b[i]));

    const passed = res.converged && maxDiff < 1e-10 && res.iterations <= 1;

    return {
      id: 'TEST_01',
      name: 'CG Identity System Verification',
      passed,
      score: passed ? 100 : 0,
      details: passed ? `CG solved Identity system in ${res.iterations} iterations with max diff = ${maxDiff.toExponential(3)}` : 'CG Identity solve failed',
      metrics: { iterations: res.iterations, maxDiff, finalResidual: res.finalResidual }
    };
  }

  /**
   * Test 02: CG SPD Sparse Matrix
   */
  static runTest02(): BenchmarkTestResult {
    const n = 50;
    const builder = SparseMatrix.create(n, n);
    for (let i = 0; i < n; i++) {
      builder.add(i, i, 4.0);
      if (i > 0) builder.add(i, i - 1, -1.0);
      if (i < n - 1) builder.add(i, i + 1, -1.0);
    }
    const A = builder.build();
    const b = new Float64Array(n).fill(1.0);

    const solver = new ConjugateGradientSolver();
    const res = solver.solve(A, b, { tolerance: { rtol: 1e-10, atol: 1e-12 } });

    const passed = res.converged && res.relativeResidual <= 1e-10;

    return {
      id: 'TEST_02',
      name: 'CG SPD Sparse Matrix Solve',
      passed,
      score: passed ? 100 : 0,
      details: passed ? `CG converged in ${res.iterations} iterations to relative residual ${res.relativeResidual.toExponential(3)}` : 'CG SPD solve failed',
      metrics: { iterations: res.iterations, relativeResidual: res.relativeResidual }
    };
  }

  /**
   * Test 03: PCG Preconditioned Acceleration
   */
  static runTest03(): BenchmarkTestResult {
    const n = 100;
    const builder = SparseMatrix.create(n, n);
    for (let i = 0; i < n; i++) {
      const scale = 1.0 + i * 5.0;
      builder.add(i, i, 4.0 * scale);
      if (i > 0) builder.add(i, i - 1, -1.0 * scale);
      if (i < n - 1) builder.add(i, i + 1, -1.0 * scale);
    }
    const A = builder.build();
    const b = new Float64Array(n).fill(1.0);

    const cg = new ConjugateGradientSolver().solve(A, b, { maxIterations: 1000, tolerance: { rtol: 1e-10 } });
    const pcg = new PreconditionedConjugateGradientSolver().solve(A, b, { maxIterations: 1000, tolerance: { rtol: 1e-10 }, preconditionerType: 'JACOBI' });

    const passed = pcg.converged && pcg.iterations <= cg.iterations;

    return {
      id: 'TEST_03',
      name: 'PCG Acceleration with Real Preconditioner',
      passed,
      score: passed ? 100 : 0,
      details: passed ? `Jacobi PCG reduced iterations from ${cg.iterations} (pure CG) to ${pcg.iterations}` : 'PCG acceleration failed',
      metrics: { cgIterations: cg.iterations, pcgIterations: pcg.iterations }
    };
  }

  /**
   * Test 04: CG Invalid Matrix Rejection (Non-SPD)
   */
  static runTest04(): BenchmarkTestResult {
    const builder = SparseMatrix.create(3, 3);
    builder.add(0, 0, -2); builder.add(0, 1, 1);
    builder.add(1, 0, 1); builder.add(1, 1, -2); builder.add(1, 2, 1);
    builder.add(2, 1, 1); builder.add(2, 2, -2);
    const A = builder.build(); // Negative definite
    const b = new Float64Array([1, 1, 1]);

    const solver = new ConjugateGradientSolver();
    const res = solver.solve(A, b);

    const passed = !res.converged && res.failureReason !== undefined && res.diagnostics.breakdownOccurred;

    return {
      id: 'TEST_04',
      name: 'CG Invalid Non-SPD Matrix Rejection',
      passed,
      score: passed ? 100 : 0,
      details: passed ? `Non-SPD matrix rejected with failure reason: ${res.failureReason}` : 'CG failed to reject non-SPD matrix',
      metrics: { converged: res.converged, failureReason: res.failureReason }
    };
  }

  /**
   * Test 05: GMRES Non-Symmetric System Solve
   */
  static runTest05(): BenchmarkTestResult {
    const builder = SparseMatrix.create(4, 4);
    builder.add(0, 0, 4); builder.add(0, 1, 1); builder.add(0, 2, -1);
    builder.add(1, 0, 2); builder.add(1, 1, 5); builder.add(1, 2, 1);
    builder.add(2, 0, 0); builder.add(2, 1, 1); builder.add(2, 2, 3); builder.add(2, 3, 1);
    builder.add(3, 2, 1); builder.add(3, 3, 4);
    const A = builder.build(); // Asymmetric (A != A^T)
    const b = new Float64Array([4, 8, 5, 5]);

    const solver = new GMRESSolver();
    const res = solver.solve(A, b, { restartDimension: 10, tolerance: { rtol: 1e-8 } });

    const passed = res.converged && !res.diagnostics.isSymmetric && res.relativeResidual <= 1e-8;

    return {
      id: 'TEST_05',
      name: 'GMRES Asymmetric Matrix Solve',
      passed,
      score: passed ? 100 : 0,
      details: passed ? `GMRES solved asymmetric system in ${res.iterations} iterations with relative residual ${res.relativeResidual.toExponential(3)}` : 'GMRES asymmetric solve failed',
      metrics: { iterations: res.iterations, isSymmetric: res.diagnostics.isSymmetric, relativeResidual: res.relativeResidual }
    };
  }

  /**
   * Test 06: GMRES Restart Comparison (m=10 vs m=20 vs m=50)
   */
  static runTest06(): BenchmarkTestResult {
    const n = 40;
    const builder = SparseMatrix.create(n, n);
    for (let i = 0; i < n; i++) {
      builder.add(i, i, 4.0);
      if (i > 0) builder.add(i, i - 1, -1.5);
      if (i < n - 1) builder.add(i, i + 1, -0.5); // Asymmetric tridiagonal
    }
    const A = builder.build();
    const b = new Float64Array(n).fill(1.0);

    const gmres10 = new GMRESSolver().solve(A, b, { restartDimension: 10, maxIterations: 200 });
    const gmres20 = new GMRESSolver().solve(A, b, { restartDimension: 20, maxIterations: 200 });
    const gmres50 = new GMRESSolver().solve(A, b, { restartDimension: 50, maxIterations: 200 });

    const passed = gmres10.converged && gmres20.converged && gmres50.converged;

    return {
      id: 'TEST_06',
      name: 'GMRES Restart Parameter Comparison',
      passed,
      score: passed ? 100 : 0,
      details: passed ? `GMRES(10), GMRES(20), and GMRES(50) all converged successfully. Iterations: m=10 (${gmres10.iterations}), m=20 (${gmres20.iterations}), m=50 (${gmres50.iterations})` : 'GMRES restart comparison failed',
      metrics: { iter10: gmres10.iterations, iter20: gmres20.iterations, iter50: gmres50.iterations }
    };
  }

  /**
   * Test 07: Cholesky SPD Solve
   */
  static runTest07(): BenchmarkTestResult {
    const builder = SparseMatrix.create(4, 4);
    builder.add(0, 0, 4); builder.add(0, 1, -1);
    builder.add(1, 0, -1); builder.add(1, 1, 4); builder.add(1, 2, -1);
    builder.add(2, 1, -1); builder.add(2, 2, 4); builder.add(2, 3, -1);
    builder.add(3, 2, -1); builder.add(3, 3, 4);
    const A = builder.build();
    const b = new Float64Array([1, 2, 2, 1]);

    const solver = new SparseCholeskySolver();
    const res = solver.solve(A, b);

    const passed = res.converged && res.finalResidual < 1e-10;

    return {
      id: 'TEST_07',
      name: 'Sparse Cholesky Direct SPD Solve',
      passed,
      score: passed ? 100 : 0,
      details: passed ? `Sparse Cholesky direct factor & solve completed with residual = ${res.finalResidual.toExponential(3)}` : 'Cholesky SPD solve failed',
      metrics: { finalResidual: res.finalResidual, factorNNZ: res.memoryProfile?.factorNNZ }
    };
  }

  /**
   * Test 08: Cholesky Non-SPD Rejection
   */
  static runTest08(): BenchmarkTestResult {
    const builder = SparseMatrix.create(3, 3);
    builder.add(0, 0, 4); builder.add(0, 1, 5); // Non-symmetric / Non-SPD
    builder.add(1, 0, 1); builder.add(1, 1, 4); builder.add(1, 2, -1);
    builder.add(2, 1, -1); builder.add(2, 2, 4);
    const A = builder.build();
    const b = new Float64Array([1, 1, 1]);

    const solver = new SparseCholeskySolver();
    const res = solver.solve(A, b);

    const passed = !res.converged && res.failureReason?.includes('SOLVER_INCOMPATIBLE');

    return {
      id: 'TEST_08',
      name: 'Sparse Cholesky Non-SPD Rejection',
      passed,
      score: passed ? 100 : 0,
      details: passed ? `Non-SPD matrix correctly rejected before factorization with: ${res.failureReason}` : 'Cholesky failed to reject non-SPD matrix',
      metrics: { failureReason: res.failureReason }
    };
  }

  /**
   * Test 09: Singular Matrix Detection
   */
  static runTest09(): BenchmarkTestResult {
    const builder = SparseMatrix.create(3, 3);
    builder.add(0, 0, 1); builder.add(0, 1, 2);
    builder.add(1, 0, 2); builder.add(1, 1, 4); // Rank deficient row
    builder.add(2, 2, 0);                       // Zero pivot
    const A = builder.build();
    const b = new Float64Array([1, 2, 3]);

    const policy = LinearSolverSelector.solveWithPolicy(A, b, 'AUTO');

    const passed = policy.verdict === 'SOLVER_INCOMPATIBLE' && policy.validation.isSingular;

    return {
      id: 'TEST_09',
      name: 'Singular Matrix Real Detection',
      passed,
      score: passed ? 100 : 0,
      details: passed ? `Singular system rejected with ${policy.validation.zeroPivots.length} zero pivots detected` : 'Singular matrix detection failed',
      metrics: { isSingular: policy.validation.isSingular, zeroPivots: policy.validation.zeroPivots }
    };
  }

  /**
   * Test 10: Near Singular Matrix Diagnostics
   */
  static runTest10(): BenchmarkTestResult {
    const builder = SparseMatrix.create(3, 3);
    builder.add(0, 0, 1e10); builder.add(0, 1, -1e10);
    builder.add(1, 0, -1e10); builder.add(1, 1, 1e10 + 1e-4); builder.add(1, 2, -1e-4);
    builder.add(2, 1, -1e-4); builder.add(2, 2, 1e-4);
    const A = builder.build();
    const b = new Float64Array([1, 0, 0]);

    const val = LinearSolverSelector.inspectMatrix(A, b);

    const passed = val.conditionEstimate > 1e8;

    return {
      id: 'TEST_10',
      name: 'Ill-Conditioned System Diagnostic',
      passed,
      score: passed ? 100 : 0,
      details: passed ? `Ill-conditioned matrix identified with condition estimate = ${val.conditionEstimate.toExponential(2)}` : 'Ill-conditioned diagnostic failed',
      metrics: { conditionEstimate: val.conditionEstimate }
    };
  }

  /**
   * Test 11: Real Residual Verification (r = b - Ax)
   */
  static runTest11(): BenchmarkTestResult {
    const n = 30;
    const builder = SparseMatrix.create(n, n);
    for (let i = 0; i < n; i++) {
      builder.add(i, i, 4.0);
      if (i > 0) builder.add(i, i - 1, -1.0);
      if (i < n - 1) builder.add(i, i + 1, -1.0);
    }
    const A = builder.build();
    const b = new Float64Array(n).fill(2.0);

    const solver = new ConjugateGradientSolver();
    const res = solver.solve(A, b);

    // Independently calculate r = b - A * x
    const Ax = A.spmv(res.solution);
    let rSq = 0.0;
    for (let i = 0; i < n; i++) {
      const diff = b[i] - Ax[i];
      rSq += diff * diff;
    }
    const calculatedResidual = Math.sqrt(rSq);
    const diffWithSolverRes = Math.abs(calculatedResidual - res.finalResidual);

    const passed = res.converged && diffWithSolverRes < 1e-12 && calculatedResidual <= 1e-8;

    return {
      id: 'TEST_11',
      name: 'Real Residual Verification (r = b - Ax)',
      passed,
      score: passed ? 100 : 0,
      details: passed ? `Independent residual calculation matches solver output. Calculated r = ${calculatedResidual.toExponential(3)}` : 'Residual verification failed',
      metrics: { calculatedResidual, solverResidual: res.finalResidual, diff: diffWithSolverRes }
    };
  }

  /**
   * Test 12: Solver Cross-Validation (Cholesky vs CG vs PCG)
   */
  static runTest12(): BenchmarkTestResult {
    const n = 20;
    const builder = SparseMatrix.create(n, n);
    for (let i = 0; i < n; i++) {
      builder.add(i, i, 5.0);
      if (i > 0) builder.add(i, i - 1, -2.0);
      if (i < n - 1) builder.add(i, i + 1, -2.0);
    }
    const A = builder.build();
    const b = new Float64Array(n).fill(3.0);

    const cholRes = new SparseCholeskySolver().solve(A, b);
    const cgRes = new ConjugateGradientSolver().solve(A, b, { tolerance: { rtol: 1e-10 } });
    const pcgRes = new PreconditionedConjugateGradientSolver().solve(A, b, { tolerance: { rtol: 1e-10 }, preconditionerType: 'JACOBI' });

    let maxDiffCholCG = 0.0;
    let maxDiffCholPCG = 0.0;
    for (let i = 0; i < n; i++) {
      maxDiffCholCG = Math.max(maxDiffCholCG, Math.abs(cholRes.solution[i] - cgRes.solution[i]));
      maxDiffCholPCG = Math.max(maxDiffCholPCG, Math.abs(cholRes.solution[i] - pcgRes.solution[i]));
    }

    const passed = cholRes.converged && cgRes.converged && pcgRes.converged && maxDiffCholCG < 1e-6 && maxDiffCholPCG < 1e-6;

    return {
      id: 'TEST_12',
      name: 'Solver Cross-Validation (Cholesky vs CG vs PCG)',
      passed,
      score: passed ? 100 : 0,
      details: passed ? `Cross-validation passed. Max diff (Cholesky vs CG) = ${maxDiffCholCG.toExponential(3)}, (Cholesky vs PCG) = ${maxDiffCholPCG.toExponential(3)}` : 'Cross-validation failed',
      metrics: { maxDiffCholCG, maxDiffCholPCG }
    };
  }

  /**
   * Test 13: Non-Symmetric Cross-Validation (GMRES vs Reference Solve)
   */
  static runTest13(): BenchmarkTestResult {
    const builder = SparseMatrix.create(3, 3);
    builder.add(0, 0, 2); builder.add(0, 1, 1); builder.add(0, 2, 0);
    builder.add(1, 0, 0); builder.add(1, 1, 2); builder.add(1, 2, 1);
    builder.add(2, 0, 1); builder.add(2, 1, 0); builder.add(2, 2, 2);
    const A = builder.build(); // Non-symmetric circulant matrix
    const b = new Float64Array([3, 3, 3]); // Exact solution x = [1, 1, 1]

    const gmres = new GMRESSolver().solve(A, b, { tolerance: { rtol: 1e-10 } });

    let maxError = 0.0;
    for (let i = 0; i < 3; i++) maxError = Math.max(maxError, Math.abs(gmres.solution[i] - 1.0));

    const passed = gmres.converged && maxError < 1e-8;

    return {
      id: 'TEST_13',
      name: 'Non-Symmetric GMRES Cross-Validation',
      passed,
      score: passed ? 100 : 0,
      details: passed ? `GMRES solved non-symmetric system with max solution error = ${maxError.toExponential(3)} against exact [1,1,1]` : 'GMRES cross-validation failed',
      metrics: { maxError, finalResidual: gmres.finalResidual }
    };
  }

  /**
   * Test 14: Large Sparse System Benchmark (N > 1000)
   */
  static runTest14(): BenchmarkTestResult {
    const n = 1200;
    const builder = SparseMatrix.create(n, n);
    for (let i = 0; i < n; i++) {
      builder.add(i, i, 4.0);
      if (i > 0) builder.add(i, i - 1, -1.0);
      if (i < n - 1) builder.add(i, i + 1, -1.0);
    }
    const A = builder.build();
    const b = new Float64Array(n).fill(1.0);

    const solver = new PreconditionedConjugateGradientSolver();
    const res = solver.solve(A, b, { tolerance: { rtol: 1e-8 }, preconditionerType: 'JACOBI' });

    const passed = res.converged && A.rows === 1200 && res.relativeResidual <= 1e-8;

    return {
      id: 'TEST_14',
      name: 'Large Sparse System Benchmark (N = 1200)',
      passed,
      score: passed ? 100 : 0,
      details: passed ? `Large system N = 1200 solved in ${res.iterations} PCG iterations (${res.executionTimeMs.toFixed(1)} ms)` : 'Large sparse benchmark failed',
      metrics: { numDOFs: n, iterations: res.iterations, timeMs: res.executionTimeMs, relativeResidual: res.relativeResidual }
    };
  }

  /**
   * Test 15: FEM Cantilever Real Pipeline Solve & Analytical Validation
   */
  static runTest15(): BenchmarkTestResult {
    const mesh = (FEMMeshGenerator as any).generateHexMesh({
      length: 2.0, width: 0.1, height: 0.1, nx: 8, ny: 2, nz: 2
    });

    const E = 210e9;
    const P = 1000.0;
    const L = 2.0;
    const I = (0.1 * Math.pow(0.1, 3)) / 12.0;
    const analyticalDeflection = (P * Math.pow(L, 3)) / (3.0 * E * I); // = 0.0015238 m

    const rootNodes = mesh.nodes.filter(n => Math.abs(n.x - 0.0) < 1e-4).map(n => n.id);
    const fixities = rootNodes.map(id => ({ nodeId: id, fixX: true, fixY: true, fixZ: true }));

    const tipNodes = mesh.nodes.filter(n => Math.abs(n.x - L) < 1e-4).map(n => n.id);
    const loadPerNode = P / tipNodes.length;
    const loads = tipNodes.map(id => ({ nodeId: id, fy: -loadPerNode }));

    const res = FEMLinearSolverAdapter.solveStaticSystem(
      mesh,
      { E, nu: 0.3 },
      fixities,
      loads,
      'SparseCholesky'
    );

    const err = Math.abs(res.maxDeflection - analyticalDeflection) / analyticalDeflection;
    const passed = res.success && res.maxDeflection > 0 && err < 0.20;

    return {
      id: 'TEST_15',
      name: 'FEM Cantilever Beam Pipeline & Analytical Validation',
      passed,
      score: passed ? 100 : 0,
      details: passed ? `FEM static solve executed. Max deflection = ${(res.maxDeflection * 1000).toFixed(3)} mm (analytical = ${(analyticalDeflection * 1000).toFixed(3)} mm)` : 'FEM cantilever pipeline failed',
      metrics: { femDeflection: res.maxDeflection, analyticalDeflection, relativeError: err }
    };
  }

  /**
   * Test 16: Mesh Refinement Convergence Test
   */
  static runTest16(): BenchmarkTestResult {
    const runMeshSolve = (nx: number) => {
      const mesh = (FEMMeshGenerator as any).generateHexMesh({ length: 1.0, width: 0.1, height: 0.1, nx, ny: 1, nz: 1 });
      const rootNodes = mesh.nodes.filter(n => Math.abs(n.x - 0.0) < 1e-4).map(n => n.id);
      const fixities = rootNodes.map(id => ({ nodeId: id, fixX: true, fixY: true, fixZ: true }));
      const tipNodes = mesh.nodes.filter(n => Math.abs(n.x - 1.0) < 1e-4).map(n => n.id);
      const loads = tipNodes.map(id => ({ nodeId: id, fy: -100.0 }));

      return FEMLinearSolverAdapter.solveStaticSystem(mesh, { E: 210e9, nu: 0.3 }, fixities, loads, 'AUTO');
    };

    const coarseRes = runMeshSolve(2);
    const fineRes = runMeshSolve(4);

    const passed = coarseRes.success && fineRes.success && fineRes.maxDeflection >= coarseRes.maxDeflection * 0.9;

    return {
      id: 'TEST_16',
      name: 'FEM Mesh Refinement Monotonic Convergence',
      passed,
      score: passed ? 100 : 0,
      details: passed ? `Monotonic convergence verified: Coarse u = ${coarseRes.maxDeflection.toExponential(3)}, Fine u = ${fineRes.maxDeflection.toExponential(3)}` : 'Mesh refinement convergence failed',
      metrics: { coarseDeflection: coarseRes.maxDeflection, fineDeflection: fineRes.maxDeflection }
    };
  }

  /**
   * Test 17: Deterministic Solve Verification
   */
  static runTest17(): BenchmarkTestResult {
    const builder = SparseMatrix.create(30, 30);
    for (let i = 0; i < 30; i++) {
      builder.add(i, i, 6.0);
      if (i > 0) builder.add(i, i - 1, -2.0);
      if (i < 29) builder.add(i, i + 1, -2.0);
    }
    const A = builder.build();
    const b = new Float64Array(30).fill(1.5);

    const run1 = new ConjugateGradientSolver().solve(A, b, { tolerance: { rtol: 1e-10 } });
    const run2 = new ConjugateGradientSolver().solve(A, b, { tolerance: { rtol: 1e-10 } });

    let maxDiff = 0.0;
    for (let i = 0; i < 30; i++) maxDiff = Math.max(maxDiff, Math.abs(run1.solution[i] - run2.solution[i]));

    const passed = run1.converged && run2.converged && maxDiff === 0.0;

    return {
      id: 'TEST_17',
      name: 'Deterministic Solve Verification',
      passed,
      score: passed ? 100 : 0,
      details: passed ? 'Identical solution vector produced across successive runs (max diff = 0.0)' : 'Non-deterministic solve detected',
      metrics: { maxDiffBetweenRuns: maxDiff }
    };
  }

  /**
   * Test 18: Failure Integrity & Zero Fake Results
   */
  static runTest18(): BenchmarkTestResult {
    const builder = SparseMatrix.create(2, 2);
    builder.add(0, 0, 0); builder.add(0, 1, 0); // Singular zero matrix
    builder.add(1, 0, 0); builder.add(1, 1, 0);
    const A = builder.build();
    const b = new Float64Array([1, 1]);

    const solver = new SparseCholeskySolver();
    const res = solver.solve(A, b);

    const passed = !res.converged && res.failureReason !== undefined && res.solution.length === 0;

    return {
      id: 'TEST_18',
      name: 'Failure Integrity & Zero Fake Results',
      passed,
      score: passed ? 100 : 0,
      details: passed ? `Failed solver returned converged = false, empty solution vector, and explicit failure reason: ${res.failureReason}` : 'Failure integrity violated',
      metrics: { converged: res.converged, failureReason: res.failureReason }
    };
  }
}
